import { PrismaClient } from '@prisma/client'
import { AuditLogger } from './security/audit-logger'
import { OrderErrorHandler } from './order-management-errors'

const prisma = new PrismaClient()

export interface BatchOperationParams {
  operationId: string
  type: string
  entityType: string
  parameters: Record<string, any>
  storeId: string
  userId: string
  userName?: string
  userEmail?: string
  records?: any[]
  files?: File[]
}

export interface BatchOperationResult {
  success: boolean
  totalRecords: number
  processedRecords: number
  successRecords: number
  failedRecords: number
  skippedRecords: number
  errors: string[]
  warnings: string[]
  results: any[]
}

export interface ValidationResult {
  isValid: boolean
  errors: string[]
  warnings: string[]
  processedData: any[]
}

export class BatchOperationManager {
  
  // Initialize and start batch operation processing
  static async startBatchOperation(params: BatchOperationParams): Promise<BatchOperationResult> {
    const { operationId, type, entityType, parameters, storeId, userId, userName, userEmail, records = [], files = [] } = params
    
    try {
      // Update operation status to running
      await prisma.batchOperation.update({
        where: { operationId },
        data: {
          status: 'running',
          startedAt: new Date(),
          progressPercentage: 0
        }
      })

      // Log operation start
      await this.logOperationEvent(operationId, 'started', 'Batch operation started', userId, userEmail, userName)

      let result: BatchOperationResult

      switch (type) {
        case 'import':
          result = await this.handleImportOperation(operationId, entityType, parameters, records, files, storeId, userId)
          break
        case 'export':
          result = await this.handleExportOperation(operationId, entityType, parameters, storeId, userId)
          break
        case 'bulk_update':
          result = await this.handleBulkUpdateOperation(operationId, entityType, parameters, records, storeId, userId)
          break
        case 'mass_processing':
          result = await this.handleMassProcessingOperation(operationId, entityType, parameters, records, storeId, userId)
          break
        default:
          throw new Error(`Unsupported operation type: ${type}`)
      }

      // Update operation with final results
      await prisma.batchOperation.update({
        where: { operationId },
        data: {
          status: result.success ? 'completed' : 'failed',
          completedAt: new Date(),
          totalRecords: result.totalRecords,
          processedRecords: result.processedRecords,
          successRecords: result.successRecords,
          failedRecords: result.failedRecords,
          skippedRecords: result.skippedRecords,
          progressPercentage: 100,
          resultData: JSON.stringify({
            results: result.results,
            errors: result.errors,
            warnings: result.warnings
          }),
          actualDuration: Date.now() - new Date().getTime()
        }
      })

      // Log operation completion
      await this.logOperationEvent(operationId, 'completed', `Batch operation completed with ${result.successRecords} successes, ${result.failedRecords} failures`, userId, userEmail, userName)

      return result

    } catch (error) {
      // Update operation status to failed
      await prisma.batchOperation.update({
        where: { operationId },
        data: {
          status: 'failed',
          completedAt: new Date(),
          errorLog: JSON.stringify({
            message: error instanceof Error ? error.message : 'Unknown error',
            stack: error instanceof Error ? error.stack : undefined
          })
        }
      })

      // Log operation failure
      await this.logOperationEvent(operationId, 'failed', `Batch operation failed: ${error instanceof Error ? error.message : 'Unknown error'}`, userId, userEmail, userName)

      return {
        success: false,
        totalRecords: 0,
        processedRecords: 0,
        successRecords: 0,
        failedRecords: 0,
        skippedRecords: 0,
        errors: [error instanceof Error ? error.message : 'Unknown error'],
        warnings: [],
        results: []
      }
    }
  }

  // Handle import operations
  private static async handleImportOperation(
    operationId: string,
    entityType: string,
    parameters: Record<string, any>,
    records: any[],
    files: File[],
    storeId: string,
    userId: string
  ): Promise<BatchOperationResult> {
    
    const result: BatchOperationResult = {
      success: true,
      totalRecords: 0,
      processedRecords: 0,
      successRecords: 0,
      failedRecords: 0,
      skippedRecords: 0,
      errors: [],
      warnings: [],
      results: []
    }

    try {
      switch (entityType) {
        case 'products':
          result.results.push(await this.importProducts(records, parameters, storeId, userId))
          break
        case 'customers':
          result.results.push(await this.importCustomers(records, parameters, storeId, userId))
          break
        case 'inventory':
          result.results.push(await this.importInventory(records, parameters, storeId, userId))
          break
        case 'categories':
          result.results.push(await this.importCategories(records, parameters, storeId, userId))
          break
        default:
          throw new Error(`Unsupported entity type for import: ${entityType}`)
      }

      // Update result counts
      result.totalRecords = result.results.reduce((sum, res) => sum + (res.totalRecords || 0), 0)
      result.successRecords = result.results.reduce((sum, res) => sum + (res.successRecords || 0), 0)
      result.failedRecords = result.results.reduce((sum, res) => sum + (res.failedRecords || 0), 0)
      result.skippedRecords = result.results.reduce((sum, res) => sum + (res.skippedRecords || 0), 0)
      result.processedRecords = result.totalRecords

    } catch (error) {
      result.success = false
      result.errors.push(error instanceof Error ? error.message : 'Import operation failed')
    }

    return result
  }

  // Handle export operations
  private static async handleExportOperation(
    operationId: string,
    entityType: string,
    parameters: Record<string, any>,
    storeId: string,
    userId: string
  ): Promise<BatchOperationResult> {
    
    const result: BatchOperationResult = {
      success: true,
      totalRecords: 0,
      processedRecords: 0,
      successRecords: 0,
      failedRecords: 0,
      skippedRecords: 0,
      errors: [],
      warnings: [],
      results: []
    }

    try {
      let exportData

      switch (entityType) {
        case 'products':
          exportData = await this.exportProducts(parameters, storeId)
          break
        case 'customers':
          exportData = await this.exportCustomers(parameters, storeId)
          break
        case 'inventory':
          exportData = await this.exportInventory(parameters, storeId)
          break
        case 'orders':
          exportData = await this.exportOrders(parameters, storeId)
          break
        case 'sales':
          exportData = await this.exportSales(parameters, storeId)
          break
        default:
          throw new Error(`Unsupported entity type for export: ${entityType}`)
      }

      result.results.push(exportData)
      result.totalRecords = exportData.totalRecords || 0
      result.successRecords = result.totalRecords
      result.processedRecords = result.totalRecords

    } catch (error) {
      result.success = false
      result.errors.push(error instanceof Error ? error.message : 'Export operation failed')
    }

    return result
  }

  // Handle bulk update operations
  private static async handleBulkUpdateOperation(
    operationId: string,
    entityType: string,
    parameters: Record<string, any>,
    records: any[],
    storeId: string,
    userId: string
  ): Promise<BatchOperationResult> {
    
    const result: BatchOperationResult = {
      success: true,
      totalRecords: records.length,
      processedRecords: 0,
      successRecords: 0,
      failedRecords: 0,
      skippedRecords: 0,
      errors: [],
      warnings: [],
      results: []
    }

    try {
      switch (entityType) {
        case 'products':
          result.results.push(await this.bulkUpdateProducts(records, parameters, storeId, userId))
          break
        case 'customers':
          result.results.push(await this.bulkUpdateCustomers(records, parameters, storeId, userId))
          break
        case 'inventory':
          result.results.push(await this.bulkUpdateInventory(records, parameters, storeId, userId))
          break
        case 'orders':
          result.results.push(await this.bulkUpdateOrders(records, parameters, storeId, userId))
          break
        default:
          throw new Error(`Unsupported entity type for bulk update: ${entityType}`)
      }

      // Update result counts
      result.processedRecords = result.totalRecords
      result.successRecords = result.results.reduce((sum, res) => sum + (res.successRecords || 0), 0)
      result.failedRecords = result.results.reduce((sum, res) => sum + (res.failedRecords || 0), 0)
      result.skippedRecords = result.results.reduce((sum, res) => sum + (res.skippedRecords || 0), 0)

    } catch (error) {
      result.success = false
      result.errors.push(error instanceof Error ? error.message : 'Bulk update operation failed')
    }

    return result
  }

  // Handle mass processing operations
  private static async handleMassProcessingOperation(
    operationId: string,
    entityType: string,
    parameters: Record<string, any>,
    records: any[],
    storeId: string,
    userId: string
  ): Promise<BatchOperationResult> {
    
    const result: BatchOperationResult = {
      success: true,
      totalRecords: records.length,
      processedRecords: 0,
      successRecords: 0,
      failedRecords: 0,
      skippedRecords: 0,
      errors: [],
      warnings: [],
      results: []
    }

    try {
      switch (entityType) {
        case 'orders':
          result.results.push(await this.massProcessOrders(records, parameters, storeId, userId))
          break
        case 'inventory':
          result.results.push(await this.massProcessInventory(records, parameters, storeId, userId))
          break
        case 'customers':
          result.results.push(await this.massProcessCustomers(records, parameters, storeId, userId))
          break
        default:
          throw new Error(`Unsupported entity type for mass processing: ${entityType}`)
      }

      // Update result counts
      result.processedRecords = result.totalRecords
      result.successRecords = result.results.reduce((sum, res) => sum + (res.successRecords || 0), 0)
      result.failedRecords = result.results.reduce((sum, res) => sum + (res.failedRecords || 0), 0)
      result.skippedRecords = result.results.reduce((sum, res) => sum + (res.skippedRecords || 0), 0)

    } catch (error) {
      result.success = false
      result.errors.push(error instanceof Error ? error.message : 'Mass processing operation failed')
    }

    return result
  }

  // Product import
  private static async importProducts(records: any[], parameters: Record<string, any>, storeId: string, userId: string) {
    const result = {
      totalRecords: records.length,
      successRecords: 0,
      failedRecords: 0,
      skippedRecords: 0,
      errors: [] as string[],
      created: [] as any[],
      updated: [] as any[]
    }

    for (const record of records) {
      try {
        // Validate product data
        const validation = this.validateProductData(record)
        if (!validation.isValid) {
          result.errors.push(...validation.errors)
          result.failedRecords++
          continue
        }

        // Check if product exists by SKU
        const existingProduct = await prisma.product.findUnique({
          where: { sku: record.sku }
        })

        if (existingProduct) {
          // Update existing product
          const updatedProduct = await prisma.product.update({
            where: { id: existingProduct.id },
            data: {
              name: record.name,
              description: record.description,
              price: parseFloat(record.price),
              cost: parseFloat(record.cost || 0),
              stock: parseInt(record.stock || 0),
              minStock: parseInt(record.minStock || 0),
              isActive: record.isActive !== false,
              updatedAt: new Date()
            }
          })
          result.updated.push(updatedProduct)
        } else {
          // Create new product
          const category = await prisma.category.findFirst({
            where: { 
              storeId,
              OR: [
                { name: record.category },
                { slug: record.category?.toLowerCase().replace(/\s+/g, '-') }
              ]
            }
          })

          if (!category) {
            result.errors.push(`Category not found: ${record.category}`)
            result.failedRecords++
            continue
          }

          const newProduct = await prisma.product.create({
            data: {
              sku: record.sku,
              barcode: record.barcode,
              name: record.name,
              description: record.description,
              price: parseFloat(record.price),
              cost: parseFloat(record.cost || 0),
              stock: parseInt(record.stock || 0),
              minStock: parseInt(record.minStock || 0),
              categoryId: category.id,
              storeId,
              isActive: record.isActive !== false
            }
          })
          result.created.push(newProduct)
        }

        result.successRecords++

      } catch (error) {
        result.errors.push(`Failed to import product ${record.sku}: ${error instanceof Error ? error.message : 'Unknown error'}`)
        result.failedRecords++
      }
    }

    return result
  }

  // Customer import
  private static async importCustomers(records: any[], parameters: Record<string, any>, storeId: string, userId: string) {
    const result = {
      totalRecords: records.length,
      successRecords: 0,
      failedRecords: 0,
      skippedRecords: 0,
      errors: [] as string[],
      created: [] as any[],
      updated: [] as any[]
    }

    for (const record of records) {
      try {
        // Validate customer data
        const validation = this.validateCustomerData(record)
        if (!validation.isValid) {
          result.errors.push(...validation.errors)
          result.failedRecords++
          continue
        }

        // Check if customer exists by email or phone
        const existingCustomer = await prisma.customer.findFirst({
          where: {
            storeId,
            OR: [
              record.email ? { email: record.email } : undefined,
              record.phone ? { phone: record.phone } : undefined
            ].filter(Boolean) as any
          }
        })

        if (existingCustomer) {
          // Update existing customer
          const updatedCustomer = await prisma.customer.update({
            where: { id: existingCustomer.id },
            data: {
              name: record.name,
              email: record.email,
              phone: record.phone,
              address: record.address,
              points: parseInt(record.points || 0),
              updatedAt: new Date()
            }
          })
          result.updated.push(updatedCustomer)
        } else {
          // Create new customer
          const newCustomer = await prisma.customer.create({
            data: {
              name: record.name,
              email: record.email,
              phone: record.phone,
              address: record.address,
              points: parseInt(record.points || 0),
              storeId
            }
          })
          result.created.push(newCustomer)
        }

        result.successRecords++

      } catch (error) {
        result.errors.push(`Failed to import customer ${record.name}: ${error instanceof Error ? error.message : 'Unknown error'}`)
        result.failedRecords++
      }
    }

    return result
  }

  // Inventory import
  private static async importInventory(records: any[], parameters: Record<string, any>, storeId: string, userId: string) {
    const result = {
      totalRecords: records.length,
      successRecords: 0,
      failedRecords: 0,
      skippedRecords: 0,
      errors: [] as string[],
      adjustments: [] as any[]
    }

    for (const record of records) {
      try {
        // Find product by SKU or barcode
        const product = await prisma.product.findFirst({
          where: {
            storeId,
            OR: [
              record.sku ? { sku: record.sku } : undefined,
              record.barcode ? { barcode: record.barcode } : undefined
            ].filter(Boolean) as any
          }
        })

        if (!product) {
          result.errors.push(`Product not found: ${record.sku || record.barcode}`)
          result.failedRecords++
          continue
        }

        // Calculate stock adjustment
        const currentStock = product.stock
        const newStock = parseInt(record.newStock || record.stock)
        const adjustment = newStock - currentStock

        // Update product stock
        const updatedProduct = await prisma.product.update({
          where: { id: product.id },
          data: { stock: newStock }
        })

        // Log stock movement
        await prisma.stockLog.create({
          data: {
            productId: product.id,
            quantity: adjustment,
            type: 'adjustment',
            reason: `Bulk inventory update via batch operation`,
            employeeId: userId
          }
        })

        result.adjustments.push({
          productId: product.id,
          sku: product.sku,
          previousStock: currentStock,
          newStock: newStock,
          adjustment: adjustment
        })

        result.successRecords++

      } catch (error) {
        result.errors.push(`Failed to update inventory for ${record.sku || record.barcode}: ${error instanceof Error ? error.message : 'Unknown error'}`)
        result.failedRecords++
      }
    }

    return result
  }

  // Categories import
  private static async importCategories(records: any[], parameters: Record<string, any>, storeId: string, userId: string) {
    const result = {
      totalRecords: records.length,
      successRecords: 0,
      failedRecords: 0,
      skippedRecords: 0,
      errors: [] as string[],
      created: [] as any[],
      updated: [] as any[]
    }

    for (const record of records) {
      try {
        // Validate category data
        if (!record.name) {
          result.errors.push('Category name is required')
          result.failedRecords++
          continue
        }

        // Check if category exists
        const existingCategory = await prisma.category.findFirst({
          where: { 
            storeId,
            OR: [
              { name: record.name },
              { slug: record.slug || record.name.toLowerCase().replace(/\s+/g, '-') }
            ]
          }
        })

        if (existingCategory) {
          // Update existing category
          const updatedCategory = await prisma.category.update({
            where: { id: existingCategory.id },
            data: {
              name: record.name,
              slug: record.slug || record.name.toLowerCase().replace(/\s+/g, '-'),
              color: record.color,
              updatedAt: new Date()
            }
          })
          result.updated.push(updatedCategory)
        } else {
          // Create new category
          const newCategory = await prisma.category.create({
            data: {
              name: record.name,
              slug: record.slug || record.name.toLowerCase().replace(/\s+/g, '-'),
              color: record.color,
              storeId
            }
          })
          result.created.push(newCategory)
        }

        result.successRecords++

      } catch (error) {
        result.errors.push(`Failed to import category ${record.name}: ${error instanceof Error ? error.message : 'Unknown error'}`)
        result.failedRecords++
      }
    }

    return result
  }

  // Export products
  private static async exportProducts(parameters: Record<string, any>, storeId: string) {
    const whereClause: any = { storeId }
    
    if (parameters.categoryId) {
      whereClause.categoryId = parameters.categoryId
    }
    
    if (parameters.isActive !== undefined) {
      whereClause.isActive = parameters.isActive
    }

    const products = await prisma.product.findMany({
      where: whereClause,
      include: {
        category: {
          select: { name: true }
        }
      },
      orderBy: { name: 'asc' }
    })

    return {
      totalRecords: products.length,
      data: products.map(product => ({
        sku: product.sku,
        barcode: product.barcode,
        name: product.name,
        description: product.description,
        category: product.category.name,
        price: product.price,
        cost: product.cost,
        stock: product.stock,
        minStock: product.minStock,
        isActive: product.isActive,
        createdAt: product.createdAt,
        updatedAt: product.updatedAt
      }))
    }
  }

  // Export customers
  private static async exportCustomers(parameters: Record<string, any>, storeId: string) {
    const whereClause: any = { storeId }
    
    if (parameters.hasPurchases !== undefined) {
      whereClause.sales = { some: {} }
    }

    const customers = await prisma.customer.findMany({
      where: whereClause,
      orderBy: { name: 'asc' }
    })

    return {
      totalRecords: customers.length,
      data: customers.map(customer => ({
        name: customer.name,
        email: customer.email,
        phone: customer.phone,
        address: customer.address,
        points: customer.points,
        createdAt: customer.createdAt,
        updatedAt: customer.updatedAt
      }))
    }
  }

  // Export inventory
  private static async exportInventory(parameters: Record<string, any>, storeId: string) {
    const whereClause: any = { storeId }
    
    if (parameters.categoryId) {
      whereClause.categoryId = parameters.categoryId
    }
    
    if (parameters.lowStockOnly) {
      whereClause.stock = { lte: prisma.product.fields.minStock }
    }

    const products = await prisma.product.findMany({
      where: whereClause,
      include: {
        category: {
          select: { name: true }
        },
        stockLogs: {
          where: {
            createdAt: {
              gte: parameters.fromDate ? new Date(parameters.fromDate) : undefined
            }
          },
          orderBy: { createdAt: 'desc' },
          take: 1
        }
      },
      orderBy: { name: 'asc' }
    })

    return {
      totalRecords: products.length,
      data: products.map(product => ({
        sku: product.sku,
        barcode: product.barcode,
        name: product.name,
        category: product.category.name,
        currentStock: product.stock,
        minStock: product.minStock,
        maxStock: product.maxStock,
        lastMovement: product.stockLogs[0]?.createdAt || null,
        lastMovementType: product.stockLogs[0]?.type || null,
        stockValue: product.stock * product.cost,
        isActive: product.isActive
      }))
    }
  }

  // Export orders
  private static async exportOrders(parameters: Record<string, any>, storeId: string) {
    const whereClause: any = { storeId }
    
    if (parameters.status) {
      whereClause.status = parameters.status
    }
    
    if (parameters.fromDate || parameters.toDate) {
      whereClause.createdAt = {}
      if (parameters.fromDate) whereClause.createdAt.gte = new Date(parameters.fromDate)
      if (parameters.toDate) whereClause.createdAt.lte = new Date(parameters.toDate)
    }

    const orders = await prisma.heldOrder.findMany({
      where: whereClause,
      include: {
        customer: {
          select: { name: true, email: true, phone: true }
        },
        employee: {
          select: { name: true }
        }
      },
      orderBy: { createdAt: 'desc' }
    })

    return {
      totalRecords: orders.length,
      data: orders.map(order => ({
        orderNumber: order.orderNumber,
        customerName: order.customer?.name || 'Walk-in',
        customerEmail: order.customer?.email,
        customerPhone: order.customer?.phone,
        employeeName: order.employee?.name,
        tableNumber: order.tableNumber,
        subtotal: order.subtotal,
        gst: order.gst,
        discount: order.discount,
        total: order.total,
        status: order.status,
        priority: order.priority,
        itemsCount: JSON.parse(order.itemsData || '[]').length,
        createdAt: order.createdAt,
        updatedAt: order.updatedAt
      }))
    }
  }

  // Export sales
  private static async exportSales(parameters: Record<string, any>, storeId: string) {
    const whereClause: any = { storeId }
    
    if (parameters.status) {
      whereClause.status = parameters.status
    }
    
    if (parameters.fromDate || parameters.toDate) {
      whereClause.createdAt = {}
      if (parameters.fromDate) whereClause.createdAt.gte = new Date(parameters.fromDate)
      if (parameters.toDate) whereClause.createdAt.lte = new Date(parameters.toDate)
    }

    const sales = await prisma.sale.findMany({
      where: whereClause,
      include: {
        customer: {
          select: { name: true, email: true, phone: true }
        },
        employee: {
          select: { name: true }
        },
        items: {
          include: {
            product: {
              select: { name: true, sku: true }
            }
          }
        }
      },
      orderBy: { createdAt: 'desc' }
    })

    return {
      totalRecords: sales.length,
      data: sales.map(sale => ({
        invoiceNumber: sale.invoiceNumber,
        customerName: sale.customer?.name || 'Walk-in',
        customerEmail: sale.customer?.email,
        customerPhone: sale.customer?.phone,
        employeeName: sale.employee?.name,
        subtotal: sale.subtotal,
        gst: sale.gst,
        discount: sale.discount,
        total: sale.total,
        paymentMethod: sale.paymentMethod,
        status: sale.status,
        itemsCount: sale.items.length,
        items: sale.items.map(item => ({
          productName: item.product.name,
          productSku: item.product.sku,
          quantity: item.quantity,
          price: item.price,
          subtotal: item.subtotal
        })),
        createdAt: sale.createdAt,
        updatedAt: sale.updatedAt
      }))
    }
  }

  // Bulk update products
  private static async bulkUpdateProducts(records: any[], parameters: Record<string, any>, storeId: string, userId: string) {
    const result = {
      totalRecords: records.length,
      successRecords: 0,
      failedRecords: 0,
      skippedRecords: 0,
      errors: [] as string[],
      updated: [] as any[]
    }

    for (const record of records) {
      try {
        const product = await prisma.product.findFirst({
          where: {
            storeId,
            OR: [
              record.id ? { id: record.id } : undefined,
              record.sku ? { sku: record.sku } : undefined,
              record.barcode ? { barcode: record.barcode } : undefined
            ].filter(Boolean) as any
          }
        })

        if (!product) {
          result.errors.push(`Product not found: ${record.sku || record.barcode || record.id}`)
          result.failedRecords++
          continue
        }

        const updateData: any = {}
        if (record.name) updateData.name = record.name
        if (record.description !== undefined) updateData.description = record.description
        if (record.price) updateData.price = parseFloat(record.price)
        if (record.cost !== undefined) updateData.cost = parseFloat(record.cost)
        if (record.stock !== undefined) updateData.stock = parseInt(record.stock)
        if (record.minStock !== undefined) updateData.minStock = parseInt(record.minStock)
        if (record.isActive !== undefined) updateData.isActive = record.isActive
        if (record.categoryId) updateData.categoryId = record.categoryId

        const updatedProduct = await prisma.product.update({
          where: { id: product.id },
          data: { ...updateData, updatedAt: new Date() }
        })

        result.updated.push(updatedProduct)
        result.successRecords++

      } catch (error) {
        result.errors.push(`Failed to update product: ${error instanceof Error ? error.message : 'Unknown error'}`)
        result.failedRecords++
      }
    }

    return result
  }

  // Bulk update customers
  private static async bulkUpdateCustomers(records: any[], parameters: Record<string, any>, storeId: string, userId: string) {
    const result = {
      totalRecords: records.length,
      successRecords: 0,
      failedRecords: 0,
      skippedRecords: 0,
      errors: [] as string[],
      updated: [] as any[]
    }

    for (const record of records) {
      try {
        const customer = await prisma.customer.findFirst({
          where: {
            storeId,
            OR: [
              record.id ? { id: record.id } : undefined,
              record.email ? { email: record.email } : undefined,
              record.phone ? { phone: record.phone } : undefined
            ].filter(Boolean) as any
          }
        })

        if (!customer) {
          result.errors.push(`Customer not found: ${record.email || record.phone || record.id}`)
          result.failedRecords++
          continue
        }

        const updateData: any = {}
        if (record.name) updateData.name = record.name
        if (record.email !== undefined) updateData.email = record.email
        if (record.phone !== undefined) updateData.phone = record.phone
        if (record.address !== undefined) updateData.address = record.address
        if (record.points !== undefined) updateData.points = parseInt(record.points)

        const updatedCustomer = await prisma.customer.update({
          where: { id: customer.id },
          data: { ...updateData, updatedAt: new Date() }
        })

        result.updated.push(updatedCustomer)
        result.successRecords++

      } catch (error) {
        result.errors.push(`Failed to update customer: ${error instanceof Error ? error.message : 'Unknown error'}`)
        result.failedRecords++
      }
    }

    return result
  }

  // Bulk update inventory
  private static async bulkUpdateInventory(records: any[], parameters: Record<string, any>, storeId: string, userId: string) {
    const result = {
      totalRecords: records.length,
      successRecords: 0,
      failedRecords: 0,
      skippedRecords: 0,
      errors: [] as string[],
      updated: [] as any[]
    }

    for (const record of records) {
      try {
        const product = await prisma.product.findFirst({
          where: {
            storeId,
            OR: [
              record.sku ? { sku: record.sku } : undefined,
              record.barcode ? { barcode: record.barcode } : undefined
            ].filter(Boolean) as any
          }
        })

        if (!product) {
          result.errors.push(`Product not found: ${record.sku || record.barcode}`)
          result.failedRecords++
          continue
        }

        const currentStock = product.stock
        let newStock = currentStock

        if (record.stock !== undefined) {
          newStock = parseInt(record.stock)
        } else if (record.adjustment !== undefined) {
          newStock = currentStock + parseInt(record.adjustment)
        }

        const updatedProduct = await prisma.product.update({
          where: { id: product.id },
          data: { stock: newStock }
        })

        // Log stock movement
        await prisma.stockLog.create({
          data: {
            productId: product.id,
            quantity: newStock - currentStock,
            type: 'adjustment',
            reason: `Bulk inventory update via batch operation`,
            employeeId: userId
          }
        })

        result.updated.push({
          ...updatedProduct,
          previousStock: currentStock,
          adjustment: newStock - currentStock
        })

        result.successRecords++

      } catch (error) {
        result.errors.push(`Failed to update inventory: ${error instanceof Error ? error.message : 'Unknown error'}`)
        result.failedRecords++
      }
    }

    return result
  }

  // Bulk update orders
  private static async bulkUpdateOrders(records: any[], parameters: Record<string, any>, storeId: string, userId: string) {
    const result = {
      totalRecords: records.length,
      successRecords: 0,
      failedRecords: 0,
      skippedRecords: 0,
      errors: [] as string[],
      updated: [] as any[]
    }

    for (const record of records) {
      try {
        const order = await prisma.heldOrder.findFirst({
          where: {
            storeId,
            OR: [
              record.id ? { id: record.id } : undefined,
              record.orderNumber ? { orderNumber: record.orderNumber } : undefined
            ].filter(Boolean) as any
          }
        })

        if (!order) {
          result.errors.push(`Order not found: ${record.orderNumber || record.id}`)
          result.failedRecords++
          continue
        }

        const updateData: any = {}
        if (record.status) updateData.status = record.status
        if (record.priority !== undefined) updateData.priority = parseInt(record.priority)
        if (record.customerId !== undefined) updateData.customerId = record.customerId
        if (record.employeeId !== undefined) updateData.employeeId = record.employeeId
        if (record.notes !== undefined) updateData.notes = record.notes

        const updatedOrder = await prisma.heldOrder.update({
          where: { id: order.id },
          data: { ...updateData, updatedAt: new Date() }
        })

        result.updated.push(updatedOrder)
        result.successRecords++

      } catch (error) {
        result.errors.push(`Failed to update order: ${error instanceof Error ? error.message : 'Unknown error'}`)
        result.failedRecords++
      }
    }

    return result
  }

  // Mass process orders
  private static async massProcessOrders(records: any[], parameters: Record<string, any>, storeId: string, userId: string) {
    const result = {
      totalRecords: records.length,
      successRecords: 0,
      failedRecords: 0,
      skippedRecords: 0,
      errors: [] as string[],
      processed: [] as any[]
    }

    const operation = parameters.operation

    for (const record of records) {
      try {
        const order = await prisma.heldOrder.findFirst({
          where: {
            storeId,
            OR: [
              record.id ? { id: record.id } : undefined,
              record.orderNumber ? { orderNumber: record.orderNumber } : undefined
            ].filter(Boolean) as any
          }
        })

        if (!order) {
          result.errors.push(`Order not found: ${record.orderNumber || record.id}`)
          result.failedRecords++
          continue
        }

        let processedOrder

        switch (operation) {
          case 'cancel':
            processedOrder = await prisma.heldOrder.update({
              where: { id: order.id },
              data: { status: 'cancelled', updatedAt: new Date() }
            })
            break
          case 'retrieve':
            processedOrder = await prisma.heldOrder.update({
              where: { id: order.id },
              data: { status: 'retrieved', retrievedAt: new Date(), updatedAt: new Date() }
            })
            break
          case 'complete':
            processedOrder = await prisma.heldOrder.update({
              where: { id: order.id },
              data: { status: 'completed', updatedAt: new Date() }
            })
            break
          default:
            throw new Error(`Unsupported mass processing operation: ${operation}`)
        }

        result.processed.push(processedOrder)
        result.successRecords++

      } catch (error) {
        result.errors.push(`Failed to process order: ${error instanceof Error ? error.message : 'Unknown error'}`)
        result.failedRecords++
      }
    }

    return result
  }

  // Mass process inventory
  private static async massProcessInventory(records: any[], parameters: Record<string, any>, storeId: string, userId: string) {
    const result = {
      totalRecords: records.length,
      successRecords: 0,
      failedRecords: 0,
      skippedRecords: 0,
      errors: [] as string[],
      processed: [] as any[]
    }

    const operation = parameters.operation

    for (const record of records) {
      try {
        const product = await prisma.product.findFirst({
          where: {
            storeId,
            OR: [
              record.sku ? { sku: record.sku } : undefined,
              record.barcode ? { barcode: record.barcode } : undefined
            ].filter(Boolean) as any
          }
        })

        if (!product) {
          result.errors.push(`Product not found: ${record.sku || record.barcode}`)
          result.failedRecords++
          continue
        }

        let processedProduct

        switch (operation) {
          case 'activate':
            processedProduct = await prisma.product.update({
              where: { id: product.id },
              data: { isActive: true, updatedAt: new Date() }
            })
            break
          case 'deactivate':
            processedProduct = await prisma.product.update({
              where: { id: product.id },
              data: { isActive: false, updatedAt: new Date() }
            })
            break
          case 'restock':
            const restockQuantity = parseInt(record.quantity || 0)
            const newStock = product.stock + restockQuantity
            processedProduct = await prisma.product.update({
              where: { id: product.id },
              data: { stock: newStock }
            })

            // Log stock movement
            await prisma.stockLog.create({
              data: {
                productId: product.id,
                quantity: restockQuantity,
                type: 'restock',
                reason: `Mass restock via batch operation`,
                employeeId: userId
              }
            })
            break
          default:
            throw new Error(`Unsupported mass processing operation: ${operation}`)
        }

        result.processed.push(processedProduct)
        result.successRecords++

      } catch (error) {
        result.errors.push(`Failed to process inventory: ${error instanceof Error ? error.message : 'Unknown error'}`)
        result.failedRecords++
      }
    }

    return result
  }

  // Mass process customers
  private static async massProcessCustomers(records: any[], parameters: Record<string, any>, storeId: string, userId: string) {
    const result = {
      totalRecords: records.length,
      successRecords: 0,
      failedRecords: 0,
      skippedRecords: 0,
      errors: [] as string[],
      processed: [] as any[]
    }

    const operation = parameters.operation

    for (const record of records) {
      try {
        const customer = await prisma.customer.findFirst({
          where: {
            storeId,
            OR: [
              record.id ? { id: record.id } : undefined,
              record.email ? { email: record.email } : undefined,
              record.phone ? { phone: record.phone } : undefined
            ].filter(Boolean) as any
          }
        })

        if (!customer) {
          result.errors.push(`Customer not found: ${record.email || record.phone || record.id}`)
          result.failedRecords++
          continue
        }

        let processedCustomer

        switch (operation) {
          case 'add_points':
            const pointsToAdd = parseInt(record.points || 0)
            const newPoints = customer.points + pointsToAdd
            processedCustomer = await prisma.customer.update({
              where: { id: customer.id },
              data: { points: newPoints }
            })
            break
          case 'reset_points':
            processedCustomer = await prisma.customer.update({
              where: { id: customer.id },
              data: { points: 0 }
            })
            break
          case 'update_loyalty_tier':
            processedCustomer = await prisma.customer.update({
              where: { id: customer.id },
              data: { 
                metadata: JSON.stringify({
                  ...(customer.metadata ? JSON.parse(customer.metadata) : {}),
                  loyaltyTier: record.tier
                })
              }
            })
            break
          default:
            throw new Error(`Unsupported mass processing operation: ${operation}`)
        }

        result.processed.push(processedCustomer)
        result.successRecords++

      } catch (error) {
        result.errors.push(`Failed to process customer: ${error instanceof Error ? error.message : 'Unknown error'}`)
        result.failedRecords++
      }
    }

    return result
  }

  // Validation methods
  private static validateProductData(record: any): ValidationResult {
    const errors: string[] = []
    const warnings: string[] = []

    if (!record.sku) {
      errors.push('SKU is required')
    }
    if (!record.name) {
      errors.push('Product name is required')
    }
    if (!record.price || isNaN(parseFloat(record.price))) {
      errors.push('Valid price is required')
    }
    if (!record.category) {
      errors.push('Category is required')
    }

    if (record.stock !== undefined && (isNaN(parseInt(record.stock)) || parseInt(record.stock) < 0)) {
      errors.push('Stock must be a non-negative number')
    }

    if (record.price && parseFloat(record.price) < 0) {
      errors.push('Price cannot be negative')
    }

    return {
      isValid: errors.length === 0,
      errors,
      warnings,
      processedData: [record]
    }
  }

  private static validateCustomerData(record: any): ValidationResult {
    const errors: string[] = []
    const warnings: string[] = []

    if (!record.name) {
      errors.push('Customer name is required')
    }
    if (!record.email && !record.phone) {
      errors.push('Either email or phone is required')
    }

    if (record.email && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(record.email)) {
      errors.push('Invalid email format')
    }

    if (record.points !== undefined && (isNaN(parseInt(record.points)) || parseInt(record.points) < 0)) {
      errors.push('Points must be a non-negative number')
    }

    return {
      isValid: errors.length === 0,
      errors,
      warnings,
      processedData: [record]
    }
  }

  // Helper method to log operation events
  private static async logOperationEvent(
    batchOperationId: string,
    eventType: string,
    eventDescription: string,
    userId?: string,
    userEmail?: string,
    userName?: string
  ) {
    try {
      const batchOperation = await prisma.batchOperation.findUnique({
        where: { operationId: batchOperationId }
      })

      if (batchOperation) {
        await prisma.batchOperationHistory.create({
          data: {
            batchOperationId: batchOperation.id,
            eventType,
            eventDescription,
            userId,
            userEmail,
            userName,
            newStatus: eventType === 'started' ? 'running' : eventType === 'completed' ? 'completed' : eventType === 'failed' ? 'failed' : undefined,
            details: JSON.stringify({
              timestamp: new Date(),
              operationId: batchOperationId
            })
          }
        })
      }
    } catch (error) {
      console.error('Failed to log operation event:', error)
    }
  }

  // Get operation progress
  static async getOperationProgress(operationId: string) {
    const batchOperation = await prisma.batchOperation.findUnique({
      where: { operationId },
      include: {
        progress: {
          orderBy: { createdAt: 'desc' },
          take: 1
        },
        records: {
          select: {
            status: true,
            validationStatus: true
          }
        },
        files: {
          select: {
            fileName: true,
            fileStatus: true,
            totalRows: true,
            processedRows: true,
            validRows: true,
            invalidRows: true
          }
        }
      }
    })

    if (!batchOperation) {
      throw new Error('Batch operation not found')
    }

    // Calculate real-time progress
    const totalRecords = batchOperation.totalRecords
    const processedRecords = batchOperation.processedRecords
    const progressPercentage = totalRecords > 0 ? (processedRecords / totalRecords) * 100 : 0

    // Get record status breakdown
    const recordStats = batchOperation.records.reduce((acc, record) => {
      acc[record.status] = (acc[record.status] || 0) + 1
      return acc
    }, {} as Record<string, number>)

    return {
      operation: {
        id: batchOperation.id,
        operationId: batchOperation.operationId,
        name: batchOperation.name,
        status: batchOperation.status,
        progressPercentage: Math.round(progressPercentage * 100) / 100,
        totalRecords,
        processedRecords,
        successRecords: batchOperation.successRecords,
        failedRecords: batchOperation.failedRecords,
        skippedRecords: batchOperation.skippedRecords,
        startedAt: batchOperation.startedAt,
        completedAt: batchOperation.completedAt,
        estimatedDuration: batchOperation.estimatedDuration,
        actualDuration: batchOperation.actualDuration
      },
      currentPhase: batchOperation.progress[0] || null,
      recordStats,
      files: batchOperation.files
    }
  }

  // Resume paused operation
  static async resumeOperation(operationId: string, userId: string) {
    const batchOperation = await prisma.batchOperation.findUnique({
      where: { operationId }
    })

    if (!batchOperation) {
      throw new Error('Batch operation not found')
    }

    if (batchOperation.status !== 'paused') {
      throw new Error('Can only resume paused operations')
    }

    if (!batchOperation.canResume) {
      throw new Error('This operation cannot be resumed')
    }

    // Update operation status
    await prisma.batchOperation.update({
      where: { operationId },
      data: {
        status: 'running',
        pausedAt: null,
        updatedAt: new Date()
      }
    })

    // Log the resume event
    await this.logOperationEvent(operationId, 'resumed', 'Batch operation resumed by user', userId)

    return { success: true, message: 'Operation resumed successfully' }
  }

  // Cancel operation
  static async cancelOperation(operationId: string, userId: string, userName?: string, userEmail?: string) {
    const batchOperation = await prisma.batchOperation.findUnique({
      where: { operationId }
    })

    if (!batchOperation) {
      throw new Error('Batch operation not found')
    }

    if (['completed', 'failed', 'cancelled'].includes(batchOperation.status)) {
      throw new Error('Cannot cancel completed, failed, or already cancelled operations')
    }

    // Update operation status
    await prisma.batchOperation.update({
      where: { operationId },
      data: {
        status: 'cancelled',
        completedAt: new Date(),
        updatedAt: new Date()
      }
    })

    // Log the cancel event
    await this.logOperationEvent(operationId, 'cancelled', 'Batch operation cancelled by user', userId, userEmail, userName)

    return { success: true, message: 'Operation cancelled successfully' }
  }
}