/**
 * Enhanced Multi-Tax Calculation Engine
 * Supports complex Indian GST system and international tax requirements
 */

import { PrismaClient } from '@prisma/client'

const prisma = new PrismaClient()

export interface TaxCalculationInput {
  storeId: string
  customerId?: string
  items: Array<{
    productId: string
    quantity: number
    unitPrice: number
    totalPrice: number
    categoryId: string
    hsnCode?: string
    isTaxInclusive?: boolean
  }>
  customerRegion?: string
  storeRegion?: string
  transactionDate?: Date
  isInterState?: boolean
  isExport?: boolean
}

export interface TaxLineItem {
  taxTypeId: string
  taxTypeCode: string
  taxTypeName: string
  taxRateId: string
  baseAmount: number
  taxPercentage: number
  taxAmount: number
  isCompound: boolean
  parentTaxId?: string
  hsnCode?: string
  reason?: string
}

export interface TaxCalculationResult {
  items: Array<{
    productId: string
    taxBreakdown: TaxLineItem[]
    subtotal: number
    totalTax: number
    finalTotal: number
  }>
  sale: {
    subtotal: number
    totalTax: number
    totalTaxBreakdown: TaxLineItem[]
    grandTotal: number
    taxInclusiveTotal: number
  }
  metadata: {
    calculationDate: Date
    region: string
    isInterState: boolean
    appliedRules: string[]
    exemptions: string[]
  }
}

export interface TaxRule {
  id: string
  name: string
  ruleType: 'exemption' | 'holiday' | 'special_scheme' | 'customer_based'
  conditions: any
  discountPercentage?: number
  taxRateId?: string
  priority: number
}

export interface TaxRegion {
  id: string
  code: string
  name: string
  type: 'state' | 'union_territory' | 'country' | 'international'
  gstStateCode?: string
}

/**
 * Enhanced Tax Calculation Engine
 */
export class TaxCalculationEngine {
  private prisma: PrismaClient

  constructor() {
    this.prisma = prisma
  }

  /**
   * Calculate comprehensive taxes for a sale
   */
  async calculateTax(input: TaxCalculationInput): Promise<TaxCalculationResult> {
    try {
      const {
        storeId,
        customerId,
        items,
        customerRegion,
        storeRegion,
        transactionDate = new Date(),
        isInterState = false,
        isExport = false
      } = input

      // Get store and customer information
      const [store, customer] = await Promise.all([
        this.prisma.store.findUnique({ where: { id: storeId } }),
        customerId ? this.prisma.customer.findUnique({ where: { id: customerId } }) : null
      ])

      if (!store) {
        throw new Error('Store not found')
      }

      // Get store region details
      const storeRegionData = await this.getRegion(storeRegion || 'IN')
      const customerRegionData = await this.getRegion(customerRegion || storeRegion || 'IN')

      // Get applicable tax rules
      const applicableRules = await this.getApplicableTaxRules({
        storeId,
        customerId,
        transactionDate,
        customerRegion: customerRegionData,
        storeRegion: storeRegionData,
        isInterState,
        isExport
      })

      // Calculate taxes for each item
      const itemTaxCalculations = []
      let totalSubtotal = 0
      let totalTax = 0

      for (const item of items) {
        const itemCalculation = await this.calculateItemTax({
          ...item,
          storeId,
          transactionDate,
          isInterState,
          isExport,
          applicableRules,
          storeRegion: storeRegionData,
          customerRegion: customerRegionData
        })

        itemTaxCalculations.push(itemCalculation)
        totalSubtotal += itemCalculation.subtotal
        totalTax += itemCalculation.totalTax
      }

      // Consolidate tax breakdown across all items
      const consolidatedTaxBreakdown = this.consolidateTaxBreakdown(itemTaxCalculations)

      // Calculate final totals
      const grandTotal = totalSubtotal + totalTax
      const taxInclusiveTotal = this.calculateTaxInclusiveTotal(totalSubtotal, consolidatedTaxBreakdown)

      const result: TaxCalculationResult = {
        items: itemTaxCalculations,
        sale: {
          subtotal: totalSubtotal,
          totalTax: totalTax,
          totalTaxBreakdown: consolidatedTaxBreakdown,
          grandTotal: grandTotal,
          taxInclusiveTotal: taxInclusiveTotal
        },
        metadata: {
          calculationDate: transactionDate,
          region: storeRegionData.code,
          isInterState: isInterState,
          appliedRules: applicableRules.map(r => r.name),
          exemptions: applicableRules
            .filter(r => r.ruleType === 'exemption')
            .map(r => r.name)
        }
      }

      // Log tax audit trail
      await this.logTaxAudit({
        saleData: result,
        appliedRules: applicableRules,
        input: input
      })

      return result

    } catch (error) {
      console.error('Tax calculation error:', error)
      throw new Error(`Tax calculation failed: ${error instanceof Error ? error.message : 'Unknown error'}`)
    }
  }

  /**
   * Calculate taxes for a single line item
   */
  private async calculateItemTax(params: {
    productId: string
    quantity: number
    unitPrice: number
    totalPrice: number
    categoryId: string
    hsnCode?: string
    isTaxInclusive?: boolean
    storeId: string
    transactionDate: Date
    isInterState: boolean
    isExport: boolean
    applicableRules: TaxRule[]
    storeRegion: TaxRegion
    customerRegion: TaxRegion
  }) {
    const {
      productId,
      quantity,
      unitPrice,
      totalPrice,
      categoryId,
      hsnCode,
      isTaxInclusive = false,
      storeId,
      transactionDate,
      isInterState,
      isExport,
      applicableRules,
      storeRegion,
      customerRegion
    } = params

    // Get product tax mapping
    const productTaxMapping = await this.getProductTaxMapping(productId, transactionDate)
    const categoryTaxMapping = await this.getCategoryTaxMapping(categoryId, transactionDate)

    // Check for exemptions
    const exemptions = this.checkExemptions({
      productTaxMapping,
      categoryTaxMapping,
      hsnCode,
      applicableRules,
      isExport
    })

    if (exemptions.isFullyExempt) {
      return {
        productId,
        taxBreakdown: [],
        subtotal: totalPrice,
        totalTax: 0,
        finalTotal: totalPrice
      }
    }

    // Get applicable tax rates
    const taxRates = await this.getApplicableTaxRates({
      productTaxMapping,
      categoryTaxMapping,
      hsnCode,
      storeRegion,
      customerRegion,
      transactionDate,
      isInterState,
      isExport
    })

    // Calculate tax breakdown
    const taxBreakdown = await this.calculateTaxBreakdown({
      baseAmount: totalPrice,
      taxRates,
      isTaxInclusive,
      isCompound: this.shouldApplyCompoundTax(taxRates),
      exemptions
    })

    const totalTax = taxBreakdown.reduce((sum, tax) => sum + tax.taxAmount, 0)
    const finalTotal = isTaxInclusive ? totalPrice : totalPrice + totalTax

    return {
      productId,
      taxBreakdown,
      subtotal: totalPrice,
      totalTax,
      finalTotal
    }
  }

  /**
   * Get applicable tax rates based on region and transaction type
   */
  private async getApplicableTaxRates(params: {
    productTaxMapping: any
    categoryTaxMapping: any
    hsnCode?: string
    storeRegion: TaxRegion
    customerRegion: TaxRegion
    transactionDate: Date
    isInterState: boolean
    isExport: boolean
  }) {
    const {
      productTaxMapping,
      categoryTaxMapping,
      hsnCode,
      storeRegion,
      customerRegion,
      transactionDate,
      isInterState,
      isExport
    } = params

    // For exports, typically no taxes apply
    if (isExport) {
      return []
    }

    // Determine tax type based on transaction type
    const taxTypes = await this.prisma.taxType.findMany({
      where: {
        isActive: true,
        code: isInterState ? 'IGST' : { in: ['CGST', 'SGST'] }
      }
    })

    // For inter-state transactions, only IGST applies
    if (isInterState) {
      const igstRate = await this.getTaxRate('IGST', storeRegion.id, transactionDate)
      return igstRate ? [igstRate] : []
    }

    // For intra-state transactions, CGST + SGST apply
    const [cgstRate, sgstRate] = await Promise.all([
      this.getTaxRate('CGST', storeRegion.id, transactionDate),
      this.getTaxRate('SGST', storeRegion.id, transactionDate)
    ])

    return [cgstRate, sgstRate].filter(Boolean)
  }

  /**
   * Get tax rate for specific tax type and region
   */
  private async getTaxRate(taxTypeCode: string, regionId: string, effectiveDate: Date) {
    return await this.prisma.taxRate.findFirst({
      where: {
        taxType: { code: taxTypeCode, isActive: true },
        regionId: regionId,
        isActive: true,
        effectiveFrom: { lte: effectiveDate },
        OR: [
          { effectiveTo: null },
          { effectiveTo: { gte: effectiveDate } }
        ]
      },
      include: {
        taxType: true,
        region: true
      },
      orderBy: {
        effectiveFrom: 'desc'
      }
    })
  }

  /**
   * Get product tax mapping
   */
  private async getProductTaxMapping(productId: string, effectiveDate: Date) {
    return await this.prisma.productTaxMapping.findFirst({
      where: {
        productId,
        isActive: true,
        effectiveFrom: { lte: effectiveDate },
        OR: [
          { effectiveTo: null },
          { effectiveTo: { gte: effectiveDate } }
        ]
      },
      include: {
        taxRate: {
          include: {
            taxType: true,
            region: true
          }
        },
        hsnCode: true
      }
    })
  }

  /**
   * Get category tax mapping
   */
  private async getCategoryTaxMapping(categoryId: string, effectiveDate: Date) {
    return await this.prisma.categoryTaxMapping.findFirst({
      where: {
        categoryId,
        isActive: true,
        effectiveFrom: { lte: effectiveDate },
        OR: [
          { effectiveTo: null },
          { effectiveTo: { gte: effectiveDate } }
        ]
      },
      include: {
        taxRate: {
          include: {
            taxType: true,
            region: true
          }
        },
        hsnCode: true
      }
    })
  }

  /**
   * Get applicable tax rules for the transaction
   */
  private async getApplicableTaxRules(params: {
    storeId: string
    customerId?: string
    transactionDate: Date
    customerRegion: TaxRegion
    storeRegion: TaxRegion
    isInterState: boolean
    isExport: boolean
  }) {
    const {
      storeId,
      customerId,
      transactionDate,
      customerRegion,
      storeRegion,
      isInterState,
      isExport
    } = params

    // Get general tax rules
    const generalRules = await this.prisma.taxRule.findMany({
      where: {
        isActive: true,
        effectiveFrom: { lte: transactionDate },
        OR: [
          { effectiveTo: null },
          { effectiveTo: { gte: transactionDate } }
        ],
        OR: [
          { ruleType: 'holiday' },
          { ruleType: 'special_scheme' }
        ]
      }
    })

    // Get customer-specific exemptions
    const customerExemptions = customerId ? await this.prisma.customerTaxExemption.findMany({
      where: {
        customerId,
        isActive: true,
        effectiveFrom: { lte: transactionDate },
        OR: [
          { effectiveTo: null },
          { effectiveTo: { gte: transactionDate } }
        ]
      },
      include: {
        taxRule: true
      }
    }) : []

    const allRules = [...generalRules, ...customerExemptions.map(ce => ce.taxRule)]

    // Filter applicable rules
    return allRules.filter(rule => {
      // Check holiday rules
      if (rule.ruleType === 'holiday') {
        const holidayConfig = JSON.parse(rule.conditions)
        const currentDate = transactionDate.toISOString().split('T')[0]
        return currentDate >= holidayConfig.startDate && currentDate <= holidayConfig.endDate
      }

      // Check customer-based rules
      if (rule.ruleType === 'customer_based' && customerId) {
        const conditions = JSON.parse(rule.conditions)
        return conditions.customerIds.includes(customerId)
      }

      return true
    }).sort((a, b) => b.priority - a.priority)
  }

  /**
   * Check for tax exemptions
   */
  private checkExemptions(params: {
    productTaxMapping: any
    categoryTaxMapping: any
    hsnCode?: string
    applicableRules: TaxRule[]
    isExport: boolean
  }) {
    const { productTaxMapping, categoryTaxMapping, hsnCode, applicableRules, isExport } = params

    // Check product-level exemption
    if (productTaxMapping?.taxExempt) {
      return {
        isFullyExempt: true,
        exemptions: ['Product tax exempt']
      }
    }

    // Check category-level exemption
    if (categoryTaxMapping?.taxExempt) {
      return {
        isFullyExempt: true,
        exemptions: ['Category tax exempt']
      }
    }

    // Check HSN code exemption
    if (hsnCode) {
      const exemptedHsnCodes = ['2201', '3004', '1006'] // Water, Medicines, Rice
      if (exemptedHsnCodes.includes(hsnCode)) {
        return {
          isFullyExempt: true,
          exemptions: ['HSN code exempt']
        }
      }
    }

    // Check rule-based exemptions
    const exemptionRules = applicableRules.filter(rule => rule.ruleType === 'exemption')
    if (exemptionRules.length > 0) {
      return {
        isFullyExempt: false,
        partialExemptions: exemptionRules,
        exemptions: exemptionRules.map(r => r.name)
      }
    }

    return {
      isFullyExempt: false,
      exemptions: []
    }
  }

  /**
   * Calculate tax breakdown for an amount
   */
  private async calculateTaxBreakdown(params: {
    baseAmount: number
    taxRates: any[]
    isTaxInclusive: boolean
    isCompound: boolean
    exemptions: any
  }) {
    const { baseAmount, taxRates, isTaxInclusive, isCompound, exemptions } = params

    const taxBreakdown: TaxLineItem[] = []
    let currentBaseAmount = baseAmount

    for (const taxRate of taxRates) {
      // Check if this tax type is exempted
      const isExempted = exemptions.partialExemptions?.some((rule: TaxRule) => 
        rule.taxRateId === taxRate.id
      )

      if (isExempted) {
        continue
      }

      let taxableAmount = currentBaseAmount
      let taxAmount = 0

      if (isTaxInclusive) {
        // Calculate tax from inclusive price
        const taxMultiplier = taxRate.rate / (100 + taxRate.rate)
        taxAmount = baseAmount * taxMultiplier
        taxableAmount = baseAmount - taxAmount
      } else {
        // Calculate tax from exclusive price
        taxAmount = baseAmount * (taxRate.rate / 100)
      }

      const taxLineItem: TaxLineItem = {
        taxTypeId: taxRate.taxType.id,
        taxTypeCode: taxRate.taxType.code,
        taxTypeName: taxRate.taxType.name,
        taxRateId: taxRate.id,
        baseAmount: taxableAmount,
        taxPercentage: taxRate.rate,
        taxAmount: taxAmount,
        isCompound: isCompound
      }

      taxBreakdown.push(taxLineItem)

      // For compound taxes, next tax is calculated on base + previous tax
      if (isCompound) {
        currentBaseAmount = taxableAmount + taxAmount
      }
    }

    return taxBreakdown
  }

  /**
   * Check if compound tax should be applied
   */
  private shouldApplyCompoundTax(taxRates: any[]): boolean {
    // CESS is typically applied on top of GST (compound)
    const hasCess = taxRates.some(rate => rate.taxType.code === 'CESS')
    const hasGst = taxRates.some(rate => ['CGST', 'SGST', 'IGST'].includes(rate.taxType.code))
    
    return hasCess && hasGst
  }

  /**
   * Consolidate tax breakdown across all items
   */
  private consolidateTaxBreakdown(itemCalculations: any[]): TaxLineItem[] {
    const consolidated: { [key: string]: TaxLineItem } = {}

    for (const itemCalc of itemCalculations) {
      for (const taxLine of itemCalc.taxBreakdown) {
        const key = `${taxLine.taxTypeId}-${taxLine.taxRateId}`
        
        if (consolidated[key]) {
          consolidated[key].baseAmount += taxLine.baseAmount
          consolidated[key].taxAmount += taxLine.taxAmount
        } else {
          consolidated[key] = { ...taxLine }
        }
      }
    }

    return Object.values(consolidated)
  }

  /**
   * Calculate tax-inclusive total
   */
  private calculateTaxInclusiveTotal(subtotal: number, taxBreakdown: TaxLineItem[]): number {
    const totalTax = taxBreakdown.reduce((sum, tax) => sum + tax.taxAmount, 0)
    return subtotal + totalTax
  }

  /**
   * Get region information
   */
  private async getRegion(regionCode: string): Promise<TaxRegion> {
    const region = await this.prisma.taxRegion.findUnique({
      where: { code: regionCode }
    })

    if (!region) {
      // Return default India region if not found
      return {
        id: 'tr_in',
        code: 'IN',
        name: 'India',
        type: 'country',
        gstStateCode: null
      }
    }

    return region as TaxRegion
  }

  /**
   * Log tax calculation for audit trail
   */
  private async logTaxAudit(params: {
    saleData: TaxCalculationResult
    appliedRules: TaxRule[]
    input: TaxCalculationInput
  }) {
    const { saleData, appliedRules, input } = params

    try {
      await this.prisma.taxAuditTrail.create({
        data: {
          action: 'calculated',
          newTaxData: JSON.stringify({
            totalTax: saleData.sale.totalTax,
            taxBreakdown: saleData.sale.totalTaxBreakdown,
            appliedRules: appliedRules.map(r => r.id)
          }),
          reason: 'Tax calculation',
          userId: null // Will be set from request context
        }
      })
    } catch (error) {
      console.error('Failed to log tax audit:', error)
    }
  }

  /**
   * Validate tax calculation
   */
  validateTaxCalculation(calculation: TaxCalculationResult): { isValid: boolean; errors: string[] } {
    const errors: string[] = []

    // Check for negative amounts
    if (calculation.sale.subtotal < 0) {
      errors.push('Subtotal cannot be negative')
    }

    if (calculation.sale.totalTax < 0) {
      errors.push('Total tax cannot be negative')
    }

    if (calculation.sale.grandTotal < 0) {
      errors.push('Grand total cannot be negative')
    }

    // Validate tax breakdown
    for (const taxLine of calculation.sale.totalTaxBreakdown) {
      if (taxLine.baseAmount < 0) {
        errors.push(`Base amount cannot be negative for ${taxLine.taxTypeCode}`)
      }

      if (taxLine.taxAmount < 0) {
        errors.push(`Tax amount cannot be negative for ${taxLine.taxTypeCode}`)
      }

      if (taxLine.taxPercentage < 0 || taxLine.taxPercentage > 100) {
        errors.push(`Invalid tax percentage for ${taxLine.taxTypeCode}`)
      }
    }

    // Check tax calculation accuracy
    const calculatedTax = calculation.sale.totalTaxBreakdown.reduce((sum, tax) => sum + tax.taxAmount, 0)
    const expectedTax = calculation.sale.totalTax

    if (Math.abs(calculatedTax - expectedTax) > 0.01) {
      errors.push('Tax calculation mismatch')
    }

    return {
      isValid: errors.length === 0,
      errors
    }
  }

  /**
   * Round tax amounts according to rules
   */
  roundTaxAmount(amount: number, roundingRule: 'nearest' | 'up' | 'down' = 'nearest'): number {
    switch (roundingRule) {
      case 'up':
        return Math.ceil(amount * 100) / 100
      case 'down':
        return Math.floor(amount * 100) / 100
      case 'nearest':
      default:
        return Math.round(amount * 100) / 100
    }
  }

  /**
   * Get tax summary for reporting
   */
  getTaxSummary(calculation: TaxCalculationResult) {
    const summary = {
      totalTax: calculation.sale.totalTax,
      taxByType: {} as { [key: string]: number },
      taxByRate: {} as { [key: string]: number },
      totalItems: calculation.items.length,
      exemptItems: calculation.items.filter(item => item.taxBreakdown.length === 0).length
    }

    // Group by tax type
    for (const taxLine of calculation.sale.totalTaxBreakdown) {
      if (!summary.taxByType[taxLine.taxTypeCode]) {
        summary.taxByType[taxLine.taxTypeCode] = 0
      }
      summary.taxByType[taxLine.taxTypeCode] += taxLine.taxAmount

      const rateKey = `${taxLine.taxTypeCode}_${taxLine.taxPercentage}`
      if (!summary.taxByRate[rateKey]) {
        summary.taxByRate[rateKey] = 0
      }
      summary.taxByRate[rateKey] += taxLine.taxAmount
    }

    return summary
  }
}

// Export singleton instance
export const taxEngine = new TaxCalculationEngine()