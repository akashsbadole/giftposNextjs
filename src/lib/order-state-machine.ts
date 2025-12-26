// Order State Machine and Transition Logic
// Comprehensive state machine for order lifecycle management with robust validation

export enum OrderState {
  NEW = 'new',
  HELD = 'held', 
  RECALLED = 'recalled',
  EDITING = 'editing',
  VALIDATING = 'validating',
  PROCESSING = 'processing',
  COMPLETED = 'completed',
  CANCELLED = 'cancelled',
  EXPIRED = 'expired',
  MERGED = 'merged',
  ARCHIVED = 'archived'
}

export interface StateTransition {
  from: OrderState
  to: OrderState
  trigger: string
  conditions?: ((context: TransitionContext) => boolean)[]
  actions?: ((context: TransitionContext) => Promise<void> | void)[]
  guard?: string // Description of guard conditions
  description: string
}

export interface TransitionContext {
  orderId: string
  currentState: OrderState
  targetState: OrderState
  userId: string
  storeId: string
  metadata?: Record<string, any>
  timestamp: Date
}

export interface StateValidationResult {
  isValid: boolean
  errors: string[]
  warnings: string[]
  requiredActions?: string[]
}

export interface StateMachineConfig {
  enableAutoTransitions: boolean
  autoTransitionDelay: number // milliseconds
  enableValidation: boolean
  enableAuditLogging: boolean
  enableCollaboration: boolean
  maxRetries: number
  timeoutMs: number
}

export class OrderStateMachine {
  private static readonly TRANSITIONS: StateTransition[] = [
    // Creation flow
    {
      from: OrderState.NEW,
      to: OrderState.HELD,
      trigger: 'hold',
      conditions: [this.validateOrderCreation],
      actions: [this.initializeHoldTimer, this.notifyCollaborators],
      guard: 'Order must be valid for holding',
      description: 'Create and hold a new order'
    },
    {
      from: OrderState.NEW,
      to: OrderState.CANCELLED,
      trigger: 'cancel',
      conditions: [this.validateCancellation],
      actions: [this.cleanupResources],
      guard: 'Order can be cancelled before processing',
      description: 'Cancel a new order before it\'s held'
    },

    // Hold lifecycle
    {
      from: OrderState.HELD,
      to: OrderState.RECALLED,
      trigger: 'retrieve',
      conditions: [this.validateRetrieval, this.checkNotExpired],
      actions: [this.stopHoldTimer, this.acquireEditLock],
      guard: 'Order must not be expired and must be held',
      description: 'Retrieve a held order for processing'
    },
    {
      from: OrderState.HELD,
      to: OrderState.EXPIRED,
      trigger: 'expire',
      conditions: [this.checkExpiry],
      actions: [this.handleExpiration, this.notifyStakeholders],
      guard: 'Hold duration has expired',
      description: 'Automatically expire a held order'
    },
    {
      from: OrderState.HELD,
      to: OrderState.CANCELLED,
      trigger: 'cancel',
      conditions: [this.validateCancellation],
      actions: [this.cleanupResources, this.releaseLocks],
      guard: 'Held order can be cancelled',
      description: 'Cancel a held order'
    },

    // Editing flow
    {
      from: OrderState.RECALLED,
      to: OrderState.EDITING,
      trigger: 'start_edit',
      conditions: [this.acquireEditLock, this.checkUserPermissions],
      actions: [this.initializeEditSession, this.notifyCollaboration],
      guard: 'User must have edit permissions',
      description: 'Start editing a recalled order'
    },
    {
      from: OrderState.EDITING,
      to: OrderState.VALIDATING,
      trigger: 'validate',
      conditions: [this.validateOrderData],
      actions: [this.runBusinessRules],
      guard: 'Order data must be valid',
      description: 'Validate order before processing'
    },
    {
      from: OrderState.VALIDATING,
      to: OrderState.PROCESSING,
      trigger: 'approve',
      conditions: [this.checkBusinessRules, this.validatePayment],
      actions: [this.reserveInventory, this.processPayment],
      guard: 'All business rules must pass',
      description: 'Approve order for processing'
    },
    {
      from: OrderState.VALIDATING,
      to: OrderState.EDITING,
      trigger: 'reject',
      conditions: [],
      actions: [this.notifyValidationFailure],
      guard: 'Validation failed',
      description: 'Return to editing due to validation failure'
    },

    // Processing flow
    {
      from: OrderState.PROCESSING,
      to: OrderState.COMPLETED,
      trigger: 'complete',
      conditions: [this.checkPaymentSuccess, this.confirmInventory],
      actions: [this.finalizeOrder, this.generateReceipt, this.cleanup],
      guard: 'Payment must be successful and inventory confirmed',
      description: 'Complete order processing successfully'
    },
    {
      from: OrderState.PROCESSING,
      to: OrderState.CANCELLED,
      trigger: 'fail',
      conditions: [this.checkProcessingFailure],
      actions: [this.rollbackInventory, this.refundPayment, this.notifyFailure],
      guard: 'Processing has failed',
      description: 'Cancel order due to processing failure'
    },

    // Merge operations
    {
      from: OrderState.HELD,
      to: OrderState.MERGED,
      trigger: 'merge',
      conditions: [this.validateMerge, this.checkMergeCompatibility],
      actions: [this.performMerge, this.resolveConflicts],
      guard: 'Orders must be compatible for merging',
      description: 'Merge this order with another'
    },
    {
      from: OrderState.MERGED,
      to: OrderState.HELD,
      trigger: 'split',
      conditions: [this.validateSplit],
      actions: [this.performSplit],
      guard: 'Merged order can be split',
      description: 'Split a merged order back into separate orders'
    },

    // Archive operations
    {
      from: OrderState.COMPLETED,
      to: OrderState.ARCHIVED,
      trigger: 'archive',
      conditions: [this.checkArchiveEligibility],
      actions: [this.archiveOrder, this.cleanupSensitiveData],
      guard: 'Order is eligible for archiving',
      description: 'Archive a completed order'
    },
    {
      from: OrderState.CANCELLED,
      to: OrderState.ARCHIVED,
      trigger: 'archive',
      conditions: [this.checkArchiveEligibility],
      actions: [this.archiveOrder, this.cleanupSensitiveData],
      guard: 'Order is eligible for archiving',
      description: 'Archive a cancelled order'
    }
  ]

  private static config: StateMachineConfig = {
    enableAutoTransitions: true,
    autoTransitionDelay: 1000,
    enableValidation: true,
    enableAuditLogging: true,
    enableCollaboration: true,
    maxRetries: 3,
    timeoutMs: 30000
  }

  static configure(config: Partial<StateMachineConfig>): void {
    this.config = { ...this.config, ...config }
  }

  static async transition(
    orderId: string,
    fromState: OrderState,
    toState: OrderState,
    trigger: string,
    context: Omit<TransitionContext, 'currentState' | 'targetState' | 'timestamp'>
  ): Promise<{ success: boolean; result?: StateValidationResult; error?: string }> {
    const fullContext: TransitionContext = {
      ...context,
      currentState: fromState,
      targetState: toState,
      timestamp: new Date()
    }

    try {
      // Find valid transition
      const transition = this.findValidTransition(fromState, toState, trigger)
      if (!transition) {
        return {
          success: false,
          error: `Invalid transition from ${fromState} to ${toState} via ${trigger}`
        }
      }

      // Validate transition conditions
      if (this.config.enableValidation) {
        const validation = await this.validateTransition(transition, fullContext)
        if (!validation.isValid) {
          return { success: false, result: validation }
        }
      }

      // Execute transition actions
      if (transition.actions) {
        for (const action of transition.actions) {
          await action(fullContext)
        }
      }

      // Log successful transition
      if (this.config.enableAuditLogging) {
        await this.logTransition(transition, fullContext, true)
      }

      return { success: true }

    } catch (error) {
      // Log failed transition
      if (this.config.enableAuditLogging) {
        await this.logTransition(
          this.findValidTransition(fromState, toState, trigger)!,
          fullContext,
          false,
          error instanceof Error ? error.message : 'Unknown error'
        )
      }

      return {
        success: false,
        error: error instanceof Error ? error.message : 'Transition failed'
      }
    }
  }

  private static findValidTransition(from: OrderState, to: OrderState, trigger: string): StateTransition | null {
    return this.TRANSITIONS.find(t => 
      t.from === from && t.to === to && t.trigger === trigger
    ) || null
  }

  private static async validateTransition(
    transition: StateTransition,
    context: TransitionContext
  ): Promise<StateValidationResult> {
    const errors: string[] = []
    const warnings: string[] = []
    const requiredActions: string[] = []

    // Check conditions
    if (transition.conditions) {
      for (const condition of transition.conditions) {
        try {
          const conditionResult = await condition(context)
          if (!conditionResult) {
            errors.push(`Condition failed: ${transition.guard}`)
          }
        } catch (error) {
          errors.push(`Condition error: ${error instanceof Error ? error.message : 'Unknown error'}`)
        }
      }
    }

    // Check timeout
    if (this.config.timeoutMs && this.config.timeoutMs > 0) {
      const age = Date.now() - context.timestamp.getTime()
      if (age > this.config.timeoutMs) {
        errors.push('Transition timeout exceeded')
      }
    }

    return {
      isValid: errors.length === 0,
      errors,
      warnings,
      requiredActions: requiredActions.length > 0 ? requiredActions : undefined
    }
  }

  // Transition conditions
  private static async validateOrderCreation(context: TransitionContext): Promise<boolean> {
    // Validate order data structure
    return context.metadata?.orderData !== undefined
  }

  private static async validateCancellation(context: TransitionContext): Promise<boolean> {
    // Orders can be cancelled unless they're being processed
    return context.currentState !== OrderState.PROCESSING
  }

  private static async validateRetrieval(context: TransitionContext): Promise<boolean> {
    // Check if user has retrieval permissions
    return context.metadata?.hasRetrievalPermission === true
  }

  private static async checkNotExpired(context: TransitionContext): Promise<boolean> {
    const expiryTime = context.metadata?.expiryTime
    return !expiryTime || new Date() < new Date(expiryTime)
  }

  private static async checkExpiry(context: TransitionContext): Promise<boolean> {
    const holdDuration = context.metadata?.holdDuration || 240 // 4 hours default
    const createdAt = context.metadata?.createdAt
    if (!createdAt) return false

    const expiryTime = new Date(createdAt).getTime() + (holdDuration * 60 * 1000)
    return Date.now() > expiryTime
  }

  private static async validateOrderData(context: TransitionContext): Promise<boolean> {
    // Validate order has required items and valid totals
    const orderData = context.metadata?.orderData
    return orderData?.items?.length > 0 && orderData?.total > 0
  }

  private static async checkBusinessRules(context: TransitionContext): Promise<boolean> {
    // Check business rules like quantity limits, payment validation
    return context.metadata?.businessRulesPassed === true
  }

  private static async validatePayment(context: TransitionContext): Promise<boolean> {
    // Validate payment information
    return context.metadata?.paymentValid === true
  }

  private static async checkPaymentSuccess(context: TransitionContext): Promise<boolean> {
    // Check if payment was successful
    return context.metadata?.paymentSuccess === true
  }

  private static async confirmInventory(context: TransitionContext): Promise<boolean> {
    // Confirm inventory availability
    return context.metadata?.inventoryConfirmed === true
  }

  private static async checkProcessingFailure(context: TransitionContext): Promise<boolean> {
    // Check if processing has failed
    return context.metadata?.processingFailed === true
  }

  private static async validateMerge(context: TransitionContext): Promise<boolean> {
    // Check if orders can be merged
    return context.metadata?.canMerge === true
  }

  private static async checkMergeCompatibility(context: TransitionContext): Promise<boolean> {
    // Check compatibility of orders to merge
    return context.metadata?.mergeCompatible === true
  }

  private static async validateSplit(context: TransitionContext): Promise<boolean> {
    // Check if merged order can be split
    return context.metadata?.canSplit === true
  }

  private static async checkArchiveEligibility(context: TransitionContext): Promise<boolean> {
    // Check if order is old enough and processed to be archived
    const completedAt = context.metadata?.completedAt
    if (!completedAt) return false

    const daysSinceCompletion = (Date.now() - new Date(completedAt).getTime()) / (1000 * 60 * 60 * 24)
    return daysSinceCompletion >= 30 // Archive after 30 days
  }

  private static async acquireEditLock(context: TransitionContext): Promise<boolean> {
    // Acquire exclusive edit lock
    return context.metadata?.lockAcquired === true
  }

  private static async checkUserPermissions(context: TransitionContext): Promise<boolean> {
    // Check if user has edit permissions
    return context.metadata?.hasEditPermission === true
  }

  // Transition actions
  private static async initializeHoldTimer(context: TransitionContext): Promise<void> {
    // Set up automatic expiry timer
    console.log(`Setting up hold timer for order ${context.orderId}`)
  }

  private static async notifyCollaborators(context: TransitionContext): Promise<void> {
    // Notify other users about the new order
    console.log(`Notifying collaborators about order ${context.orderId}`)
  }

  private static async stopHoldTimer(context: TransitionContext): Promise<void> {
    // Clear the hold expiry timer
    console.log(`Stopping hold timer for order ${context.orderId}`)
  }

  private static async cleanupResources(context: TransitionContext): Promise<void> {
    // Clean up temporary resources
    console.log(`Cleaning up resources for order ${context.orderId}`)
  }

  private static async releaseLocks(context: TransitionContext): Promise<void> {
    // Release any acquired locks
    console.log(`Releasing locks for order ${context.orderId}`)
  }

  private static async handleExpiration(context: TransitionContext): Promise<void> {
    // Handle order expiration
    console.log(`Handling expiration for order ${context.orderId}`)
  }

  private static async notifyStakeholders(context: TransitionContext): Promise<void> {
    // Notify stakeholders about expiration
    console.log(`Notifying stakeholders about expiration of order ${context.orderId}`)
  }

  private static async initializeEditSession(context: TransitionContext): Promise<void> {
    // Initialize editing session
    console.log(`Initializing edit session for order ${context.orderId}`)
  }

  private static async notifyCollaboration(context: TransitionContext): Promise<void> {
    // Notify about collaboration start
    console.log(`Notifying collaboration for order ${context.orderId}`)
  }

  private static async runBusinessRules(context: TransitionContext): Promise<void> {
    // Run business rule validation
    console.log(`Running business rules for order ${context.orderId}`)
  }

  private static async reserveInventory(context: TransitionContext): Promise<void> {
    // Reserve inventory for the order
    console.log(`Reserving inventory for order ${context.orderId}`)
  }

  private static async processPayment(context: TransitionContext): Promise<void> {
    // Process payment
    console.log(`Processing payment for order ${context.orderId}`)
  }

  private static async notifyValidationFailure(context: TransitionContext): Promise<void> {
    // Notify about validation failure
    console.log(`Notifying validation failure for order ${context.orderId}`)
  }

  private static async checkPaymentSuccessAction(context: TransitionContext): Promise<boolean> {
    // Check payment success
    return context.metadata?.paymentSuccess === true
  }

  private static async confirmInventoryAction(context: TransitionContext): Promise<boolean> {
    // Confirm inventory
    return context.metadata?.inventoryConfirmed === true
  }

  private static async finalizeOrder(context: TransitionContext): Promise<void> {
    // Finalize the order
    console.log(`Finalizing order ${context.orderId}`)
  }

  private static async generateReceipt(context: TransitionContext): Promise<void> {
    // Generate receipt
    console.log(`Generating receipt for order ${context.orderId}`)
  }

  private static async rollbackInventory(context: TransitionContext): Promise<void> {
    // Rollback inventory reservation
    console.log(`Rolling back inventory for order ${context.orderId}`)
  }

  private static async refundPayment(context: TransitionContext): Promise<void> {
    // Process refund
    console.log(`Processing refund for order ${context.orderId}`)
  }

  private static async notifyFailure(context: TransitionContext): Promise<void> {
    // Notify about processing failure
    console.log(`Notifying failure for order ${context.orderId}`)
  }

  private static async performMerge(context: TransitionContext): Promise<void> {
    // Perform order merge
    console.log(`Performing merge for order ${context.orderId}`)
  }

  private static async resolveConflicts(context: TransitionContext): Promise<void> {
    // Resolve merge conflicts
    console.log(`Resolving conflicts for order ${context.orderId}`)
  }

  private static async performSplit(context: TransitionContext): Promise<void> {
    // Split merged order
    console.log(`Performing split for order ${context.orderId}`)
  }

  private static async archiveOrder(context: TransitionContext): Promise<void> {
    // Archive the order
    console.log(`Archiving order ${context.orderId}`)
  }

  private static async cleanupSensitiveData(context: TransitionContext): Promise<void> {
    // Clean up sensitive data before archiving
    console.log(`Cleaning sensitive data for order ${context.orderId}`)
  }

  private static async logTransition(
    transition: StateTransition,
    context: TransitionContext,
    success: boolean,
    error?: string
  ): Promise<void> {
    // Log transition for audit purposes
    const logEntry = {
      orderId: context.orderId,
      transition: `${transition.from} -> ${transition.to}`,
      trigger: transition.trigger,
      userId: context.userId,
      timestamp: context.timestamp,
      success,
      error
    }
    
    console.log('State transition logged:', logEntry)
  }

  static getValidTransitions(fromState: OrderState): StateTransition[] {
    return this.TRANSITIONS.filter(t => t.from === fromState)
  }

  static getTransition(fromState: OrderState, toState: OrderState, trigger: string): StateTransition | null {
    return this.findValidTransition(fromState, toState, trigger)
  }

  static isValidTransition(fromState: OrderState, toState: OrderState): boolean {
    return this.TRANSITIONS.some(t => t.from === fromState && t.to === toState)
  }

  static getStateDescription(state: OrderState): string {
    const descriptions: Record<OrderState, string> = {
      [OrderState.NEW]: 'Order created but not yet held',
      [OrderState.HELD]: 'Order is on hold and waiting to be retrieved',
      [OrderState.RECALLED]: 'Order has been recalled from hold',
      [OrderState.EDITING]: 'Order is being edited',
      [OrderState.VALIDATING]: 'Order is being validated',
      [OrderState.PROCESSING]: 'Order is being processed',
      [OrderState.COMPLETED]: 'Order has been completed successfully',
      [OrderState.CANCELLED]: 'Order has been cancelled',
      [OrderState.EXPIRED]: 'Order has expired',
      [OrderState.MERGED]: 'Order has been merged with another order',
      [OrderState.ARCHIVED]: 'Order has been archived'
    }
    return descriptions[state] || 'Unknown state'
  }
}

// Export utility functions
export const OrderStateUtils = {
  isActiveState: (state: OrderState): boolean => {
    return [OrderState.NEW, OrderState.HELD, OrderState.RECALLED, OrderState.EDITING, OrderState.VALIDATING, OrderState.PROCESSING].includes(state)
  },

  isFinalState: (state: OrderState): boolean => {
    return [OrderState.COMPLETED, OrderState.CANCELLED, OrderState.EXPIRED, OrderState.ARCHIVED].includes(state)
  },

  canTransitionTo: (from: OrderState, to: OrderState): boolean => {
    return OrderStateMachine.isValidTransition(from, to)
  },

  getNextStates: (from: OrderState): OrderState[] => {
    return OrderStateMachine.getValidTransitions(from).map(t => t.to)
  },

  getPreviousStates: (to: OrderState): OrderState[] => {
    return OrderStateMachine.TRANSITIONS.filter(t => t.to === to).map(t => t.from)
  }
}