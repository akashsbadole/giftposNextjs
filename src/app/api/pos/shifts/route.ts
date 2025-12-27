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
    const status = searchParams.get('status')
    const limit = parseInt(searchParams.get('limit') || '50')

    if (!storeId) {
      return NextResponse.json({ error: 'Store ID is required' }, { status: 400 })
    }

    const where: any = { storeId }
    
    if (employeeId) where.employeeId = employeeId
    if (status) where.status = status

    const shifts = await prisma.shift.findMany({
      where,
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
          select: {
            id: true,
            type: true,
            amount: true,
            createdAt: true
          },
          orderBy: { createdAt: 'desc' }
        },
        cashCounts: {
          select: {
            id: true,
            countType: true,
            expectedAmount: true,
            actualAmount: true,
            variance: true,
            status: true,
            createdAt: true
          },
          orderBy: { createdAt: 'desc' }
        }
      },
      orderBy: { startTime: 'desc' },
      take: limit
    })

    // Calculate additional metrics for each shift
    const shiftsWithMetrics = shifts.map(shift => {
      const totalSales = shift.cashTransactions
        .filter(t => t.type === 'sale')
        .reduce((sum, t) => sum + t.amount, 0)
      
      const totalCashIn = shift.cashTransactions
        .filter(t => t.type === 'cash_in')
        .reduce((sum, t) => sum + t.amount, 0)
      
      const totalCashOut = shift.cashTransactions
        .filter(t => t.type === 'cash_out')
        .reduce((sum, t) => sum + t.amount, 0)

      return {
        ...shift,
        metrics: {
          totalSales,
          totalCashIn,
          totalCashOut,
          transactionCount: shift.cashTransactions.length
        }
      }
    })

    return NextResponse.json(shiftsWithMetrics)
  } catch (error) {
    console.error('Error fetching shifts:', error)
    return NextResponse.json(
      { error: 'Failed to fetch shifts' },
      { status: 500 }
    )
  }
}

export async function POST(request: NextRequest) {
  try {
    const { userId } = getAuth(request)
    if (!userId) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const body = await request.json()
    const { employeeId, storeId, startingCash, notes } = body

    if (!employeeId || !storeId) {
      return NextResponse.json(
        { error: 'Employee ID and Store ID are required' },
        { status: 400 }
      )
    }

    // Check if employee already has an active shift
    const existingShift = await prisma.shift.findFirst({
      where: {
        employeeId,
        storeId,
        status: 'active'
      }
    })

    if (existingShift) {
      return NextResponse.json(
        { error: 'Employee already has an active shift' },
        { status: 400 }
      )
    }

    // Create new shift
    const shift = await prisma.shift.create({
      data: {
        employeeId,
        storeId,
        startingCash: startingCash || 0,
        status: 'active',
        notes,
        createdBy: userId
      },
      include: {
        employee: {
          select: {
            id: true,
            name: true,
            email: true,
            role: true
          }
        }
      }
    })

    // Create initial cash transaction if starting cash is provided
    if (startingCash && startingCash > 0) {
      await prisma.cashTransaction.create({
        data: {
          shiftId: shift.id,
          type: 'cash_in',
          amount: startingCash,
          reason: 'Starting cash for shift',
          createdBy: userId
        }
      })
    }

    return NextResponse.json(shift, { status: 201 })
  } catch (error) {
    console.error('Error creating shift:', error)
    return NextResponse.json(
      { error: 'Failed to create shift' },
      { status: 500 }
    )
  }
}