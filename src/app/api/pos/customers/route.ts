import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'

// Get all customers
export async function GET() {
  try {
    const customers = await db.customer.findMany({
      orderBy: { name: 'asc' },
    })

    return NextResponse.json(customers)
  } catch (error) {
    console.error('Error fetching customers:', error)
    return NextResponse.json({ error: 'Failed to fetch customers' }, { status: 500 })
  }
}

// Create new customer
export async function POST(request: NextRequest) {
  try {
    const body = await request.json()
    const { name, email, phone, address } = body

    if (!name) {
      return NextResponse.json({ error: 'Name is required' }, { status: 400 })
    }

    // Get or create store
    let store = await db.store.findFirst()
    if (!store) {
      store = await db.store.create({
        data: {
          name: 'My Store',
          taxRate: 0,
          currency: 'USD',
        },
      })
    }

    const customer = await db.customer.create({
      data: {
        name,
        email,
        phone,
        address,
        storeId: store.id,
        points: 0,
      },
    })

    return NextResponse.json(customer, { status: 201 })
  } catch (error: any) {
    console.error('Error creating customer:', error)
    if (error.code === 'P2002') {
      return NextResponse.json({ error: 'Email already exists' }, { status: 400 })
    }
    return NextResponse.json({ error: 'Failed to create customer' }, { status: 500 })
  }
}
