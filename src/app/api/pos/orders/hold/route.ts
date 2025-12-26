import { NextRequest, NextResponse } from 'next/server'
import { PrismaClient } from '@prisma/client'
import { auth } from '@clerk/nextjs/server'

const prisma = new PrismaClient()

// GET /api/pos/orders/hold - List all active held orders
export async function GET(request: NextRequest) {
  try {
    const { userId } = await auth()
    if (!userId) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const { searchParams } = new URL(request.url)
    const storeId = searchParams.get('storeId')
    const status = searchParams.get('status') || 'held'
    const search = searchParams.get('search') || ''
    const customerId = searchParams.get('customerId')
    const tableNumber = searchParams.get('tableNumber')
    const limit = parseInt(searchParams.get('limit') || '50')
    const offset = parseInt(searchParams.get('offset') || '0')

    if (!storeId) {
      return NextResponse.json({ error: 'Store ID is required' }, { status: 400 })
    }

    // Build where clause
    const where: any = {
      storeId,
      status
    }

    if (search) {
      where.OR = [
        { orderNumber: { contains: search, mode: 'insensitive' } },
        { orderName: { contains: search, mode: 'insensitive' } },
        { customer: { name: { contains: search, mode: 'insensitive' } } },
        { tableNumber: { contains: search, mode: 'insensitive' } }
      ]
    }

    if (customerId) {
      where.customerId = customerId
    }

    if (tableNumber) {
      where.tableNumber = tableNumber
    }

    // Get held orders with related data
    const heldOrders = await prisma.heldOrder.findMany({
      where,
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
      },
      orderBy: [
        { priority: 'desc' },
        { createdAt: 'asc' }
      ],
      take: limit,
      skip: offset
    })

    // Calculate age for each order
    const ordersWithAge = heldOrders.map(order => {
      const ageInMinutes = Math.floor((Date.now() - order.createdAt.getTime()) / (1000 * 60))
      const hours = Math.floor(ageInMinutes / 60)
      const minutes = ageInMinutes % 60
      
      let ageDisplay = ''
      if (hours > 0) {
        ageDisplay = `${hours}h ${minutes}m`
      } else {
        ageDisplay = `${minutes}m`
      }

      // Parse items data to get item count
      let itemCount = 0
      try {
        const items = JSON.parse(order.itemsData)
        itemCount = Array.isArray(items) ? items.length : 0
      } catch (error) {
        itemCount = 0
      }

      return {
        ...order,
        age: ageInMinutes,
        ageDisplay,
        itemCount,
        itemsData: undefined // Remove raw JSON data from response
      }
    })

    // Get total count for pagination
    const totalCount = await prisma.heldOrder.count({ where })

    return NextResponse.json({
      data: ordersWithAge,
      pagination: {
        total: totalCount,
        limit,
        offset,
        hasMore: offset + limit < totalCount
      }
    })

  } catch (error) {
    console.error('Error fetching held orders:', error)
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    )
  }
}

// POST /api/pos/orders/hold - Save current cart as held order
export async function POST(request: NextRequest) {
  try {
    const { userId } = await auth()
    if (!userId) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const body = await request.json()
    const {
      items,
      customerId,
      tableNumber,
      orderName,
      subtotal,
      gst,
      discount,
      total,
      notes,
      priority,
      holdDuration,
      isAutoSaved,
      tags,
      metadata
    } = body

    // Validate required fields
    if (!items || !Array.isArray(items) || items.length === 0) {
      return NextResponse.json(
        { error: 'Items array is required' },
        { status: 400 }
      )
    }

    if (!total || total <= 0) {
      return NextResponse.json(
        { error: 'Valid total amount is required' },
        { status: 400 }
      )
    }

    // Get store ID from session (this would need to be implemented based on your auth setup)
    const storeId = body.storeId // This should come from the authenticated user's store

    if (!storeId) {
      return NextResponse.json({ error: 'Store ID is required' }, { status: 400 })
    }

    // Generate unique order number
    const orderNumber = `ORD-${Date.now()}-${Math.random().toString(36).substr(2, 6).toUpperCase()}`

    // Create held order
    const heldOrder = await prisma.heldOrder.create({
      data: {
        orderNumber,
        customerId: customerId || null,
        employeeId: body.employeeId || null, // Get from session
        tableNumber: tableNumber || null,
        orderName: orderName || null,
        itemsData: JSON.stringify(items),
        subtotal: subtotal || 0,
        gst: gst || 0,
        discount: discount || 0,
        total,
        notes: notes || null,
        status: 'held',
        priority: priority || 0,
        holdDuration: holdDuration || null,
        isAutoSaved: isAutoSaved || false,
        tags: tags ? JSON.stringify(tags) : null,
        metadata: metadata ? JSON.stringify(metadata) : null,
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

    // Parse items for response
    let itemsData = []
    try {
      itemsData = JSON.parse(heldOrder.itemsData)
    } catch (error) {
      console.error('Error parsing items data:', error)
    }

    const response = {
      ...heldOrder,
      items: itemsData,
      itemsData: undefined // Remove raw JSON data from response
    }

    return NextResponse.json(response, { status: 201 })

  } catch (error) {
    console.error('Error creating held order:', error)
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    )
  }
}