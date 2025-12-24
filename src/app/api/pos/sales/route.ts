import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { v4 as uuidv4 } from 'uuid'
import { auth } from '@clerk/nextjs/server'

// Get all sales
export async function GET() {
  try {
    const { userId } = await auth()

    if (!userId) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    // Verify user is an employee
    const employee = await db.employee.findFirst({
      where: { clerkId: userId },
    })

    if (!employee) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
    }

    const sales = await db.sale.findMany({
      include: {
        items: {
          include: {
            product: true,
          },
        },
        customer: true,
        employee: true,
      },
      orderBy: { createdAt: 'desc' },
      take: 100, // Limit to last 100 sales
    })

    return NextResponse.json(sales)
  } catch (error) {
    console.error('Error fetching sales:', error)
    return NextResponse.json({ error: 'Failed to fetch sales' }, { status: 500 })
  }
}

// Create new sale
export async function POST(request: NextRequest) {
  try {
    const { userId } = await auth()

    if (!userId) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    // Verify user is an employee
    const employee = await db.employee.findFirst({
      where: { clerkId: userId },
    })

    if (!employee) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
    }

    const body = await request.json()
    const { items, subtotal, gst, discount, total, paymentMethod, customerId } = body

    if (!items || items.length === 0) {
      return NextResponse.json({ error: 'Sale must contain at least one item' }, { status: 400 })
    }

    // Get store
    let store = await db.store.findFirst()
    if (!store) {
      store = await db.store.create({
        data: {
          name: 'My Store',
          gstRate: 10,
          currency: 'USD',
        },
      })
    }

    // Generate invoice number
    const invoiceNumber = `INV-${Date.now()}-${Math.random().toString(36).substr(2, 9).toUpperCase()}`

    // Create sale with items in a transaction
    const sale = await db.sale.create({
      data: {
        invoiceNumber,
        subtotal,
        tax: gst || 0, // Keep compatibility with old field
        gst: gst || 0,
        discount,
        total,
        paymentMethod,
        status: 'completed',
        storeId: store.id,
        customerId: customerId || null,
        employeeId: employee.id,
        items: {
          create: items.map((item: any) => ({
            productId: item.productId,
            quantity: item.quantity,
            price: item.price,
            subtotal: item.subtotal,
          })),
        },
        payment: {
          create: {
            amount: total,
            method: paymentMethod,
            status: 'completed',
          },
        },
      },
      include: {
        items: {
          include: {
            product: true,
          },
        },
        customer: true,
        payment: true,
      },
    })

    // Update product stock and create stock logs
    for (const item of items) {
      await db.product.update({
        where: { id: item.productId },
        data: {
          stock: {
            decrement: item.quantity,
          },
        },
      })

      await db.stockLog.create({
        data: {
          quantity: -item.quantity,
          type: 'sale',
          reason: `Sale #${sale.invoiceNumber}`,
          productId: item.productId,
          employeeId: employee.id,
        },
      })
    }

    // Add loyalty points to customer if applicable
    if (customerId) {
      const pointsEarned = Math.floor(total)
      await db.customer.update({
        where: { id: customerId },
        data: {
          points: {
            increment: pointsEarned,
          },
        },
      })
    }

    return NextResponse.json(sale, { status: 201 })
  } catch (error) {
    console.error('Error creating sale:', error)
    return NextResponse.json({ error: 'Failed to create sale' }, { status: 500 })
  }
}
