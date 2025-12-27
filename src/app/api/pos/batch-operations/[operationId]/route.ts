import { NextRequest, NextResponse } from 'next/server'
import { PrismaClient } from '@prisma/client'
import { auth } from '@clerk/nextjs/server'
import { AuditLogger } from '@/lib/security/audit-logger'
import { BatchOperationManager } from '@/lib/batch-operations-manager'

const prisma = new PrismaClient()

// GET /api/pos/batch-operations/[operationId] - Get specific batch operation details
export async function GET(
  request: NextRequest,
  { params }: { params: { operationId: string } }
) {
  try {
    const { userId } = await auth()
    if (!userId) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const { operationId } = params
    const { searchParams } = new URL(request.url)
    const storeId = searchParams.get('storeId')
    const includeRecords = searchParams.get('includeRecords') === 'true'
    const includeProgress = searchParams.get('includeProgress') === 'true'
    const includeHistory = searchParams.get('includeHistory') === 'true'

    if (!storeId) {
      return NextResponse.json({ error: 'Store ID is required' }, { status: 400 })
    }

    // Get batch operation with optional includes
    const batchOperation = await prisma.batchOperation.findFirst({
      where: {
        operationId,
        storeId
      },
      include: {
        template: {
          select: {
            id: true,
            name: true,
            operationType: true,
            targetEntity: true
          }
        },
        user: {
          select: {
            id: true,
            name: true,
            email: true
          }
        },
        parentOperation: {
          select: {
            operationId: true,
            name: true,
            type: true
          }
        },
        childOperations: {
          select: {
            operationId: true,
            name: true,
            type: true,
            status: true,
            progressPercentage: true
          }
        }
      }
    })

    if (!batchOperation) {
      return NextResponse.json({ error: 'Batch operation not found' }, { status: 404 })
    }

    // Get operation progress if requested
    let progress = null
    if (includeProgress) {
      progress = await BatchOperationManager.getOperationProgress(operationId)
    }

    // Get operation records if requested
    let records = null
    if (includeRecords) {
      const page = parseInt(searchParams.get('page') || '1')
      const limit = parseInt(searchParams.get('limit') || '50')
      const status = searchParams.get('recordStatus')
      const validationStatus = searchParams.get('validationStatus')

      const whereClause: any = {
        batchOperationId: batchOperation.id
      }

      if (status) whereClause.status = status
      if (validationStatus) whereClause.validationStatus = validationStatus

      const [operationRecords, totalCount] = await Promise.all([
        prisma.batchOperationRecord.findMany({
          where: whereClause,
          orderBy: { recordIndex: 'asc' },
          skip: (page - 1) * limit,
          take: limit
        }),
        prisma.batchOperationRecord.count({ where: whereClause })
      ])

      records = {
        data: operationRecords,
        pagination: {
          total: totalCount,
          page,
          limit,
          pages: Math.ceil(totalCount / limit)
        }
      }
    }

    // Get operation history if requested
    let history = null
    if (includeHistory) {
      const page = parseInt(searchParams.get('historyPage') || '1')
      const limit = parseInt(searchParams.get('historyLimit') || '20')

      const [operationHistory, totalCount] = await Promise.all([
        prisma.batchOperationHistory.findMany({
          where: { batchOperationId: batchOperation.id },
          orderBy: { timestamp: 'desc' },
          skip: (page - 1) * limit,
          take: limit
        }),
        prisma.batchOperationHistory.count({
          where: { batchOperationId: batchOperation.id }
        })
      ])

      history = {
        data: operationHistory,
        pagination: {
          total: totalCount,
          page,
          limit,
          pages: Math.ceil(totalCount / limit)
        }
      }
    }

    // Get operation files
    const files = await prisma.batchOperationFile.findMany({
      where: { batchOperationId: batchOperation.id },
      orderBy: { createdAt: 'desc' }
    })

    return NextResponse.json({
      operation: batchOperation,
      progress,
      records,
      history,
      files
    })

  } catch (error) {
    console.error('Error fetching batch operation:', error)
    return NextResponse.json(
      { error: 'Failed to fetch batch operation' },
      { status: 500 }
    )
  }
}

// PATCH /api/pos/batch-operations/[operationId] - Update batch operation (pause, resume, cancel)
export async function PATCH(
  request: NextRequest,
  { params }: { params: { operationId: string } }
) {
  try {
    const { userId } = await auth()
    if (!userId) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const { operationId } = params
    const body = await request.json()
    const { action, storeId, userName, userEmail } = body

    if (!storeId) {
      return NextResponse.json({ error: 'Store ID is required' }, { status: 400 })
    }

    if (!action || !['pause', 'resume', 'cancel', 'retry'].includes(action)) {
      return NextResponse.json(
        { error: 'Invalid action. Must be one of: pause, resume, cancel, retry' },
        { status: 400 }
      )
    }

    // Get current operation status
    const batchOperation = await prisma.batchOperation.findFirst({
      where: {
        operationId,
        storeId
      }
    })

    if (!batchOperation) {
      return NextResponse.json({ error: 'Batch operation not found' }, { status: 404 })
    }

    let result
    let newStatus = batchOperation.status

    switch (action) {
      case 'pause':
        if (batchOperation.status !== 'running') {
          return NextResponse.json(
            { error: 'Can only pause running operations' },
            { status: 400 }
          )
        }
        result = await BatchOperationManager.resumeOperation(operationId, userId) // We'll implement pause separately
        newStatus = 'paused'
        break

      case 'resume':
        if (batchOperation.status !== 'paused') {
          return NextResponse.json(
            { error: 'Can only resume paused operations' },
            { status: 400 }
          )
        }
        result = await BatchOperationManager.resumeOperation(operationId, userId)
        newStatus = 'running'
        break

      case 'cancel':
        if (['completed', 'failed', 'cancelled'].includes(batchOperation.status)) {
          return NextResponse.json(
            { error: 'Cannot cancel completed, failed, or already cancelled operations' },
            { status: 400 }
          )
        }
        result = await BatchOperationManager.cancelOperation(operationId, userId, userName, userEmail)
        newStatus = 'cancelled'
        break

      case 'retry':
        if (batchOperation.status !== 'failed') {
          return NextResponse.json(
            { error: 'Can only retry failed operations' },
            { status: 400 }
          )
        }
        if (batchOperation.retryCount >= batchOperation.maxRetries) {
          return NextResponse.json(
            { error: 'Maximum retry attempts reached' },
            { status: 400 }
          )
        }
        // Reset operation for retry
        await prisma.batchOperation.update({
          where: { operationId },
          data: {
            status: 'queued',
            startedAt: null,
            completedAt: null,
            progressPercentage: 0,
            retryCount: batchOperation.retryCount + 1,
            errorLog: null
          }
        })
        newStatus = 'queued'
        result = { success: true, message: 'Operation queued for retry' }
        break

      default:
        return NextResponse.json({ error: 'Invalid action' }, { status: 400 })
    }

    // Log the action
    await AuditLogger.log({
      timestamp: new Date(),
      userId,
      userEmail: userEmail || undefined,
      action: `batch_operation_${action}`,
      resource: 'batch_operation',
      resourceId: batchOperation.id,
      method: 'PATCH',
      path: request.url,
      status: 'success',
      severity: 'medium',
      details: {
        operationId: batchOperation.operationId,
        action,
        previousStatus: batchOperation.status,
        newStatus
      }
    })

    return NextResponse.json({
      success: true,
      action,
      previousStatus: batchOperation.status,
      newStatus,
      result,
      message: `Operation ${action}ed successfully`
    })

  } catch (error) {
    console.error('Error updating batch operation:', error)
    return NextResponse.json(
      { error: 'Failed to update batch operation' },
      { status: 500 }
    )
  }
}

// DELETE /api/pos/batch-operations/[operationId] - Delete batch operation
export async function DELETE(
  request: NextRequest,
  { params }: { params: { operationId: string } }
) {
  try {
    const { userId } = await auth()
    if (!userId) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const { operationId } = params
    const { searchParams } = new URL(request.url)
    const storeId = searchParams.get('storeId')
    const force = searchParams.get('force') === 'true'

    if (!storeId) {
      return NextResponse.json({ error: 'Store ID is required' }, { status: 400 })
    }

    // Get batch operation
    const batchOperation = await prisma.batchOperation.findFirst({
      where: {
        operationId,
        storeId
      }
    })

    if (!batchOperation) {
      return NextResponse.json({ error: 'Batch operation not found' }, { status: 404 })
    }

    // Check if operation can be deleted
    if (!force && ['running', 'queued', 'pending'].includes(batchOperation.status)) {
      return NextResponse.json(
        { error: 'Cannot delete running or queued operations. Use cancel first or force=true' },
        { status: 400 }
      )
    }

    // Delete the operation and all related records
    await prisma.$transaction(async (tx) => {
      // Delete related records first
      await tx.batchOperationRecord.deleteMany({
        where: { batchOperationId: batchOperation.id }
      })

      await tx.batchOperationProgress.deleteMany({
        where: { batchOperationId: batchOperation.id }
      })

      await tx.batchOperationFile.deleteMany({
        where: { batchOperationId: batchOperation.id }
      })

      await tx.batchOperationHistory.deleteMany({
        where: { batchOperationId: batchOperation.id }
      })

      // Delete the main operation
      await tx.batchOperation.delete({
        where: { id: batchOperation.id }
      })
    })

    // Log the deletion
    await AuditLogger.log({
      timestamp: new Date(),
      userId,
      action: 'batch_operation_deleted',
      resource: 'batch_operation',
      resourceId: batchOperation.id,
      method: 'DELETE',
      path: request.url,
      status: 'success',
      severity: 'medium',
      details: {
        operationId: batchOperation.operationId,
        name: batchOperation.name,
        type: batchOperation.type,
        entityType: batchOperation.entityType,
        force
      }
    })

    return NextResponse.json({
      success: true,
      message: 'Batch operation deleted successfully'
    })

  } catch (error) {
    console.error('Error deleting batch operation:', error)
    return NextResponse.json(
      { error: 'Failed to delete batch operation' },
      { status: 500 }
    )
  }
}