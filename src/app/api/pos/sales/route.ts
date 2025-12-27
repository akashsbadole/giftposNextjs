import { NextRequest, NextResponse } from 'next/server'
import { PrismaClient } from '@prisma/client'
import { getAuth } from '@clerk/nextjs/server'
import { v4 as uuidv4 } from 'uuid'
import { taxEngine, TaxCalculationInput } from '@/lib/tax-engine'

const prisma = new PrismaClient()

// Get all sales
export async function GET() {
  try {
    const { userId } = getAuth()

    if (!userId) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    // Verify user is an employee
    const employee = await prisma.employee.findFirst({
      where: { clerkId: userId },
    })

    if (!employee) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
    }

    const sales = await prisma.sale.findMany({
      include: {
        items: {
          include: {
            product: true,
          },
        },
        customer: true,
        employee: true,
      },
      orderBy: { createdAt: 'desc' },
      take: 100, // Limit to last 100 sales
    })

    return NextResponse.json(sales)
  } catch (error) {
    console.error('Error fetching sales:', error)
    return NextResponse.json({ error: 'Failed to fetch sales' }, { status: 500 })
  }
}

// Create new sale
export async function POST(request: NextRequest) {
  try {
    const { userId } = getAuth()

    if (!userId) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    // Verify user is an employee
    const employee = await prisma.employee.findFirst({
      where: { clerkId: userId },
    })

    if (!employee) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
    }

    const body = await request.json()
    const { 
      items, 
      subtotal, 
      gst, 
      discount = 0, 
      total, 
      paymentMethod, 
      customerId,
      // Enhanced multi-tax fields
      customerRegion,
      storeRegion,
      isInterState = false,
      isExport = false,
      taxCalculation // Optional pre-calculated tax data
    } = body

    if (!items || items.length === 0) {
      return NextResponse.json({ error: 'Sale must contain at least one item' }, { status: 400 })
    }

    // Get store
    let store = await prisma.store.findFirst()
    if (!store) {
      store = await prisma.store.create({
        data: {
          name: 'My Store',
          gstRate: 10,
          currency: 'USD',
        },
      })
    }

    // Find active shift for cash transactions
    let activeShift = null
    if (paymentMethod === 'cash') {
      activeShift = await prisma.shift.findFirst({
        where: {
          employeeId: employee.id,
          storeId: store.id,
          status: 'active'
        }
      })

      if (!activeShift) {
        return NextResponse.json(
          { error: 'No active shift found. Please start a shift before processing cash sales.' },
          { status: 400 }
        )
      }
    }

    // Generate invoice number
    const invoiceNumber = `INV-${Date.now()}-${Math.random().toString(36).substr(2, 9).toUpperCase()}`

    // Calculate taxes using enhanced tax engine
    let taxCalculationResult
    if (!taxCalculation) {
      // Prepare tax calculation input
      const taxInput: TaxCalculationInput = {
        storeId: store.id,
        customerId: customerId || undefined,
        items: items.map((item: any) => ({
          productId: item.productId,
          quantity: item.quantity,
          unitPrice: item.price,
          totalPrice: item.subtotal,
          categoryId: item.categoryId || '', // This would need to be fetched from product
          hsnCode: item.hsnCode,
          isTaxInclusive: item.isTaxInclusive
        })),
        customerRegion: customerRegion || 'IN',
        storeRegion: storeRegion || 'IN',
        isInterState,
        isExport
      }

      try {
        taxCalculationResult = await taxEngine.calculateTax(taxInput)
      } catch (error) {
        console.error('Tax calculation failed, using fallback:', error)
        // Fallback to simple GST calculation if enhanced tax calculation fails
        taxCalculationResult = {
          sale: {
            subtotal,
            totalTax: gst || 0,
            totalTaxBreakdown: [],
            grandTotal: total || (subtotal + (gst || 0) - discount)
          },
          items: []
        }
      }
    } else {
      taxCalculationResult = taxCalculation
    }

    // Create sale with items in a transaction
    const sale = await prisma.$transaction(async (tx) => {
      // Create sale with enhanced tax data
      const sale = await tx.sale.create({
        data: {
          invoiceNumber,
          subtotal: taxCalculationResult.sale.subtotal,
          tax: taxCalculationResult.sale.totalTax, // Legacy compatibility
          gst: taxCalculationResult.sale.totalTax, // Legacy compatibility
          discount,
          total: taxCalculationResult.sale.grandTotal,
          paymentMethod,
          status: 'completed',
          storeId: store.id,
          customerId: customerId || null,
          employeeId: employee.id,
          items: {
            create: items.map((item: any) => ({
              productId: item.productId,
              quantity: item.quantity,
              price: item.price,
              subtotal: item.subtotal,
            })),
          },
          payment: {
            create: {
              amount: taxCalculationResult.sale.grandTotal,
              method: paymentMethod,
              status: 'completed',
            },
          },
        },
        include: {
          items: {
            include: {
              product: true,
            },
          },
          customer: true,
          payment: true,
        },
      })

      // Create tax breakdown records for the sale
      for (const taxLine of taxCalculationResult.sale.totalTaxBreakdown) {
        await tx.saleTaxBreakdown.create({
          data: {
            saleId: sale.id,
            taxTypeId: taxLine.taxTypeId,
            taxRateId: taxLine.taxRateId,
            baseAmount: taxLine.baseAmount,
            taxPercentage: taxLine.taxPercentage,
            taxAmount: taxLine.taxAmount,
            isCompound: taxLine.isCompound,
            parentTaxId: taxLine.parentTaxId,
          },
        })
      }

      // Create tax breakdown records for individual items
      for (let i = 0; i < taxCalculationResult.items.length; i++) {
        const itemTaxData = taxCalculationResult.items[i]
        const saleItem = sale.items[i]
        
        for (const taxLine of itemTaxData.taxBreakdown) {
          await tx.saleItemTaxBreakdown.create({
            data: {
              saleItemId: saleItem.id,
              taxTypeId: taxLine.taxTypeId,
              taxRateId: taxLine.taxRateId,
              baseAmount: taxLine.baseAmount,
              taxPercentage: taxLine.taxPercentage,
              taxAmount: taxLine.taxAmount,
              hsnCode: taxLine.hsnCode,
              isCompound: taxLine.isCompound,
              parentTaxId: taxLine.parentTaxId,
            },
          })
        }
      }

      // Update product stock and create stock logs
      for (const item of items) {
        await tx.product.update({
          where: { id: item.productId },
          data: {
            stock: {
              decrement: item.quantity,
            },
          },
        })

        await tx.stockLog.create({
          data: {
            quantity: -item.quantity,
            type: 'sale',
            reason: `Sale #${sale.invoiceNumber}`,
            productId: item.productId,
            employeeId: employee.id,
          },
        })
      }

      // Create cash transaction if payment method is cash and there's an active shift
      if (paymentMethod === 'cash' && activeShift) {
        await tx.cashTransaction.create({
          data: {
            shiftId: activeShift.id,
            type: 'sale',
            amount: taxCalculationResult.sale.grandTotal,
            referenceId: sale.id,
            referenceType: 'sale',
            reason: `Cash sale - ${invoiceNumber}`,
            createdBy: userId
          }
        })
      }

      return sale
    })

    // Add loyalty points to customer if applicable
    if (customerId) {
      const pointsEarned = Math.floor(taxCalculationResult.sale.grandTotal)
      await prisma.customer.update({
        where: { id: customerId },
        data: {
          points: {
            increment: pointsEarned,
          },
        },
      })
    }

    // Return sale with enhanced tax information
    const enhancedSale = {
      ...sale,
      taxBreakdown: taxCalculationResult.sale.totalTaxBreakdown,
      itemTaxBreakdown: taxCalculationResult.items.map(item => ({
        productId: item.productId,
        taxBreakdown: item.taxBreakdown
      })),
      taxCalculation: taxCalculationResult
    }

    return NextResponse.json(enhancedSale, { status: 201 })
  } catch (error) {
    console.error('Error creating sale:', error)
    return NextResponse.json({ error: 'Failed to create sale' }, { status: 500 })
  }
}
