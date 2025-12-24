import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { auth } from '@clerk/nextjs/server'

// Get single employee
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { userId } = await auth()
    const { id } = await params

    if (!userId) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const employee = await db.employee.findUnique({
      where: { id },
    })

    if (!employee) {
      return NextResponse.json({ error: 'Employee not found' }, { status: 404 })
    }

    // Verify user can access this employee info
    const currentUser = await db.employee.findFirst({
      where: { clerkId: userId },
    })

    if (!currentUser || (currentUser.role !== 'admin' && currentUser.clerkId !== employee.clerkId)) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
    }

    return NextResponse.json(employee)
  } catch (error) {
    console.error('Error fetching employee:', error)
    return NextResponse.json({ error: 'Failed to fetch employee' }, { status: 500 })
  }
}

// Update employee
export async function PUT(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { userId } = await auth()
    const { id } = await params

    if (!userId) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const body = await request.json()
    const { name, phone, role, isActive, clerkId } = body

    // Verify user is admin or updating their own profile
    const currentUser = await db.employee.findFirst({
      where: { clerkId: userId },
    })

    if (!currentUser) {
      return NextResponse.json({ error: 'Employee not found' }, { status: 404 })
    }

    const targetEmployee = await db.employee.findUnique({
      where: { id },
    })

    if (!targetEmployee) {
      return NextResponse.json({ error: 'Employee not found' }, { status: 404 })
    }

    // Only admins can change roles or clerkId
    if (currentUser.role !== 'admin' && (role || clerkId)) {
      return NextResponse.json(
        { error: 'Only admins can change roles' },
        { status: 403 }
      )
    }

    // Only admins or the employee themselves can update their profile
    if (currentUser.role !== 'admin' && currentUser.clerkId !== targetEmployee.clerkId) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
    }

    const employee = await db.employee.update({
      where: { id },
      data: {
        name,
        phone,
        role: currentUser.role === 'admin' ? role : targetEmployee.role,
        isActive: currentUser.role === 'admin' ? isActive : targetEmployee.isActive,
        clerkId: currentUser.role === 'admin' ? clerkId : targetEmployee.clerkId,
      },
    })

    return NextResponse.json(employee)
  } catch (error: any) {
    console.error('Error updating employee:', error)
    if (error.code === 'P2002') {
      return NextResponse.json({ error: 'Email already exists' }, { status: 400 })
    }
    return NextResponse.json({ error: 'Failed to update employee' }, { status: 500 })
  }
}

// Delete employee
export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { userId } = await auth()
    const { id } = await params

    if (!userId) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    // Verify user is admin
    const currentUser = await db.employee.findFirst({
      where: { clerkId: userId },
    })

    if (!currentUser || currentUser.role !== 'admin') {
      return NextResponse.json({ error: 'Only admins can delete employees' }, { status: 403 })
    }

    await db.employee.delete({
      where: { id },
    })

    return NextResponse.json({ success: true })
  } catch (error) {
    console.error('Error deleting employee:', error)
    return NextResponse.json({ error: 'Failed to delete employee' }, { status: 500 })
  }
}
