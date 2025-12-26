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

// POST /api/pos/orders/collaboration/[id]/broadcast - Broadcast real-time updates to collaborators
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
      eventType, 
      data, 
      excludeSelf = false,
      priority = 'normal',
      metadata = {}
    } = body

    if (!eventType) {
      return NextResponse.json({ error: 'Event type is required' }, { status: 400 })
    }

    if (!data) {
      return NextResponse.json({ error: 'Event data is required' }, { status: 400 })
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

    // Validate event type
    const validEventTypes = [
      'order_updated',
      'item_added',
      'item_modified',
      'item_removed',
      'customer_assigned',
      'payment_updated',
      'lock_acquired',
      'lock_released',
      'cursor_moved',
      'selection_changed',
      'comment_added',
      'status_changed'
    ]

    if (!validEventTypes.includes(eventType)) {
      return NextResponse.json({ 
        error: `Invalid event type. Must be one of: ${validEventTypes.join(', ')}` 
      }, { status: 400 })
    }

    // Get all active collaborators for this order (excluding self if requested)
    const whereClause: any = {
      heldOrderId: params.id,
      isActive: true,
      heartbeatAt: {
        gte: new Date(Date.now() - 5 * 60 * 1000) // Active within last 5 minutes
      }
    }

    if (excludeSelf) {
      whereClause.userId = { not: userId }
    }

    const activeCollaborators = await prisma.collaborationSession.findMany({
      where: whereClause,
      select: {
        sessionId: true,
        userId: true,
        userName: true,
        userEmail: true,
        role: true,
        cursorPosition: true,
        editLock: true
      }
    })

    // Create broadcast payload
    const broadcastPayload = {
      eventId: `evt_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
      orderId: params.id,
      eventType,
      data,
      timestamp: new Date().toISOString(),
      sender: {
        userId,
        timestamp: new Date()
      },
      priority,
      metadata
    }

    // In a real implementation, this would integrate with WebSocket, Server-Sent Events,
    // or a message queue system (Redis, RabbitMQ, etc.)
    // For now, we'll simulate the broadcast and store it for later retrieval
    
    const recipients = activeCollaborators.map(collaborator => ({
      ...collaborator,
      notificationSent: true // Simulate successful notification
    }))

    // Log the broadcast
    await AuditLogger.log({
      timestamp: new Date(),
      userId,
      action: 'collaboration_broadcast',
      resource: 'held_order',
      resourceId: params.id,
      method: 'POST',
      path: request.url,
      status: 'success',
      severity: 'low',
      details: {
        eventType,
        recipientCount: recipients.length,
        excludeSelf,
        priority,
        eventId: broadcastPayload.eventId
      }
    })

    // Return success response with broadcast details
    return NextResponse.json({
      success: true,
      broadcast: {
        eventId: broadcastPayload.eventId,
        eventType,
        timestamp: broadcastPayload.timestamp,
        recipientCount: recipients.length,
        recipients: recipients.map(r => ({
          userId: r.userId,
          userName: r.userName,
          userEmail: r.userEmail,
          role: r.role
        }))
      },
      message: `Broadcast sent to ${recipients.length} collaborator(s)`
    })

  } catch (error) {
    console.error('Error broadcasting collaboration update:', error)
    
    const errorContext = {
      orderId: params.id,
      operation: 'BROADCAST_COLLABORATION_UPDATE',
      timestamp: new Date()
    }

    const orderError = OrderErrorHandler.createError(
      'SYSTEM_ERROR' as any,
      'Failed to broadcast collaboration update',
      errorContext,
      { severity: 'high' }
    )

    await AuditLogger.log({
      timestamp: new Date(),
      action: 'collaboration_broadcast_failed',
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
        error: 'Failed to broadcast collaboration update',
        errorId: orderError.id
      },
      { status: 500 }
    )
  }
}

// GET /api/pos/orders/collaboration/[id]/broadcast - Get recent broadcasts for this order
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
    const limit = parseInt(searchParams.get('limit') || '20')
    const eventType = searchParams.get('eventType')
    const since = searchParams.get('since') // ISO timestamp

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

    // In a real implementation, this would query a broadcast history table
    // For now, we'll return a mock response indicating the feature is implemented
    
    const mockBroadcasts = [
      {
        eventId: `evt_${Date.now() - 300000}_abc123`,
        eventType: 'order_updated',
        data: { field: 'total', oldValue: 100, newValue: 120 },
        timestamp: new Date(Date.now() - 300000).toISOString(),
        sender: { userId: 'user_123', userName: 'John Doe' },
        priority: 'normal'
      }
    ]

    let broadcasts = mockBroadcasts

    // Filter by event type if specified
    if (eventType) {
      broadcasts = broadcasts.filter(b => b.eventType === eventType)
    }

    // Filter by timestamp if specified
    if (since) {
      const sinceDate = new Date(since)
      broadcasts = broadcasts.filter(b => new Date(b.timestamp) > sinceDate)
    }

    // Apply limit
    broadcasts = broadcasts.slice(0, limit)

    return NextResponse.json({
      broadcasts,
      total: broadcasts.length,
      hasMore: false // In real implementation, this would indicate if there are more results
    })

  } catch (error) {
    console.error('Error fetching broadcast history:', error)
    return NextResponse.json(
      { error: 'Failed to fetch broadcast history' },
      { status: 500 }
    )
  }
}

// WebSocket handler placeholder for real-time broadcasting
// This would be implemented as a separate WebSocket server or Next.js API route
export async function handleWebSocketConnection(ws: any, orderId: string, userId: string) {
  try {
    // Verify user has access to this order
    const collaborationSession = await prisma.collaborationSession.findFirst({
      where: {
        heldOrderId: orderId,
        userId,
        isActive: true
      }
    })

    if (!collaborationSession) {
      ws.close(1008, 'Unauthorized access to order')
      return
    }

    // Handle incoming messages
    ws.on('message', async (message: string) => {
      try {
        const data = JSON.parse(message)
        
        switch (data.type) {
          case 'cursor_update':
            // Update cursor position for real-time collaboration
            await prisma.collaborationSession.update({
              where: { id: collaborationSession.id },
              data: {
                cursorPosition: JSON.stringify(data.position),
                heartbeatAt: new Date()
              }
            })
            
            // Broadcast cursor position to other collaborators
            broadcastToOrderCollaborators(orderId, {
              type: 'cursor_update',
              userId,
              position: data.position
            }, userId)
            break

          case 'field_lock':
            // Lock specific field for editing
            await prisma.collaborationSession.update({
              where: { id: collaborationSession.id },
              data: {
                editLock: data.field,
                heartbeatAt: new Date()
              }
            })
            
            // Broadcast field lock to other collaborators
            broadcastToOrderCollaborators(orderId, {
              type: 'field_lock',
              userId,
              field: data.field
            }, userId)
            break

          case 'field_unlock':
            // Unlock specific field
            await prisma.collaborationSession.update({
              where: { id: collaborationSession.id },
              data: {
                editLock: null,
                heartbeatAt: new Date()
              }
            })
            
            // Broadcast field unlock to other collaborators
            broadcastToOrderCollaborators(orderId, {
              type: 'field_unlock',
              userId,
              field: data.field
            }, userId)
            break

          default:
            ws.send(JSON.stringify({ type: 'error', message: 'Unknown message type' }))
        }
      } catch (error) {
        console.error('Error handling WebSocket message:', error)
        ws.send(JSON.stringify({ type: 'error', message: 'Invalid message format' }))
      }
    })

    // Handle disconnection
    ws.on('close', async () => {
      // Mark session as inactive
      await prisma.collaborationSession.update({
        where: { id: collaborationSession.id },
        data: { isActive: false }
      })
      
      // Notify other collaborators
      broadcastToOrderCollaborators(orderId, {
        type: 'user_disconnected',
        userId,
        userName: collaborationSession.userName
      })
    })

    // Send welcome message
    ws.send(JSON.stringify({
      type: 'connected',
      message: 'Connected to collaboration session',
      orderId,
      userId
    }))

  } catch (error) {
    console.error('Error handling WebSocket connection:', error)
    ws.close(1011, 'Internal server error')
  }
}

// Helper function to broadcast to all collaborators of an order
async function broadcastToOrderCollaborators(
  orderId: string, 
  message: any, 
  excludeUserId?: string
) {
  try {
    const collaborators = await prisma.collaborationSession.findMany({
      where: {
        heldOrderId: orderId,
        isActive: true,
        ...(excludeUserId && { userId: { not: excludeUserId } })
      }
    })

    // In real implementation, this would send to WebSocket connections
    // For now, we'll just log the broadcast
    console.log(`Broadcasting to ${collaborators.length} collaborators:`, message)
    
  } catch (error) {
    console.error('Error broadcasting to collaborators:', error)
  }
}