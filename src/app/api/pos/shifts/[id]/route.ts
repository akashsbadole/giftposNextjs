import { NextRequest, NextResponse } from 'next/server'
import { PrismaClient } from '@prisma/client'
import { getAuth } from '@clerk/nextjs/server'

const prisma = new PrismaClient()

export async function GET(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const { userId } = getAuth(request)
    if (!userId) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const shift = await prisma.shift.findUnique({
      where: { id: params.id },
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
          orderBy: { createdAt: 'desc' }
        },
        cashCounts: {
          orderBy: { createdAt: 'desc' }
        },
        zReports: {
          orderBy: { createdAt: 'desc' }
        }
      }
    })

    if (!shift) {
      return NextResponse.json({ error: 'Shift not found' }, { status: 404 })
    }

    // Calculate metrics
    const totalSales = shift.cashTransactions
      .filter(t => t.type === 'sale')
      .reduce((sum, t) => sum + t.amount, 0)
    
    const totalCashIn = shift.cashTransactions
      .filter(t => t.type === 'cash_in')
      .reduce((sum, t) => sum + t.amount, 0)
    
    const totalCashOut = shift.cashTransactions
      .filter(t => t.type === 'cash_out')
      .reduce((sum, t) => sum + t.amount, 0)

    const expectedCash = shift.startingCash + totalSales + totalCashIn - totalCashOut

    return NextResponse.json({
      ...shift,
      metrics: {
        totalSales,
        totalCashIn,
        totalCashOut,
        expectedCash,
        transactionCount: shift.cashTransactions.length
      }
    })
  } catch (error) {
    console.error('Error fetching shift:', error)
    return NextResponse.json(
      { error: 'Failed to fetch shift' },
      { status: 500 }
    )
  }
}

export async function PATCH(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const { userId } = getAuth(request)
    if (!userId) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const body = await request.json()
    const { status, actualCash, notes, handoverTo, handoverNotes } = body

    const shift = await prisma.shift.findUnique({
      where: { id: params.id },
      include: { cashTransactions: true }
    })

    if (!shift) {
      return NextResponse.json({ error: 'Shift not found' }, { status: 404 })
    }

    const updateData: any = {}
    
    if (status) updateData.status = status
    if (notes !== undefined) updateData.notes = notes
    if (handoverTo !== undefined) updateData.handoverTo = handoverTo
    if (handoverNotes !== undefined) updateData.handoverNotes = handoverNotes

    // If closing the shift, calculate final cash
    if (status === 'closed' && actualCash !== undefined) {
      updateData.actualCash = actualCash
      updateData.endTime = new Date()
      
      const totalSales = shift.cashTransactions
        .filter(t => t.type === 'sale')
        .reduce((sum, t) => sum + t.amount, 0)
      
      const totalCashIn = shift.cashTransactions
        .filter(t => t.type === 'cash_in')
        .reduce((sum, t) => sum + t.amount, 0)
      
      const totalCashOut = shift.cashTransactions
        .filter(t => t.type === 'cash_out')
        .reduce((sum, t) => sum + t.amount, 0)

      const expectedCash = shift.startingCash + totalSales + totalCashIn - totalCashOut
      updateData.expectedCash = expectedCash
      updateData.cashVariance = actualCash - expectedCash

      // Auto-generate Z-report if variance is acceptable (within ₹10)
      if (Math.abs(updateData.cashVariance) <= 10) {
        try {
          await generateZReport(params.id, userId)
        } catch (zReportError) {
          console.error('Failed to auto-generate Z-report:', zReportError)
          // Don't fail the shift closure if Z-report generation fails
        }
      }
    }

    // Handle break status
    if (status === 'break') {
      updateData.isBreak = true
      updateData.breakStart = new Date()
    } else if (status === 'active' && shift.isBreak) {
      updateData.isBreak = false
      updateData.breakEnd = new Date()
    }

    const updatedShift = await prisma.shift.update({
      where: { id: params.id },
      data: updateData,
      include: {
        employee: {
          select: {
            id: true,
            name: true,
            email: true,
            role: true
          }
        },
        cashTransactions: true,
        cashCounts: true
      }
    })

    return NextResponse.json(updatedShift)
  } catch (error) {
    console.error('Error updating shift:', error)
    return NextResponse.json(
      { error: 'Failed to update shift' },
      { status: 500 }
    )
  }
}

export async function DELETE(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const { userId } = getAuth(request)
    if (!userId) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    // Check if shift exists and is in a deletable state
    const shift = await prisma.shift.findUnique({
      where: { id: params.id }
    })

    if (!shift) {
      return NextResponse.json({ error: 'Shift not found' }, { status: 404 })
    }

    if (shift.status === 'active') {
      return NextResponse.json(
        { error: 'Cannot delete an active shift. Close the shift first.' },
        { status: 400 }
      )
    }

    await prisma.shift.delete({
      where: { id: params.id }
    })

    return NextResponse.json({ message: 'Shift deleted successfully' })
  } catch (error) {
    console.error('Error deleting shift:', error)
    return NextResponse.json(
      { error: 'Failed to delete shift' },
      { status: 500 }
    )
  }
}

// Helper function to generate Z-report
async function generateZReport(shiftId: string, userId: string) {
  const shift = await prisma.shift.findUnique({
    where: { id: shiftId },
    include: {
      cashTransactions: true,
      store: true
    }
  })

  if (!shift) return

  const totalSales = shift.cashTransactions
    .filter(t => t.type === 'sale')
    .reduce((sum, t) => sum + t.amount, 0)

  const totalTransactions = shift.cashTransactions
    .filter(t => t.type === 'sale')
    .length

  const cashSales = shift.cashTransactions
    .filter(t => t.type === 'sale')
    .reduce((sum, t) => sum + t.amount, 0)

  const cardSales = 0 // TODO: Calculate from payment transactions
  const digitalSales = 0 // TODO: Calculate from payment transactions

  const totalCashIn = shift.cashTransactions
    .filter(t => t.type === 'cash_in')
    .reduce((sum, t) => sum + t.amount, 0)

  const totalCashOut = shift.cashTransactions
    .filter(t => t.type === 'cash_out')
    .reduce((sum, t) => sum + t.amount, 0)

  const expectedCash = shift.startingCash + totalSales + totalCashIn - totalCashOut

  await prisma.zReport.create({
    data: {
      shiftId,
      storeId: shift.storeId,
      reportDate: new Date(),
      reportPeriod: 'daily',
      totalSales,
      totalTransactions,
      cashSales,
      cardSales,
      digitalSales,
      openingCash: shift.startingCash,
      closingCash: shift.actualCash || expectedCash,
      cashVariance: shift.cashVariance || 0,
      cashAdjustments: totalCashIn - totalCashOut,
      status: 'generated'
    }
  })
}