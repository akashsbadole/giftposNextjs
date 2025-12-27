import { NextRequest, NextResponse } from 'next/server'
import { PrismaClient } from '@prisma/client'
import { auth } from '@clerk/nextjs/server'
import { AuditLogger } from '@/lib/security/audit-logger'
import { OrderErrorHandler } from '@/lib/order-management-errors'
import { BatchOperationManager } from '@/lib/batch-operations-manager'

const prisma = new PrismaClient()

// GET /api/pos/batch-operations - Get batch operations with filtering and pagination
export async function GET(request: NextRequest) {
  try {
    const { userId } = await auth()
    if (!userId) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const { searchParams } = new URL(request.url)
    const storeId = searchParams.get('storeId')
    const page = parseInt(searchParams.get('page') || '1')
    const limit = parseInt(searchParams.get('limit') || '20')
    const status = searchParams.get('status')
    const type = searchParams.get('type')
    const entityType = searchParams.get('entityType')
    const userId = searchParams.get('userId')
    const startDate = searchParams.get('startDate')
    const endDate = searchParams.get('endDate')
    const search = searchParams.get('search')

    if (!storeId) {
      return NextResponse.json({ error: 'Store ID is required' }, { status: 400 })
    }

    // Build where clause
    const whereClause: any = {
      storeId
    }

    if (status) whereClause.status = status
    if (type) whereClause.type = type
    if (entityType) whereClause.entityType = entityType
    if (userId) whereClause.userId = userId

    if (startDate || endDate) {
      whereClause.createdAt = {}
      if (startDate) whereClause.createdAt.gte = new Date(startDate)
      if (endDate) whereClause.createdAt.lte = new Date(endDate)
    }

    if (search) {
      whereClause.OR = [
        { name: { contains: search, mode: 'insensitive' } },
        { description: { contains: search, mode: 'insensitive' } },
        { operationId: { contains: search, mode: 'insensitive' } }
      ]
    }

    // Get batch operations with pagination
    const [operations, totalCount] = await Promise.all([
      prisma.batchOperation.findMany({
        where: whereClause,
        include: {
          template: {
            select: { id: true, name: true, operationType: true }
          },
          user: {
            select: { id: true, name: true, email: true }
          },
          _count: {
            select: {
              records: true,
              progress: true,
              files: true,
              history: true
            }
          }
        },
        orderBy: [
          { priority: 'desc' },
          { createdAt: 'desc' }
        ],
        skip: (page - 1) * limit,
        take: limit
      }),
      prisma.batchOperation.count({ where: whereClause })
    ])

    // Get operation statistics
    const stats = await prisma.batchOperation.groupBy({
      by: ['status'],
      where: { storeId },
      _count: { status: true }
    })

    const statusStats = stats.reduce((acc, stat) => {
      acc[stat.status] = stat._count.status
      return acc
    }, {} as Record<string, number>)

    return NextResponse.json({
      operations,
      pagination: {
        total: totalCount,
        page,
        limit,
        pages: Math.ceil(totalCount / limit)
      },
      stats: {
        total: totalCount,
        byStatus: statusStats
      }
    })

  } catch (error) {
    console.error('Error fetching batch operations:', error)
    return NextResponse.json(
      { error: 'Failed to fetch batch operations' },
      { status: 500 }
    )
  }
}

// POST /api/pos/batch-operations - Create a new batch operation
export async function POST(request: NextRequest) {
  try {
    const { userId } = await auth()
    if (!userId) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const body = await request.json()
    const {
      name,
      description,
      type,
      entityType,
      parameters = {},
      templateId,
      scheduledAt,
      priority = 0,
      storeId,
      userName,
      userEmail
    } = body

    // Validate required fields
    if (!name || !type || !entityType || !storeId) {
      return NextResponse.json(
        { error: 'Name, type, entityType, and storeId are required' },
        { status: 400 }
      )
    }

    // Validate operation type
    const validTypes = ['import', 'export', 'bulk_update', 'mass_processing', 'scheduled']
    if (!validTypes.includes(type)) {
      return NextResponse.json(
        { error: `Invalid operation type. Must be one of: ${validTypes.join(', ')}` },
        { status: 400 }
      )
    }

    // Validate entity type
    const validEntityTypes = ['products', 'customers', 'inventory', 'orders', 'categories', 'sales', 'employees']
    if (!validEntityTypes.includes(entityType)) {
      return NextResponse.json(
        { error: `Invalid entity type. Must be one of: ${validEntityTypes.join(', ')}` },
        { status: 400 }
      )
    }

    // Generate unique operation ID
    const operationId = `BO-${Date.now()}-${Math.random().toString(36).substr(2, 9).toUpperCase()}`

    // Create batch operation
    const batchOperation = await prisma.batchOperation.create({
      data: {
        operationId,
        name,
        description,
        type,
        entityType,
        status: scheduledAt ? 'pending' : 'queued',
        priority,
        storeId,
        userId,
        templateId,
        parameters: JSON.stringify(parameters),
        scheduledAt: scheduledAt ? new Date(scheduledAt) : null,
        metadata: JSON.stringify({
          createdBy: userName || userEmail,
          ipAddress: request.headers.get('x-forwarded-for') || request.ip,
          userAgent: request.headers.get('user-agent')
        })
      },
      include: {
        template: {
          select: { id: true, name: true, operationType: true }
        }
      }
    })

    // Log the batch operation creation
    await AuditLogger.log({
      timestamp: new Date(),
      userId,
      userEmail: userEmail || undefined,
      action: 'batch_operation_created',
      resource: 'batch_operation',
      resourceId: batchOperation.id,
      method: 'POST',
      path: request.url,
      status: 'success',
      severity: 'medium',
      details: {
        operationId: batchOperation.operationId,
        name: batchOperation.name,
        type: batchOperation.type,
        entityType: batchOperation.entityType,
        storeId: batchOperation.storeId,
        totalRecords: batchOperation.totalRecords
      }
    })

    return NextResponse.json({
      success: true,
      operation: batchOperation,
      message: 'Batch operation created successfully'
    }, { status: 201 })

  } catch (error) {
    console.error('Error creating batch operation:', error)
    
    const errorContext = {
      operation: 'BATCH_OPERATION_CREATE',
      timestamp: new Date()
    }

    const orderError = OrderErrorHandler.createError(
      'SYSTEM_ERROR' as any,
      'Failed to create batch operation',
      errorContext,
      { severity: 'high' }
    )

    await AuditLogger.log({
      timestamp: new Date(),
      action: 'batch_operation_creation_failed',
      resource: 'batch_operation',
      method: 'POST',
      path: request.url,
      status: 'failure',
      severity: 'high',
      details: { error: error instanceof Error ? error.message : 'Unknown error' }
    })

    return NextResponse.json(
      { 
        error: 'Failed to create batch operation',
        errorId: orderError.id
      },
      { status: 500 }
    )
  }
}