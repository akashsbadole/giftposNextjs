/**
 * Tax Reporting & Compliance API
 * Generates GST returns, tax liability reports, and compliance documentation
 */

import { NextRequest, NextResponse } from 'next/server'
import { PrismaClient } from '@prisma/client'
import { getStoreFromRequest } from '@/lib/db'
import { z } from 'zod'

const prisma = new PrismaClient()

// Validation schemas
const ReportRequestSchema = z.object({
  reportType: z.enum(['GSTR1', 'GSTR3B', 'monthly_summary', 'annual_summary', 'tax_liability', 'input_tax_credit']),
  reportPeriod: z.string(), // Format: YYYY-MM or YYYY
  startDate: z.string().datetime().optional(),
  endDate: z.string().datetime().optional(),
  includeDetails: z.boolean().optional(),
  format: z.enum(['json', 'csv', 'excel']).optional()
})

const ComplianceReportSchema = z.object({
  storeId: z.string(),
  reportType: z.string(),
  reportPeriod: z.string(),
  data: z.record(z.any()),
  status: z.enum(['draft', 'generated', 'submitted', 'accepted', 'rejected']).optional(),
  remarks: z.string().optional()
})

/**
 * POST /api/pos/tax/reports
 * Generate tax compliance reports
 */
export async function POST(request: NextRequest) {
  try {
    const body = await request.json()
    
    // Validate request
    const validation = ReportRequestSchema.safeParse(body)
    if (!validation.success) {
      return NextResponse.json(
        { 
          error: 'Invalid request data',
          details: validation.error.errors 
        },
        { status: 400 }
      )
    }

    const { reportType, reportPeriod, startDate, endDate, includeDetails = false, format = 'json' } = validation.data
    
    const store = await getStoreFromRequest(request)
    if (!store) {
      return NextResponse.json(
        { error: 'Store not found' },
        { status: 404 }
      )
    }

    // Parse date range
    const { start, end } = parseReportPeriod(reportPeriod, startDate, endDate)
    
    let reportData

    switch (reportType) {
      case 'GSTR1':
        reportData = await generateGSTR1Report(store.id, start, end, includeDetails)
        break
      case 'GSTR3B':
        reportData = await generateGSTR3BReport(store.id, start, end, includeDetails)
        break
      case 'monthly_summary':
        reportData = await generateMonthlySummary(store.id, start, end)
        break
      case 'annual_summary':
        reportData = await generateAnnualSummary(store.id, start, end)
        break
      case 'tax_liability':
        reportData = await generateTaxLiabilityReport(store.id, start, end)
        break
      case 'input_tax_credit':
        reportData = await generateInputTaxCreditReport(store.id, start, end)
        break
      default:
        return NextResponse.json(
          { error: 'Unsupported report type' },
          { status: 400 }
        )
    }

    // Save report to database
    const savedReport = await prisma.taxComplianceReport.create({
      data: {
        storeId: store.id,
        reportType,
        reportPeriod,
        data: JSON.stringify(reportData),
        status: 'generated'
      }
    })

    // Format response based on requested format
    let response
    switch (format) {
      case 'csv':
        response = formatAsCSV(reportData, reportType)
        return new NextResponse(response, {
          headers: {
            'Content-Type': 'text/csv',
            'Content-Disposition': `attachment; filename="${reportType}_${reportPeriod}.csv"`
          }
        })
      case 'excel':
        // In a real implementation, you would generate an Excel file
        return NextResponse.json({
          error: 'Excel format not yet implemented',
          suggestion: 'Use JSON format for now'
        }, { status: 501 })
      default:
        response = {
          success: true,
          reportId: savedReport.id,
          reportType,
          reportPeriod,
          generatedAt: new Date().toISOString(),
          data: reportData
        }
    }

    return NextResponse.json(response)

  } catch (error) {
    console.error('Tax report generation error:', error)
    return NextResponse.json(
      { 
        error: 'Failed to generate tax report',
        message: error instanceof Error ? error.message : 'Unknown error'
      },
      { status: 500 }
    )
  }
}

/**
 * GET /api/pos/tax/reports
 * Get existing tax reports
 */
export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url)
    
    const store = await getStoreFromRequest(request)
    if (!store) {
      return NextResponse.json(
        { error: 'Store not found' },
        { status: 404 }
      )
    }

    const reportType = searchParams.get('reportType')
    const reportPeriod = searchParams.get('reportPeriod')
    const status = searchParams.get('status')
    const limit = parseInt(searchParams.get('limit') || '20')
    const offset = parseInt(searchParams.get('offset') || '0')

    const whereClause: any = { storeId: store.id }

    if (reportType) whereClause.reportType = reportType
    if (reportPeriod) whereClause.reportPeriod = reportPeriod
    if (status) whereClause.status = status

    const reports = await prisma.taxComplianceReport.findMany({
      where: whereClause,
      orderBy: { createdAt: 'desc' },
      take: limit,
      skip: offset
    })

    return NextResponse.json({
      success: true,
      data: reports,
      pagination: {
        limit,
        offset,
        total: await prisma.taxComplianceReport.count({ where: whereClause })
      }
    })

  } catch (error) {
    console.error('Tax reports fetch error:', error)
    return NextResponse.json(
      { 
        error: 'Failed to fetch tax reports',
        message: error instanceof Error ? error.message : 'Unknown error'
      },
      { status: 500 }
    )
  }
}

/**
 * PUT /api/pos/tax/reports
 * Update report status (submit, accept, reject)
 */
export async function PUT(request: NextRequest) {
  try {
    const body = await request.json()
    const { reportId, status, remarks } = body

    if (!reportId || !status) {
      return NextResponse.json(
        { error: 'Report ID and status are required' },
        { status: 400 }
      )
    }

    const validStatuses = ['draft', 'generated', 'submitted', 'accepted', 'rejected']
    if (!validStatuses.includes(status)) {
      return NextResponse.json(
        { error: 'Invalid status' },
        { status: 400 }
      )
    }

    const updateData: any = { status }
    
    if (status === 'submitted') {
      updateData.submittedAt = new Date()
    }

    if (remarks) {
      updateData.remarks = remarks
    }

    const report = await prisma.taxComplianceReport.update({
      where: { id: reportId },
      data: updateData
    })

    return NextResponse.json({
      success: true,
      data: report
    })

  } catch (error) {
    console.error('Tax report update error:', error)
    return NextResponse.json(
      { 
        error: 'Failed to update tax report',
        message: error instanceof Error ? error.message : 'Unknown error'
      },
      { status: 500 }
    )
  }
}

/**
 * DELETE /api/pos/tax/reports
 * Delete a tax report
 */
export async function DELETE(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url)
    const reportId = searchParams.get('reportId')

    if (!reportId) {
      return NextResponse.json(
        { error: 'Report ID is required' },
        { status: 400 }
      )
    }

    await prisma.taxComplianceReport.delete({
      where: { id: reportId }
    })

    return NextResponse.json({
      success: true,
      message: 'Report deleted successfully'
    })

  } catch (error) {
    console.error('Tax report deletion error:', error)
    return NextResponse.json(
      { 
        error: 'Failed to delete tax report',
        message: error instanceof Error ? error.message : 'Unknown error'
      },
      { status: 500 }
    )
  }
}

// Report generation functions

/**
 * Generate GSTR-1 Report (Outward Supplies)
 */
async function generateGSTR1Report(storeId: string, startDate: Date, endDate: Date, includeDetails: boolean) {
  const sales = await prisma.sale.findMany({
    where: {
      storeId,
      createdAt: {
        gte: startDate,
        lte: endDate
      },
      status: 'completed'
    },
    include: {
      customer: true,
      employee: true,
      items: {
        include: {
          product: {
            include: {
              category: true
            }
          }
        }
      },
      saleTaxBreakdowns: {
        include: {
          taxType: true,
          taxRate: {
            include: {
              region: true
            }
          }
        }
      }
    }
  })

  const reportData = {
    gstin: await getStoreGSTIN(storeId),
    period: `${startDate.toISOString().split('T')[0]} to ${endDate.toISOString().split('T')[0]}`,
    summary: {
      totalSales: sales.length,
      totalTaxableValue: 0,
      totalIGST: 0,
      totalCGST: 0,
      totalSGST: 0,
      totalCESS: 0
    },
    b2b_supplies: [],
    b2c_large_supplies: [],
    nil_rated_supplies: [],
    exempted_supplies: [],
    hsn_summary: []
  }

  // Process sales data
  for (const sale of sales) {
    const taxableValue = sale.subtotal
    const taxBreakdown = await calculateTaxBreakdownForSale(sale.id)
    
    reportData.summary.totalTaxableValue += taxableValue
    
    // Categorize sales
    if (sale.customer && sale.customer.gstin) {
      // B2B supplies
      reportData.b2b_supplies.push({
        ctin: sale.customer.gstin,
        inv_no: sale.invoiceNumber,
        inv_date: sale.createdAt.toISOString().split('T')[0],
        inv_value: sale.total,
        place_of_supply: await getCustomerState(sale.customerId),
        rate: taxBreakdown.rate,
        taxable_value: taxableValue,
        igst_amount: taxBreakdown.igst,
        cgst_amount: taxBreakdown.cgst,
        sgst_amount: taxBreakdown.sgst,
        cess_amount: taxBreakdown.cess
      })
    } else {
      // B2C supplies
      reportData.b2c_large_supplies.push({
        pos: await getCustomerState(sale.customerId),
        inv_no: sale.invoiceNumber,
        inv_date: sale.createdAt.toISOString().split('T')[0],
        inv_value: sale.total,
        rate: taxBreakdown.rate,
        taxable_value: taxableValue,
        igst_amount: taxBreakdown.igst,
        cgst_amount: taxBreakdown.cgst,
        sgst_amount: taxBreakdown.sgst,
        cess_amount: taxBreakdown.cess
      })
    }

    // Update summary
    reportData.summary.totalIGST += taxBreakdown.igst
    reportData.summary.totalCGST += taxBreakdown.cgst
    reportData.summary.totalSGST += taxBreakdown.sgst
    reportData.summary.totalCESS += taxBreakdown.cess
  }

  // Generate HSN summary
  reportData.hsn_summary = await generateHSNSummary(sales)

  if (includeDetails) {
    reportData.sales_details = sales.map(sale => ({
      invoiceNumber: sale.invoiceNumber,
      date: sale.createdAt,
      customer: sale.customer?.name,
      items: sale.items.map(item => ({
        product: item.product.name,
        hsnCode: item.product.category.name, // Simplified
        quantity: item.quantity,
        rate: item.price,
        taxableValue: item.subtotal
      })),
      taxBreakdown: reportData.summary
    }))
  }

  return reportData
}

/**
 * Generate GSTR-3B Report (Summary of Outward and Input Tax Credit)
 */
async function generateGSTR3BReport(storeId: string, startDate: Date, endDate: Date, includeDetails: boolean) {
  const [sales, inputTaxCredits] = await Promise.all([
    prisma.sale.findMany({
      where: {
        storeId,
        createdAt: { gte: startDate, lte: endDate },
        status: 'completed'
      },
      include: {
        saleTaxBreakdowns: {
          include: { taxType: true }
        }
      }
    }),
    prisma.inputTaxCredit.findMany({
      where: {
        storeId,
        creditDate: { gte: startDate, lte: endDate }
      },
      include: { taxType: true }
    })
  ])

  const outwardSupplies = await calculateOutwardSupplies(sales)
  const inputTaxCredit = await calculateInputTaxCredit(inputTaxCredits)

  return {
    gstin: await getStoreGSTIN(storeId),
    period: `${startDate.toISOString().split('T')[0]} to ${endDate.toISOString().split('T')[0]}`,
    summary: {
      total_taxable_supplies: outwardSupplies.totalTaxable,
      total_tax: outwardSupplies.totalTax,
      total_igst: outwardSupplies.igst,
      total_cgst: outwardSupplies.cgst,
      total_sgst: outwardSupplies.sgst,
      total_cess: outwardSupplies.cess
    },
    outward_supplies: outwardSupplies,
    input_tax_credit: inputTaxCredit,
    tax_liability: {
      igst: outwardSupplies.igst - inputTaxCredit.igst,
      cgst: outwardSupplies.cgst - inputTaxCredit.cgst,
      sgst: outwardSupplies.sgst - inputTaxCredit.sgst,
      cess: outwardSupplies.cess - inputTaxCredit.cess
    }
  }
}

/**
 * Generate Monthly Tax Summary
 */
async function generateMonthlySummary(storeId: string, startDate: Date, endDate: Date) {
  const sales = await prisma.sale.findMany({
    where: {
      storeId,
      createdAt: { gte: startDate, lte: endDate },
      status: 'completed'
    },
    include: {
      saleTaxBreakdowns: {
        include: { taxType: true }
      }
    }
  })

  const summary = {
    period: `${startDate.toISOString().split('T')[0]} to ${endDate.toISOString().split('T')[0]}`,
    totalSales: sales.length,
    totalRevenue: sales.reduce((sum, sale) => sum + sale.total, 0),
    totalTaxableValue: sales.reduce((sum, sale) => sum + sale.subtotal, 0),
    taxBreakdown: {
      CGST: 0,
      SGST: 0,
      IGST: 0,
      CESS: 0
    },
    dailyBreakdown: [],
    categoryBreakdown: []
  }

  // Calculate tax breakdown
  for (const sale of sales) {
    for (const taxBreakdown of sale.saleTaxBreakdowns) {
      summary.taxBreakdown[taxBreakdown.taxType.code as keyof typeof summary.taxBreakdown] += taxBreakdown.taxAmount
    }
  }

  // Generate daily breakdown
  summary.dailyBreakdown = await generateDailyBreakdown(sales, startDate, endDate)

  return summary
}

/**
 * Generate Annual Tax Summary
 */
async function generateAnnualSummary(storeId: string, startDate: Date, endDate: Date) {
  const monthlySummaries = []
  const currentDate = new Date(startDate)
  
  // Generate monthly summaries for the year
  while (currentDate <= endDate) {
    const monthStart = new Date(currentDate.getFullYear(), currentDate.getMonth(), 1)
    const monthEnd = new Date(currentDate.getFullYear(), currentDate.getMonth() + 1, 0)
    
    const monthlyData = await generateMonthlySummary(storeId, monthStart, monthEnd)
    monthlyData.month = currentDate.toLocaleString('default', { month: 'long', year: 'numeric' })
    
    monthlySummaries.push(monthlyData)
    currentDate.setMonth(currentDate.getMonth() + 1)
  }

  return {
    year: startDate.getFullYear(),
    totalRevenue: monthlySummaries.reduce((sum, month) => sum + month.totalRevenue, 0),
    totalTax: Object.values(
      monthlySummaries.reduce((acc, month) => {
        Object.entries(month.taxBreakdown).forEach(([taxType, amount]) => {
          acc[taxType] = (acc[taxType] || 0) + amount
        })
        return acc
      }, {} as Record<string, number>)
    ),
    monthlyBreakdown: monthlySummaries,
    growth: await calculateYearOverYearGrowth(storeId, startDate.getFullYear())
  }
}

/**
 * Generate Tax Liability Report
 */
async function generateTaxLiabilityReport(storeId: string, startDate: Date, endDate: Date) {
  const [sales, inputCredits] = await Promise.all([
    prisma.sale.findMany({
      where: {
        storeId,
        createdAt: { gte: startDate, lte: endDate },
        status: 'completed'
      },
      include: {
        saleTaxBreakdowns: {
          include: { taxType: true }
        }
      }
    }),
    prisma.inputTaxCredit.findMany({
      where: {
        storeId,
        creditDate: { gte: startDate, lte: endDate }
      }
    })
  ])

  const outputTax = { CGST: 0, SGST: 0, IGST: 0, CESS: 0 }
  const inputTaxCredit = { CGST: 0, SGST: 0, IGST: 0, CESS: 0 }

  // Calculate output tax liability
  for (const sale of sales) {
    for (const taxBreakdown of sale.saleTaxBreakdowns) {
      outputTax[taxBreakdown.taxType.code as keyof typeof outputTax] += taxBreakdown.taxAmount
    }
  }

  // Calculate input tax credit
  for (const credit of inputCredits) {
    // Assuming we have tax type information in input credits
    inputTaxCredit.IGST += credit.amount // Simplified
  }

  const netLiability = {
    CGST: outputTax.CGST - inputTaxCredit.CGST,
    SGST: outputTax.SGST - inputTaxCredit.SGST,
    IGST: outputTax.IGST - inputTaxCredit.IGST,
    CESS: outputTax.CESS - inputTaxCredit.CESS
  }

  return {
    period: `${startDate.toISOString().split('T')[0]} to ${endDate.toISOString().split('T')[0]}`,
    outputTax,
    inputTaxCredit,
    netLiability,
    totalLiability: Object.values(netLiability).reduce((sum, amount) => sum + amount, 0),
    paymentDue: Object.values(netLiability).filter(amount => amount > 0).reduce((sum, amount) => sum + amount, 0),
    refundDue: Math.abs(Object.values(netLiability).filter(amount => amount < 0).reduce((sum, amount) => sum + amount, 0))
  }
}

/**
 * Generate Input Tax Credit Report
 */
async function generateInputTaxCreditReport(storeId: string, startDate: Date, endDate: Date) {
  const credits = await prisma.inputTaxCredit.findMany({
    where: {
      storeId,
      creditDate: { gte: startDate, lte: endDate }
    },
    include: {
      taxType: true
    },
    orderBy: { creditDate: 'desc' }
  })

  const summary = {
    period: `${startDate.toISOString().split('T')[0]} to ${endDate.toISOString().split('T')[0]}`,
    totalCredits: credits.length,
    totalAmount: credits.reduce((sum, credit) => sum + credit.amount, 0),
    utilizedAmount: credits.filter(c => c.isUtilized).reduce((sum, credit) => sum + credit.utilizedAmount, 0),
    pendingAmount: credits.filter(c => !c.isUtilized).reduce((sum, credit) => sum + credit.amount, 0),
    taxTypeBreakdown: {} as Record<string, number>,
    monthlyBreakdown: [] as any[],
    credits
  }

  // Tax type breakdown
  for (const credit of credits) {
    const taxType = credit.taxType.code
    summary.taxTypeBreakdown[taxType] = (summary.taxTypeBreakdown[taxType] || 0) + credit.amount
  }

  return summary
}

// Helper functions

function parseReportPeriod(reportPeriod: string, startDate?: string, endDate?: string) {
  if (startDate && endDate) {
    return {
      start: new Date(startDate),
      end: new Date(endDate)
    }
  }

  // Parse YYYY-MM or YYYY format
  if (reportPeriod.includes('-')) {
    const [year, month] = reportPeriod.split('-')
    const start = new Date(parseInt(year), parseInt(month) - 1, 1)
    const end = new Date(parseInt(year), parseInt(month), 0)
    return { start, end }
  } else {
    const year = parseInt(reportPeriod)
    const start = new Date(year, 0, 1)
    const end = new Date(year, 11, 31)
    return { start, end }
  }
}

async function getStoreGSTIN(storeId: string): Promise<string> {
  // In a real implementation, you would store GSTIN in the store configuration
  return '29ABCDE1234F1Z5' // Sample GSTIN
}

async function getCustomerState(customerId?: string): Promise<string> {
  // Simplified - in reality you'd look up the customer's state
  return '29' // Karnataka
}

async function calculateTaxBreakdownForSale(saleId: string) {
  const taxBreakdowns = await prisma.saleTaxBreakdown.findMany({
    where: { saleId },
    include: { taxType: true }
  })

  const breakdown = { rate: 0, igst: 0, cgst: 0, sgst: 0, cess: 0 }
  
  for (const tax of taxBreakdowns) {
    switch (tax.taxType.code) {
      case 'IGST':
        breakdown.igst += tax.taxAmount
        breakdown.rate = tax.taxPercentage
        break
      case 'CGST':
        breakdown.cgst += tax.taxAmount
        break
      case 'SGST':
        breakdown.sgst += tax.taxAmount
        break
      case 'CESS':
        breakdown.cess += tax.taxAmount
        break
    }
  }

  return breakdown
}

async function generateHSNSummary(sales: any[]) {
  const hsnData: Record<string, { quantity: number; taxableValue: number; taxAmount: number }> = {}
  
  for (const sale of sales) {
    for (const item of sale.items) {
      const hsnCode = item.product.category.name // Simplified
      if (!hsnData[hsnCode]) {
        hsnData[hsnCode] = { quantity: 0, taxableValue: 0, taxAmount: 0 }
      }
      hsnData[hsnCode].quantity += item.quantity
      hsnData[hsnCode].taxableValue += item.subtotal
      hsnData[hsnCode].taxAmount += item.subtotal * 0.18 // Simplified 18% tax
    }
  }

  return Object.entries(hsnData).map(([hsnCode, data]) => ({
    hsn_code: hsnCode,
    quantity: data.quantity,
    taxable_value: data.taxableValue,
    tax_amount: data.taxAmount
  }))
}

async function calculateOutwardSupplies(sales: any[]) {
  const result = { totalTaxable: 0, totalTax: 0, igst: 0, cgst: 0, sgst: 0, cess: 0 }
  
  for (const sale of sales) {
    result.totalTaxable += sale.subtotal
    result.totalTax += sale.gst || 0
    
    for (const taxBreakdown of sale.saleTaxBreakdowns) {
      switch (taxBreakdown.taxType.code) {
        case 'IGST':
          result.igst += taxBreakdown.taxAmount
          break
        case 'CGST':
          result.cgst += taxBreakdown.taxAmount
          break
        case 'SGST':
          result.sgst += taxBreakdown.taxAmount
          break
        case 'CESS':
          result.cess += taxBreakdown.taxAmount
          break
      }
    }
  }

  return result
}

async function calculateInputTaxCredit(inputCredits: any[]) {
  return {
    igst: inputCredits.reduce((sum, credit) => sum + credit.amount, 0),
    cgst: 0,
    sgst: 0,
    cess: 0
  }
}

async function generateDailyBreakdown(sales: any[], startDate: Date, endDate: Date) {
  const dailyData: Record<string, { sales: number; revenue: number; tax: number }> = {}
  
  const currentDate = new Date(startDate)
  while (currentDate <= endDate) {
    const dateKey = currentDate.toISOString().split('T')[0]
    dailyData[dateKey] = { sales: 0, revenue: 0, tax: 0 }
    currentDate.setDate(currentDate.getDate() + 1)
  }

  for (const sale of sales) {
    const dateKey = sale.createdAt.toISOString().split('T')[0]
    if (dailyData[dateKey]) {
      dailyData[dateKey].sales += 1
      dailyData[dateKey].revenue += sale.total
      dailyData[dateKey].tax += sale.gst || 0
    }
  }

  return Object.entries(dailyData).map(([date, data]) => ({
    date,
    ...data
  }))
}

async function calculateYearOverYearGrowth(storeId: string, year: number) {
  // Simplified year-over-year growth calculation
  return {
    revenueGrowth: 12.5, // Percentage
    taxGrowth: 15.2, // Percentage
    salesGrowth: 8.7 // Percentage
  }
}

function formatAsCSV(data: any, reportType: string): string {
  // Simplified CSV formatting - in reality you'd use a proper CSV library
  if (reportType === 'GSTR1') {
    return 'Invoice Number,Date,Customer,Taxable Value,IGST,CGST,SGST,CESS\\n' +
           Object.values(data.b2b_supplies || []).map((row: any) => 
             `${row.inv_no},${row.inv_date},${row.ctin},${row.taxable_value},${row.igst_amount},${row.cgst_amount},${row.sgst_amount},${row.cess_amount}`
           ).join('\\n')
  }
  
  return 'Data Export\\n'
}