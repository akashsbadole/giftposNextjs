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

// POST /api/pos/orders/collaboration/[id]/session - Create/Join collaboration session
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
      userName, 
      userEmail, 
      role = 'collaborator', 
      metadata = {} 
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

    // Generate unique session ID
    const sessionId = `session_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`

    // Check if user already has an active session for this order
    const existingSession = await prisma.collaborationSession.findFirst({
      where: {
        heldOrderId: params.id,
        userId,
        isActive: true
      }
    })

    if (existingSession) {
      // Update existing session instead of creating new one
      const updatedSession = await prisma.collaborationSession.update({
        where: { id: existingSession.id },
        data: {
          sessionId: existingSession.sessionId, // Keep existing session ID
          userName,
          userEmail: userEmail || null,
          role,
          lastSeenAt: new Date(),
          heartbeatAt: new Date(),
          metadata: JSON.stringify(metadata)
        }
      })

      await AuditLogger.log({
        timestamp: new Date(),
        userId,
        userEmail: userEmail || undefined,
        action: 'collaboration_session_updated',
        resource: 'held_order',
        resourceId: params.id,
        method: 'POST',
        path: request.url,
        status: 'success',
        severity: 'low',
        details: {
          sessionId: existingSession.sessionId,
          role,
          operation: 'update'
        }
      })

      return NextResponse.json({
        session: {
          ...updatedSession,
          metadata: metadata
        },
        message: 'Session updated successfully'
      })
    }

    // Create new collaboration session
    const collaborationSession = await prisma.collaborationSession.create({
      data: {
        sessionId,
        heldOrderId: params.id,
        userId,
        userEmail: userEmail || null,
        userName,
        role,
        isActive: true,
        lastSeenAt: new Date(),
        heartbeatAt: new Date(),
        metadata: JSON.stringify(metadata)
      }
    })

    // Log the session creation
    await AuditLogger.log({
      timestamp: new Date(),
      userId,
      userEmail: userEmail || undefined,
      action: 'collaboration_session_created',
      resource: 'held_order',
      resourceId: params.id,
      method: 'POST',
      path: request.url,
      status: 'success',
      severity: 'low',
      details: {
        sessionId,
        role,
        operation: 'create'
      }
    })

    return NextResponse.json({
      session: {
        ...collaborationSession,
        metadata: metadata
      },
      message: 'Collaboration session created successfully'
    }, { status: 201 })

  } catch (error) {
    console.error('Error creating collaboration session:', error)
    
    const errorContext = {
      orderId: params.id,
      operation: 'CREATE_COLLABORATION_SESSION',
      timestamp: new Date()
    }

    const orderError = OrderErrorHandler.createError(
      'SYSTEM_ERROR' as any,
      'Failed to create collaboration session',
      errorContext,
      { severity: 'high' }
    )

    await AuditLogger.log({
      timestamp: new Date(),
      action: 'collaboration_session_creation_failed',
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
        error: 'Failed to create collaboration session',
        errorId: orderError.id
      },
      { status: 500 }
    )
  }
}

// GET /api/pos/orders/collaboration/[id]/session - Get active collaboration sessions
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

    // Get all active collaboration sessions for this order
    const activeSessions = await prisma.collaborationSession.findMany({
      where: {
        heldOrderId: params.id,
        isActive: true,
        heartbeatAt: {
          gte: new Date(Date.now() - 5 * 60 * 1000) // Active within last 5 minutes
        }
      },
      orderBy: { lastSeenAt: 'desc' }
    })

    // Parse metadata for each session
    const sessionsWithMetadata = activeSessions.map(session => ({
      ...session,
      metadata: session.metadata ? JSON.parse(session.metadata) : {}
    }))

    return NextResponse.json({
      sessions: sessionsWithMetadata,
      totalActiveUsers: sessionsWithMetadata.length
    })

  } catch (error) {
    console.error('Error fetching collaboration sessions:', error)
    return NextResponse.json(
      { error: 'Failed to fetch collaboration sessions' },
      { status: 500 }
    )
  }
}

// DELETE /api/pos/orders/collaboration/[id]/session - Leave/deactivate collaboration session
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
    if (!storeId) {
      return NextResponse.json({ error: 'Store ID is required' }, { status: 400 })
    }

    // Find and deactivate the user's active session
    const session = await prisma.collaborationSession.findFirst({
      where: {
        heldOrderId: params.id,
        userId,
        isActive: true
      }
    })

    if (!session) {
      return NextResponse.json({ error: 'Active session not found' }, { status: 404 })
    }

    // Deactivate the session
    await prisma.collaborationSession.update({
      where: { id: session.id },
      data: {
        isActive: false,
        updatedAt: new Date()
      }
    })

    // Log the session deactivation
    await AuditLogger.log({
      timestamp: new Date(),
      userId,
      action: 'collaboration_session_deactivated',
      resource: 'held_order',
      resourceId: params.id,
      method: 'DELETE',
      path: request.url,
      status: 'success',
      severity: 'low',
      details: {
        sessionId: session.sessionId
      }
    })

    return NextResponse.json({
      message: 'Successfully left collaboration session'
    })

  } catch (error) {
    console.error('Error deactivating collaboration session:', error)
    return NextResponse.json(
      { error: 'Failed to deactivate collaboration session' },
      { status: 500 }
    )
  }
}

// PATCH /api/pos/orders/collaboration/[id]/session - Update session (heartbeat, cursor position, etc.)
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
    const { 
      cursorPosition, 
      editLock, 
      metadata = {},
      heartbeat = true 
    } = body

    const { searchParams } = new URL(request.url)
    const storeId = searchParams.get('storeId')
    if (!storeId) {
      return NextResponse.json({ error: 'Store ID is required' }, { status: 400 })
    }

    // Find the user's active session
    const session = await prisma.collaborationSession.findFirst({
      where: {
        heldOrderId: params.id,
        userId,
        isActive: true
      }
    })

    if (!session) {
      return NextResponse.json({ error: 'Active session not found' }, { status: 404 })
    }

    // Prepare update data
    const updateData: any = {
      updatedAt: new Date()
    }

    if (cursorPosition !== undefined) {
      updateData.cursorPosition = JSON.stringify(cursorPosition)
    }

    if (editLock !== undefined) {
      updateData.editLock = editLock
    }

    if (heartbeat) {
      updateData.heartbeatAt = new Date()
      updateData.lastSeenAt = new Date()
    }

    if (Object.keys(metadata).length > 0) {
      updateData.metadata = JSON.stringify(metadata)
    }

    // Update the session
    const updatedSession = await prisma.collaborationSession.update({
      where: { id: session.id },
      data: updateData
    })

    return NextResponse.json({
      session: {
        ...updatedSession,
        cursorPosition: cursorPosition ? JSON.parse(updatedSession.cursorPosition || '{}') : null,
        metadata: Object.keys(metadata).length > 0 ? metadata : (updatedSession.metadata ? JSON.parse(updatedSession.metadata) : {})
      },
      message: 'Session updated successfully'
    })

  } catch (error) {
    console.error('Error updating collaboration session:', error)
    return NextResponse.json(
      { error: 'Failed to update collaboration session' },
      { status: 500 }
    )
  }
}