import { NextRequest, NextResponse } from 'next/server'
import { PrismaClient } from '@prisma/client'
import { auth } from '@clerk/nextjs/server'
import { AuditLogger } from '@/lib/security/audit-logger'
import { OrderErrorHandler } from '@/lib/order-management-errors'

const prisma = new PrismaClient()

interface RouteParams {
  params: {
    id: string
  }
}

// POST /api/pos/orders/collaboration/[id]/lock - Acquire order lock
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
      lockType = 'full', 
      lockScope = 'exclusive', 
      reason,
      expiresAt,
      userName,
      userEmail
    } = body

    if (!userName) {
      return NextResponse.json({ error: 'User name is required' }, { status: 400 })
    }

    const { searchParams } = new URL(request.url)
    const storeId = searchParams.get('storeId')
    if (!storeId) {
      return NextResponse.json({ error: 'Store ID is required' }, { status: 400 })
    }

    // Verify the held order exists and belongs to the store
    const heldOrder = await prisma.heldOrder.findFirst({
      where: {
        id: params.id,
        storeId
      }
    })

    if (!heldOrder) {
      return NextResponse.json({ error: 'Held order not found' }, { status: 404 })
    }

    // Check if order already has an active lock
    const existingLock = await prisma.orderLock.findFirst({
      where: {
        heldOrderId: params.id,
        isActive: true
      }
    })

    if (existingLock) {
      // Check if current user already owns the lock
      if (existingLock.userId === userId) {
        // Renew existing lock
        const renewedLock = await prisma.orderLock.update({
          where: { id: existingLock.id },
          data: {
            lockType,
            lockScope,
            reason: reason || existingLock.reason,
            expiresAt: expiresAt || null,
            lastRenewedAt: new Date(),
            metadata: JSON.stringify({ renewed: true })
          }
        })

        await AuditLogger.log({
          timestamp: new Date(),
          userId,
          userEmail: userEmail || undefined,
          action: 'order_lock_renewed',
          resource: 'held_order',
          resourceId: params.id,
          method: 'POST',
          path: request.url,
          status: 'success',
          severity: 'low',
          details: {
            lockId: existingLock.id,
            lockType,
            lockScope
          }
        })

        return NextResponse.json({
          lock: renewedLock,
          message: 'Order lock renewed successfully',
          isRenewed: true
        })
      } else {
        // Lock is owned by another user
        return NextResponse.json({
          error: 'Order is already locked by another user',
          lockOwner: {
            userId: existingLock.userId,
            userName: existingLock.userName,
            userEmail: existingLock.userEmail,
            lockType: existingLock.lockType,
            lockScope: existingLock.lockScope,
            acquiredAt: existingLock.acquiredAt,
            expiresAt: existingLock.expiresAt
          }
        }, { status: 409 })
      }
    }

    // Create new lock
    const orderLock = await prisma.orderLock.create({
      data: {
        heldOrderId: params.id,
        userId,
        userEmail: userEmail || null,
        userName,
        lockType,
        lockScope,
        reason: reason || null,
        isActive: true,
        expiresAt: expiresAt ? new Date(expiresAt) : null,
        metadata: JSON.stringify({ created: true })
      }
    })

    // Log the lock acquisition
    await AuditLogger.log({
      timestamp: new Date(),
      userId,
      userEmail: userEmail || undefined,
      action: 'order_lock_acquired',
      resource: 'held_order',
      resourceId: params.id,
      method: 'POST',
      path: request.url,
      status: 'success',
      severity: 'low',
      details: {
        lockId: orderLock.id,
        lockType,
        lockScope,
        reason: reason || null
      }
    })

    return NextResponse.json({
      lock: orderLock,
      message: 'Order lock acquired successfully'
    }, { status: 201 })

  } catch (error) {
    console.error('Error acquiring order lock:', error)
    
    const errorContext = {
      orderId: params.id,
      operation: 'ACQUIRE_ORDER_LOCK',
      timestamp: new Date()
    }

    const orderError = OrderErrorHandler.createError(
      'SYSTEM_ERROR' as any,
      'Failed to acquire order lock',
      errorContext,
      { severity: 'high' }
    )

    await AuditLogger.log({
      timestamp: new Date(),
      action: 'order_lock_acquisition_failed',
      resource: 'held_order',
      resourceId: params.id,
      method: 'POST',
      path: request.url,
      status: 'failure',
      severity: 'high',
      details: { error: error instanceof Error ? error.message : 'Unknown error' }
    })

    return NextResponse.json(
      { 
        error: 'Failed to acquire order lock',
        errorId: orderError.id
      },
      { status: 500 }
    )
  }
}

// GET /api/pos/orders/collaboration/[id]/lock - Get current order lock status
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

    // Verify the held order exists and belongs to the store
    const heldOrder = await prisma.heldOrder.findFirst({
      where: {
        id: params.id,
        storeId
      }
    })

    if (!heldOrder) {
      return NextResponse.json({ error: 'Held order not found' }, { status: 404 })
    }

    // Get active lock for this order
    const activeLock = await prisma.orderLock.findFirst({
      where: {
        heldOrderId: params.id,
        isActive: true
      }
    })

    // Check if lock has expired
    let lockInfo = null
    if (activeLock) {
      const isExpired = activeLock.expiresAt && new Date() > activeLock.expiresAt
      
      if (isExpired) {
        // Auto-expire the lock
        await prisma.orderLock.update({
          where: { id: activeLock.id },
          data: { isActive: false }
        })
        lockInfo = null
      } else {
        lockInfo = {
          ...activeLock,
          metadata: activeLock.metadata ? JSON.parse(activeLock.metadata) : {},
          isExpired: false,
          timeRemaining: activeLock.expiresAt 
            ? Math.max(0, activeLock.expiresAt.getTime() - Date.now())
            : null
        }
      }
    }

    // Get lock history (last 10 locks)
    const lockHistory = await prisma.orderLock.findMany({
      where: { heldOrderId: params.id },
      orderBy: { createdAt: 'desc' },
      take: 10,
      select: {
        id: true,
        userName: true,
        userEmail: true,
        lockType: true,
        lockScope: true,
        reason: true,
        acquiredAt: true,
        releasedAt: true,
        isActive: true
      }
    })

    return NextResponse.json({
      currentLock: lockInfo,
      lockHistory,
      canAcquireLock: !lockInfo || lockInfo.userId === userId
    })

  } catch (error) {
    console.error('Error fetching order lock status:', error)
    return NextResponse.json(
      { error: 'Failed to fetch order lock status' },
      { status: 500 }
    )
  }
}

// DELETE /api/pos/orders/collaboration/[id]/lock - Release order lock
export async function DELETE(
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
    const force = searchParams.get('force') === 'true' // Allow admin to force release
    
    if (!storeId) {
      return NextResponse.json({ error: 'Store ID is required' }, { status: 400 })
    }

    // Verify the held order exists and belongs to the store
    const heldOrder = await prisma.heldOrder.findFirst({
      where: {
        id: params.id,
        storeId
      }
    })

    if (!heldOrder) {
      return NextResponse.json({ error: 'Held order not found' }, { status: 404 })
    }

    // Find active lock
    const activeLock = await prisma.orderLock.findFirst({
      where: {
        heldOrderId: params.id,
        isActive: true
      }
    })

    if (!activeLock) {
      return NextResponse.json({ error: 'No active lock found' }, { status: 404 })
    }

    // Check if user owns the lock or has force permission
    if (activeLock.userId !== userId && !force) {
      return NextResponse.json({
        error: 'You can only release locks you own',
        lockOwner: {
          userId: activeLock.userId,
          userName: activeLock.userName,
          userEmail: activeLock.userEmail
        }
      }, { status: 403 })
    }

    // Release the lock
    await prisma.orderLock.update({
      where: { id: activeLock.id },
      data: {
        isActive: false,
        updatedAt: new Date(),
        metadata: JSON.stringify({ 
          released: true, 
          releasedBy: userId,
          forceReleased: force 
        })
      }
    })

    // Log the lock release
    await AuditLogger.log({
      timestamp: new Date(),
      userId,
      action: 'order_lock_released',
      resource: 'held_order',
      resourceId: params.id,
      method: 'DELETE',
      path: request.url,
      status: 'success',
      severity: 'low',
      details: {
        lockId: activeLock.id,
        lockOwner: activeLock.userId,
        forceReleased: force
      }
    })

    return NextResponse.json({
      message: 'Order lock released successfully'
    })

  } catch (error) {
    console.error('Error releasing order lock:', error)
    return NextResponse.json(
      { error: 'Failed to release order lock' },
      { status: 500 }
    )
  }
}

// PATCH /api/pos/orders/collaboration/[id]/lock - Renew or modify lock
export async function PATCH(
  request: NextRequest,
  { params }: RouteParams
) {
  try {
    const { userId } = await auth()
    if (!userId) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const body = await request.json()
    const { lockType, lockScope, reason, expiresAt } = body

    const { searchParams } = new URL(request.url)
    const storeId = searchParams.get('storeId')
    if (!storeId) {
      return NextResponse.json({ error: 'Store ID is required' }, { status: 400 })
    }

    // Verify the held order exists and belongs to the store
    const heldOrder = await prisma.heldOrder.findFirst({
      where: {
        id: params.id,
        storeId
      }
    })

    if (!heldOrder) {
      return NextResponse.json({ error: 'Held order not found' }, { status: 404 })
    }

    // Find active lock owned by current user
    const activeLock = await prisma.orderLock.findFirst({
      where: {
        heldOrderId: params.id,
        userId,
        isActive: true
      }
    })

    if (!activeLock) {
      return NextResponse.json({ error: 'No active lock found for this user' }, { status: 404 })
    }

    // Prepare update data
    const updateData: any = {
      lastRenewedAt: new Date(),
      updatedAt: new Date()
    }

    if (lockType !== undefined) updateData.lockType = lockType
    if (lockScope !== undefined) updateData.lockScope = lockScope
    if (reason !== undefined) updateData.reason = reason
    if (expiresAt !== undefined) {
      updateData.expiresAt = expiresAt ? new Date(expiresAt) : null
    }

    // Update the lock
    const updatedLock = await prisma.orderLock.update({
      where: { id: activeLock.id },
      data: updateData
    })

    return NextResponse.json({
      lock: updatedLock,
      message: 'Order lock updated successfully'
    })

  } catch (error) {
    console.error('Error updating order lock:', error)
    return NextResponse.json(
      { error: 'Failed to update order lock' },
      { status: 500 }
    )
  }
}