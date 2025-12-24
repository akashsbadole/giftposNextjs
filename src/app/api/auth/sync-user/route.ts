import { NextRequest, NextResponse } from 'next/server'
import { auth } from '@clerk/nextjs/server'
import { db } from '@/lib/db'
import { isUserAllowed, getAccessDenialReason } from '@/lib/access-control'

// Sync current user or get employee info
export async function GET() {
  try {
    const { userId, sessionClaims } = await auth()

    if (!userId) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    // Check if user is in allowed list
    const email = sessionClaims?.email as string
    const isAllowed = isUserAllowed(userId, email)
    if (!isAllowed) {
      // Return 401 Unauthorized to trigger redirect to login page
      return NextResponse.json(
        { error: 'Unauthorized' },
        { status: 401 }
      )
    }

    // Check if employee exists for this clerk user
    let employee = await db.employee.findFirst({
      where: { clerkId: userId },
    })

    // If employee doesn't exist, try to create one
    if (!employee) {
      const email = sessionClaims?.email as string | undefined
      const name = (sessionClaims?.name as string) || email?.split('@')[0] || 'User'

      // Get or create store
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

      // Check employee count
      const employeeCount = await db.employee.count()
      if (employeeCount >= 3) {
        return NextResponse.json(
          { error: 'Maximum number of employees reached (3)' },
          { status: 400 }
        )
      }

      // Create employee - handle email for unique constraint
      const employeeData: any = {
        clerkId: userId,
        name,
        storeId: store.id,
        role: employeeCount === 0 ? 'admin' : 'staff', // First user becomes admin
      }
      
      // Set email only if available and valid, otherwise generate a unique identifier
      if (email && email.trim()) {
        employeeData.email = email.toLowerCase()
      } else {
        // Generate a unique identifier for users without email
        employeeData.email = `user_${userId}@pos.local`
      }
      
      employee = await db.employee.create({
        data: employeeData,
      })
    }

    return NextResponse.json(employee)
  } catch (error: any) {
    console.error('Error syncing user:', error)
    console.error('Error details:', {
      message: error.message,
      code: error.code,
      stack: error.stack
    })
    if (error.code === 'P2002') {
      return NextResponse.json({ error: 'Email already registered' }, { status: 400 })
    }
    return NextResponse.json({
      error: 'Failed to sync user',
      details: process.env.NODE_ENV === 'development' ? error.message : undefined
    }, { status: 500 })
  }
}
