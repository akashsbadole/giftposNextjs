/**
 * Comprehensive Test Suite for Enhanced Multi-Tax System
 * Tests all aspects of the multi-tax calculation engine, regional variations, and compliance features
 */

import { taxEngine, TaxCalculationInput, TaxCalculationResult } from './tax-engine'
import { PrismaClient } from '@prisma/client'

const prisma = new PrismaClient()

// Test data setup
const mockStoreId = 'test-store-id'
const mockCustomerId = 'test-customer-id'

// Mock tax configuration for testing
const mockTaxConfiguration = {
  taxTypes: [
    { code: 'CGST', name: 'Central GST', isActive: true },
    { code: 'SGST', name: 'State GST', isActive: true },
    { code: 'IGST', name: 'Integrated GST', isActive: true },
    { code: 'CESS', name: 'Compensation Cess', isActive: true }
  ],
  taxRegions: [
    { code: 'MH', name: 'Maharashtra', type: 'state', gstStateCode: '27', isActive: true },
    { code: 'DL', name: 'Delhi', type: 'state', gstStateCode: '07', isActive: true },
    { code: 'KA', name: 'Karnataka', type: 'state', gstStateCode: '29', isActive: true },
    { code: 'IN', name: 'India', type: 'country', isActive: true }
  ],
  taxRates: [
    // Maharashtra rates (18% GST)
    { taxTypeCode: 'CGST', regionCode: 'MH', rate: 9.0 },
    { taxTypeCode: 'SGST', regionCode: 'MH', rate: 9.0 },
    // Delhi rates (18% GST)
    { taxTypeCode: 'CGST', regionCode: 'DL', rate: 9.0 },
    { taxTypeCode: 'SGST', regionCode: 'DL', rate: 9.0 },
    // Inter-state rates (18% IGST)
    { taxTypeCode: 'IGST', regionCode: 'MH', rate: 18.0 },
    { taxTypeCode: 'IGST', regionCode: 'DL', rate: 18.0 },
    // CESS rates
    { taxTypeCode: 'CESS', regionCode: 'MH', rate: 1.0 }
  ]
}

describe('Enhanced Multi-Tax Calculation Engine', () => {
  beforeAll(async () => {
    // Setup test data in database
    await setupTestData()
  })

  afterAll(async () => {
    // Clean up test data
    await cleanupTestData()
  })

  describe('Basic Tax Calculations', () => {
    test('should calculate simple CGST + SGST for intra-state transaction', async () => {
      const input: TaxCalculationInput = {
        storeId: mockStoreId,
        customerId: mockCustomerId,
        items: [
          {
            productId: 'product-1',
            quantity: 1,
            unitPrice: 100,
            totalPrice: 100,
            categoryId: 'category-1'
          }
        ],
        customerRegion: 'MH',
        storeRegion: 'MH',
        isInterState: false,
        isExport: false
      }

      const result = await taxEngine.calculateTax(input)

      expect(result.sale.subtotal).toBe(100)
      expect(result.sale.totalTax).toBe(18) // 9% CGST + 9% SGST
      expect(result.sale.grandTotal).toBe(118)
      expect(result.sale.totalTaxBreakdown).toHaveLength(2)
      
      const cgst = result.sale.totalTaxBreakdown.find(t => t.taxTypeCode === 'CGST')
      const sgst = result.sale.totalTaxBreakdown.find(t => t.taxTypeCode === 'SGST')
      
      expect(cgst?.taxAmount).toBe(9)
      expect(sgst?.taxAmount).toBe(9)
    })

    test('should calculate IGST for inter-state transaction', async () => {
      const input: TaxCalculationInput = {
        storeId: mockStoreId,
        customerId: mockCustomerId,
        items: [
          {
            productId: 'product-1',
            quantity: 1,
            unitPrice: 100,
            totalPrice: 100,
            categoryId: 'category-1'
          }
        ],
        customerRegion: 'DL', // Different state
        storeRegion: 'MH',
        isInterState: true,
        isExport: false
      }

      const result = await taxEngine.calculateTax(input)

      expect(result.sale.subtotal).toBe(100)
      expect(result.sale.totalTax).toBe(18) // 18% IGST
      expect(result.sale.grandTotal).toBe(118)
      expect(result.sale.totalTaxBreakdown).toHaveLength(1)
      
      const igst = result.sale.totalTaxBreakdown.find(t => t.taxTypeCode === 'IGST')
      expect(igst?.taxAmount).toBe(18)
    })

    test('should calculate compound tax (GST + CESS)', async () => {
      const input: TaxCalculationInput = {
        storeId: mockStoreId,
        customerId: mockCustomerId,
        items: [
          {
            productId: 'product-luxury', // Luxury item with CESS
            quantity: 1,
            unitPrice: 1000,
            totalPrice: 1000,
            categoryId: 'luxury-category'
          }
        ],
        customerRegion: 'MH',
        storeRegion: 'MH',
        isInterState: false,
        isExport: false
      }

      const result = await taxEngine.calculateTax(input)

      expect(result.sale.subtotal).toBe(1000)
      expect(result.sale.totalTax).toBe(190) // 18% GST + 1% CESS
      expect(result.sale.grandTotal).toBe(1190)
      
      const gst = result.sale.totalTaxBreakdown.find(t => t.taxTypeCode === 'CGST' || t.taxTypeCode === 'SGST')
      const cess = result.sale.totalTaxBreakdown.find(t => t.taxTypeCode === 'CESS')
      
      expect(gst?.taxAmount).toBe(180)
      expect(cess?.taxAmount).toBe(10)
    })

    test('should handle tax-exempt items', async () => {
      const input: TaxCalculationInput = {
        storeId: mockStoreId,
        customerId: mockCustomerId,
        items: [
          {
            productId: 'product-exempt', // Exempt item (e.g., rice, medicines)
            quantity: 1,
            unitPrice: 50,
            totalPrice: 50,
            categoryId: 'essential-category',
            hsnCode: '1006' // Rice HSN code
          }
        ],
        customerRegion: 'MH',
        storeRegion: 'MH',
        isInterState: false,
        isExport: false
      }

      const result = await taxEngine.calculateTax(input)

      expect(result.sale.subtotal).toBe(50)
      expect(result.sale.totalTax).toBe(0) // Tax exempt
      expect(result.sale.grandTotal).toBe(50)
      expect(result.sale.totalTaxBreakdown).toHaveLength(0)
    })
  })

  describe('Regional Tax Variations', () => {
    test('should apply different tax rates by region', async () => {
      const maharashtraInput: TaxCalculationInput = {
        storeId: mockStoreId,
        items: [{ productId: 'product-1', quantity: 1, unitPrice: 100, totalPrice: 100, categoryId: 'category-1' }],
        customerRegion: 'MH',
        storeRegion: 'MH'
      }

      const delhiInput: TaxCalculationInput = {
        storeId: mockStoreId,
        items: [{ productId: 'product-1', quantity: 1, unitPrice: 100, totalPrice: 100, categoryId: 'category-1' }],
        customerRegion: 'DL',
        storeRegion: 'DL'
      }

      const [maharashtraResult, delhiResult] = await Promise.all([
        taxEngine.calculateTax(maharashtraInput),
        taxEngine.calculateTax(delhiInput)
      ])

      expect(maharashtraResult.sale.totalTax).toBe(delhiResult.sale.totalTax) // Same rates
      expect(maharashtraResult.metadata.region).toBe('MH')
      expect(delhiResult.metadata.region).toBe('DL')
    })

    test('should handle export transactions (tax-exempt)', async () => {
      const input: TaxCalculationInput = {
        storeId: mockStoreId,
        items: [{ productId: 'product-1', quantity: 1, unitPrice: 100, totalPrice: 100, categoryId: 'category-1' }],
        customerRegion: 'IN',
        storeRegion: 'MH',
        isInterState: false,
        isExport: true
      }

      const result = await taxEngine.calculateTax(input)

      expect(result.sale.subtotal).toBe(100)
      expect(result.sale.totalTax).toBe(0) // Export exempt
      expect(result.sale.grandTotal).toBe(100)
    })
  })

  describe('Complex Tax Rules', () => {
    test('should apply tax exemptions for specific customers', async () => {
      // This test would require setting up customer-specific tax exemptions
      const input: TaxCalculationInput = {
        storeId: mockStoreId,
        customerId: 'exempt-customer-id', // Customer with exemption
        items: [{ productId: 'product-1', quantity: 1, unitPrice: 100, totalPrice: 100, categoryId: 'category-1' }],
        customerRegion: 'MH',
        storeRegion: 'MH'
      }

      const result = await taxEngine.calculateTax(input)

      // Should have applied customer exemption
      expect(result.sale.totalTax).toBeLessThan(18)
      expect(result.metadata.exemptions.length).toBeGreaterThan(0)
    })

    test('should handle tax holidays', async () => {
      // This test would require setting up tax holiday rules
      const input: TaxCalculationInput = {
        storeId: mockStoreId,
        items: [{ productId: 'product-1', quantity: 1, unitPrice: 100, totalPrice: 100, categoryId: 'category-1' }],
        customerRegion: 'MH',
        storeRegion: 'MH',
        transactionDate: new Date('2024-01-26') // Republic Day (tax holiday)
      }

      const result = await taxEngine.calculateTax(input)

      // Should have applied tax holiday exemption
      expect(result.metadata.appliedRules).toContain('Republic Day Tax Holiday')
    })
  })

  describe('Tax Calculation Validation', () => {
    test('should validate tax calculations', () => {
      const mockCalculation: TaxCalculationResult = {
        items: [],
        sale: {
          subtotal: 100,
          totalTax: 18,
          totalTaxBreakdown: [
            { taxTypeCode: 'CGST', taxTypeName: 'Central GST', baseAmount: 100, taxAmount: 9 },
            { taxTypeCode: 'SGST', taxTypeName: 'State GST', baseAmount: 100, taxAmount: 9 }
          ],
          grandTotal: 118
        },
        metadata: {
          calculationDate: new Date(),
          region: 'MH',
          isInterState: false,
          appliedRules: [],
          exemptions: []
        }
      }

      const validation = taxEngine.validateTaxCalculation(mockCalculation)
      expect(validation.isValid).toBe(true)
      expect(validation.errors).toHaveLength(0)
    })

    test('should detect invalid tax calculations', () => {
      const invalidCalculation: TaxCalculationResult = {
        items: [],
        sale: {
          subtotal: 100,
          totalTax: 20, // Mismatch: should be 18
          totalTaxBreakdown: [
            { taxTypeCode: 'CGST', taxTypeName: 'Central GST', baseAmount: 100, taxAmount: 10 },
            { taxTypeCode: 'SGST', taxTypeName: 'State GST', baseAmount: 100, taxAmount: 9 }
          ],
          grandTotal: 120
        },
        metadata: {
          calculationDate: new Date(),
          region: 'MH',
          isInterState: false,
          appliedRules: [],
          exemptions: []
        }
      }

      const validation = taxEngine.validateTaxCalculation(invalidCalculation)
      expect(validation.isValid).toBe(false)
      expect(validation.errors.length).toBeGreaterThan(0)
    })
  })

  describe('Tax Summary and Reporting', () => {
    test('should generate tax summary', () => {
      const mockCalculation: TaxCalculationResult = {
        items: [
          {
            productId: 'product-1',
            taxBreakdown: [
              { taxTypeCode: 'CGST', taxTypeName: 'Central GST', baseAmount: 100, taxPercentage: 9, taxAmount: 9 },
              { taxTypeCode: 'SGST', taxTypeName: 'State GST', baseAmount: 100, taxPercentage: 9, taxAmount: 9 }
            ],
            subtotal: 100,
            totalTax: 18,
            finalTotal: 118
          }
        ],
        sale: {
          subtotal: 100,
          totalTax: 18,
          totalTaxBreakdown: [
            { taxTypeCode: 'CGST', taxTypeName: 'Central GST', baseAmount: 100, taxAmount: 9 },
            { taxTypeCode: 'SGST', taxTypeName: 'State GST', baseAmount: 100, taxAmount: 9 }
          ],
          grandTotal: 118
        },
        metadata: {
          calculationDate: new Date(),
          region: 'MH',
          isInterState: false,
          appliedRules: [],
          exemptions: []
        }
      }

      const summary = taxEngine.getTaxSummary(mockCalculation)
      
      expect(summary.totalTax).toBe(18)
      expect(summary.taxByType.CGST).toBe(9)
      expect(summary.taxByType.SGST).toBe(9)
      expect(summary.totalItems).toBe(1)
      expect(summary.exemptItems).toBe(0)
    })
  })

  describe('Edge Cases and Error Handling', () => {
    test('should handle negative amounts gracefully', async () => {
      const input: TaxCalculationInput = {
        storeId: mockStoreId,
        items: [{ productId: 'product-1', quantity: -1, unitPrice: 100, totalPrice: -100, categoryId: 'category-1' }],
        customerRegion: 'MH',
        storeRegion: 'MH'
      }

      await expect(taxEngine.calculateTax(input)).rejects.toThrow()
    })

    test('should handle empty items array', async () => {
      const input: TaxCalculationInput = {
        storeId: mockStoreId,
        items: [],
        customerRegion: 'MH',
        storeRegion: 'MH'
      }

      await expect(taxEngine.calculateTax(input)).rejects.toThrow()
    })

    test('should handle invalid store ID', async () => {
      const input: TaxCalculationInput = {
        storeId: 'invalid-store-id',
        items: [{ productId: 'product-1', quantity: 1, unitPrice: 100, totalPrice: 100, categoryId: 'category-1' }],
        customerRegion: 'MH',
        storeRegion: 'MH'
      }

      await expect(taxEngine.calculateTax(input)).rejects.toThrow()
    })
  })

  describe('Performance Tests', () => {
    test('should handle bulk tax calculations efficiently', async () => {
      const bulkInputs = Array.from({ length: 100 }, (_, i) => ({
        storeId: mockStoreId,
        items: [{ productId: `product-${i}`, quantity: 1, unitPrice: 100, totalPrice: 100, categoryId: 'category-1' }],
        customerRegion: 'MH',
        storeRegion: 'MH'
      }))

      const startTime = Date.now()
      const results = await Promise.all(bulkInputs.map(input => taxEngine.calculateTax(input)))
      const endTime = Date.now()

      expect(results).toHaveLength(100)
      expect(endTime - startTime).toBeLessThan(5000) // Should complete within 5 seconds
    })
  })
})

// Helper functions for test setup
async function setupTestData() {
  try {
    // Create test tax types
    for (const taxType of mockTaxConfiguration.taxTypes) {
      await prisma.taxType.upsert({
        where: { code: taxType.code },
        update: { isActive: taxType.isActive },
        create: {
          code: taxType.code,
          name: taxType.name,
          isActive: taxType.isActive
        }
      })
    }

    // Create test tax regions
    for (const region of mockTaxConfiguration.taxRegions) {
      await prisma.taxRegion.upsert({
        where: { code: region.code },
        update: { isActive: region.isActive },
        create: {
          code: region.code,
          name: region.name,
          type: region.type,
          gstStateCode: region.gstStateCode,
          isActive: region.isActive
        }
      })
    }

    // Create test tax rates
    for (const rate of mockTaxConfiguration.taxRates) {
      const taxType = await prisma.taxType.findUnique({ where: { code: rate.taxTypeCode } })
      const region = await prisma.taxRegion.findUnique({ where: { code: rate.regionCode } })
      
      if (taxType && region) {
        await prisma.taxRate.create({
          data: {
            taxTypeId: taxType.id,
            regionId: region.id,
            rate: rate.rate,
            effectiveFrom: new Date('2024-01-01'),
            isActive: true
          }
        })
      }
    }

    // Create test store
    await prisma.store.upsert({
      where: { id: mockStoreId },
      update: {},
      create: {
        id: mockStoreId,
        name: 'Test Store',
        currency: 'INR'
      }
    })

    // Create test customer
    await prisma.customer.upsert({
      where: { id: mockCustomerId },
      update: {},
      create: {
        id: mockCustomerId,
        name: 'Test Customer',
        storeId: mockStoreId
      }
    })

    // Create test products
    await prisma.product.createMany({
      data: [
        {
          id: 'product-1',
          name: 'Test Product 1',
          price: 100,
          categoryId: 'category-1',
          storeId: mockStoreId
        },
        {
          id: 'product-luxury',
          name: 'Luxury Product',
          price: 1000,
          categoryId: 'luxury-category',
          storeId: mockStoreId
        },
        {
          id: 'product-exempt',
          name: 'Exempt Product',
          price: 50,
          categoryId: 'essential-category',
          storeId: mockStoreId
        }
      ],
      skipDuplicates: true
    })

    // Create test categories
    await prisma.category.createMany({
      data: [
        { id: 'category-1', name: 'General Category', slug: 'general', storeId: mockStoreId },
        { id: 'luxury-category', name: 'Luxury Category', slug: 'luxury', storeId: mockStoreId },
        { id: 'essential-category', name: 'Essential Category', slug: 'essential', storeId: mockStoreId }
      ],
      skipDuplicates: true
    })

    console.log('Test data setup completed successfully')
  } catch (error) {
    console.error('Failed to setup test data:', error)
    throw error
  }
}

async function cleanupTestData() {
  try {
    // Clean up in reverse order of dependencies
    await prisma.saleItemTaxBreakdown.deleteMany({})
    await prisma.saleTaxBreakdown.deleteMany({})
    await prisma.stockLog.deleteMany({})
    await prisma.saleItem.deleteMany({})
    await prisma.sale.deleteMany({})
    await prisma.payment.deleteMany({})
    await prisma.product.deleteMany({})
    await prisma.category.deleteMany({})
    await prisma.customer.deleteMany({})
    await prisma.taxRate.deleteMany({})
    await prisma.taxRegion.deleteMany({})
    await prisma.taxType.deleteMany({})
    await prisma.store.deleteMany({})

    console.log('Test data cleanup completed successfully')
  } catch (error) {
    console.error('Failed to cleanup test data:', error)
  } finally {
    await prisma.$disconnect()
  }
}