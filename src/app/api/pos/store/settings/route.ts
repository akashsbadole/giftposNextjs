import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { auth } from '@clerk/nextjs/server'

// Get store settings
export async function GET() {
  try {
    let store = await db.store.findFirst()

    // If no store exists, create default store
    if (!store) {
      store = await db.store.create({
        data: {
          name: 'My Store',
          gstRate: 10,
          currency: 'USD',
        },
      })
    }

    return NextResponse.json(store)
  } catch (error) {
    console.error('Error fetching store settings:', error)
    return NextResponse.json({ error: 'Failed to fetch store settings' }, { status: 500 })
  }
}

// Update store settings
export async function POST(request: NextRequest) {
  try {
    const { userId } = await auth()

    if (!userId) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    // Verify user is admin or manager
    const employee = await db.employee.findFirst({
      where: { clerkId: userId },
    })

    if (!employee || (employee.role !== 'admin' && employee.role !== 'manager')) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
    }

    const body = await request.json()
    const { name, address, phone, email, taxRate, gstRate, currency } = body

    let store = await db.store.findFirst()

    if (!store) {
      store = await db.store.create({
        data: {
          name: name || 'My Store',
          address,
          phone,
          email,
          taxRate: taxRate || 0,
          gstRate: gstRate || 10,
          currency: currency || 'USD',
        },
      })
    } else {
      store = await db.store.update({
        where: { id: store.id },
        data: {
          name,
          address,
          phone,
          email,
          taxRate,
          gstRate,
          currency,
        },
      })
    }

    return NextResponse.json(store)
  } catch (error) {
    console.error('Error updating store settings:', error)
    return NextResponse.json({ error: 'Failed to update store settings' }, { status: 500 })
  }
}
