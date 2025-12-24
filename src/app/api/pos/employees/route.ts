import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { auth } from '@clerk/nextjs/server'

// Get all employees
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

    if (!employee || (employee.role !== 'admin' && employee.role !== 'manager')) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
    }

    const employees = await db.employee.findMany({
      orderBy: { createdAt: 'desc' },
    })

    return NextResponse.json(employees)
  } catch (error) {
    console.error('Error fetching employees:', error)
    return NextResponse.json({ error: 'Failed to fetch employees' }, { status: 500 })
  }
}

// Create new employee
export async function POST(request: NextRequest) {
  try {
    const { userId } = await auth()

    if (!userId) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    // Verify user is admin
    const adminEmployee = await db.employee.findFirst({
      where: { clerkId: userId },
    })

    if (!adminEmployee || adminEmployee.role !== 'admin') {
      return NextResponse.json({ error: 'Only admins can create employees' }, { status: 403 })
    }

    // Check employee count limit (max 3 employees including admin)
    const employeeCount = await db.employee.count()
    if (employeeCount >= 3) {
      return NextResponse.json(
        { error: 'Maximum number of employees reached (3)' },
        { status: 400 }
      )
    }

    const body = await request.json()
    const { name, email, phone, role, clerkId } = body

    if (!name || !email || !role) {
      return NextResponse.json(
        { error: 'Name, email, and role are required' },
        { status: 400 }
      )
    }

    // Get store
    const store = await db.store.findFirst()
    if (!store) {
      return NextResponse.json({ error: 'Store not found' }, { status: 404 })
    }

    const employee = await db.employee.create({
      data: {
        clerkId,
        name,
        email,
        phone,
        role,
        storeId: store.id,
      },
    })

    return NextResponse.json(employee, { status: 201 })
  } catch (error: any) {
    console.error('Error creating employee:', error)
    if (error.code === 'P2002') {
      return NextResponse.json({ error: 'Email already exists' }, { status: 400 })
    }
    return NextResponse.json({ error: 'Failed to create employee' }, { status: 500 })
  }
}
