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
    const shiftId = searchParams.get('shiftId')
    const reportDate = searchParams.get('reportDate')
    const status = searchParams.get('status')
    const limit = parseInt(searchParams.get('limit') || '50')

    if (!storeId) {
      return NextResponse.json({ error: 'Store ID is required' }, { status: 400 })
    }

    const where: any = { storeId }
    
    if (shiftId) where.shiftId = shiftId
    if (status) where.status = status
    if (reportDate) {
      const date = new Date(reportDate)
      const startOfDay = new Date(date.setHours(0, 0, 0, 0))
      const endOfDay = new Date(date.setHours(23, 59, 59, 999))
      where.reportDate = {
        gte: startOfDay,
        lte: endOfDay
      }
    }

    const zReports = await prisma.zReport.findMany({
      where,
      include: {
        shift: {
          include: {
            employee: {
              select: {
                id: true,
                name: true,
                email: true
              }
            }
          }
        }
      },
      orderBy: { reportDate: 'desc' },
      take: limit
    })

    // Parse JSON fields for each report
    const reportsWithParsedData = zReports.map(report => ({
      ...report,
      taxBreakdown: report.taxBreakdown ? JSON.parse(report.taxBreakdown) : null,
      reportData: report.reportData ? JSON.parse(report.reportData) : null
    }))

    return NextResponse.json(reportsWithParsedData)
  } catch (error) {
    console.error('Error fetching Z-reports:', error)
    return NextResponse.json(
      { error: 'Failed to fetch Z-reports' },
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
    const { shiftId, reportPeriod, customDate, reportData } = body

    if (!shiftId) {
      return NextResponse.json({ error: 'Shift ID is required' }, { status: 400 })
    }

    // Verify shift exists
    const shift = await prisma.shift.findUnique({
      where: { id: shiftId },
      include: {
        cashTransactions: true,
        store: true
      }
    })

    if (!shift) {
      return NextResponse.json({ error: 'Shift not found' }, { status: 404 })
    }

    if (shift.status !== 'closed') {
      return NextResponse.json(
        { error: 'Cannot generate Z-report for an open shift' },
        { status: 400 }
      )
    }

    // Calculate report data
    const totalSales = shift.cashTransactions
      .filter(t => t.type === 'sale')
      .reduce((sum, t) => sum + t.amount, 0)

    const totalTransactions = shift.cashTransactions
      .filter(t => t.type === 'sale')
      .length

    const cashSales = shift.cashTransactions
      .filter(t => t.type === 'sale')
      .reduce((sum, t) => sum + t.amount, 0)

    const cardSales = 0 // TODO: Calculate from actual payment transactions
    const digitalSales = 0 // TODO: Calculate from actual payment transactions

    const totalCashIn = shift.cashTransactions
      .filter(t => t.type === 'cash_in')
      .reduce((sum, t) => sum + t.amount, 0)

    const totalCashOut = shift.cashTransactions
      .filter(t => t.type === 'cash_out')
      .reduce((sum, t) => sum + t.amount, 0)

    const cashAdjustments = totalCashIn - totalCashOut
    const openingCash = shift.startingCash
    const closingCash = shift.actualCash || shift.expectedCash
    const cashVariance = shift.cashVariance || 0

    // Calculate tax data (simplified - would need to integrate with actual tax calculations)
    const totalTax = totalSales * 0.1 // 10% GST assumption
    const taxBreakdown = {
      GST: totalTax,
      CGST: totalTax / 2,
      SGST: totalTax / 2
    }

    // Additional metrics
    const refundAmount = shift.cashTransactions
      .filter(t => t.type === 'refund')
      .reduce((sum, t) => sum + t.amount, 0)

    const discountAmount = 0 // Would need to calculate from actual sales data

    // Create Z-report
    const zReport = await prisma.zReport.create({
      data: {
        shiftId,
        storeId: shift.storeId,
        reportDate: customDate ? new Date(customDate) : new Date(),
        reportPeriod: reportPeriod || 'daily',
        totalSales,
        totalTransactions,
        cashSales,
        cardSales,
        digitalSales,
        openingCash,
        closingCash,
        cashVariance,
        cashAdjustments,
        totalTax,
        taxBreakdown: JSON.stringify(taxBreakdown),
        refundAmount,
        discountAmount,
        reportData: reportData ? JSON.stringify(reportData) : null,
        status: 'generated'
      },
      include: {
        shift: {
          include: {
            employee: {
              select: {
                id: true,
                name: true,
                email: true
              }
            }
          }
        }
      }
    })

    return NextResponse.json({
      ...zReport,
      taxBreakdown,
      reportData: reportData || null
    }, { status: 201 })
  } catch (error) {
    console.error('Error creating Z-report:', error)
    return NextResponse.json(
      { error: 'Failed to create Z-report' },
      { status: 500 }
    )
  }
}