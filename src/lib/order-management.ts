// Order Management Business Logic Utilities
// This module contains advanced business logic for the Open/Hold Orders System with comprehensive enhancements

import { OrderOrchestrator, OrderOperations, OrderOperationContext, OrchestrationResult } from './order-orchestrator'
import { OrderState, OrderStateMachine } from './order-state-machine'
import { LockType } from './order-collaboration-manager'
import { JobPriority } from './order-performance-optimizer'

export interface OrderManagementConfig {
  autoSaveInterval: number // milliseconds
  maxHoldDuration: number // minutes
  warningThresholds: number[] // minutes before expiry
  enableMultiUserSupport: boolean
  enableManagerApproval: boolean
  bulkOperationsLimit: number
  enableStateMachine: boolean
  enableValidation: boolean
  enableCollaboration: boolean
  enablePerformanceOptimization: boolean
  enableAuditLogging: boolean
  enableAutomaticCleanup: boolean
}

export interface OrderOperationResult {
  success: boolean
  message: string
  data?: any
  warnings?: string[]
  errors?: string[]
  validationReport?: any
  stateTransition?: { from: OrderState; to: OrderState }
  collaborationData?: any
  performanceMetrics?: {
    duration: number
    memoryUsage: number
    cached: boolean
  }
  errorId?: string
  timestamp: Date
}

export interface BulkOperation {
  type: 'cancel' | 'retrieve' | 'merge' | 'export' | 'edit' | 'complete'
  orderIds: string[]
  parameters?: Record<string, any>
  enableParallelProcessing?: boolean
  batchSize?: number
  skipValidationForSubsequent?: boolean
}

export interface BulkOperationResult {
  success: boolean
  message: string
  data?: {
    successful: any[]
    failed: { orderId: string; error: string }[]
    totalProcessed: number
    successCount: number
    failureCount: number
  }
  warnings?: string[]
  errors?: string[]
  performanceMetrics?: {
    totalDuration: number
    averageDuration: number
    throughput: number
  }
}

// Default configuration
export const DEFAULT_ORDER_CONFIG: OrderManagementConfig = {
  autoSaveInterval: 30000, // 30 seconds
  maxHoldDuration: 240, // 4 hours
  warningThresholds: [15, 30, 60], // 15min, 30min, 1hr warnings
  enableMultiUserSupport: true,
  enableManagerApproval: false,
  bulkOperationsLimit: 50,
  enableStateMachine: true,
  enableValidation: true,
  enableCollaboration: true,
  enablePerformanceOptimization: true,
  enableAuditLogging: true,
  enableAutomaticCleanup: true
}

// Order status management
export class OrderStatusManager {
  static isOrderExpired(order: any, config: OrderManagementConfig = DEFAULT_ORDER_CONFIG): boolean {
    if (!order.createdAt || !order.holdDuration) return false
    
    const createdTime = new Date(order.createdAt).getTime()
    const maxDuration = order.holdDuration || config.maxHoldDuration
    const expiryTime = createdTime + (maxDuration * 60 * 1000)
    const currentTime = Date.now()
    
    return currentTime > expiryTime
  }

  static getOrderAgeInMinutes(order: any): number {
    if (!order.createdAt) return 0
    
    const createdTime = new Date(order.createdAt).getTime()
    const currentTime = Date.now()
    return Math.floor((currentTime - createdTime) / (1000 * 60))
  }

  static getOrderStatus(order: any, config: OrderManagementConfig = DEFAULT_ORDER_CONFIG): {
    status: string
    isExpired: boolean
    ageInMinutes: number
    warnings: string[]
    priority: number
  } {
    const ageInMinutes = this.getOrderAgeInMinutes(order)
    const isExpired = this.isOrderExpired(order, config)
    const warnings: string[] = []
    let priority = 0

    // Check for warnings based on thresholds
    config.warningThresholds.forEach(threshold => {
      if (ageInMinutes >= threshold && ageInMinutes < (threshold + 5)) {
        warnings.push(`Order is ${threshold} minutes old`)
        priority += 1
      }
    })

    // Check for expiry
    if (isExpired) {
      warnings.push('Order has expired')
      priority += 5
    }

    // Determine status
    let status = order.status
    if (isExpired && status === 'held') {
      status = 'expired'
    }

    return {
      status,
      isExpired,
      ageInMinutes,
      warnings,
      priority: Math.max(priority, order.priority || 0)
    }
  }

  static shouldAutoSave(order: any, config: OrderManagementConfig = DEFAULT_ORDER_CONFIG): boolean {
    const ageInMinutes = this.getOrderAgeInMinutes(order)
    const interval = config.autoSaveInterval / (1000 * 60) // Convert to minutes
    
    return ageInMinutes > 0 && ageInMinutes % Math.floor(interval) === 0 && !order.isAutoSaved
  }
}

// Order validation and business rules
export class OrderValidator {
  static validateOrderForHold(orderData: any): OrderOperationResult {
    const errors: string[] = []
    const warnings: string[] = []

    // Required fields validation
    if (!orderData.items || !Array.isArray(orderData.items) || orderData.items.length === 0) {
      errors.push('Order must contain at least one item')
    }

    if (!orderData.total || orderData.total <= 0) {
      errors.push('Order must have a valid total amount')
    }

    if (!orderData.storeId) {
      errors.push('Store ID is required')
    }

    // Business rules validation
    if (orderData.items && orderData.items.length > 100) {
      warnings.push('Large order with more than 100 items')
    }

    if (orderData.total > 100000) {
      warnings.push('High value order - consider additional verification')
    }

    if (orderData.tableNumber && !/^[A-Z0-9]+$/i.test(orderData.tableNumber)) {
      warnings.push('Table number format may be invalid')
    }

    return {
      success: errors.length === 0,
      message: errors.length === 0 ? 'Order validation passed' : 'Order validation failed',
      errors: errors.length > 0 ? errors : undefined,
      warnings: warnings.length > 0 ? warnings : undefined
    }
  }

  static validateOrderForRetrieve(order: any): OrderOperationResult {
    const errors: string[] = []

    if (!order) {
      errors.push('Order not found')
    }

    if (order.status !== 'held') {
      errors.push('Order is not in held status')
    }

    if (this.isOrderExpired(order)) {
      errors.push('Order has expired and cannot be retrieved')
    }

    return {
      success: errors.length === 0,
      message: errors.length === 0 ? 'Order can be retrieved' : 'Order cannot be retrieved',
      errors: errors.length > 0 ? errors : undefined
    }
  }
}

// Multi-user and collaboration features
export class MultiUserManager {
  static async checkOrderConflicts(orderId: string, userId: string): Promise<OrderOperationResult> {
    try {
      // This would typically check a real-time collaboration system
      // For now, we'll simulate the check
      const conflicts = await this.getOrderConflicts(orderId)
      
      if (conflicts.length > 0) {
        return {
          success: false,
          message: 'Order is being modified by other users',
          warnings: [`Currently being edited by: ${conflicts.join(', ')}`]
        }
      }

      return {
        success: true,
        message: 'No conflicts detected'
      }
    } catch (error) {
      return {
        success: false,
        message: 'Error checking for conflicts',
        errors: [error instanceof Error ? error.message : 'Unknown error']
      }
    }
  }

  private static async getOrderConflicts(orderId: string): Promise<string[]> {
    // This would integrate with WebSocket or real-time system
    // For now, return empty array
    return []
  }

  static async acquireOrderLock(orderId: string, userId: string): Promise<boolean> {
    try {
      // This would implement a distributed locking mechanism
      // For now, simulate success
      return true
    } catch (error) {
      console.error('Failed to acquire order lock:', error)
      return false
    }
  }

  static releaseOrderLock(orderId: string, userId: string): Promise<void> {
    // Release the lock
    return Promise.resolve()
  }
}

// Enhanced Bulk Operations Manager with Orchestrator Integration
export class BulkOperationsManager {
  static async performBulkOperation(
    operation: BulkOperation,
    contexts: Array<{ orderId: string; userId: string; userName: string; storeId: string }>,
    config: OrderManagementConfig = DEFAULT_ORDER_CONFIG
  ): Promise<BulkOperationResult> {
    const startTime = Date.now()
    
    // Validate operation
    if (operation.orderIds.length > config.bulkOperationsLimit) {
      return {
        success: false,
        message: `Bulk operation limit exceeded. Maximum: ${config.bulkOperationsLimit}`,
        errors: [`Operation limit exceeded: ${operation.orderIds.length} > ${config.bulkOperationsLimit}`]
      }
    }

    if (contexts.length !== operation.orderIds.length) {
      return {
        success: false,
        message: 'Contexts and order IDs count mismatch',
        errors: ['Contexts and order IDs must have the same count']
      }
    }

    try {
      // Create operation contexts for all orders
      const operationContexts: OrderOperationContext[] = contexts.map((context, index) => ({
        orderId: operation.orderIds[index],
        userId: context.userId,
        userName: context.userName,
        storeId: context.storeId,
        operation: this.getOperationType(operation.type),
        timestamp: new Date()
      }))

      // Get order data (this would come from the actual data source)
      const orderDataArray = operation.orderIds.map(orderId => ({ orderId }))

      // Execute bulk operation through orchestrator
      const orchestratorResult = await OrderOrchestrator.executeBulkOperation(
        this.getOperationType(operation.type),
        operationContexts,
        orderDataArray,
        {
          batchSize: operation.batchSize || 10,
          enableParallelProcessing: operation.enableParallelProcessing !== false,
          skipValidationForSubsequent: operation.skipValidationForSubsequent,
          lockType: this.getLockTypeForOperation(operation.type)
        }
      )

      // Process results
      const successfulResults: any[] = []
      const failedResults: { orderId: string; error: string }[] = []

      if (orchestratorResult.success && orchestratorResult.data) {
        orchestratorResult.data.forEach((result, index) => {
          if (result) {
            successfulResults.push({
              orderId: operation.orderIds[index],
              result
            })
          } else {
            failedResults.push({
              orderId: operation.orderIds[index],
              error: 'Operation failed'
            })
          }
        })
      }

      if (orchestratorResult.errors) {
        orchestratorResult.errors.forEach((error, index) => {
          failedResults.push({
            orderId: operation.orderIds[index] || `unknown-${index}`,
            error
          })
        })
      }

      const totalDuration = Date.now() - startTime
      const throughput = successfulResults.length / (totalDuration / 1000) // operations per second

      return {
        success: failedResults.length === 0,
        message: failedResults.length === 0 
          ? 'Bulk operation completed successfully'
          : `Bulk operation completed with ${failedResults.length} failures`,
        data: {
          successful: successfulResults,
          failed: failedResults,
          totalProcessed: operation.orderIds.length,
          successCount: successfulResults.length,
          failureCount: failedResults.length
        },
        warnings: orchestratorResult.warnings,
        errors: failedResults.map(f => f.error),
        performanceMetrics: {
          totalDuration,
          averageDuration: totalDuration / operation.orderIds.length,
          throughput
        }
      }

    } catch (error) {
      return {
        success: false,
        message: 'Bulk operation failed due to system error',
        errors: [error instanceof Error ? error.message : 'Unknown error occurred']
      }
    }
  }

  private static getOperationType(operation: string): string {
    const operationMap: Record<string, string> = {
      'cancel': 'cancel_order',
      'retrieve': 'retrieve_order',
      'merge': 'merge_orders',
      'export': 'export_order',
      'edit': 'edit_order',
      'complete': 'complete_order'
    }
    return operationMap[operation] || operation
  }

  private static getLockTypeForOperation(operation: string): LockType {
    const lockTypeMap: Record<string, LockType> = {
      'cancel': LockType.FULL,
      'retrieve': LockType.READ,
      'merge': LockType.FULL,
      'export': LockType.READ,
      'edit': LockType.FULL,
      'complete': LockType.PAYMENT
    }
    return lockTypeMap[operation] || LockType.FULL
  }

  // Legacy methods for backward compatibility
  static async processOrderOperation(
    orderId: string, 
    operation: BulkOperation, 
    config: OrderManagementConfig
  ): Promise<OrderOperationResult> {
    // This method is kept for backward compatibility
    // In new code, use the orchestrator directly
    
    const context: OrderOperationContext = {
      orderId,
      userId: 'system',
      userName: 'System',
      storeId: 'default',
      operation: this.getOperationType(operation.type),
      timestamp: new Date()
    }

    const orchestratorResult = await OrderOrchestrator.executeOperation(
      this.getOperationType(operation.type),
      context,
      { orderId, parameters: operation.parameters }
    )

    return {
      success: orchestratorResult.success,
      message: orchestratorResult.success ? 'Operation completed successfully' : 'Operation failed',
      data: orchestratorResult.data,
      warnings: orchestratorResult.warnings,
      errors: orchestratorResult.errors,
      validationReport: orchestratorResult.validationReport,
      stateTransition: orchestratorResult.stateTransition,
      collaborationData: orchestratorResult.collaborationData,
      performanceMetrics: orchestratorResult.performanceMetrics,
      errorId: orchestratorResult.errorId,
      timestamp: orchestratorResult.timestamp
    }
  }

  // Individual operation methods (enhanced)
  static async cancelOrder(orderId: string, context: { userId: string; userName: string; storeId: string }): Promise<OrderOperationResult> {
    const operationContext: OrderOperationContext = {
      orderId,
      userId: context.userId,
      userName: context.userName,
      storeId: context.storeId,
      operation: 'cancel_order',
      timestamp: new Date()
    }

    const result = await OrderOperations.cancelOrder(operationContext, { orderId })
    return this.convertOrchestrationResult(result)
  }

  static async retrieveOrder(orderId: string, context: { userId: string; userName: string; storeId: string }): Promise<OrderOperationResult> {
    const operationContext: OrderOperationContext = {
      orderId,
      userId: context.userId,
      userName: context.userName,
      storeId: context.storeId,
      operation: 'retrieve_order',
      timestamp: new Date()
    }

    // Use the orchestrator for retrieve operation
    const result = await OrderOrchestrator.executeOperation('retrieve_order', operationContext, { orderId })
    return this.convertOrchestrationResult(result)
  }

  static async mergeOrders(sourceOrderId: string, targetOrderId: string, context: { userId: string; userName: string; storeId: string }): Promise<OrderOperationResult> {
    const operationContext: OrderOperationContext = {
      orderId: sourceOrderId,
      userId: context.userId,
      userName: context.userName,
      storeId: context.storeId,
      operation: 'merge_orders',
      metadata: { targetOrderId },
      timestamp: new Date()
    }

    // Use the orchestrator for merge operation
    const result = await OrderOrchestrator.executeOperation('merge_orders', operationContext, { 
      sourceOrderId, 
      targetOrderId 
    })
    return this.convertOrchestrationResult(result)
  }

  static async exportOrder(orderId: string, context: { userId: string; userName: string; storeId: string }): Promise<OrderOperationResult> {
    const operationContext: OrderOperationContext = {
      orderId,
      userId: context.userId,
      userName: context.userName,
      storeId: context.storeId,
      operation: 'export_order',
      timestamp: new Date()
    }

    // Export is typically a read operation
    const result = await OrderOrchestrator.executeOperation('export_order', operationContext, { orderId })
    return this.convertOrchestrationResult(result)
  }

  // Utility method to convert orchestrator results
  private static convertOrchestrationResult(result: OrchestrationResult): OrderOperationResult {
    return {
      success: result.success,
      message: result.success ? 'Operation completed successfully' : 'Operation failed',
      data: result.data,
      warnings: result.warnings,
      errors: result.errors,
      validationReport: result.validationReport,
      stateTransition: result.stateTransition,
      collaborationData: result.collaborationData,
      performanceMetrics: result.performanceMetrics,
      errorId: result.errorId,
      timestamp: result.timestamp
    }
  }
}

// Auto-save functionality
export class AutoSaveManager {
  private static autoSaveIntervals: Map<string, NodeJS.Timeout> = new Map()

  static enableAutoSave(orderId: string, config: OrderManagementConfig = DEFAULT_ORDER_CONFIG): void {
    // Clear existing interval if any
    this.disableAutoSave(orderId)

    const interval = setInterval(async () => {
      try {
        await this.performAutoSave(orderId)
      } catch (error) {
        console.error('Auto-save failed for order:', orderId, error)
      }
    }, config.autoSaveInterval)

    this.autoSaveIntervals.set(orderId, interval)
  }

  static disableAutoSave(orderId: string): void {
    const interval = this.autoSaveIntervals.get(orderId)
    if (interval) {
      clearInterval(interval)
      this.autoSaveIntervals.delete(orderId)
    }
  }

  private static async performAutoSave(orderId: string): Promise<void> {
    // Implement auto-save logic here
    // This would typically save the current state of the order
    console.log('Auto-saving order:', orderId)
  }

  static cleanup(): void {
    // Clear all intervals when shutting down
    this.autoSaveIntervals.forEach((interval) => clearInterval(interval))
    this.autoSaveIntervals.clear()
  }
}

// Order analytics and reporting
export class OrderAnalytics {
  static calculateOrderMetrics(orders: any[]): {
    totalOrders: number
    activeOrders: number
    expiredOrders: number
    averageAge: number
    totalValue: number
    peakHours: number[]
    popularItems: Array<{ item: string; count: number }>
  } {
    const now = Date.now()
    const activeOrders = orders.filter(o => o.status === 'held')
    const expiredOrders = orders.filter(o => o.status === 'expired')
    
    const totalValue = orders.reduce((sum, order) => sum + (order.total || 0), 0)
    const averageAge = orders.length > 0 
      ? orders.reduce((sum, order) => sum + this.getOrderAgeInMinutes(order), 0) / orders.length 
      : 0

    // Calculate peak hours
    const hourCounts = new Array(24).fill(0)
    orders.forEach(order => {
      if (order.createdAt) {
        const hour = new Date(order.createdAt).getHours()
        hourCounts[hour]++
      }
    })

    const peakHours = hourCounts
      .map((count, hour) => ({ hour, count }))
      .sort((a, b) => b.count - a.count)
      .slice(0, 3)
      .map(item => item.hour)

    return {
      totalOrders: orders.length,
      activeOrders: activeOrders.length,
      expiredOrders: expiredOrders.length,
      averageAge: Math.round(averageAge),
      totalValue,
      peakHours,
      popularItems: [] // Would need item data to calculate this
    }
  }

  static generateOrderReport(orders: any[]): string {
    const metrics = this.calculateOrderMetrics(orders)
    const reportDate = new Date().toLocaleDateString()
    
    return `
ORDER MANAGEMENT REPORT
Generated: ${reportDate}

SUMMARY:
- Total Orders: ${metrics.totalOrders}
- Active Orders: ${metrics.activeOrders}
- Expired Orders: ${metrics.expiredOrders}
- Average Age: ${metrics.averageAge} minutes
- Total Value: ₹${metrics.totalValue.toFixed(2)}

PEAK HOURS:
${metrics.peakHours.map(hour => `- ${hour}:00`).join('\n')}

STATUS BREAKDOWN:
${this.getStatusBreakdown(orders)}
    `.trim()
  }

  private static getStatusBreakdown(orders: any[]): string {
    const statusCounts = orders.reduce((acc, order) => {
      acc[order.status] = (acc[order.status] || 0) + 1
      return acc
    }, {} as Record<string, number>)

    return Object.entries(statusCounts)
      .map(([status, count]) => `- ${status}: ${count}`)
      .join('\n')
  }
}