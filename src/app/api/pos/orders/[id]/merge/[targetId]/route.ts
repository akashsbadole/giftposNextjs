import { NextRequest, NextResponse } from 'next/server'
import { PrismaClient } from '@prisma/client'
import { auth } from '@clerk/nextjs/server'
import { AuditLogger } from '@/lib/security/audit-logger'
import { OrderErrorHandler } from '@/lib/order-management-errors'

const prisma = new PrismaClient()

interface RouteParams {
  params: {
    id: string
    targetId: string
  }
}

// POST /api/pos/orders/[id]/merge/[targetId] - Merge two held orders
export async function POST(
  request: NextRequest,
  { params }: RouteParams
) {
  try {
    const { userId } = await auth()
    if (!userId) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const body = await request.json()
    const { 
      mergeStrategy = 'append', // 'append', 'replace', 'combine_totals'
      userName,
      userEmail,
      metadata = {}
    } = body

    const { searchParams } = new URL(request.url)
    const storeId = searchParams.get('storeId')
    if (!storeId) {
      return NextResponse.json({ error: 'Store ID is required' }, { status: 400 })
    }

    // Validate merge strategy
    const validStrategies = ['append', 'replace', 'combine_totals']
    if (!validStrategies.includes(mergeStrategy)) {
      return NextResponse.json({ 
        error: `Invalid merge strategy. Must be one of: ${validStrategies.join(', ')}` 
      }, { status: 400 })
    }

    const sourceOrderId = params.id
    const targetOrderId = params.targetId

    // Prevent merging an order with itself
    if (sourceOrderId === targetOrderId) {
      return NextResponse.json({ 
        error: 'Cannot merge an order with itself' 
      }, { status: 400 })
    }

    // Get both orders
    const [sourceOrder, targetOrder] = await Promise.all([
      prisma.heldOrder.findFirst({
        where: { id: sourceOrderId, storeId },
        include: {
          customer: { select: { id: true, name: true } },
          employee: { select: { id: true, name: true } }
        }
      }),
      prisma.heldOrder.findFirst({
        where: { id: targetOrderId, storeId },
        include: {
          customer: { select: { id: true, name: true } },
          employee: { select: { id: true, name: true } }
        }
      })
    ])

    if (!sourceOrder) {
      return NextResponse.json({ error: 'Source order not found' }, { status: 404 })
    }

    if (!targetOrder) {
      return NextResponse.json({ error: 'Target order not found' }, { status: 404 })
    }

    // Validate orders can be merged
    if (sourceOrder.status === 'cancelled') {
      return NextResponse.json({ 
        error: 'Source order is cancelled and cannot be merged' 
      }, { status: 400 })
    }

    if (targetOrder.status === 'cancelled') {
      return NextResponse.json({ 
        error: 'Target order is cancelled and cannot be merged into' 
      }, { status: 400 })
    }

    // Check for locks
    const [sourceLock, targetLock] = await Promise.all([
      prisma.orderLock.findFirst({
        where: { heldOrderId: sourceOrderId, isActive: true }
      }),
      prisma.orderLock.findFirst({
        where: { heldOrderId: targetOrderId, isActive: true }
      })
    ])

    // If either order is locked by another user, prevent merge
    if (sourceLock && sourceLock.userId !== userId) {
      return NextResponse.json({
        error: 'Source order is locked by another user',
        lockOwner: {
          userId: sourceLock.userId,
          userName: sourceLock.userName
        }
      }, { status: 423 })
    }

    if (targetLock && targetLock.userId !== userId) {
      return NextResponse.json({
        error: 'Target order is locked by another user',
        lockOwner: {
          userId: targetLock.userId,
          userName: targetLock.userName
        }
      }, { status: 423 })
    }

    // Parse items from both orders
    let sourceItems: any[] = []
    let targetItems: any[] = []

    try {
      sourceItems = JSON.parse(sourceOrder.itemsData || '[]')
      targetItems = JSON.parse(targetOrder.itemsData || '[]')
    } catch (error) {
      return NextResponse.json({ 
        error: 'Error parsing order items data' 
      }, { status: 400 })
    }

    // Perform merge based on strategy
    let mergedItems: any[] = []
    let mergedTotals = {
      subtotal: targetOrder.subtotal,
      gst: targetOrder.gst,
      discount: targetOrder.discount,
      total: targetOrder.total
    }

    switch (mergeStrategy) {
      case 'append':
        // Simply append source items to target items
        mergedItems = [...targetItems, ...sourceItems]
        mergedTotals = {
          subtotal: targetOrder.subtotal + sourceOrder.subtotal,
          gst: targetOrder.gst + sourceOrder.gst,
          discount: targetOrder.discount + sourceOrder.discount,
          total: targetOrder.total + sourceOrder.total
        }
        break

      case 'replace':
        // Replace target items with source items, keep target customer/employee info
        mergedItems = [...sourceItems]
        mergedTotals = {
          subtotal: sourceOrder.subtotal,
          gst: sourceOrder.gst,
          discount: sourceOrder.discount,
          total: sourceOrder.total
        }
        break

      case 'combine_totals':
        // Combine totals but keep original items
        mergedItems = [...targetItems]
        mergedTotals = {
          subtotal: targetOrder.subtotal + sourceOrder.subtotal,
          gst: targetOrder.gst + sourceOrder.gst,
          discount: Math.max(targetOrder.discount, sourceOrder.discount), // Take higher discount
          total: targetOrder.total + sourceOrder.total
        }
        break
    }

    // Create merge metadata
    const mergeMetadata = {
      sourceOrderId,
      targetOrderId,
      sourceOrderNumber: sourceOrder.orderNumber,
      targetOrderNumber: targetOrder.orderNumber,
      mergeStrategy,
      mergedAt: new Date().toISOString(),
      mergedBy: userId,
      itemsMerged: sourceItems.length,
      ...metadata
    }

    // Update target order with merged data
    const updatedTargetOrder = await prisma.heldOrder.update({
      where: { id: targetOrderId },
      data: {
        itemsData: JSON.stringify(mergedItems),
        subtotal: mergedTotals.subtotal,
        gst: mergedTotals.gst,
        discount: mergedTotals.discount,
        total: mergedTotals.total,
        notes: [
          targetOrder.notes,
          `Merged with order ${sourceOrder.orderNumber} on ${new Date().toLocaleString()}`,
          `Merge strategy: ${mergeStrategy}`
        ].filter(Boolean).join('\n\n'),
        metadata: JSON.stringify({
          ...(targetOrder.metadata ? JSON.parse(targetOrder.metadata) : {}),
          mergeHistory: [
            ...(targetOrder.metadata ? JSON.parse(targetOrder.metadata).mergeHistory || [] : []),
            mergeMetadata
          ]
        }),
        updatedAt: new Date()
      }
    })

    // Mark source order as cancelled and add merge info
    await prisma.heldOrder.update({
      where: { id: sourceOrderId },
      data: {
        status: 'cancelled',
        metadata: JSON.stringify({
          ...(sourceOrder.metadata ? JSON.parse(sourceOrder.metadata) : {}),
          mergedInto: targetOrderId,
          mergedAt: new Date().toISOString(),
          mergeStrategy,
          mergeReason: 'User initiated merge'
        }),
        updatedAt: new Date()
      }
    })

    // Release locks on both orders
    await Promise.all([
      sourceLock && prisma.orderLock.update({
        where: { id: sourceLock.id },
        data: { isActive: false }
      }),
      targetLock && prisma.orderLock.update({
        where: { id: targetLock.id },
        data: { isActive: false }
      })
    ])

    // Broadcast merge event to collaborators
    await broadcastMergeEvent(sourceOrderId, targetOrderId, {
      type: 'orders_merged',
      sourceOrderNumber: sourceOrder.orderNumber,
      targetOrderNumber: targetOrder.orderNumber,
      mergeStrategy,
      mergedBy: userId,
      userName: userName || 'Unknown User'
    })

    // Log the merge operation
    await AuditLogger.log({
      timestamp: new Date(),
      userId,
      userEmail: userEmail || undefined,
      action: 'orders_merged',
      resource: 'held_order',
      resourceId: targetOrderId,
      method: 'POST',
      path: request.url,
      status: 'success',
      severity: 'medium',
      details: {
        sourceOrderId,
        targetOrderId,
        sourceOrderNumber: sourceOrder.orderNumber,
        targetOrderNumber: targetOrder.orderNumber,
        mergeStrategy,
        itemsMerged: sourceItems.length,
        finalItemCount: mergedItems.length,
        finalTotal: mergedTotals.total,
        metadata: mergeMetadata
      }
    })

    return NextResponse.json({
      success: true,
      message: 'Orders merged successfully',
      result: {
        sourceOrder: {
          id: sourceOrderId,
          orderNumber: sourceOrder.orderNumber,
          status: 'cancelled',
          itemsCount: sourceItems.length,
          total: sourceOrder.total
        },
        targetOrder: {
          id: targetOrderId,
          orderNumber: targetOrder.orderNumber,
          status: updatedTargetOrder.status,
          itemsCount: mergedItems.length,
          total: mergedTotals.total,
          subtotal: mergedTotals.subtotal,
          gst: mergedTotals.gst,
          discount: mergedTotals.discount
        },
        mergeDetails: {
          strategy: mergeStrategy,
          itemsMerged: sourceItems.length,
          totalValueMerged: sourceOrder.total,
          finalTotal: mergedTotals.total
        }
      }
    })

  } catch (error) {
    console.error('Error merging orders:', error)
    
    const errorContext = {
      orderId: params.id,
      operation: 'MERGE_ORDERS',
      timestamp: new Date()
    }

    const orderError = OrderErrorHandler.createError(
      'SYSTEM_ERROR' as any,
      'Failed to merge orders',
      errorContext,
      { severity: 'high' }
    )

    await AuditLogger.log({
      timestamp: new Date(),
      action: 'orders_merge_failed',
      resource: 'held_order',
      resourceId: params.targetId,
      method: 'POST',
      path: request.url,
      status: 'failure',
      severity: 'high',
      details: { 
        sourceOrderId: params.id,
        targetOrderId: params.targetId,
        error: error instanceof Error ? error.message : 'Unknown error' 
      }
    })

    return NextResponse.json(
      { 
        error: 'Failed to merge orders',
        errorId: orderError.id
      },
      { status: 500 }
    )
  }
}

// GET /api/pos/orders/[id]/merge/[targetId] - Get merge preview/compatibility check
export async function GET(
  request: NextRequest,
  { params }: RouteParams
) {
  try {
    const { userId } = await auth()
    if (!userId) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const { searchParams } = new URL(request.url)
    const storeId = searchParams.get('storeId')

    if (!storeId) {
      return NextResponse.json({ error: 'Store ID is required' }, { status: 400 })
    }

    const sourceOrderId = params.id
    const targetOrderId = params.targetId

    // Get both orders
    const [sourceOrder, targetOrder] = await Promise.all([
      prisma.heldOrder.findFirst({
        where: { id: sourceOrderId, storeId }
      }),
      prisma.heldOrder.findFirst({
        where: { id: targetOrderId, storeId }
      })
    ])

    if (!sourceOrder || !targetOrder) {
      return NextResponse.json({ error: 'One or both orders not found' }, { status: 404 })
    }

    // Parse items
    let sourceItems: any[] = []
    let targetItems: any[] = []

    try {
      sourceItems = JSON.parse(sourceOrder.itemsData || '[]')
      targetItems = JSON.parse(targetOrder.itemsData || '[]')
    } catch (error) {
      return NextResponse.json({ 
        error: 'Error parsing order items data' 
      }, { status: 400 })
    }

    // Check merge compatibility
    const compatibility = {
      canMerge: true,
      conflicts: [] as string[],
      warnings: [] as string[]
    }

    // Check order statuses
    if (sourceOrder.status === 'cancelled') {
      compatibility.canMerge = false
      compatibility.conflicts.push('Source order is cancelled')
    }

    if (targetOrder.status === 'cancelled') {
      compatibility.canMerge = false
      compatibility.conflicts.push('Target order is cancelled')
    }

    // Check locks
    const [sourceLock, targetLock] = await Promise.all([
      prisma.orderLock.findFirst({
        where: { heldOrderId: sourceOrderId, isActive: true }
      }),
      prisma.orderLock.findFirst({
        where: { heldOrderId: targetOrderId, isActive: true }
      })
    ])

    if (sourceLock && sourceLock.userId !== userId) {
      compatibility.warnings.push(`Source order is locked by ${sourceLock.userName}`)
    }

    if (targetLock && targetLock.userId !== userId) {
      compatibility.warnings.push(`Target order is locked by ${targetLock.userName}`)
    }

    // Calculate merge preview for each strategy
    const preview = calculateMergePreview(sourceOrder, targetOrder, sourceItems, targetItems)

    return NextResponse.json({
      canMerge: compatibility.canMerge,
      compatibility,
      orders: {
        source: {
          id: sourceOrder.id,
          orderNumber: sourceOrder.orderNumber,
          status: sourceOrder.status,
          itemsCount: sourceItems.length,
          total: sourceOrder.total,
          customer: sourceOrder.customerId,
          employee: sourceOrder.employeeId
        },
        target: {
          id: targetOrder.id,
          orderNumber: targetOrder.orderNumber,
          status: targetOrder.status,
          itemsCount: targetItems.length,
          total: targetOrder.total,
          customer: targetOrder.customerId,
          employee: targetOrder.employeeId
        }
      },
      preview,
      metadata: {
        mergeStrategies: ['append', 'replace', 'combine_totals'],
        estimatedDuration: '2-5 seconds'
      }
    })

  } catch (error) {
    console.error('Error getting merge preview:', error)
    return NextResponse.json(
      { error: 'Failed to get merge preview' },
      { status: 500 }
    )
  }
}

// Helper function to calculate merge preview
function calculateMergePreview(sourceOrder: any, targetOrder: any, sourceItems: any[], targetItems: any[]) {
  return {
    append: {
      finalItemsCount: targetItems.length + sourceItems.length,
      finalTotal: targetOrder.total + sourceOrder.total,
      itemsMerged: sourceItems.length,
      description: 'Append source items to target order and combine totals'
    },
    replace: {
      finalItemsCount: sourceItems.length,
      finalTotal: sourceOrder.total,
      itemsMerged: sourceItems.length,
      description: 'Replace target items with source items, keep target customer info'
    },
    combine_totals: {
      finalItemsCount: targetItems.length,
      finalTotal: targetOrder.total + sourceOrder.total,
      itemsMerged: 0,
      description: 'Combine totals but keep original target items'
    }
  }
}

// Helper function to broadcast merge event
async function broadcastMergeEvent(sourceOrderId: string, targetOrderId: string, eventData: any) {
  try {
    // In a real implementation, this would broadcast to WebSocket connections
    // or update a real-time notification system
    console.log('Broadcasting merge event:', {
      sourceOrderId,
      targetOrderId,
      eventData
    })
  } catch (error) {
    console.error('Error broadcasting merge event:', error)
  }
}