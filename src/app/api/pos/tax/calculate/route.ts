/**
 * Enhanced Tax Calculation API Endpoint
 * Supports multiple tax rates, regional variations, and complex tax rules
 */

import { NextRequest, NextResponse } from 'next/server'
import { taxEngine, TaxCalculationInput } from '@/lib/tax-engine'
import { getStoreFromRequest } from '@/lib/db'
import { z } from 'zod'

// Validation schema for tax calculation request
const TaxCalculationSchema = z.object({
  customerId: z.string().optional(),
  items: z.array(z.object({
    productId: z.string(),
    quantity: z.number().positive(),
    unitPrice: z.number().nonnegative(),
    totalPrice: z.number().nonnegative(),
    categoryId: z.string(),
    hsnCode: z.string().optional(),
    isTaxInclusive: z.boolean().optional()
  })).min(1),
  customerRegion: z.string().optional(),
  storeRegion: z.string().optional(),
  transactionDate: z.string().datetime().optional(),
  isInterState: z.boolean().optional(),
  isExport: z.boolean().optional()
})

/**
 * POST /api/pos/tax/calculate
 * Calculate comprehensive taxes for a sale
 */
export async function POST(request: NextRequest) {
  try {
    const body = await request.json()
    
    // Validate request body
    const validation = TaxCalculationSchema.safeParse(body)
    if (!validation.success) {
      return NextResponse.json(
        { 
          error: 'Invalid request data',
          details: validation.error.errors 
        },
        { status: 400 }
      )
    }

    const validatedData = validation.data

    // Get store information
    const store = await getStoreFromRequest(request)
    if (!store) {
      return NextResponse.json(
        { error: 'Store not found' },
        { status: 404 }
      )
    }

    // Prepare tax calculation input
    const taxInput: TaxCalculationInput = {
      storeId: store.id,
      customerId: validatedData.customerId,
      items: validatedData.items,
      customerRegion: validatedData.customerRegion,
      storeRegion: validatedData.storeRegion,
      transactionDate: validatedData.transactionDate ? new Date(validatedData.transactionDate) : new Date(),
      isInterState: validatedData.isInterState || false,
      isExport: validatedData.isExport || false
    }

    // Calculate taxes
    const taxCalculation = await taxEngine.calculateTax(taxInput)

    // Validate the calculation
    const validationResult = taxEngine.validateTaxCalculation(taxCalculation)
    if (!validationResult.isValid) {
      return NextResponse.json(
        { 
          error: 'Tax calculation validation failed',
          errors: validationResult.errors 
        },
        { status: 400 }
      )
    }

    // Return successful response
    return NextResponse.json({
      success: true,
      data: taxCalculation,
      summary: taxEngine.getTaxSummary(taxCalculation),
      metadata: {
        calculationTime: new Date().toISOString(),
        storeRegion: taxInput.storeRegion || 'IN',
        transactionType: taxInput.isInterState ? 'inter_state' : 'intra_state'
      }
    })

  } catch (error) {
    console.error('Tax calculation error:', error)
    
    return NextResponse.json(
      { 
        error: 'Tax calculation failed',
        message: error instanceof Error ? error.message : 'Unknown error'
      },
      { status: 500 }
    )
  }
}

/**
 * GET /api/pos/tax/calculate
 * Get tax calculation preview/estimate
 */
export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url)
    
    const storeId = searchParams.get('storeId')
    const region = searchParams.get('region')
    const taxType = searchParams.get('taxType')
    const amount = parseFloat(searchParams.get('amount') || '0')

    if (!storeId || !amount) {
      return NextResponse.json(
        { error: 'Store ID and amount are required' },
        { status: 400 }
      )
    }

    // Get tax rate for preview
    const taxRates = await getTaxRatePreview(storeId, region, taxType, amount)

    return NextResponse.json({
      success: true,
      data: {
        amount: amount,
        region: region || 'IN',
        taxRates: taxRates,
        estimatedTax: taxRates.reduce((sum, rate) => sum + (amount * rate.rate / 100), 0),
        estimatedTotal: amount + taxRates.reduce((sum, rate) => sum + (amount * rate.rate / 100), 0)
      }
    })

  } catch (error) {
    console.error('Tax preview error:', error)
    
    return NextResponse.json(
      { 
        error: 'Tax preview failed',
        message: error instanceof Error ? error.message : 'Unknown error'
      },
      { status: 500 }
    )
  }
}

/**
 * Helper function to get tax rate preview
 */
async function getTaxRatePreview(storeId: string, region?: string | null, taxType?: string | null, amount?: number) {
  const { PrismaClient } = await import('@prisma/client')
  const prisma = new PrismaClient()

  try {
    const currentDate = new Date()
    const regionCode = region || 'IN'

    // Get region
    const regionData = await prisma.taxRegion.findUnique({
      where: { code: regionCode }
    })

    if (!regionData) {
      return []
    }

    // Build where clause for tax rates
    const whereClause: any = {
      isActive: true,
      effectiveFrom: { lte: currentDate },
      OR: [
        { effectiveTo: null },
        { effectiveTo: { gte: currentDate } }
      ],
      regionId: regionData.id
    }

    if (taxType) {
      whereClause.taxType = {
        code: taxType,
        isActive: true
      }
    } else {
      whereClause.taxType = {
        isActive: true,
        code: { in: ['CGST', 'SGST', 'IGST'] }
      }
    }

    const taxRates = await prisma.taxRate.findMany({
      where: whereClause,
      include: {
        taxType: true,
        region: true
      },
      orderBy: {
        effectiveFrom: 'desc'
      }
    })

    return taxRates.map(rate => ({
      id: rate.id,
      code: rate.taxType.code,
      name: rate.taxType.name,
      rate: rate.rate,
      region: rate.region.code,
      effectiveFrom: rate.effectiveFrom,
      effectiveTo: rate.effectiveTo
    }))

  } finally {
    await prisma.$disconnect()
  }
}