import { NextRequest, NextResponse } from 'next/server'
import { PrismaClient } from '@prisma/client'
import { getAuth } from '@clerk/nextjs/server'

const prisma = new PrismaClient()

export async function GET(request: NextRequest) {
  try {
    const { userId } = getAuth(request)
    if (!userId) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const { searchParams } = new URL(request.url)
    const storeId = searchParams.get('storeId')
    const employeeId = searchParams.get('employeeId')

    if (!storeId) {
      return NextResponse.json({ error: 'Store ID is required' }, { status: 400 })
    }

    // Find employee by Clerk user ID if employeeId not provided
    let actualEmployeeId = employeeId
    if (!actualEmployeeId) {
      const employee = await prisma.employee.findFirst({
        where: {
          clerkId: userId,
          storeId
        }
      })
      
      if (!employee) {
        return NextResponse.json({ error: 'Employee not found' }, { status: 404 })
      }
      
      actualEmployeeId = employee.id
    }

    // Find active shift
    const activeShift = await prisma.shift.findFirst({
      where: {
        employeeId: actualEmployeeId,
        storeId,
        status: 'active'
      },
      include: {
        employee: {
          select: {
            id: true,
            name: true,
            email: true,
            role: true
          }
        },
        cashTransactions: {
          orderBy: { createdAt: 'desc' },
          take: 10 // Latest 10 transactions
        },
        cashCounts: {
          orderBy: { createdAt: 'desc' },
          take: 5 // Latest 5 counts
        }
      }
    })

    if (!activeShift) {
      return NextResponse.json({ 
        hasActiveShift: false,
        message: 'No active shift found' 
      })
    }

    // Calculate metrics
    const totalSales = activeShift.cashTransactions
      .filter(t => t.type === 'sale')
      .reduce((sum, t) => sum + t.amount, 0)
    
    const totalCashIn = activeShift.cashTransactions
      .filter(t => t.type === 'cash_in')
      .reduce((sum, t) => sum + t.amount, 0)
    
    const totalCashOut = activeShift.cashTransactions
      .filter(t => t.type === 'cash_out')
      .reduce((sum, t) => sum + t.amount, 0)

    const expectedCash = activeShift.startingCash + totalSales + totalCashIn - totalCashOut

    return NextResponse.json({
      hasActiveShift: true,
      shift: {
        ...activeShift,
        metrics: {
          totalSales,
          totalCashIn,
          totalCashOut,
          expectedCash,
          transactionCount: activeShift.cashTransactions.length
        }
      }
    })
  } catch (error) {
    console.error('Error fetching current shift:', error)
    return NextResponse.json(
      { error: 'Failed to fetch current shift' },
      { status: 500 }
    )
  }
}