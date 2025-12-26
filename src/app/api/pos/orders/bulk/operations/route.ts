import { NextRequest, NextResponse } from 'next/server'
import { PrismaClient } from '@prisma/client'
import { auth } from '@clerk/nextjs/server'
import { AuditLogger } from '@/lib/security/audit-logger'
import { OrderErrorHandler } from '@/lib/order-management-errors'
import { BulkOperationsManager } from '@/lib/order-management'

const prisma = new PrismaClient()

// POST /api/pos/orders/bulk/operations - Perform bulk operations on multiple orders
export async function POST(request: NextRequest) {
  try {
    const { userId } = await auth()
    if (!userId) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const body = await request.json()
    const { 
      operation,
      orderIds,
      parameters = {},
      userName,
      userEmail
    } = body

    // Validate required fields
    if (!operation) {
      return NextResponse.json({ error: 'Operation type is required' }, { status: 400 })
    }

    if (!orderIds || !Array.isArray(orderIds) || orderIds.length === 0) {
      return NextResponse.json({ error: 'Order IDs array is required' }, { status: 400 })
    }

    if (orderIds.length > 50) {
      return NextResponse.json({ error: 'Cannot process more than 50 orders at once' }, { status: 400 })
    }

    const { searchParams } = new URL(request.url)
    const storeId = searchParams.get('storeId')
    if (!storeId) {
      return NextResponse.json({ error: 'Store ID is required' }, { status: 400 })
    }

    // Validate operation type
    const validOperations = ['cancel', 'retrieve', 'merge', 'export', 'update_priority', 'assign_customer']
    if (!validOperations.includes(operation)) {
      return NextResponse.json({ 
        error: `Invalid operation. Must be one of: ${validOperations.join(', ')}` 
      }, { status: 400 })
    }

    // Verify all orders exist and belong to the store
    const orders = await prisma.heldOrder.findMany({
      where: {
        id: { in: orderIds },
        storeId
      },
      select: {
        id: true,
        orderNumber: true,
        status: true,
        customerId: true,
        employeeId: true
      }
    })

    if (orders.length !== orderIds.length) {
      const foundIds = orders.map(o => o.id)
      const missingIds = orderIds.filter(id => !foundIds.includes(id))
      return NextResponse.json({ 
        error: 'Some orders not found', 
        missingIds 
      }, { status: 404 })
    }

    // Validate orders based on operation
    const validationErrors = []
    for (const order of orders) {
      switch (operation) {
        case 'retrieve':
          if (order.status !== 'held') {
            validationErrors.push(`Order ${order.orderNumber} is not in 'held' status`)
          }
          break
        case 'cancel':
          if (order.status === 'retrieved') {
            validationErrors.push(`Order ${order.orderNumber} has already been retrieved`)
          }
          break
      }
    }

    if (validationErrors.length > 0) {
      return NextResponse.json({ 
        error: 'Validation failed',
        details: validationErrors
      }, { status: 400 })
    }

    // Perform the bulk operation
    const results = await performBulkOperation(operation, orderIds, parameters, storeId, userId)

    // Log the bulk operation
    await AuditLogger.log({
      timestamp: new Date(),
      userId,
      userEmail: userEmail || undefined,
      action: `bulk_${operation}`,
      resource: 'held_order',
      method: 'POST',
      path: request.url,
      status: results.success ? 'success' : 'failure',
      severity: results.success ? 'medium' : 'high',
      details: {
        operation,
        orderIds,
        totalOrders: orderIds.length,
        successCount: results.successCount,
        failureCount: results.failureCount,
        errors: results.errors,
        parameters
      }
    })

    return NextResponse.json({
      success: results.success,
      operation,
      summary: {
        totalOrders: orderIds.length,
        successCount: results.successCount,
        failureCount: results.failureCount
      },
      results: results.details,
      errors: results.errors.length > 0 ? results.errors : undefined,
      message: results.success 
        ? `Successfully processed ${results.successCount} of ${orderIds.length} orders`
        : `Failed to process ${results.failureCount} orders`
    })

  } catch (error) {
    console.error('Error performing bulk operation:', error)
    
    const errorContext = {
      operation: 'BULK_OPERATION',
      timestamp: new Date()
    }

    const orderError = OrderErrorHandler.createError(
      'SYSTEM_ERROR' as any,
      'Failed to perform bulk operation',
      errorContext,
      { severity: 'high' }
    )

    await AuditLogger.log({
      timestamp: new Date(),
      action: 'bulk_operation_failed',
      resource: 'held_order',
      method: 'POST',
      path: request.url,
      status: 'failure',
      severity: 'high',
      details: { error: error instanceof Error ? error.message : 'Unknown error' }
    })

    return NextResponse.json(
      { 
        error: 'Failed to perform bulk operation',
        errorId: orderError.id
      },
      { status: 500 }
    )
  }
}

// GET /api/pos/orders/bulk/operations - Get bulk operation history
export async function GET(request: NextRequest) {
  try {
    const { userId } = await auth()
    if (!userId) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const { searchParams } = new URL(request.url)
    const storeId = searchParams.get('storeId')
    const limit = parseInt(searchParams.get('limit') || '20')
    const offset = parseInt(searchParams.get('offset') || '0')
    const operation = searchParams.get('operation')
    const startDate = searchParams.get('startDate')
    const endDate = searchParams.get('endDate')

    if (!storeId) {
      return NextResponse.json({ error: 'Store ID is required' }, { status: 400 })
    }

    // Build where clause for audit logs (simulating bulk operation history)
    const whereClause: any = {
      action: { startsWith: 'bulk_' },
      path: { contains: '/bulk/operations' }
    }

    if (operation) {
      whereClause.action = `bulk_${operation}`
    }

    if (startDate || endDate) {
      whereClause.timestamp = {}
      if (startDate) whereClause.timestamp.gte = new Date(startDate)
      if (endDate) whereClause.timestamp.lte = new Date(endDate)
    }

    // Get bulk operation history from audit logs
    const bulkOperations = await prisma.auditLog.findMany({
      where: whereClause,
      select: {
        id: true,
        timestamp: true,
        userId: true,
        userEmail: true,
        action: true,
        details: true,
        severity: true,
        status: true
      },
      orderBy: { timestamp: 'desc' },
      take: limit,
      skip: offset
    })

    // Parse details for each operation
    const operationsWithDetails = bulkOperations.map(op => ({
      ...op,
      details: op.details ? JSON.parse(op.details) : {}
    }))

    // Get total count
    const totalCount = await prisma.auditLog.count({ where: whereClause })

    return NextResponse.json({
      operations: operationsWithDetails,
      pagination: {
        total: totalCount,
        limit,
        offset,
        hasMore: offset + limit < totalCount
      }
    })

  } catch (error) {
    console.error('Error fetching bulk operation history:', error)
    return NextResponse.json(
      { error: 'Failed to fetch bulk operation history' },
      { status: 500 }
    )
  }
}

// Helper function to perform bulk operations
async function performBulkOperation(
  operation: string,
  orderIds: string[],
  parameters: any,
  storeId: string,
  userId: string
): Promise<{
  success: boolean
  successCount: number
  failureCount: number
  details: any[]
  errors: string[]
}> {
  const results = {
    success: true,
    successCount: 0,
    failureCount: 0,
    details: [] as any[],
    errors: [] as string[]
  }

  for (const orderId of orderIds) {
    try {
      let result: any = {}

      switch (operation) {
        case 'cancel':
          result = await cancelOrder(orderId, userId)
          break
        case 'retrieve':
          result = await retrieveOrder(orderId, userId)
          break
        case 'merge':
          result = await mergeOrder(orderId, parameters.targetOrderId, userId)
          break
        case 'export':
          result = await exportOrder(orderId, parameters.format)
          break
        case 'update_priority':
          result = await updateOrderPriority(orderId, parameters.priority, userId)
          break
        case 'assign_customer':
          result = await assignCustomer(orderId, parameters.customerId, userId)
          break
        default:
          throw new Error(`Unknown operation: ${operation}`)
      }

      if (result.success) {
        results.successCount++
        results.details.push({
          orderId,
          success: true,
          data: result.data
        })
      } else {
        results.failureCount++
        results.errors.push(`${orderId}: ${result.error}`)
        results.details.push({
          orderId,
          success: false,
          error: result.error
        })
      }

    } catch (error) {
      results.failureCount++
      const errorMessage = error instanceof Error ? error.message : 'Unknown error'
      results.errors.push(`${orderId}: ${errorMessage}`)
      results.details.push({
        orderId,
        success: false,
        error: errorMessage
      })
    }
  }

  results.success = results.failureCount === 0
  return results
}

// Individual operation implementations
async function cancelOrder(orderId: string, userId: string) {
  try {
    const order = await prisma.heldOrder.update({
      where: { id: orderId },
      data: {
        status: 'cancelled',
        updatedAt: new Date()
      }
    })

    return {
      success: true,
      data: { orderNumber: order.orderNumber, status: order.status }
    }
  } catch (error) {
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Failed to cancel order'
    }
  }
}

async function retrieveOrder(orderId: string, userId: string) {
  try {
    const order = await prisma.heldOrder.update({
      where: { id: orderId },
      data: {
        status: 'retrieved',
        retrievedAt: new Date(),
        updatedAt: new Date()
      }
    })

    return {
      success: true,
      data: { orderNumber: order.orderNumber, status: order.status }
    }
  } catch (error) {
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Failed to retrieve order'
    }
  }
}

async function mergeOrder(sourceOrderId: string, targetOrderId: string, userId: string) {
  try {
    if (!targetOrderId) {
      throw new Error('Target order ID is required for merge operation')
    }

    // Get both orders
    const [sourceOrder, targetOrder] = await Promise.all([
      prisma.heldOrder.findUnique({ where: { id: sourceOrderId } }),
      prisma.heldOrder.findUnique({ where: { id: targetOrderId } })
    ])

    if (!sourceOrder || !targetOrder) {
      throw new Error('One or both orders not found')
    }

    // Parse items from both orders
    const sourceItems = JSON.parse(sourceOrder.itemsData || '[]')
    const targetItems = JSON.parse(targetOrder.itemsData || '[]')

    // Merge items (simple concatenation - in real app might need to handle duplicates)
    const mergedItems = [...targetItems, ...sourceItems]

    // Update target order with merged data
    const updatedTargetOrder = await prisma.heldOrder.update({
      where: { id: targetOrderId },
      data: {
        itemsData: JSON.stringify(mergedItems),
        subtotal: targetOrder.subtotal + sourceOrder.subtotal,
        total: targetOrder.total + sourceOrder.total,
        updatedAt: new Date()
      }
    })

    // Mark source order as cancelled/merged
    await prisma.heldOrder.update({
      where: { id: sourceOrderId },
      data: {
        status: 'cancelled',
        updatedAt: new Date(),
        metadata: JSON.stringify({ 
          mergedInto: targetOrderId,
          mergedAt: new Date()
        })
      }
    })

    return {
      success: true,
      data: { 
        sourceOrderNumber: sourceOrder.orderNumber,
        targetOrderNumber: targetOrder.orderNumber,
        mergedItemsCount: mergedItems.length
      }
    }
  } catch (error) {
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Failed to merge orders'
    }
  }
}

async function exportOrder(orderId: string, format: string = 'json') {
  try {
    const order = await prisma.heldOrder.findUnique({
      where: { id: orderId },
      include: {
        customer: {
          select: { id: true, name: true, phone: true, email: true }
        },
        employee: {
          select: { id: true, name: true }
        }
      }
    })

    if (!order) {
      throw new Error('Order not found')
    }

    const items = JSON.parse(order.itemsData || '[]')

    const exportData = {
      orderNumber: order.orderNumber,
      customer: order.customer,
      employee: order.employee,
      tableNumber: order.tableNumber,
      items,
      subtotal: order.subtotal,
      gst: order.gst,
      discount: order.discount,
      total: order.total,
      status: order.status,
      createdAt: order.createdAt,
      exportedAt: new Date()
    }

    // In a real implementation, format the export data according to the requested format
    return {
      success: true,
      data: { format, data: exportData }
    }
  } catch (error) {
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Failed to export order'
    }
  }
}

async function updateOrderPriority(orderId: string, priority: number, userId: string) {
  try {
    const order = await prisma.heldOrder.update({
      where: { id: orderId },
      data: {
        priority,
        updatedAt: new Date()
      }
    })

    return {
      success: true,
      data: { orderNumber: order.orderNumber, priority: order.priority }
    }
  } catch (error) {
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Failed to update priority'
    }
  }
}

async function assignCustomer(orderId: string, customerId: string, userId: string) {
  try {
    const order = await prisma.heldOrder.update({
      where: { id: orderId },
      data: {
        customerId,
        updatedAt: new Date()
      }
    })

    return {
      success: true,
      data: { orderNumber: order.orderNumber, customerId: order.customerId }
    }
  } catch (error) {
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Failed to assign customer'
    }
  }
}