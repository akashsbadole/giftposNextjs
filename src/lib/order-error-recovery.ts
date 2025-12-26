// Enhanced Error Recovery and Fallback Mechanisms for Order Management
// Comprehensive error recovery with automatic retries, circuit breakers, and graceful degradation

import { OrderErrorHandler, OrderErrorType, OrderErrorContext, OrderManagementError } from './order-management-errors'
import { OrderAuditLogger, AuditEventType, AuditSeverity } from './order-audit-logger'
import { OrderPerformanceOptimizer, JobPriority } from './order-performance-optimizer'

export enum RecoveryStrategy {
  RETRY = 'retry',
  CIRCUIT_BREAKER = 'circuit_breaker',
  FALLBACK = 'fallback',
  DEGRADE = 'degrade',
  ESCALATE = 'escalate',
  ROLLBACK = 'rollback'
}

export enum FallbackMode {
  CACHE_ONLY = 'cache_only',
  OFFLINE_MODE = 'offline_mode',
  READ_ONLY = 'read_only',
  DELAYED_PROCESSING = 'delayed_processing',
  MANUAL_APPROVAL = 'manual_approval'
}

export enum CircuitBreakerState {
  CLOSED = 'closed',      // Normal operation
  OPEN = 'open',          // Failing, reject requests
  HALF_OPEN = 'half_open' // Testing if service recovered
}

export interface CircuitBreakerConfig {
  failureThreshold: number        // Number of failures to open circuit
  recoveryTimeout: number        // Time to wait before trying half-open (ms)
  expectedErrorTypes: OrderErrorType[]
  enableMetrics: boolean
  resetTimeout: number          // Time to wait before resetting metrics (ms)
}

export interface RetryConfig {
  maxAttempts: number
  backoffMultiplier: number
  maxBackoffTime: number
  jitter: boolean
  retryableErrorTypes: OrderErrorType[]
  retryableStatusCodes?: number[]
}

export interface FallbackConfig {
  enabled: boolean
  mode: FallbackMode
  cacheTimeout: number
  offlineQueueSize: number
  enableManualFallback: boolean
  fallbackDelay: number
}

export interface RecoveryContext {
  operation: string
  error: Error
  errorType: OrderErrorType
  context: OrderErrorContext
  attempt: number
  maxAttempts: number
  startTime: number
}

export interface RecoveryResult<T = any> {
  success: boolean
  data?: T
  strategy: RecoveryStrategy
  attempt: number
  totalDuration: number
  error?: string
  fallbackUsed: boolean
  circuitBreakerTriggered: boolean
}

export class OrderErrorRecovery {
  private static circuitBreakers = new Map<string, {
    state: CircuitBreakerState
    failures: number
    lastFailureTime: number
    nextAttemptTime: number
    config: CircuitBreakerConfig
  }>()

  private static retryConfigs = new Map<string, RetryConfig>()
  private static fallbackConfigs = new Map<string, FallbackConfig>()
  private static recoveryMetrics = new Map<string, {
    totalAttempts: number
    successfulRecoveries: number
    failedRecoveries: number
    totalFallbackUsed: number
    circuitBreakerTriggers: number
  }>()

  // Configuration management
  static configureRetry(operation: string, config: RetryConfig): void {
    this.retryConfigs.set(operation, config)
  }

  static configureCircuitBreaker(operation: string, config: CircuitBreakerConfig): void {
    this.circuitBreakers.set(operation, {
      state: CircuitBreakerState.CLOSED,
      failures: 0,
      lastFailureTime: 0,
      nextAttemptTime: 0,
      config
    })
  }

  static configureFallback(operation: string, config: FallbackConfig): void {
    this.fallbackConfigs.set(operation, config)
  }

  // Main recovery method
  static async recover<T = any>(
    operation: string,
    operationFn: () => Promise<T>,
    context: OrderErrorContext,
    options: {
      enableRetry?: boolean
      enableCircuitBreaker?: boolean
      enableFallback?: boolean
      customRetryConfig?: RetryConfig
      customCircuitBreakerConfig?: CircuitBreakerConfig
      customFallbackConfig?: FallbackConfig
    } = {}
  ): Promise<RecoveryResult<T>> {
    const startTime = Date.now()
    const retryConfig = options.customRetryConfig || this.retryConfigs.get(operation) || this.getDefaultRetryConfig()
    const circuitBreakerConfig = options.customCircuitBreakerConfig || this.circuitBreakers.get(operation)?.config
    const fallbackConfig = options.customFallbackConfig || this.fallbackConfigs.get(operation)

    let attempt = 0
    let lastError: Error | null = null

    // Initialize metrics
    this.initializeMetrics(operation)

    try {
      // Check circuit breaker
      if (options.enableCircuitBreaker && circuitBreakerConfig) {
        const circuitBreakerResult = this.checkCircuitBreaker(operation, circuitBreakerConfig)
        if (!circuitBreakerResult.allowed) {
          // Try fallback if circuit breaker is open
          if (options.enableFallback && fallbackConfig?.enabled) {
            const fallbackResult = await this.executeFallback<T>(operation, fallbackConfig, context)
            this.recordRecoveryAttempt(operation, false, true, false)
            return {
              success: fallbackResult.success,
              data: fallbackResult.data,
              strategy: RecoveryStrategy.CIRCUIT_BREAKER,
              attempt: 0,
              totalDuration: Date.now() - startTime,
              fallbackUsed: true,
              circuitBreakerTriggered: true
            }
          }

          this.recordRecoveryAttempt(operation, false, false, true)
          return {
            success: false,
            strategy: RecoveryStrategy.CIRCUIT_BREAKER,
            attempt: 0,
            totalDuration: Date.now() - startTime,
            error: 'Circuit breaker is open',
            circuitBreakerTriggered: true
          }
        }
      }

      // Retry loop
      if (options.enableRetry) {
        while (attempt < retryConfig.maxAttempts) {
          attempt++

          try {
            const result = await operationFn()
            
            // Success - reset circuit breaker if exists
            if (circuitBreakerConfig) {
              this.recordCircuitBreakerSuccess(operation)
            }

            this.recordRecoveryAttempt(operation, true, false, false)
            return {
              success: true,
              data: result,
              strategy: RecoveryStrategy.RETRY,
              attempt,
              totalDuration: Date.now() - startTime,
              fallbackUsed: false,
              circuitBreakerTriggered: false
            }

          } catch (error) {
            lastError = error as Error
            
            // Check if error is retryable
            const errorType = this.categorizeError(lastError)
            if (!this.isRetryableError(errorType, retryConfig)) {
              break
            }

            // Check if this was the last attempt
            if (attempt >= retryConfig.maxAttempts) {
              break
            }

            // Calculate backoff delay
            const delay = this.calculateBackoffDelay(attempt, retryConfig)
            
            // Wait before retry
            await this.delay(delay)

            // Log retry attempt
            await OrderAuditLogger.log({
              eventType: AuditEventType.SYSTEM_ERROR,
              category: 'error' as any,
              severity: AuditSeverity.MEDIUM,
              source: 'backend',
              userId: context.userId,
              storeId: context.storeId,
              resourceId: context.orderId,
              description: `Retry attempt ${attempt}/${retryConfig.maxAttempts} for operation ${operation}`,
              details: { operation, attempt, error: lastError.message, delay },
              success: false,
              errorMessage: lastError.message
            })
          }
        }
      } else {
        // Single attempt without retry
        try {
          const result = await operationFn()
          this.recordRecoveryAttempt(operation, true, false, false)
          return {
            success: true,
            data: result,
            strategy: RecoveryStrategy.RETRY,
            attempt: 1,
            totalDuration: Date.now() - startTime,
            fallbackUsed: false,
            circuitBreakerTriggered: false
          }
        } catch (error) {
          lastError = error as Error
        }
      }

      // If we get here, all retries failed or retry is disabled
      // Try fallback if enabled
      if (options.enableFallback && fallbackConfig?.enabled && lastError) {
        const fallbackResult = await this.executeFallback<T>(operation, fallbackConfig, context, lastError)
        this.recordRecoveryAttempt(operation, fallbackResult.success, true, false)
        
        return {
          success: fallbackResult.success,
          data: fallbackResult.data,
          strategy: RecoveryStrategy.FALLBACK,
          attempt,
          totalDuration: Date.now() - startTime,
          fallbackUsed: true,
          circuitBreakerTriggered: false,
          error: fallbackResult.error
        }
      }

      // Record circuit breaker failure
      if (circuitBreakerConfig && lastError) {
        this.recordCircuitBreakerFailure(operation)
      }

      this.recordRecoveryAttempt(operation, false, false, false)
      return {
        success: false,
        strategy: RecoveryStrategy.ESCALATE,
        attempt,
        totalDuration: Date.now() - startTime,
        error: lastError?.message || 'Unknown error',
        fallbackUsed: false,
        circuitBreakerTriggered: false
      }

    } catch (fatalError) {
      // Fatal error - log and escalate
      await OrderAuditLogger.logError(fatalError as Error, {
        userId: context.userId,
        storeId: context.storeId,
        orderId: context.orderId,
        operation,
        correlationId: context.metadata?.correlationId
      })

      this.recordRecoveryAttempt(operation, false, false, false)
      return {
        success: false,
        strategy: RecoveryStrategy.ESCALATE,
        attempt,
        totalDuration: Date.now() - startTime,
        error: (fatalError as Error).message,
        fallbackUsed: false,
        circuitBreakerTriggered: false
      }
    }
  }

  // Circuit Breaker Implementation
  private static checkCircuitBreaker(operation: string, config: CircuitBreakerConfig): { allowed: boolean; reason?: string } {
    const breaker = this.circuitBreakers.get(operation)
    if (!breaker) {
      return { allowed: true }
    }

    const now = Date.now()

    switch (breaker.state) {
      case CircuitBreakerState.CLOSED:
        return { allowed: true }

      case CircuitBreakerState.OPEN:
        if (now >= breaker.nextAttemptTime) {
          // Transition to half-open
          breaker.state = CircuitBreakerState.HALF_OPEN
          breaker.failures = 0
          return { allowed: true }
        }
        return { allowed: false, reason: 'Circuit breaker is open' }

      case CircuitBreakerState.HALF_OPEN:
        // Allow one test request
        return { allowed: true }

      default:
        return { allowed: true }
    }
  }

  private static recordCircuitBreakerFailure(operation: string): void {
    const breaker = this.circuitBreakers.get(operation)
    if (!breaker) return

    breaker.failures++
    breaker.lastFailureTime = Date.now()

    if (breaker.failures >= breaker.config.failureThreshold) {
      breaker.state = CircuitBreakerState.OPEN
      breaker.nextAttemptTime = Date.now() + breaker.config.recoveryTimeout

      // Log circuit breaker opening
      console.warn(`Circuit breaker opened for operation: ${operation}`)
    }
  }

  private static recordCircuitBreakerSuccess(operation: string): void {
    const breaker = this.circuitBreakers.get(operation)
    if (!breaker) return

    if (breaker.state === CircuitBreakerState.HALF_OPEN) {
      // Success in half-open state - close the circuit
      breaker.state = CircuitBreakerState.CLOSED
      breaker.failures = 0
      console.info(`Circuit breaker closed for operation: ${operation}`)
    } else if (breaker.state === CircuitBreakerState.CLOSED) {
      // Reset failure count periodically
      const now = Date.now()
      if (now - breaker.lastFailureTime > breaker.config.resetTimeout) {
        breaker.failures = 0
      }
    }
  }

  // Fallback Implementation
  private static async executeFallback<T = any>(
    operation: string,
    config: FallbackConfig,
    context: OrderErrorContext,
    error?: Error
  ): Promise<{ success: boolean; data?: T; error?: string }> {
    try {
      // Log fallback usage
      await OrderAuditLogger.log({
        eventType: AuditEventType.SYSTEM_ERROR,
        category: 'error' as any,
        severity: AuditSeverity.HIGH,
        source: 'backend',
        userId: context.userId,
        storeId: context.storeId,
        resourceId: context.orderId,
        description: `Fallback activated for operation ${operation}: ${config.mode}`,
        details: { operation, mode: config.mode, error: error?.message },
        success: false,
        errorMessage: `Fallback used: ${config.mode}`
      })

      // Execute appropriate fallback strategy
      switch (config.mode) {
        case FallbackMode.CACHE_ONLY:
          return this.executeCacheFallback<T>(operation, config, context)
        
        case FallbackMode.OFFLINE_MODE:
          return this.executeOfflineFallback<T>(operation, config, context)
        
        case FallbackMode.READ_ONLY:
          return this.executeReadOnlyFallback<T>(operation, config, context)
        
        case FallbackMode.DELAYED_PROCESSING:
          return this.executeDelayedProcessingFallback(operation, config, context)
        
        case FallbackMode.MANUAL_APPROVAL:
          return this.executeManualApprovalFallback(operation, config, context)
        
        default:
          return { success: false, error: `Unknown fallback mode: ${config.mode}` }
      }

    } catch (fallbackError) {
      return {
        success: false,
        error: `Fallback failed: ${fallbackError instanceof Error ? fallbackError.message : 'Unknown error'}`
      }
    }
  }

  private static async executeCacheFallback<T = any>(
    operation: string,
    config: FallbackConfig,
    context: OrderErrorContext
  ): Promise<{ success: boolean; data?: T; error?: string }> {
    const cacheKey = `fallback_${operation}_${context.orderId}`
    const cached = await OrderPerformanceOptimizer.get<T>(cacheKey)
    
    if (cached) {
      return { success: true, data: cached }
    }

    return { success: false, error: 'No cached data available' }
  }

  private static async executeOfflineFallback<T = any>(
    operation: string,
    config: FallbackConfig,
    context: OrderErrorContext
  ): Promise<{ success: boolean; data?: T; error?: string }> {
    // Queue operation for later processing
    await OrderPerformanceOptimizer.scheduleJob(
      'offline_operation',
      { operation, context, timestamp: new Date() },
      JobPriority.LOW,
      new Date(Date.now() + config.fallbackDelay)
    )

    return {
      success: true,
      data: { queued: true, message: 'Operation queued for offline processing' } as T
    }
  }

  private static async executeReadOnlyFallback<T = any>(
    operation: string,
    config: FallbackConfig,
    context: OrderErrorContext
  ): Promise<{ success: boolean; data?: T; error?: string }> {
    // Only allow read operations in read-only mode
    const readOnlyOperations = ['get_order', 'list_orders', 'search_orders']
    
    if (!readOnlyOperations.includes(operation)) {
      return { success: false, error: 'Operation not allowed in read-only mode' }
    }

    // Execute read operation with cached data
    const cacheKey = `readonly_${operation}_${context.orderId}`
    const cached = await OrderPerformanceOptimizer.get<T>(cacheKey)
    
    if (cached) {
      return { success: true, data: cached }
    }

    return { success: false, error: 'No data available in read-only mode' }
  }

  private static async executeDelayedProcessingFallback(
    operation: string,
    config: FallbackConfig,
    context: OrderErrorContext
  ): Promise<{ success: boolean; data?: any; error?: string }> {
    // Schedule operation for delayed processing
    const delayMinutes = Math.ceil(config.fallbackDelay / (60 * 1000))
    
    await OrderPerformanceOptimizer.scheduleJob(
      'delayed_operation',
      { operation, context, delayMinutes },
      JobPriority.LOW,
      new Date(Date.now() + config.fallbackDelay)
    )

    return {
      success: true,
      data: { 
        queued: true, 
        message: `Operation scheduled for processing in ${delayMinutes} minutes`,
        scheduledAt: new Date(Date.now() + config.fallbackDelay)
      }
    }
  }

  private static async executeManualApprovalFallback(
    operation: string,
    config: FallbackConfig,
    context: OrderErrorContext
  ): Promise<{ success: boolean; data?: any; error?: string }> {
    // Create manual approval task
    await OrderPerformanceOptimizer.scheduleJob(
      'manual_approval',
      { operation, context, requiresApproval: true },
      JobPriority.HIGH
    )

    return {
      success: true,
      data: { 
        requiresApproval: true, 
        message: 'Operation requires manual approval',
        approvalId: `approval_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`
      }
    }
  }

  // Utility methods
  private static categorizeError(error: Error): OrderErrorType {
    const message = error.message.toLowerCase()
    
    if (message.includes('network') || message.includes('timeout')) {
      return OrderErrorType.NETWORK_ERROR
    }
    
    if (message.includes('permission') || message.includes('unauthorized')) {
      return OrderErrorType.PERMISSION_ERROR
    }
    
    if (message.includes('validation') || message.includes('invalid')) {
      return OrderErrorType.VALIDATION_ERROR
    }
    
    if (message.includes('conflict') || message.includes('concurrent')) {
      return OrderErrorType.CONFLICT_ERROR
    }
    
    if (message.includes('storage') || message.includes('database')) {
      return OrderErrorType.STORAGE_ERROR
    }
    
    if (message.includes('timeout')) {
      return OrderErrorType.TIMEOUT_ERROR
    }
    
    return OrderErrorType.SYSTEM_ERROR
  }

  private static isRetryableError(errorType: OrderErrorType, config: RetryConfig): boolean {
    return config.retryableErrorTypes.includes(errorType)
  }

  private static calculateBackoffDelay(attempt: number, config: RetryConfig): number {
    const baseDelay = 1000 // 1 second
    const exponentialDelay = baseDelay * Math.pow(config.backoffMultiplier, attempt - 1)
    const maxDelay = Math.min(exponentialDelay, config.maxBackoffTime)
    
    if (config.jitter) {
      // Add random jitter (±25%)
      const jitter = maxDelay * 0.25
      return maxDelay + (Math.random() * 2 - 1) * jitter
    }
    
    return maxDelay
  }

  private static delay(ms: number): Promise<void> {
    return new Promise(resolve => setTimeout(resolve, ms))
  }

  private static getDefaultRetryConfig(): RetryConfig {
    return {
      maxAttempts: 3,
      backoffMultiplier: 2,
      maxBackoffTime: 10000,
      jitter: true,
      retryableErrorTypes: [
        OrderErrorType.NETWORK_ERROR,
        OrderErrorType.TIMEOUT_ERROR,
        OrderErrorType.STORAGE_ERROR
      ]
    }
  }

  // Metrics and monitoring
  private static initializeMetrics(operation: string): void {
    if (!this.recoveryMetrics.has(operation)) {
      this.recoveryMetrics.set(operation, {
        totalAttempts: 0,
        successfulRecoveries: 0,
        failedRecoveries: 0,
        totalFallbackUsed: 0,
        circuitBreakerTriggers: 0
      })
    }
  }

  private static recordRecoveryAttempt(
    operation: string,
    success: boolean,
    fallbackUsed: boolean,
    circuitBreakerTriggered: boolean
  ): void {
    const metrics = this.recoveryMetrics.get(operation)
    if (!metrics) return

    metrics.totalAttempts++
    
    if (success) {
      metrics.successfulRecoveries++
    } else {
      metrics.failedRecoveries++
    }
    
    if (fallbackUsed) {
      metrics.totalFallbackUsed++
    }
    
    if (circuitBreakerTriggered) {
      metrics.circuitBreakerTriggers++
    }
  }

  // Public monitoring methods
  static getRecoveryMetrics(operation?: string): any {
    if (operation) {
      return this.recoveryMetrics.get(operation)
    }
    
    const allMetrics = Object.fromEntries(this.recoveryMetrics)
    const totalMetrics = Object.values(allMetrics).reduce((acc, metrics) => ({
      totalAttempts: acc.totalAttempts + metrics.totalAttempts,
      successfulRecoveries: acc.successfulRecoveries + metrics.successfulRecoveries,
      failedRecoveries: acc.failedRecoveries + metrics.failedRecoveries,
      totalFallbackUsed: acc.totalFallbackUsed + metrics.totalFallbackUsed,
      circuitBreakerTriggers: acc.circuitBreakerTriggers + metrics.circuitBreakerTriggers
    }), {
      totalAttempts: 0,
      successfulRecoveries: 0,
      failedRecoveries: 0,
      totalFallbackUsed: 0,
      circuitBreakerTriggers: 0
    })

    return {
      operations: allMetrics,
      total: totalMetrics
    }
  }

  static getCircuitBreakerStatus(operation?: string): any {
    if (operation) {
      return this.circuitBreakers.get(operation)
    }
    
    return Object.fromEntries(this.circuitBreakers)
  }

  static resetCircuitBreaker(operation: string): void {
    const breaker = this.circuitBreakers.get(operation)
    if (breaker) {
      breaker.state = CircuitBreakerState.CLOSED
      breaker.failures = 0
      breaker.lastFailureTime = 0
      breaker.nextAttemptTime = 0
    }
  }

  static resetMetrics(operation?: string): void {
    if (operation) {
      this.recoveryMetrics.delete(operation)
    } else {
      this.recoveryMetrics.clear()
    }
  }

  // Cleanup
  static cleanup(): void {
    // Clean up expired circuit breakers
    const now = Date.now()
    for (const [operation, breaker] of this.circuitBreakers.entries()) {
      if (now - breaker.lastFailureTime > 24 * 60 * 60 * 1000) { // 24 hours
        this.circuitBreakers.delete(operation)
      }
    }
  }

  static destroy(): void {
    this.circuitBreakers.clear()
    this.retryConfigs.clear()
    this.fallbackConfigs.clear()
    this.recoveryMetrics.clear()
  }
}

// Export convenience functions
export const RecoveryUtils = {
  withRetry: <T>(
    operationFn: () => Promise<T>,
    config: RetryConfig
  ) => OrderErrorRecovery.recover('anonymous', operationFn, { operation: 'anonymous', timestamp: new Date() }, { enableRetry: true, customRetryConfig: config }),

  withCircuitBreaker: <T>(
    operationFn: () => Promise<T>,
    config: CircuitBreakerConfig
  ) => OrderErrorRecovery.recover('anonymous', operationFn, { operation: 'anonymous', timestamp: new Date() }, { enableCircuitBreaker: true, customCircuitBreakerConfig: config }),

  withFallback: <T>(
    operationFn: () => Promise<T>,
    config: FallbackConfig
  ) => OrderErrorRecovery.recover('anonymous', operationFn, { operation: 'anonymous', timestamp: new Date() }, { enableFallback: true, customFallbackConfig: config })
}