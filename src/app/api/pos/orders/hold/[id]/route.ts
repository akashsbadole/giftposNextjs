import { NextRequest, NextResponse } from 'next/server'
import { PrismaClient } from '@prisma/client'
import { auth } from '@clerk/nextjs/server'

const prisma = new PrismaClient()

interface RouteParams {
  params: {
    id: string
  }
}

// GET /api/pos/orders/hold/[id] - Get specific held order
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

    const heldOrder = await prisma.heldOrder.findFirst({
      where: {
        id: params.id,
        storeId
      },
      include: {
        customer: {
          select: {
            id: true,
            name: true,
            phone: true,
            email: true
          }
        },
        employee: {
          select: {
            id: true,
            name: true
          }
        }
      }
    })

    if (!heldOrder) {
      return NextResponse.json({ error: 'Held order not found' }, { status: 404 })
    }

    // Parse items data
    let items = []
    try {
      items = JSON.parse(heldOrder.itemsData)
    } catch (error) {
      console.error('Error parsing items data:', error)
    }

    // Calculate age
    const ageInMinutes = Math.floor((Date.now() - heldOrder.createdAt.getTime()) / (1000 * 60))
    const hours = Math.floor(ageInMinutes / 60)
    const minutes = ageInMinutes % 60
    
    let ageDisplay = ''
    if (hours > 0) {
      ageDisplay = `${hours}h ${minutes}m`
    } else {
      ageDisplay = `${minutes}m`
    }

    const response = {
      ...heldOrder,
      items,
      age: ageInMinutes,
      ageDisplay,
      itemsData: undefined // Remove raw JSON data from response
    }

    return NextResponse.json(response)

  } catch (error) {
    console.error('Error fetching held order:', error)
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    )
  }
}

// PUT /api/pos/orders/hold/[id] - Update held order
export async function PUT(
  request: NextRequest,
  { params }: RouteParams
) {
  try {
    const { userId } = await auth()
    if (!userId) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const body = await request.json()
    const { searchParams } = new URL(request.url)
    const storeId = searchParams.get('storeId')

    if (!storeId) {
      return NextResponse.json({ error: 'Store ID is required' }, { status: 400 })
    }

    // Check if held order exists and belongs to store
    const existingOrder = await prisma.heldOrder.findFirst({
      where: {
        id: params.id,
        storeId
      }
    })

    if (!existingOrder) {
      return NextResponse.json({ error: 'Held order not found' }, { status: 404 })
    }

    // Prepare update data
    const updateData: any = {
      updatedAt: new Date()
    }

    // Only update fields that are provided
    if (body.customerId !== undefined) updateData.customerId = body.customerId
    if (body.tableNumber !== undefined) updateData.tableNumber = body.tableNumber
    if (body.orderName !== undefined) updateData.orderName = body.orderName
    if (body.notes !== undefined) updateData.notes = body.notes
    if (body.priority !== undefined) updateData.priority = body.priority
    if (body.holdDuration !== undefined) updateData.holdDuration = body.holdDuration
    if (body.isAutoSaved !== undefined) updateData.isAutoSaved = body.isAutoSaved
    if (body.tags !== undefined) updateData.tags = body.tags ? JSON.stringify(body.tags) : null
    if (body.metadata !== undefined) updateData.metadata = body.metadata ? JSON.stringify(body.metadata) : null

    // If items are provided, update them along with totals
    if (body.items && Array.isArray(body.items)) {
      updateData.itemsData = JSON.stringify(body.items)
      
      // Recalculate totals if items are updated
      if (body.subtotal !== undefined) updateData.subtotal = body.subtotal
      if (body.gst !== undefined) updateData.gst = body.gst
      if (body.discount !== undefined) updateData.discount = body.discount
      if (body.total !== undefined) updateData.total = body.total
    }

    const updatedOrder = await prisma.heldOrder.update({
      where: {
        id: params.id
      },
      data: updateData,
      include: {
        customer: {
          select: {
            id: true,
            name: true,
            phone: true,
            email: true
          }
        },
        employee: {
          select: {
            id: true,
            name: true
          }
        }
      }
    })

    // Parse items for response
    let items = []
    try {
      items = JSON.parse(updatedOrder.itemsData)
    } catch (error) {
      console.error('Error parsing items data:', error)
    }

    const response = {
      ...updatedOrder,
      items,
      itemsData: undefined // Remove raw JSON data from response
    }

    return NextResponse.json(response)

  } catch (error) {
    console.error('Error updating held order:', error)
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    )
  }
}

// DELETE /api/pos/orders/hold/[id] - Delete/cancel held order
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

    // Check if held order exists and belongs to store
    const existingOrder = await prisma.heldOrder.findFirst({
      where: {
        id: params.id,
        storeId
      }
    })

    if (!existingOrder) {
      return NextResponse.json({ error: 'Held order not found' }, { status: 404 })
    }

    // Update status to cancelled instead of hard delete for audit trail
    const cancelledOrder = await prisma.heldOrder.update({
      where: {
        id: params.id
      },
      data: {
        status: 'cancelled',
        updatedAt: new Date()
      }
    })

    return NextResponse.json({ 
      message: 'Held order cancelled successfully',
      order: cancelledOrder 
    })

  } catch (error) {
    console.error('Error cancelling held order:', error)
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    )
  }
}