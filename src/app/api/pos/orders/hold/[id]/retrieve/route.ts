import { NextRequest, NextResponse } from 'next/server'
import { PrismaClient } from '@prisma/client'
import { auth } from '@clerk/nextjs/server'

const prisma = new PrismaClient()

interface RouteParams {
  params: {
    id: string
  }
}

// POST /api/pos/orders/hold/[id]/retrieve - Load held order back to active cart
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
    const { searchParams } = new URL(request.url)
    const storeId = searchParams.get('storeId')

    if (!storeId) {
      return NextResponse.json({ error: 'Store ID is required' }, { status: 400 })
    }

    // Get the held order with validation
    const heldOrder = await prisma.heldOrder.findFirst({
      where: {
        id: params.id,
        storeId,
        status: 'held'
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
      return NextResponse.json({ error: 'Held order not found or not available' }, { status: 404 })
    }

    // Check if order has expired
    if (heldOrder.holdDuration) {
      const ageInMinutes = Math.floor((Date.now() - heldOrder.createdAt.getTime()) / (1000 * 60))
      if (ageInMinutes > heldOrder.holdDuration) {
        // Mark as expired
        await prisma.heldOrder.update({
          where: { id: params.id },
          data: { 
            status: 'expired',
            expiredAt: new Date(),
            updatedAt: new Date()
          }
        })
        return NextResponse.json({ error: 'Held order has expired' }, { status: 410 })
      }
    }

    // Parse items data
    let items = []
    try {
      items = JSON.parse(heldOrder.itemsData)
    } catch (error) {
      console.error('Error parsing items data:', error)
      return NextResponse.json({ error: 'Invalid order data' }, { status: 400 })
    }

    // Validate items structure
    if (!Array.isArray(items) || items.length === 0) {
      return NextResponse.json({ error: 'No items found in held order' }, { status: 400 })
    }

    // Update held order status to retrieved
    const retrievedOrder = await prisma.heldOrder.update({
      where: { id: params.id },
      data: {
        status: 'retrieved',
        retrievedAt: new Date(),
        updatedAt: new Date()
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

    // Calculate additional data
    const ageInMinutes = Math.floor((Date.now() - heldOrder.createdAt.getTime()) / (1000 * 60))
    const hours = Math.floor(ageInMinutes / 60)
    const minutes = ageInMinutes % 60
    
    let ageDisplay = ''
    if (hours > 0) {
      ageDisplay = `${hours}h ${minutes}m`
    } else {
      ageDisplay = `${minutes}m`
    }

    // Prepare response data for cart
    const cartData = {
      items: items,
      customer: heldOrder.customer,
      subtotal: heldOrder.subtotal,
      gst: heldOrder.gst,
      discount: heldOrder.discount,
      total: heldOrder.total,
      tableNumber: heldOrder.tableNumber,
      orderName: heldOrder.orderName,
      notes: heldOrder.notes,
      metadata: heldOrder.metadata ? JSON.parse(heldOrder.metadata) : null
    }

    const response = {
      success: true,
      message: 'Held order retrieved successfully',
      cart: cartData,
      order: {
        ...retrievedOrder,
        items: undefined, // Remove raw JSON data
        itemsData: undefined,
        age: ageInMinutes,
        ageDisplay
      }
    }

    return NextResponse.json(response, { status: 200 })

  } catch (error) {
    console.error('Error retrieving held order:', error)
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    )
  }
}