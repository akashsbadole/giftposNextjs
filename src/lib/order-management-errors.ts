// Order Management System - Comprehensive Error Handling
// Advanced error handling, logging, and recovery mechanisms

export enum OrderErrorType {
  VALIDATION_ERROR = 'VALIDATION_ERROR',
  NETWORK_ERROR = 'NETWORK_ERROR',
  PERMISSION_ERROR = 'PERMISSION_ERROR',
  BUSINESS_LOGIC_ERROR = 'BUSINESS_LOGIC_ERROR',
  CONFLICT_ERROR = 'CONFLICT_ERROR',
  TIMEOUT_ERROR = 'TIMEOUT_ERROR',
  STORAGE_ERROR = 'STORAGE_ERROR',
  USER_CANCELLED = 'USER_CANCELLED',
  SYSTEM_ERROR = 'SYSTEM_ERROR'
}

export interface OrderErrorContext {
  orderId?: string
  operation: string
  userId?: string
  storeId?: string
  timestamp: Date
  metadata?: Record<string, any>
}

export interface OrderManagementError {
  id: string
  type: OrderErrorType
  message: string
  details?: string
  context: OrderErrorContext
  severity: 'low' | 'medium' | 'high' | 'critical'
  retryable: boolean
  suggestedActions?: string[]
  timestamp: Date
}

// Error categories and handling strategies
export class OrderErrorHandler {
  private static errorLog: OrderManagementError[] = []
  private static maxLogSize = 1000

  static createError(
    type: OrderErrorType,
    message: string,
    context: OrderErrorContext,
    options: {
      details?: string
      severity?: 'low' | 'medium' | 'high' | 'critical'
      retryable?: boolean
      suggestedActions?: string[]
    } = {}
  ): OrderManagementError {
    const error: OrderManagementError = {
      id: `err_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
      type,
      message,
      details: options.details,
      context,
      severity: options.severity || 'medium',
      retryable: options.retryable !== false,
      suggestedActions: options.suggestedActions || this.getDefaultActions(type),
      timestamp: new Date()
    }

    this.logError(error)
    return error
  }

  private static logError(error: OrderManagementError): void {
    this.errorLog.push(error)
    
    // Maintain log size
    if (this.errorLog.length > this.maxLogSize) {
      this.errorLog = this.errorLog.slice(-this.maxLogSize)
    }

    // Log to console for debugging
    console.error(`[OrderError] ${error.type}: ${error.message}`, {
      error,
      context: error.context
    })

    // In production, this would send to error tracking service
    this.sendToErrorTracking(error)
  }

  private static sendToErrorTracking(error: OrderManagementError): void {
    // This would integrate with services like Sentry, LogRocket, etc.
    if (process.env.NODE_ENV === 'production') {
      // sendErrorToTrackingService(error)
    }
  }

  private static getDefaultActions(type: OrderErrorType): string[] {
    switch (type) {
      case OrderErrorType.VALIDATION_ERROR:
        return [
          'Check all required fields are filled',
          'Verify data format is correct',
          'Ensure values are within acceptable ranges'
        ]
      case OrderErrorType.NETWORK_ERROR:
        return [
          'Check internet connection',
          'Verify server is accessible',
          'Try again in a few moments'
        ]
      case OrderErrorType.PERMISSION_ERROR:
        return [
          'Check user permissions',
          'Contact administrator if needed',
          'Verify user role has required access'
        ]
      case OrderErrorType.CONFLICT_ERROR:
        return [
          'Check if order is being edited by another user',
          'Refresh the page and try again',
          'Contact support if issue persists'
        ]
      case OrderErrorType.TIMEOUT_ERROR:
        return [
          'Increase timeout settings',
          'Check server performance',
          'Try with smaller data sets'
        ]
      default:
        return [
          'Try refreshing the page',
          'Check system status',
          'Contact support if issue persists'
        ]
    }
  }

  static getErrorById(id: string): OrderManagementError | undefined {
    return this.errorLog.find(error => error.id === id)
  }

  static getRecentErrors(limit: number = 10): OrderManagementError[] {
    return this.errorLog.slice(-limit).reverse()
  }

  static getErrorsByType(type: OrderErrorType): OrderManagementError[] {
    return this.errorLog.filter(error => error.type === type)
  }

  static getCriticalErrors(): OrderManagementError[] {
    return this.errorLog.filter(error => error.severity === 'critical')
  }

  static clearErrorLog(): void {
    this.errorLog = []
  }
}

// Enhanced error recovery mechanisms
export class OrderErrorRecovery {
  static async handleApiError(
    error: any,
    context: OrderErrorContext,
    retryOptions: {
      maxRetries?: number
      backoffMultiplier?: number
      maxBackoffTime?: number
    } = {}
  ): Promise<{ success: boolean; data?: any; error?: OrderManagementError }> {
    const {
      maxRetries = 3,
      backoffMultiplier = 1000,
      maxBackoffTime = 10000
    } = retryOptions

    let lastError: OrderManagementError | null = null

    for (let attempt = 0; attempt <= maxRetries; attempt++) {
      try {
        if (attempt > 0) {
          // Exponential backoff
          const delay = Math.min(
            backoffMultiplier * Math.pow(2, attempt - 1),
            maxBackoffTime
          )
          
          await new Promise(resolve => setTimeout(resolve, delay))
        }

        // Attempt the operation
        const result = await this.attemptOperation(context)
        return { success: true, data: result }

      } catch (error) {
        lastError = this.categorizeError(error, context)
        
        // Don't retry certain types of errors
        if (!lastError.retryable || attempt === maxRetries) {
          break
        }
      }
    }

    return {
      success: false,
      error: lastError || this.createUnknownError(context)
    }
  }

  private static async attemptOperation(context: OrderErrorContext): Promise<any> {
    // This would contain the actual API call logic
    // For now, we'll simulate different error scenarios
    switch (context.operation) {
      case 'CREATE_ORDER':
        throw new Error('Simulated network error')
      case 'RETRIEVE_ORDER':
        throw new Error('Simulated timeout error')
      case 'UPDATE_ORDER':
        throw new Error('Simulated conflict error')
      default:
        return { success: true }
    }
  }

  private static categorizeError(error: any, context: OrderErrorContext): OrderManagementError {
    const errorMessage = error?.message || 'Unknown error occurred'
    
    if (errorMessage.includes('network') || errorMessage.includes('fetch')) {
      return OrderErrorHandler.createError(
        OrderErrorType.NETWORK_ERROR,
        'Network request failed',
        context,
        {
          details: errorMessage,
          severity: 'medium',
          retryable: true
        }
      )
    }
    
    if (errorMessage.includes('timeout')) {
      return OrderErrorHandler.createError(
        OrderErrorType.TIMEOUT_ERROR,
        'Request timed out',
        context,
        {
          details: errorMessage,
          severity: 'medium',
          retryable: true
        }
      )
    }
    
    if (errorMessage.includes('conflict') || errorMessage.includes('concurrent')) {
      return OrderErrorHandler.createError(
        OrderErrorType.CONFLICT_ERROR,
        'Operation conflict detected',
        context,
        {
          details: errorMessage,
          severity: 'high',
          retryable: true
        }
      )
    }
    
    if (errorMessage.includes('permission') || errorMessage.includes('unauthorized')) {
      return OrderErrorHandler.createError(
        OrderErrorType.PERMISSION_ERROR,
        'Insufficient permissions',
        context,
        {
          details: errorMessage,
          severity: 'high',
          retryable: false
        }
      )
    }
    
    return this.createUnknownError(context, errorMessage)
  }

  private static createUnknownError(context: OrderErrorContext, details?: string): OrderManagementError {
    return OrderErrorHandler.createError(
      OrderErrorType.SYSTEM_ERROR,
      'An unexpected error occurred',
      context,
      {
        details,
        severity: 'high',
        retryable: false
      }
    )
  }
}

// Loading state management
export class OrderLoadingState {
  private static loadingStates = new Map<string, {
    isLoading: boolean
    progress?: number
    message?: string
    startTime?: Date
    operations: Set<string>
  }>()

  static setLoading(
    operationId: string,
    isLoading: boolean,
    options: {
      progress?: number
      message?: string
      operation?: string
    } = {}
  ): void {
    const currentState = this.loadingStates.get(operationId) || {
      isLoading: false,
      operations: new Set()
    }

    if (isLoading) {
      if (!currentState.isLoading) {
        currentState.startTime = new Date()
      }
      currentState.isLoading = true
      currentState.progress = options.progress
      currentState.message = options.message
      if (options.operation) {
        currentState.operations.add(options.operation)
      }
    } else {
      currentState.isLoading = false
      currentState.progress = undefined
      currentState.message = undefined
      currentState.operations.clear()
    }

    this.loadingStates.set(operationId, currentState)
  }

  static getLoadingState(operationId: string): {
    isLoading: boolean
    progress?: number
    message?: string
    elapsedTime?: number
    operations: string[]
  } | null {
    const state = this.loadingStates.get(operationId)
    if (!state) return null

    const elapsedTime = state.startTime 
      ? Date.now() - state.startTime.getTime()
      : undefined

    return {
      isLoading: state.isLoading,
      progress: state.progress,
      message: state.message,
      elapsedTime,
      operations: Array.from(state.operations)
    }
  }

  static isLoading(operationId?: string): boolean {
    if (operationId) {
      const state = this.loadingStates.get(operationId)
      return state?.isLoading || false
    }
    
    // Check if any operation is loading
    return Array.from(this.loadingStates.values()).some(state => state.isLoading)
  }

  static getAllLoadingStates(): Record<string, any> {
    const result: Record<string, any> = {}
    
    this.loadingStates.forEach((state, operationId) => {
      if (state.isLoading) {
        result[operationId] = this.getLoadingState(operationId)
      }
    })
    
    return result
  }

  static clearLoadingState(operationId: string): void {
    this.loadingStates.delete(operationId)
  }
}

// User notification system for errors
export class OrderErrorNotifications {
  private static notifications: Array<{
    id: string
    type: 'error' | 'warning' | 'success' | 'info'
    title: string
    message: string
    errorId?: string
    timestamp: Date
    autoClose?: boolean
    actions?: Array<{
      label: string
      action: () => void
    }>
  }> = []

  static showError(error: OrderManagementError, options: {
    title?: string
    autoClose?: boolean
    showActions?: boolean
  } = {}): string {
    const id = `notif_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`
    
    const notification = {
      id,
      type: 'error' as const,
      title: options.title || 'Order Operation Failed',
      message: error.message,
      errorId: error.id,
      timestamp: new Date(),
      autoClose: options.autoClose !== false,
      actions: options.showActions !== false ? this.generateActions(error) : undefined
    }

    this.notifications.push(notification)

    // Auto-remove after 10 seconds if autoClose is enabled
    if (notification.autoClose) {
      setTimeout(() => {
        this.removeNotification(id)
      }, 10000)
    }

    return id
  }

  static showWarning(message: string, title: string = 'Warning'): string {
    return this.addNotification('warning', title, message)
  }

  static showSuccess(message: string, title: string = 'Success'): string {
    return this.addNotification('success', title, message)
  }

  static showInfo(message: string, title: string = 'Information'): string {
    return this.addNotification('info', title, message)
  }

  private static addNotification(
    type: 'error' | 'warning' | 'success' | 'info',
    title: string,
    message: string
  ): string {
    const id = `notif_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`
    
    this.notifications.push({
      id,
      type,
      title,
      message,
      timestamp: new Date(),
      autoClose: type !== 'error'
    })

    // Auto-remove non-error notifications after 5 seconds
    if (type !== 'error') {
      setTimeout(() => {
        this.removeNotification(id)
      }, 5000)
    }

    return id
  }

  private static generateActions(error: OrderManagementError): Array<{
    label: string
    action: () => void
  }> {
    const actions = []

    if (error.suggestedActions) {
      error.suggestedActions.forEach((action, index) => {
        actions.push({
          label: action,
          action: () => {
            // Execute suggested action
            console.log(`Executing suggested action: ${action}`)
          }
        })
      })
    }

    if (error.retryable) {
      actions.push({
        label: 'Retry',
        action: () => {
          // Retry the operation
          console.log('Retrying operation...')
        }
      })
    }

    actions.push({
      label: 'View Details',
      action: () => {
        // Show error details
        console.log('Showing error details:', error)
      }
    })

    return actions
  }

  static removeNotification(id: string): void {
    this.notifications = this.notifications.filter(n => n.id !== id)
  }

  static getAllNotifications() {
    return [...this.notifications]
  }

  static clearAllNotifications(): void {
    this.notifications = []
  }
}

// Export all error handling utilities
export {
  OrderErrorHandler as ErrorHandler,
  OrderErrorRecovery as ErrorRecovery,
  OrderLoadingState as LoadingState,
  OrderErrorNotifications as Notifications
}