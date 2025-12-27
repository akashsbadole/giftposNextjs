/**
 * Tax Configuration Management API
 * Handles tax types, rates, regions, and rules configuration
 */

import { NextRequest, NextResponse } from 'next/server'
import { PrismaClient } from '@prisma/client'
import { getStoreFromRequest } from '@/lib/db'
import { z } from 'zod'

const prisma = new PrismaClient()

// Validation schemas
const TaxTypeSchema = z.object({
  code: z.string().min(1),
  name: z.string().min(1),
  description: z.string().optional(),
  isActive: z.boolean().optional()
})

const TaxRegionSchema = z.object({
  code: z.string().min(1),
  name: z.string().min(1),
  type: z.enum(['state', 'union_territory', 'country', 'international']),
  gstStateCode: z.string().optional(),
  isActive: z.boolean().optional()
})

const TaxRateSchema = z.object({
  taxTypeId: z.string(),
  regionId: z.string(),
  rate: z.number().min(0).max(100),
  effectiveFrom: z.string().datetime(),
  effectiveTo: z.string().datetime().optional(),
  isActive: z.boolean().optional()
})

const TaxRuleSchema = z.object({
  name: z.string().min(1),
  description: z.string().optional(),
  ruleType: z.enum(['exemption', 'holiday', 'special_scheme', 'customer_based']),
  conditions: z.record(z.any()),
  taxRateId: z.string().optional(),
  discountPercentage: z.number().min(0).max(100).optional(),
  effectiveFrom: z.string().datetime(),
  effectiveTo: z.string().datetime().optional(),
  isActive: z.boolean().optional(),
  priority: z.number().optional()
})

const HSNCodeSchema = z.object({
  hsnCode: z.string().min(1),
  description: z.string().optional(),
  taxCategory: z.string().optional(),
  defaultTaxRateId: z.string().optional(),
  isActive: z.boolean().optional()
})

const ProductTaxMappingSchema = z.object({
  productId: z.string(),
  hsnCodeId: z.string().optional(),
  taxRateId: z.string(),
  isTaxInclusive: z.boolean().optional(),
  taxExempt: z.boolean().optional(),
  effectiveFrom: z.string().datetime().optional(),
  effectiveTo: z.string().datetime().optional()
})

const CategoryTaxMappingSchema = z.object({
  categoryId: z.string(),
  hsnCodeId: z.string().optional(),
  taxRateId: z.string(),
  isTaxInclusive: z.boolean().optional(),
  taxExempt: z.boolean().optional(),
  effectiveFrom: z.string().datetime().optional(),
  effectiveTo: z.string().datetime().optional()
})

/**
 * GET /api/pos/tax/config
 * Get tax configuration overview
 */
export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url)
    const type = searchParams.get('type')
    const store = await getStoreFromRequest(request)

    if (!store) {
      return NextResponse.json(
        { error: 'Store not found' },
        { status: 404 }
      )
    }

    switch (type) {
      case 'types':
        return await getTaxTypes()
      case 'regions':
        return await getTaxRegions()
      case 'rates':
        return await getTaxRates(searchParams)
      case 'rules':
        return await getTaxRules(searchParams)
      case 'hsn':
        return await getHSNCodes(searchParams)
      case 'mappings':
        return await getTaxMappings(searchParams, store.id)
      default:
        return await getTaxOverview(store.id)
    }

  } catch (error) {
    console.error('Tax config fetch error:', error)
    return NextResponse.json(
      { 
        error: 'Failed to fetch tax configuration',
        message: error instanceof Error ? error.message : 'Unknown error'
      },
      { status: 500 }
    )
  }
}

/**
 * POST /api/pos/tax/config
 * Create new tax configuration
 */
export async function POST(request: NextRequest) {
  try {
    const body = await request.json()
    const { type, data } = body

    const store = await getStoreFromRequest(request)
    if (!store) {
      return NextResponse.json(
        { error: 'Store not found' },
        { status: 404 }
      )
    }

    let result

    switch (type) {
      case 'taxType':
        result = await createTaxType(data)
        break
      case 'taxRegion':
        result = await createTaxRegion(data)
        break
      case 'taxRate':
        result = await createTaxRate(data)
        break
      case 'taxRule':
        result = await createTaxRule(data)
        break
      case 'hsnCode':
        result = await createHSNCode(data)
        break
      case 'productMapping':
        result = await createProductTaxMapping(data)
        break
      case 'categoryMapping':
        result = await createCategoryTaxMapping(data)
        break
      default:
        return NextResponse.json(
          { error: 'Invalid configuration type' },
          { status: 400 }
        )
    }

    return NextResponse.json({
      success: true,
      data: result
    })

  } catch (error) {
    console.error('Tax config creation error:', error)
    return NextResponse.json(
      { 
        error: 'Failed to create tax configuration',
        message: error instanceof Error ? error.message : 'Unknown error'
      },
      { status: 500 }
    )
  }
}

/**
 * PUT /api/pos/tax/config
 * Update tax configuration
 */
export async function PUT(request: NextRequest) {
  try {
    const body = await request.json()
    const { type, id, data } = body

    let result

    switch (type) {
      case 'taxType':
        result = await updateTaxType(id, data)
        break
      case 'taxRegion':
        result = await updateTaxRegion(id, data)
        break
      case 'taxRate':
        result = await updateTaxRate(id, data)
        break
      case 'taxRule':
        result = await updateTaxRule(id, data)
        break
      case 'hsnCode':
        result = await updateHSNCode(id, data)
        break
      case 'productMapping':
        result = await updateProductTaxMapping(id, data)
        break
      case 'categoryMapping':
        result = await updateCategoryTaxMapping(id, data)
        break
      default:
        return NextResponse.json(
          { error: 'Invalid configuration type' },
          { status: 400 }
        )
    }

    return NextResponse.json({
      success: true,
      data: result
    })

  } catch (error) {
    console.error('Tax config update error:', error)
    return NextResponse.json(
      { 
        error: 'Failed to update tax configuration',
        message: error instanceof Error ? error.message : 'Unknown error'
      },
      { status: 500 }
    )
  }
}

/**
 * DELETE /api/pos/tax/config
 * Delete tax configuration
 */
export async function DELETE(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url)
    const type = searchParams.get('type')
    const id = searchParams.get('id')

    if (!type || !id) {
      return NextResponse.json(
        { error: 'Type and ID are required' },
        { status: 400 }
      )
    }

    let result

    switch (type) {
      case 'taxType':
        result = await deleteTaxType(id)
        break
      case 'taxRegion':
        result = await deleteTaxRegion(id)
        break
      case 'taxRate':
        result = await deleteTaxRate(id)
        break
      case 'taxRule':
        result = await deleteTaxRule(id)
        break
      case 'hsnCode':
        result = await deleteHSNCode(id)
        break
      case 'productMapping':
        result = await deleteProductTaxMapping(id)
        break
      case 'categoryMapping':
        result = await deleteCategoryTaxMapping(id)
        break
      default:
        return NextResponse.json(
          { error: 'Invalid configuration type' },
          { status: 400 }
        )
    }

    return NextResponse.json({
      success: true,
      data: result
    })

  } catch (error) {
    console.error('Tax config deletion error:', error)
    return NextResponse.json(
      { 
        error: 'Failed to delete tax configuration',
        message: error instanceof Error ? error.message : 'Unknown error'
      },
      { status: 500 }
    )
  }
}

// Helper functions for tax configuration management

async function getTaxOverview(storeId: string) {
  const [taxTypes, taxRegions, taxRates, taxRules, hsnCodes] = await Promise.all([
    prisma.taxType.findMany({ orderBy: { code: 'asc' } }),
    prisma.taxRegion.findMany({ orderBy: { name: 'asc' } }),
    prisma.taxRate.findMany({
      include: { taxType: true, region: true },
      orderBy: { effectiveFrom: 'desc' },
      take: 50
    }),
    prisma.taxRule.findMany({ 
      orderBy: { priority: 'desc' },
      take: 20 
    }),
    prisma.hSNCodeMaster.findMany({ 
      orderBy: { hsnCode: 'asc' },
      take: 50
    })
  ])

  return {
    taxTypes: taxTypes.length,
    taxRegions: taxRegions.length,
    activeTaxRates: taxRates.filter(r => r.isActive).length,
    taxRules: taxRules.length,
    hsnCodes: hsnCodes.length
  }
}

async function getTaxTypes() {
  const taxTypes = await prisma.taxType.findMany({
    orderBy: { code: 'asc' }
  })
  return NextResponse.json({ success: true, data: taxTypes })
}

async function getTaxRegions() {
  const regions = await prisma.taxRegion.findMany({
    orderBy: { name: 'asc' }
  })
  return NextResponse.json({ success: true, data: regions })
}

async function getTaxRates(searchParams: URLSearchParams) {
  const regionId = searchParams.get('regionId')
  const taxTypeId = searchParams.get('taxTypeId')
  const isActive = searchParams.get('isActive')

  const whereClause: any = {}

  if (regionId) whereClause.regionId = regionId
  if (taxTypeId) whereClause.taxTypeId = taxTypeId
  if (isActive !== null) whereClause.isActive = isActive === 'true'

  const taxRates = await prisma.taxRate.findMany({
    where: whereClause,
    include: {
      taxType: true,
      region: true
    },
    orderBy: { effectiveFrom: 'desc' }
  })

  return NextResponse.json({ success: true, data: taxRates })
}

async function getTaxRules(searchParams: URLSearchParams) {
  const ruleType = searchParams.get('ruleType')
  const isActive = searchParams.get('isActive')

  const whereClause: any = {}

  if (ruleType) whereClause.ruleType = ruleType
  if (isActive !== null) whereClause.isActive = isActive === 'true'

  const rules = await prisma.taxRule.findMany({
    where: whereClause,
    orderBy: { priority: 'desc' }
  })

  return NextResponse.json({ success: true, data: rules })
}

async function getHSNCodes(searchParams: URLSearchParams) {
  const taxCategory = searchParams.get('taxCategory')
  const isActive = searchParams.get('isActive')

  const whereClause: any = {}

  if (taxCategory) whereClause.taxCategory = taxCategory
  if (isActive !== null) whereClause.isActive = isActive === 'true'

  const hsnCodes = await prisma.hSNCodeMaster.findMany({
    where: whereClause,
    orderBy: { hsnCode: 'asc' }
  })

  return NextResponse.json({ success: true, data: hsnCodes })
}

async function getTaxMappings(searchParams: URLSearchParams, storeId: string) {
  const mappingType = searchParams.get('mappingType')

  if (mappingType === 'product') {
    const mappings = await prisma.productTaxMapping.findMany({
      include: {
        product: true,
        taxRate: {
          include: {
            taxType: true,
            region: true
          }
        },
        hsnCode: true
      },
      take: 50
    })
    return NextResponse.json({ success: true, data: mappings })
  } else if (mappingType === 'category') {
    const mappings = await prisma.categoryTaxMapping.findMany({
      include: {
        category: true,
        taxRate: {
          include: {
            taxType: true,
            region: true
          }
        },
        hsnCode: true
      },
      take: 50
    })
    return NextResponse.json({ success: true, data: mappings })
  }

  return NextResponse.json({ success: true, data: [] })
}

// Creation functions
async function createTaxType(data: any) {
  const validation = TaxTypeSchema.parse(data)
  return await prisma.taxType.create({
    data: validation
  })
}

async function createTaxRegion(data: any) {
  const validation = TaxRegionSchema.parse(data)
  return await prisma.taxRegion.create({
    data: validation
  })
}

async function createTaxRate(data: any) {
  const validation = TaxRateSchema.parse(data)
  return await prisma.taxRate.create({
    data: {
      ...validation,
      effectiveFrom: new Date(validation.effectiveFrom),
      effectiveTo: validation.effectiveTo ? new Date(validation.effectiveTo) : null
    }
  })
}

async function createTaxRule(data: any) {
  const validation = TaxRuleSchema.parse(data)
  return await prisma.taxRule.create({
    data: {
      ...validation,
      conditions: JSON.stringify(validation.conditions),
      effectiveFrom: new Date(validation.effectiveFrom),
      effectiveTo: validation.effectiveTo ? new Date(validation.effectiveTo) : null
    }
  })
}

async function createHSNCode(data: any) {
  const validation = HSNCodeSchema.parse(data)
  return await prisma.hSNCodeMaster.create({
    data: validation
  })
}

async function createProductTaxMapping(data: any) {
  const validation = ProductTaxMappingSchema.parse(data)
  return await prisma.productTaxMapping.create({
    data: {
      ...validation,
      effectiveFrom: validation.effectiveFrom ? new Date(validation.effectiveFrom) : new Date(),
      effectiveTo: validation.effectiveTo ? new Date(validation.effectiveTo) : null
    }
  })
}

async function createCategoryTaxMapping(data: any) {
  const validation = CategoryTaxMappingSchema.parse(data)
  return await prisma.categoryTaxMapping.create({
    data: {
      ...validation,
      effectiveFrom: validation.effectiveFrom ? new Date(validation.effectiveFrom) : new Date(),
      effectiveTo: validation.effectiveTo ? new Date(validation.effectiveTo) : null
    }
  })
}

// Update functions
async function updateTaxType(id: string, data: any) {
  const validation = TaxTypeSchema.partial().parse(data)
  return await prisma.taxType.update({
    where: { id },
    data: validation
  })
}

async function updateTaxRegion(id: string, data: any) {
  const validation = TaxRegionSchema.partial().parse(data)
  return await prisma.taxRegion.update({
    where: { id },
    data: validation
  })
}

async function updateTaxRate(id: string, data: any) {
  const validation = TaxRateSchema.partial().parse(data)
  const updateData: any = { ...validation }
  
  if (validation.effectiveFrom) {
    updateData.effectiveFrom = new Date(validation.effectiveFrom)
  }
  if (validation.effectiveTo) {
    updateData.effectiveTo = new Date(validation.effectiveTo)
  }

  return await prisma.taxRate.update({
    where: { id },
    data: updateData
  })
}

async function updateTaxRule(id: string, data: any) {
  const validation = TaxRuleSchema.partial().parse(data)
  const updateData: any = { ...validation }
  
  if (validation.conditions) {
    updateData.conditions = JSON.stringify(validation.conditions)
  }
  if (validation.effectiveFrom) {
    updateData.effectiveFrom = new Date(validation.effectiveFrom)
  }
  if (validation.effectiveTo) {
    updateData.effectiveTo = new Date(validation.effectiveTo)
  }

  return await prisma.taxRule.update({
    where: { id },
    data: updateData
  })
}

async function updateHSNCode(id: string, data: any) {
  const validation = HSNCodeSchema.partial().parse(data)
  return await prisma.hSNCodeMaster.update({
    where: { id },
    data: validation
  })
}

async function updateProductTaxMapping(id: string, data: any) {
  const validation = ProductTaxMappingSchema.partial().parse(data)
  const updateData: any = { ...validation }
  
  if (validation.effectiveFrom) {
    updateData.effectiveFrom = new Date(validation.effectiveFrom)
  }
  if (validation.effectiveTo) {
    updateData.effectiveTo = new Date(validation.effectiveTo)
  }

  return await prisma.productTaxMapping.update({
    where: { id },
    data: updateData
  })
}

async function updateCategoryTaxMapping(id: string, data: any) {
  const validation = CategoryTaxMappingSchema.partial().parse(data)
  const updateData: any = { ...validation }
  
  if (validation.effectiveFrom) {
    updateData.effectiveFrom = new Date(validation.effectiveFrom)
  }
  if (validation.effectiveTo) {
    updateData.effectiveTo = new Date(validation.effectiveTo)
  }

  return await prisma.categoryTaxMapping.update({
    where: { id },
    data: updateData
  })
}

// Delete functions
async function deleteTaxType(id: string) {
  return await prisma.taxType.delete({ where: { id } })
}

async function deleteTaxRegion(id: string) {
  return await prisma.taxRegion.delete({ where: { id } })
}

async function deleteTaxRate(id: string) {
  return await prisma.taxRate.delete({ where: { id } })
}

async function deleteTaxRule(id: string) {
  return await prisma.taxRule.delete({ where: { id } })
}

async function deleteHSNCode(id: string) {
  return await prisma.hSNCodeMaster.delete({ where: { id } })
}

async function deleteProductTaxMapping(id: string) {
  return await prisma.productTaxMapping.delete({ where: { id } })
}

async function deleteCategoryTaxMapping(id: string) {
  return await prisma.categoryTaxMapping.delete({ where: { id } })
}