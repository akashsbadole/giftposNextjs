// Order Management Orchestrator - Enhanced Integration Layer
// Comprehensive system that combines state machine, validation, collaboration, and performance optimization

import { OrderStateMachine, OrderState, TransitionContext, StateValidationResult } from './order-state-machine'
import { OrderDataValidator, ValidationContext, ValidationReport } from './order-data-validation'
import { 
  CollaborationManager, 
  CollaborationRole, 
  LockType, 
  LockScope,
  ConflictResolution 
} from './order-collaboration-manager'
import { 
  OrderPerformanceOptimizer, 
  JobPriority,
  OrderBackgroundJobs 
} from './order-performance-optimizer'
import { 
  OrderErrorHandler, 
  OrderErrorRecovery, 
  OrderLoadingState, 
  OrderErrorNotifications,
  OrderErrorType 
} from './order-management-errors'
import { OrderStatusManager, OrderOperationResult } from './order-management'

export interface OrderOrchestrationConfig {
  enableStateMachine: boolean
  enableValidation: boolean
  enableCollaboration: boolean
  enablePerformanceOptimization: boolean
  enableErrorHandling: boolean
  enableAuditLogging: boolean
  enableAutomaticCleanup: boolean
  enableBulkOperations: boolean
  maxRetries: number
  timeoutMs: number
}

export interface OrderOperationContext {
  orderId: string
  userId: string
  userName: string
  userEmail?: string
  storeId: string
  sessionId?: string
  operation: string
  metadata?: Record<string, any>
  timestamp: Date
}

export interface OrchestrationResult<T = any> {
  success: boolean
  data?: T
  errors?: string[]
  warnings?: string[]
  validationReport?: ValidationReport
  stateTransition?: { from: OrderState; to: OrderState }
  collaborationData?: {
    sessionId?: string
    locks?: string[]
    conflicts?: any[]
    resolvedConflicts?: boolean
  }
  performanceMetrics?: {
    duration: number
    memoryUsage: number
    cached: boolean
  }
  errorId?: string
  timestamp: Date
}

export class OrderOrchestrator {
  private static config: OrderOrchestrationConfig = {
    enableStateMachine: true,
    enableValidation: true,
    enableCollaboration: true,
    enablePerformanceOptimization: true,
    enableErrorHandling: true,
    enableAuditLogging: true,
    enableAutomaticCleanup: true,
    enableBulkOperations: true,
    maxRetries: 3,
    timeoutMs: 30000
  }

  static configure(config: Partial<OrderOrchestrationConfig>): void {
    this.config = { ...this.config, ...config }
  }

  // Main orchestration method for order operations
  static async executeOperation<T = any>(
    operation: string,
    context: OrderOperationContext,
    data: any,
    options: {
      skipValidation?: boolean
      skipCollaboration?: boolean
      skipPerformanceOptimization?: boolean
      forceStateTransition?: { from: OrderState; to: OrderState }
      lockType?: LockType
      priority?: JobPriority
    } = {}
  ): Promise<OrchestrationResult<T>> {
    const startTime = Date.now()
    const startMemory = this.getMemoryUsage()

    try {
      // Set up loading state
      OrderLoadingState.setLoading(context.orderId, true, {
        operation,
        message: `Processing ${operation}...`
      })

      // Phase 1: Validation
      let validationReport: ValidationReport | undefined
      if (!options.skipValidation && this.config.enableValidation) {
        validationReport = await this.validateOperation(operation, context, data)
        if (!this.isValidationPassed(validationReport)) {
          return this.createValidationFailureResult(validationReport, startTime, startMemory)
        }
      }

      // Phase 2: State Management
      let stateTransition: { from: OrderState; to: OrderState } | undefined
      if (this.config.enableStateMachine) {
        stateTransition = await this.handleStateTransition(operation, context, data, options.forceStateTransition)
        if (!stateTransition) {
          return this.createStateTransitionFailureResult(operation, context, startTime, startMemory)
        }
      }

      // Phase 3: Collaboration Setup
      let collaborationData: any
      if (!options.skipCollaboration && this.config.enableCollaboration) {
        collaborationData = await this.setupCollaboration(operation, context, data, options.lockType)
        if (collaborationData.error) {
          return this.createCollaborationFailureResult(collaborationData.error, startTime, startMemory)
        }
      }

      // Phase 4: Performance Optimization
      let performanceData: any
      if (!options.skipPerformanceOptimization && this.config.enablePerformanceOptimization) {
        performanceData = await this.optimizePerformance(operation, context, data, options.priority)
      }

      // Phase 5: Core Operation Execution
      const operationResult = await this.executeCoreOperation<T>(operation, context, data, {
        validationReport,
        stateTransition,
        collaborationData,
        performanceData
      })

      // Phase 6: Post-Operation Processing
      await this.handlePostOperation(operation, context, data, operationResult)

      // Record performance metrics
      this.recordPerformanceMetrics(operation, context, Date.now() - startTime, this.getMemoryUsage() - startMemory)

      return {
        success: true,
        data: operationResult,
        validationReport,
        stateTransition,
        collaborationData,
        performanceMetrics: {
          duration: Date.now() - startTime,
          memoryUsage: this.getMemoryUsage() - startMemory,
          cached: performanceData?.cached || false
        },
        timestamp: new Date()
      }

    } catch (error) {
      return this.handleOperationError(operation, context, error, startTime, startMemory)
    } finally {
      OrderLoadingState.setLoading(context.orderId, false)
    }
  }

  // Bulk Operations Orchestration
  static async executeBulkOperation<T = any>(
    operation: string,
    contexts: OrderOperationContext[],
    dataArray: any[],
    options: {
      batchSize?: number
      enableParallelProcessing?: boolean
      skipValidationForSubsequent?: boolean
      lockType?: LockType
    } = {}
  ): Promise<OrchestrationResult<T[]>> {
    const batchSize = options.batchSize || 10
    const enableParallel = options.enableParallelProcessing !== false
    const results: T[] = []
    const errors: string[] = []
    const warnings: string[] = []

    try {
      // Phase 1: Bulk Validation
      const bulkValidation = await this.validateBulkOperation(operation, contexts, dataArray)
      if (!bulkValidation.success) {
        return {
          success: false,
          errors: bulkValidation.errors,
          timestamp: new Date()
        }
      }

      // Phase 2: Process in batches
      const batches = this.createBatches(contexts, dataArray, batchSize)

      for (let i = 0; i < batches.length; i++) {
        const batch = batches[i]
        
        if (enableParallel) {
          // Process batch in parallel
          const batchPromises = batch.map(async (item, index) => {
            try {
              const result = await this.executeOperation<T>(
                operation,
                item.context,
                item.data,
                {
                  skipValidation: options.skipValidationForSubsequent && i > 0,
                  lockType: options.lockType
                }
              )
              return { success: result.success, data: result.data, error: result.errors?.[0] }
            } catch (error) {
              return { 
                success: false, 
                data: null, 
                error: error instanceof Error ? error.message : 'Unknown error' 
              }
            }
          })

          const batchResults = await Promise.all(batchPromises)
          
          // Collect results
          batchResults.forEach(result => {
            if (result.success) {
              results.push(result.data as T)
            } else if (result.error) {
              errors.push(result.error)
            }
          })

        } else {
          // Process batch sequentially
          for (const item of batch) {
            try {
              const result = await this.executeOperation<T>(
                operation,
                item.context,
                item.data,
                {
                  skipValidation: options.skipValidationForSubsequent && i > 0,
                  lockType: options.lockType
                }
              )
              
              if (result.success) {
                results.push(result.data as T)
              } else if (result.errors) {
                errors.push(...result.errors)
              }
              
              if (result.warnings) {
                warnings.push(...result.warnings)
              }
            } catch (error) {
              errors.push(error instanceof Error ? error.message : 'Unknown error')
            }
          }
        }

        // Add delay between batches to prevent overwhelming the system
        if (i < batches.length - 1) {
          await new Promise(resolve => setTimeout(resolve, 100))
        }
      }

      // Schedule background jobs for cleanup if needed
      if (this.config.enableAutomaticCleanup) {
        await this.scheduleBulkCleanup(contexts, results.length, errors.length)
      }

      return {
        success: errors.length === 0,
        data: results,
        errors: errors.length > 0 ? errors : undefined,
        warnings: warnings.length > 0 ? warnings : undefined,
        timestamp: new Date()
      }

    } catch (error) {
      return {
        success: false,
        errors: [error instanceof Error ? error.message : 'Bulk operation failed'],
        timestamp: new Date()
      }
    }
  }

  // Validation Phase
  private static async validateOperation(
    operation: string,
    context: OrderOperationContext,
    data: any
  ): Promise<ValidationReport> {
    const validationContext: ValidationContext = {
      userId: context.userId,
      storeId: context.storeId,
      orderId: context.orderId,
      operation,
      metadata: context.metadata,
      timestamp: context.timestamp
    }

    // Add current state if order exists
    if (context.metadata?.currentState) {
      validationContext.currentState = context.metadata.currentState
    }

    return await OrderDataValidator.validate(data, validationContext)
  }

  private static isValidationPassed(report: ValidationReport): boolean {
    return report.isValid && report.overallSeverity !== 'error' && report.overallSeverity !== 'critical'
  }

  // State Management Phase
  private static async handleStateTransition(
    operation: string,
    context: OrderOperationContext,
    data: any,
    forcedTransition?: { from: OrderState; to: OrderState }
  ): Promise<{ from: OrderState; to: OrderState } | null> {
    // Determine state transition based on operation
    const transitionMap: Record<string, { from: OrderState; to: OrderState; trigger: string }> = {
      'create_order': { from: OrderState.NEW, to: OrderState.HELD, trigger: 'hold' },
      'retrieve_order': { from: OrderState.HELD, to: OrderState.RECALLED, trigger: 'retrieve' },
      'edit_order': { from: OrderState.RECALLED, to: OrderState.EDITING, trigger: 'start_edit' },
      'validate_order': { from: OrderState.EDITING, to: OrderState.VALIDATING, trigger: 'validate' },
      'complete_order': { from: OrderState.PROCESSING, to: OrderState.COMPLETED, trigger: 'complete' },
      'cancel_order': { from: OrderState.RECALLED, to: OrderState.CANCELLED, trigger: 'cancel' },
      'merge_orders': { from: OrderState.HELD, to: OrderState.MERGED, trigger: 'merge' }
    }

    const transition = forcedTransition || transitionMap[operation]
    if (!transition) {
      return null
    }

    const transitionContext: TransitionContext = {
      orderId: context.orderId,
      currentState: transition.from,
      targetState: transition.to,
      userId: context.userId,
      storeId: context.storeId,
      metadata: context.metadata,
      timestamp: context.timestamp
    }

    const result = await OrderStateMachine.transition(
      context.orderId,
      transition.from,
      transition.to,
      transition.trigger,
      {
        userId: context.userId,
        storeId: context.storeId,
        metadata: context.metadata
      }
    )

    if (!result.success) {
      console.error('State transition failed:', result.error)
      return null
    }

    return { from: transition.from, to: transition.to }
  }

  // Collaboration Phase
  private static async setupCollaboration(
    operation: string,
    context: OrderOperationContext,
    data: any,
    lockType?: LockType
  ): Promise<any> {
    // Create collaboration session
    const sessionResult = await CollaborationManager.createSession(
      context.orderId,
      context.userId,
      context.userName,
      context.userEmail
    )

    if (!sessionResult.success) {
      return { error: sessionResult.error }
    }

    // Acquire locks if needed for editing operations
    const editOperations = ['edit_order', 'validate_order', 'complete_order']
    if (editOperations.includes(operation)) {
      const lockResult = await CollaborationManager.acquireLock(
        context.orderId,
        context.userId,
        lockType || LockType.FULL,
        LockScope.EXCLUSIVE,
        `User ${context.userName} is ${operation.replace('_', ' ')}`
      )

      if (!lockResult.success) {
        // End session if lock acquisition fails
        await CollaborationManager.endSession(sessionResult.sessionId!)
        return { error: lockResult.error }
      }

      return {
        sessionId: sessionResult.sessionId,
        locks: [lockResult.lockId]
      }
    }

    return {
      sessionId: sessionResult.sessionId
    }
  }

  // Performance Optimization Phase
  private static async optimizePerformance(
    operation: string,
    context: OrderOperationContext,
    data: any,
    priority?: JobPriority
  ): Promise<any> {
    const cacheKey = this.generateCacheKey(operation, context, data)
    
    // Try to get from cache first
    const cached = await OrderPerformanceOptimizer.get(cacheKey)
    if (cached) {
      return { cached: true, data: cached }
    }

    // Schedule background jobs for heavy operations
    const heavyOperations = ['bulk_process', 'analytics_update', 'data_sync']
    if (heavyOperations.includes(operation)) {
      await OrderBackgroundJobs.scheduleAnalyticsUpdate(
        context.storeId,
        { start: new Date(), end: new Date() }
      )
    }

    return { cached: false }
  }

  // Core Operation Execution
  private static async executeCoreOperation<T>(
    operation: string,
    context: OrderOperationContext,
    data: any,
    phaseData: any
  ): Promise<T> {
    // This would integrate with actual business logic
    // For now, we'll simulate the operation
    
    switch (operation) {
      case 'create_order':
        return this.createOrder(data, context) as T
      case 'edit_order':
        return this.editOrder(data, context) as T
      case 'complete_order':
        return this.completeOrder(data, context) as T
      case 'cancel_order':
        return this.cancelOrder(data, context) as T
      default:
        throw new Error(`Unknown operation: ${operation}`)
    }
  }

  private static async createOrder(data: any, context: OrderOperationContext): Promise<any> {
    // Simulate order creation
    return {
      orderId: context.orderId,
      status: 'created',
      timestamp: new Date()
    }
  }

  private static async editOrder(data: any, context: OrderOperationContext): Promise<any> {
    // Simulate order editing
    return {
      orderId: context.orderId,
      changes: data,
      timestamp: new Date()
    }
  }

  private static async completeOrder(data: any, context: OrderOperationContext): Promise<any> {
    // Simulate order completion
    return {
      orderId: context.orderId,
      status: 'completed',
      timestamp: new Date()
    }
  }

  private static async cancelOrder(data: any, context: OrderOperationContext): Promise<any> {
    // Simulate order cancellation
    return {
      orderId: context.orderId,
      status: 'cancelled',
      timestamp: new Date()
    }
  }

  // Post-Operation Processing
  private static async handlePostOperation(
    operation: string,
    context: OrderOperationContext,
    data: any,
    result: any
  ): Promise<void> {
    // Update collaboration session activity
    if (context.sessionId) {
      await CollaborationManager.updateSessionActivity(context.sessionId, {
        metadata: { lastOperation: operation, result }
      })
    }

    // Schedule background jobs based on operation
    switch (operation) {
      case 'complete_order':
        await OrderBackgroundJobs.scheduleCleanup(context.storeId)
        break
      case 'bulk_process':
        await OrderBackgroundJobs.scheduleAnalyticsUpdate(context.storeId, {
          start: new Date(),
          end: new Date()
        })
        break
    }

    // Send notifications for important operations
    const importantOperations = ['complete_order', 'cancel_order']
    if (importantOperations.includes(operation)) {
      await OrderBackgroundJobs.scheduleNotification(
        context.userId,
        'order_update',
        `Order ${context.orderId} has been ${operation.replace('_', ' ')}`
      )
    }
  }

  // Bulk Operations Support
  private static async validateBulkOperation(
    operation: string,
    contexts: OrderOperationContext[],
    dataArray: any[]
  ): Promise<{ success: boolean; errors?: string[] }> {
    // Validate bulk operation constraints
    if (contexts.length > 1000) {
      return {
        success: false,
        errors: ['Bulk operation limit exceeded. Maximum 1000 orders allowed.']
      }
    }

    // Check for duplicate order IDs
    const orderIds = contexts.map(c => c.orderId)
    const duplicates = orderIds.filter((id, index) => orderIds.indexOf(id) !== index)
    if (duplicates.length > 0) {
      return {
        success: false,
        errors: [`Duplicate order IDs found: ${duplicates.join(', ')}`]
      }
    }

    return { success: true }
  }

  private static createBatches<T, U>(
    contexts: T[],
    dataArray: U[],
    batchSize: number
  ): Array<{ context: T; data: U }>[][] {
    const combined = contexts.map((context, index) => ({
      context,
      data: dataArray[index]
    }))

    const batches: Array<{ context: T; data: U }>[][] = []
    for (let i = 0; i < combined.length; i += batchSize) {
      batches.push([combined.slice(i, i + batchSize)])
    }

    return batches
  }

  private static async scheduleBulkCleanup(
    contexts: OrderOperationContext[],
    successCount: number,
    errorCount: number
  ): Promise<void> {
    // Schedule cleanup job for bulk operations
    await OrderPerformanceOptimizer.scheduleJob(
      'bulk_cleanup',
      {
        contexts: contexts.length,
        successCount,
        errorCount,
        timestamp: new Date()
      },
      JobPriority.LOW
    )
  }

  // Error Handling
  private static handleOperationError(
    operation: string,
    context: OrderOperationContext,
    error: any,
    startTime: number,
    startMemory: number
  ): OrchestrationResult {
    const errorId = OrderErrorHandler.createError(
      OrderErrorType.SYSTEM_ERROR,
      `Operation '${operation}' failed: ${error instanceof Error ? error.message : 'Unknown error'}`,
      {
        orderId: context.orderId,
        operation,
        userId: context.userId,
        storeId: context.storeId,
        timestamp: context.timestamp,
        metadata: { stack: error instanceof Error ? error.stack : undefined }
      },
      {
        severity: 'high',
        retryable: true,
        suggestedActions: [
          'Check your internet connection',
          'Try refreshing the page',
          'Contact support if the issue persists'
        ]
      }
    ).id

    // Record performance metrics for failed operation
    this.recordPerformanceMetrics(operation, context, Date.now() - startTime, this.getMemoryUsage() - startMemory, false, error.message)

    // Show user notification
    OrderErrorNotifications.showError(OrderErrorHandler.getErrorById(errorId)!, {
      title: 'Operation Failed',
      showActions: true
    })

    return {
      success: false,
      errors: [error instanceof Error ? error.message : 'Operation failed'],
      errorId,
      timestamp: new Date()
    }
  }

  private static createValidationFailureResult(
    validationReport: ValidationReport,
    startTime: number,
    startMemory: number
  ): OrchestrationResult {
    return {
      success: false,
      errors: validationReport.results
        .filter(r => !r.isValid)
        .map(r => r.message),
      validationReport,
      performanceMetrics: {
        duration: Date.now() - startTime,
        memoryUsage: this.getMemoryUsage() - startMemory,
        cached: false
      },
      timestamp: new Date()
    }
  }

  private static createStateTransitionFailureResult(
    operation: string,
    context: OrderOperationContext,
    startTime: number,
    startMemory: number
  ): OrchestrationResult {
    return {
      success: false,
      errors: [`State transition not allowed for operation: ${operation}`],
      performanceMetrics: {
        duration: Date.now() - startTime,
        memoryUsage: this.getMemoryUsage() - startMemory,
        cached: false
      },
      timestamp: new Date()
    }
  }

  private static createCollaborationFailureResult(
    error: string,
    startTime: number,
    startMemory: number
  ): OrchestrationResult {
    return {
      success: false,
      errors: [error],
      performanceMetrics: {
        duration: Date.now() - startTime,
        memoryUsage: this.getMemoryUsage() - startMemory,
        cached: false
      },
      timestamp: new Date()
    }
  }

  // Utility Methods
  private static generateCacheKey(operation: string, context: OrderOperationContext, data: any): string {
    const contextHash = JSON.stringify({
      userId: context.userId,
      storeId: context.storeId,
      operation
    })
    const dataHash = JSON.stringify(data).slice(0, 100) // Truncate for key length
    return `${operation}_${contextHash}_${dataHash}`.replace(/[^a-zA-Z0-9]/g, '_')
  }

  private static getMemoryUsage(): number {
    if (typeof performance !== 'undefined' && (performance as any).memory) {
      return (performance as any).memory.usedJSHeapSize
    }
    return 0
  }

  private static recordPerformanceMetrics(
    operation: string,
    context: OrderOperationContext,
    duration: number,
    memoryUsage: number,
    success: boolean = true,
    error?: string
  ): void {
    if (this.config.enableAuditLogging) {
      OrderPerformanceOptimizer.recordPerformanceMetric(
        operation,
        duration,
        memoryUsage,
        success,
        error,
        { orderId: context.orderId, userId: context.userId, storeId: context.storeId }
      )
    }
  }

  // System Health and Maintenance
  static getSystemHealth(): {
    stateMachine: any
    validation: any
    collaboration: any
    performance: any
    overall: 'healthy' | 'degraded' | 'critical'
  } {
    const collaborationStats = CollaborationManager.getCollaborationStats()
    const performanceStats = OrderPerformanceOptimizer.generateOptimizationReport()

    // Determine overall health
    let overall: 'healthy' | 'degraded' | 'critical' = 'healthy'
    
    if (collaborationStats.pendingConflicts > 10 || 
        performanceStats.jobStats.failedJobs > performanceStats.jobStats.totalJobs * 0.1) {
      overall = 'degraded'
    }

    if (collaborationStats.activeSessions === 0 && performanceStats.jobStats.pendingJobs > 100) {
      overall = 'critical'
    }

    return {
      stateMachine: { status: 'operational' },
      validation: { 
        rulesLoaded: OrderDataValidator.getRulesByCategory('structure').length,
        cacheSize: OrderDataValidator.getCacheStats().size 
      },
      collaboration: collaborationStats,
      performance: performanceStats,
      overall
    }
  }

  static async cleanup(): Promise<void> {
    // Clean up all subsystems
    CollaborationManager.cleanupInactiveSessions()
    CollaborationManager.cleanupExpiredLocks()
    OrderPerformanceOptimizer.cleanup()
    OrderDataValidator.clearCache()

    // Clear loading states
    OrderLoadingState.clearAllNotifications()
  }

  static destroy(): void {
    // Destroy all subsystems
    CollaborationManager.destroy()
    OrderPerformanceOptimizer.destroy()
    OrderDataValidator.clearCache()
    OrderLoadingState.clearAllNotifications()
  }
}

// Export convenience methods for common operations
export const OrderOperations = {
  createOrder: (context: OrderOperationContext, orderData: any) =>
    OrderOrchestrator.executeOperation('create_order', context, orderData),

  editOrder: (context: OrderOperationContext, orderData: any) =>
    OrderOrchestrator.executeOperation('edit_order', context, orderData, { lockType: LockType.FULL }),

  completeOrder: (context: OrderOperationContext, orderData: any) =>
    OrderOrchestrator.executeOperation('complete_order', context, orderData, { lockType: LockType.PAYMENT }),

  cancelOrder: (context: OrderOperationContext, orderData: any) =>
    OrderOrchestrator.executeOperation('cancel_order', context, orderData),

  bulkEdit: (contexts: OrderOperationContext[], ordersData: any[]) =>
    OrderOrchestrator.executeBulkOperation('edit_order', contexts, ordersData, { enableParallelProcessing: true }),

  bulkComplete: (contexts: OrderOperationContext[], ordersData: any[]) =>
    OrderOrchestrator.executeBulkOperation('complete_order', contexts, ordersData, { enableParallelProcessing: false })
}