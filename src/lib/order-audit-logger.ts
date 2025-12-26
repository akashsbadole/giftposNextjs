// Comprehensive Audit Logging System for Order Management
// Advanced audit logging with security tracking, compliance, and operational insights

export enum AuditEventType {
  // Order lifecycle events
  ORDER_CREATED = 'order_created',
  ORDER_UPDATED = 'order_updated',
  ORDER_RETRIEVED = 'order_retrieved',
  ORDER_COMPLETED = 'order_completed',
  ORDER_CANCELLED = 'order_cancelled',
  ORDER_EXPIRED = 'order_expired',
  ORDER_MERGED = 'order_merged',
  ORDER_SPLIT = 'order_split',
  ORDER_ARCHIVED = 'order_archived',

  // State transition events
  STATE_TRANSITION = 'state_transition',
  VALIDATION_STARTED = 'validation_started',
  VALIDATION_COMPLETED = 'validation_completed',
  VALIDATION_FAILED = 'validation_failed',

  // Collaboration events
  SESSION_CREATED = 'session_created',
  SESSION_ENDED = 'session_ended',
  LOCK_ACQUIRED = 'lock_acquired',
  LOCK_RELEASED = 'lock_released',
  CONFLICT_DETECTED = 'conflict_detected',
  CONFLICT_RESOLVED = 'conflict_resolved',

  // Performance events
  PERFORMANCE_ISSUE = 'performance_issue',
  CACHE_HIT = 'cache_hit',
  CACHE_MISS = 'cache_miss',
  SLOW_QUERY = 'slow_query',
  JOB_STARTED = 'job_started',
  JOB_COMPLETED = 'job_completed',
  JOB_FAILED = 'job_failed',

  // Security events
  UNAUTHORIZED_ACCESS = 'unauthorized_access',
  PERMISSION_DENIED = 'permission_denied',
  DATA_ACCESS = 'data_access',
  SENSITIVE_DATA_EXPORT = 'sensitive_data_export',

  // Bulk operations
  BULK_OPERATION_STARTED = 'bulk_operation_started',
  BULK_OPERATION_COMPLETED = 'bulk_operation_completed',
  BULK_OPERATION_FAILED = 'bulk_operation_failed',

  // System events
  SYSTEM_ERROR = 'system_error',
  CONFIGURATION_CHANGED = 'configuration_changed',
  MAINTENANCE_STARTED = 'maintenance_started',
  BACKUP_CREATED = 'backup_created'
}

export enum AuditSeverity {
  LOW = 'low',
  MEDIUM = 'medium',
  HIGH = 'high',
  CRITICAL = 'critical'
}

export enum AuditCategory {
  SECURITY = 'security',
  COMPLIANCE = 'compliance',
  OPERATIONS = 'operations',
  PERFORMANCE = 'performance',
  BUSINESS = 'business',
  ERROR = 'error'
}

export interface AuditEvent {
  id: string
  eventType: AuditEventType
  category: AuditCategory
  severity: AuditSeverity
  timestamp: Date
  source: 'frontend' | 'backend' | 'api' | 'worker' | 'system'
  environment: 'development' | 'staging' | 'production'

  // User context
  userId?: string
  userEmail?: string
  userName?: string
  userRole?: string
  sessionId?: string

  // Resource context
  resourceId?: string
  resourceType?: string
  storeId?: string
  orderId?: string

  // Event details
  description: string
  details?: Record<string, any>
  metadata?: Record<string, any>

  // Technical details
  ipAddress?: string
  userAgent?: string
  correlationId?: string
  requestId?: string

  // Results
  success: boolean
  errorMessage?: string
  duration?: number
  memoryUsage?: number

  // Compliance and retention
  retentionPeriod: number // days
  tags?: string[]
  immutable: boolean // Cannot be modified or deleted
}

export interface AuditQuery {
  eventTypes?: AuditEventType[]
  categories?: AuditCategory[]
  severities?: AuditSeverity[]
  userIds?: string[]
  resourceIds?: string[]
  storeIds?: string[]
  timeRange?: {
    start: Date
    end: Date
  }
  searchText?: string
  success?: boolean
  limit?: number
  offset?: number
  sortBy?: 'timestamp' | 'severity' | 'eventType'
  sortOrder?: 'asc' | 'desc'
}

export interface AuditReport {
  totalEvents: number
  timeRange: { start: Date; end: Date }
  eventsByType: Record<AuditEventType, number>
  eventsByCategory: Record<AuditCategory, number>
  eventsBySeverity: Record<AuditSeverity, number>
  eventsByUser: Record<string, number>
  eventsByStore: Record<string, number>
  topUsers: Array<{ userId: string; count: number }>
  errorRate: number
  averageDuration: number
  slowEvents: AuditEvent[]
  securityEvents: AuditEvent[]
  recommendations: string[]
  generatedAt: Date
}

export interface AuditConfig {
  enabled: boolean
  retentionPeriodDays: number
  enableRealTimeProcessing: boolean
  enableBatchProcessing: boolean
  batchSize: number
  batchIntervalMs: number
  enableCompression: boolean
  enableEncryption: boolean
  enableRealTimeAlerts: boolean
  alertThresholds: {
    errorRate: number
    securityEvents: number
    performanceIssues: number
  }
  enableCompliance: boolean
  enableGDPRCompliance: boolean
  enableSOXCompliance: boolean
  maxEventsPerDay: number
  enableSampling: boolean
  samplingRate: number // 0.0 to 1.0
}

export class OrderAuditLogger {
  private static config: AuditConfig = {
    enabled: true,
    retentionPeriodDays: 2555, // 7 years for compliance
    enableRealTimeProcessing: true,
    enableBatchProcessing: true,
    batchSize: 100,
    batchIntervalMs: 5000, // 5 seconds
    enableCompression: true,
    enableEncryption: true,
    enableRealTimeAlerts: true,
    alertThresholds: {
      errorRate: 0.05, // 5%
      securityEvents: 10,
      performanceIssues: 50
    },
    enableCompliance: true,
    enableGDPRCompliance: true,
    enableSOXCompliance: true,
    maxEventsPerDay: 100000,
    enableSampling: false,
    samplingRate: 0.1
  }

  private static eventQueue: AuditEvent[] = []
  private static batchTimer?: NodeJS.Timeout
  private static eventCount = new Map<string, number>() // Date -> count
  private static recentEvents: AuditEvent[] = [] // Ring buffer for recent events
  private static maxRecentEvents = 1000

  static configure(config: Partial<AuditConfig>): void {
    this.config = { ...this.config, ...config }
  }

  // Main logging methods
  static async log(event: Omit<AuditEvent, 'id' | 'timestamp' | 'environment'>): Promise<string> {
    if (!this.config.enabled) return ''

    // Apply sampling if enabled
    if (this.config.enableSampling && Math.random() > this.config.samplingRate) {
      return ''
    }

    // Check daily limits
    const today = new Date().toISOString().split('T')[0]
    const todayCount = this.eventCount.get(today) || 0
    
    if (todayCount >= this.config.maxEventsPerDay) {
      console.warn('Daily audit event limit exceeded')
      return ''
    }

    const auditEvent: AuditEvent = {
      ...event,
      id: this.generateEventId(),
      timestamp: new Date(),
      environment: this.getEnvironment()
    }

    // Add to recent events buffer
    this.recentEvents.push(auditEvent)
    if (this.recentEvents.length > this.maxRecentEvents) {
      this.recentEvents.shift()
    }

    // Update daily count
    this.eventCount.set(today, todayCount + 1)

    // Process event
    if (this.config.enableRealTimeProcessing) {
      this.processEvent(auditEvent)
    }

    if (this.config.enableBatchProcessing) {
      this.queueEvent(auditEvent)
    }

    return auditEvent.id
  }

  // Convenience methods for common events
  static async logOrderCreated(
    orderId: string,
    context: { userId: string; userName: string; userEmail?: string; storeId: string }
  ): Promise<string> {
    return this.log({
      eventType: AuditEventType.ORDER_CREATED,
      category: AuditCategory.BUSINESS,
      severity: AuditSeverity.LOW,
      source: 'backend',
      userId: context.userId,
      userName: context.userName,
      userEmail: context.userEmail,
      storeId: context.storeId,
      resourceId: orderId,
      resourceType: 'order',
      description: `Order ${orderId} was created by ${context.userName}`,
      details: { orderId },
      success: true
    })
  }

  static async logStateTransition(
    orderId: string,
    fromState: string,
    toState: string,
    trigger: string,
    context: { userId: string; userName: string; storeId: string }
  ): Promise<string> {
    return this.log({
      eventType: AuditEventType.STATE_TRANSITION,
      category: AuditCategory.BUSINESS,
      severity: AuditSeverity.MEDIUM,
      source: 'backend',
      userId: context.userId,
      userName: context.userName,
      storeId: context.storeId,
      resourceId: orderId,
      resourceType: 'order',
      description: `Order ${orderId} transitioned from ${fromState} to ${toState} via ${trigger}`,
      details: { fromState, toState, trigger, orderId },
      success: true
    })
  }

  static async logValidation(
    orderId: string,
    validationResult: any,
    context: { userId: string; userName: string; storeId: string }
  ): Promise<string> {
    const eventType = validationResult.isValid 
      ? AuditEventType.VALIDATION_COMPLETED 
      : AuditEventType.VALIDATION_FAILED

    return this.log({
      eventType,
      category: AuditCategory.COMPLIANCE,
      severity: validationResult.isValid ? AuditSeverity.LOW : AuditSeverity.HIGH,
      source: 'backend',
      userId: context.userId,
      userName: context.userName,
      storeId: context.storeId,
      resourceId: orderId,
      resourceType: 'order',
      description: `Order ${orderId} validation ${validationResult.isValid ? 'passed' : 'failed'}`,
      details: { orderId, validationResult },
      success: validationResult.isValid,
      errorMessage: validationResult.isValid ? undefined : 'Validation failed'
    })
  }

  static async logCollaborationEvent(
    eventType: AuditEventType,
    orderId: string,
    sessionId: string,
    context: { userId: string; userName: string; storeId: string },
    details?: Record<string, any>
  ): Promise<string> {
    return this.log({
      eventType,
      category: AuditCategory.SECURITY,
      severity: AuditSeverity.MEDIUM,
      source: 'backend',
      userId: context.userId,
      userName: context.userName,
      storeId: context.storeId,
      resourceId: orderId,
      resourceType: 'order',
      sessionId,
      description: `Collaboration event: ${eventType} for order ${orderId} by ${context.userName}`,
      details: { orderId, sessionId, ...details },
      success: true
    })
  }

  static async logSecurityEvent(
    eventType: AuditEventType,
    description: string,
    context: { userId?: string; userEmail?: string; ipAddress?: string; userAgent?: string },
    severity: AuditSeverity = AuditSeverity.HIGH
  ): Promise<string> {
    return this.log({
      eventType,
      category: AuditCategory.SECURITY,
      severity,
      source: 'backend',
      userId: context.userId,
      userEmail: context.userEmail,
      description,
      details: { userId: context.userId, userEmail: context.userEmail },
      ipAddress: context.ipAddress,
      userAgent: context.userAgent,
      success: false,
      errorMessage: 'Security event detected'
    })
  }

  static async logPerformanceIssue(
    operation: string,
    duration: number,
    threshold: number,
    context: { userId?: string; storeId?: string; orderId?: string }
  ): Promise<string> {
    return this.log({
      eventType: AuditEventType.PERFORMANCE_ISSUE,
      category: AuditCategory.PERFORMANCE,
      severity: duration > threshold * 2 ? AuditSeverity.HIGH : AuditSeverity.MEDIUM,
      source: 'backend',
      userId: context.userId,
      storeId: context.storeId,
      resourceId: context.orderId,
      resourceType: 'order',
      description: `Performance issue: ${operation} took ${duration}ms (threshold: ${threshold}ms)`,
      details: { operation, duration, threshold },
      duration,
      success: false,
      errorMessage: 'Performance threshold exceeded'
    })
  }

  static async logBulkOperation(
    operation: string,
    orderIds: string[],
    result: { successCount: number; failureCount: number },
    context: { userId: string; userName: string; storeId: string }
  ): Promise<string> {
    const eventType = result.failureCount === 0 
      ? AuditEventType.BULK_OPERATION_COMPLETED
      : AuditEventType.BULK_OPERATION_FAILED

    return this.log({
      eventType,
      category: AuditCategory.OPERATIONS,
      severity: result.failureCount === 0 ? AuditSeverity.LOW : AuditSeverity.HIGH,
      source: 'backend',
      userId: context.userId,
      userName: context.userName,
      storeId: context.storeId,
      description: `Bulk ${operation} processed ${orderIds.length} orders: ${result.successCount} successful, ${result.failureCount} failed`,
      details: { operation, orderIds, ...result },
      success: result.failureCount === 0,
      errorMessage: result.failureCount > 0 ? `${result.failureCount} orders failed` : undefined
    })
  }

  static async logError(
    error: Error,
    context: { 
      userId?: string; 
      storeId?: string; 
      orderId?: string; 
      operation?: string; 
      correlationId?: string 
    }
  ): Promise<string> {
    return this.log({
      eventType: AuditEventType.SYSTEM_ERROR,
      category: AuditCategory.ERROR,
      severity: this.determineErrorSeverity(error),
      source: 'backend',
      userId: context.userId,
      storeId: context.storeId,
      resourceId: context.orderId,
      resourceType: 'order',
      correlationId: context.correlationId,
      description: `System error in ${context.operation || 'unknown operation'}: ${error.message}`,
      details: { 
        error: error.message, 
        stack: error.stack, 
        operation: context.operation,
        ...context 
      },
      success: false,
      errorMessage: error.message
    })
  }

  // Query and reporting methods
  static async query(query: AuditQuery): Promise<{ events: AuditEvent[]; total: number }> {
    // In a real implementation, this would query a database
    // For now, we'll filter from the recent events buffer
    let filteredEvents = [...this.recentEvents]

    // Apply filters
    if (query.eventTypes?.length) {
      filteredEvents = filteredEvents.filter(e => query.eventTypes!.includes(e.eventType))
    }

    if (query.categories?.length) {
      filteredEvents = filteredEvents.filter(e => query.categories!.includes(e.category))
    }

    if (query.severities?.length) {
      filteredEvents = filteredEvents.filter(e => query.severities!.includes(e.severity))
    }

    if (query.userIds?.length) {
      filteredEvents = filteredEvents.filter(e => e.userId && query.userIds!.includes(e.userId))
    }

    if (query.storeIds?.length) {
      filteredEvents = filteredEvents.filter(e => e.storeId && query.storeIds!.includes(e.storeId))
    }

    if (query.timeRange) {
      filteredEvents = filteredEvents.filter(e => 
        e.timestamp >= query.timeRange!.start && e.timestamp <= query.timeRange!.end
      )
    }

    if (query.searchText) {
      const searchLower = query.searchText.toLowerCase()
      filteredEvents = filteredEvents.filter(e => 
        e.description.toLowerCase().includes(searchLower) ||
        e.details?.toString().toLowerCase().includes(searchLower)
      )
    }

    if (query.success !== undefined) {
      filteredEvents = filteredEvents.filter(e => e.success === query.success)
    }

    // Sort
    const sortBy = query.sortBy || 'timestamp'
    const sortOrder = query.sortOrder || 'desc'
    
    filteredEvents.sort((a, b) => {
      let comparison = 0
      
      switch (sortBy) {
        case 'timestamp':
          comparison = a.timestamp.getTime() - b.timestamp.getTime()
          break
        case 'severity':
          const severityOrder = { low: 1, medium: 2, high: 3, critical: 4 }
          comparison = severityOrder[a.severity] - severityOrder[b.severity]
          break
        case 'eventType':
          comparison = a.eventType.localeCompare(b.eventType)
          break
      }
      
      return sortOrder === 'asc' ? comparison : -comparison
    })

    // Pagination
    const offset = query.offset || 0
    const limit = query.limit || 100
    const paginatedEvents = filteredEvents.slice(offset, offset + limit)

    return {
      events: paginatedEvents,
      total: filteredEvents.length
    }
  }

  static async generateReport(query: AuditQuery): Promise<AuditReport> {
    const { events } = await this.query({
      ...query,
      limit: undefined, // Get all events for analysis
      offset: 0
    })

    const timeRange = query.timeRange || {
      start: new Date(Date.now() - 24 * 60 * 60 * 1000), // Last 24 hours
      end: new Date()
    }

    // Aggregate statistics
    const eventsByType = events.reduce((acc, event) => {
      acc[event.eventType] = (acc[event.eventType] || 0) + 1
      return acc
    }, {} as Record<AuditEventType, number>)

    const eventsByCategory = events.reduce((acc, event) => {
      acc[event.category] = (acc[event.category] || 0) + 1
      return acc
    }, {} as Record<AuditCategory, number>)

    const eventsBySeverity = events.reduce((acc, event) => {
      acc[event.severity] = (acc[event.severity] || 0) + 1
      return acc
    }, {} as Record<AuditSeverity, number>)

    const eventsByUser = events.reduce((acc, event) => {
      if (event.userId) {
        acc[event.userId] = (acc[event.userId] || 0) + 1
      }
      return acc
    }, {} as Record<string, number>)

    const eventsByStore = events.reduce((acc, event) => {
      if (event.storeId) {
        acc[event.storeId] = (acc[event.storeId] || 0) + 1
      }
      return acc
    }, {} as Record<string, number>)

    // Top users
    const topUsers = Object.entries(eventsByUser)
      .map(([userId, count]) => ({ userId, count }))
      .sort((a, b) => b.count - a.count)
      .slice(0, 10)

    // Calculate metrics
    const totalEvents = events.length
    const errorEvents = events.filter(e => !e.success)
    const errorRate = totalEvents > 0 ? errorEvents.length / totalEvents : 0
    
    const eventsWithDuration = events.filter(e => e.duration)
    const averageDuration = eventsWithDuration.length > 0
      ? eventsWithDuration.reduce((sum, e) => sum + (e.duration || 0), 0) / eventsWithDuration.length
      : 0

    // Identify slow events (top 10% by duration)
    const sortedByDuration = eventsWithDuration.sort((a, b) => (b.duration || 0) - (a.duration || 0))
    const slowEvents = sortedByDuration.slice(0, Math.ceil(sortedByDuration.length * 0.1))

    // Security events
    const securityEvents = events.filter(e => e.category === AuditCategory.SECURITY)

    // Generate recommendations
    const recommendations = this.generateRecommendations({
      errorRate,
      securityEventsCount: securityEvents.length,
      slowEventsCount: slowEvents.length,
      totalEvents,
      eventsByCategory,
      eventsBySeverity
    })

    return {
      totalEvents,
      timeRange,
      eventsByType,
      eventsByCategory,
      eventsBySeverity,
      eventsByUser,
      eventsByStore,
      topUsers,
      errorRate,
      averageDuration,
      slowEvents,
      securityEvents,
      recommendations,
      generatedAt: new Date()
    }
  }

  // Private methods
  private static generateEventId(): string {
    return `audit_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`
  }

  private static getEnvironment(): 'development' | 'staging' | 'production' {
    if (typeof process !== 'undefined' && process.env) {
      const nodeEnv = process.env.NODE_ENV || 'development'
      if (nodeEnv === 'production') return 'production'
      if (nodeEnv === 'staging') return 'staging'
    }
    return 'development'
  }

  private static processEvent(event: AuditEvent): void {
    // Real-time processing
    this.checkAlerts(event)
    this.processCompliance(event)
    this.updateMetrics(event)
  }

  private static queueEvent(event: AuditEvent): void {
    this.eventQueue.push(event)

    if (this.eventQueue.length >= this.config.batchSize) {
      this.flushBatch()
    } else {
      this.scheduleBatchFlush()
    }
  }

  private static scheduleBatchFlush(): void {
    if (this.batchTimer) return

    this.batchTimer = setTimeout(() => {
      this.flushBatch()
    }, this.config.batchIntervalMs)
  }

  private static flushBatch(): void {
    if (this.eventQueue.length === 0) return

    const batch = [...this.eventQueue]
    this.eventQueue = []

    if (this.batchTimer) {
      clearTimeout(this.batchTimer)
      this.batchTimer = undefined
    }

    // In a real implementation, this would write to a database or file
    console.log(`Flushing audit batch of ${batch.length} events`)

    // Simulate database write
    batch.forEach(event => {
      // This would be persisted to a database
      console.log(`Audit event: ${event.eventType} - ${event.description}`)
    })
  }

  private static checkAlerts(event: AuditEvent): void {
    if (!this.config.enableRealTimeAlerts) return

    // Check for high severity events
    if (event.severity === AuditSeverity.CRITICAL) {
      this.triggerAlert('Critical audit event detected', event)
    }

    // Check for security events
    if (event.category === AuditCategory.SECURITY) {
      this.triggerAlert('Security event detected', event)
    }

    // Check for performance issues
    if (event.eventType === AuditEventType.PERFORMANCE_ISSUE) {
      this.triggerAlert('Performance issue detected', event)
    }
  }

  private static triggerAlert(message: string, event: AuditEvent): void {
    // In a real implementation, this would send alerts via email, Slack, etc.
    console.warn(`ALERT: ${message}`, {
      eventId: event.id,
      eventType: event.eventType,
      severity: event.severity,
      userId: event.userId,
      timestamp: event.timestamp
    })
  }

  private static processCompliance(event: AuditEvent): void {
    if (!this.config.enableCompliance) return

    // GDPR compliance - ensure PII is handled properly
    if (this.config.enableGDPRCompliance) {
      this.handleGDPRCompliance(event)
    }

    // SOX compliance - ensure financial data is tracked
    if (this.config.enableSOXCompliance) {
      this.handleSOXCompliance(event)
    }
  }

  private static handleGDPRCompliance(event: AuditEvent): void {
    // Mark events containing personal data
    if (event.userEmail || event.userName) {
      event.tags = [...(event.tags || []), 'pii', 'gdpr']
      event.retentionPeriod = Math.min(event.retentionPeriod, 2555) // 7 years max
    }
  }

  private static handleSOXCompliance(event: AuditEvent): void {
    // Mark financial events for SOX compliance
    if (event.eventType.includes('order') && event.eventType !== 'order_created') {
      event.tags = [...(event.tags || []), 'financial', 'sox']
      event.immutable = true
    }
  }

  private static updateMetrics(event: AuditEvent): void {
    // Update real-time metrics for monitoring
    // This would integrate with monitoring systems like Prometheus, Grafana, etc.
  }

  private static determineErrorSeverity(error: Error): AuditSeverity {
    const message = error.message.toLowerCase()
    
    if (message.includes('critical') || message.includes('fatal')) {
      return AuditSeverity.CRITICAL
    }
    
    if (message.includes('security') || message.includes('unauthorized')) {
      return AuditSeverity.HIGH
    }
    
    if (message.includes('warning') || message.includes('deprecated')) {
      return AuditSeverity.MEDIUM
    }
    
    return AuditSeverity.LOW
  }

  private static generateRecommendations(report: any): string[] {
    const recommendations: string[] = []

    // Error rate recommendations
    if (report.errorRate > this.config.alertThresholds.errorRate) {
      recommendations.push(`High error rate detected (${(report.errorRate * 100).toFixed(1)}%). Investigate root causes.`)
    }

    // Security recommendations
    if (report.securityEventsCount > this.config.alertThresholds.securityEvents) {
      recommendations.push(`High number of security events (${report.securityEventsCount}). Review security posture.`)
    }

    // Performance recommendations
    if (report.slowEventsCount > this.config.alertThresholds.performanceIssues) {
      recommendations.push(`Performance issues detected (${report.slowEventsCount} slow events). Consider optimization.`)
    }

    // Category-based recommendations
    if ((report.eventsByCategory.security || 0) > (report.eventsByCategory.business || 0) * 0.1) {
      recommendations.push('Security events are high relative to business events. Review access controls.')
    }

    if (recommendations.length === 0) {
      recommendations.push('Audit metrics look healthy. No immediate action required.')
    }

    return recommendations
  }

  // Cleanup and maintenance
  static cleanup(): void {
    // Flush any pending events
    this.flushBatch()

    // Clean up old events from memory
    const cutoff = new Date(Date.now() - this.config.retentionPeriodDays * 24 * 60 * 60 * 1000)
    this.recentEvents = this.recentEvents.filter(e => e.timestamp > cutoff)
  }

  static destroy(): void {
    // Clean up timers
    if (this.batchTimer) {
      clearTimeout(this.batchTimer)
    }

    // Final flush
    this.flushBatch()

    // Clear data structures
    this.eventQueue = []
    this.recentEvents = []
    this.eventCount.clear()
  }

  // Statistics and monitoring
  static getStats(): {
    recentEventsCount: number
    queuedEventsCount: number
    todayEventCount: number
    config: AuditConfig
  } {
    const today = new Date().toISOString().split('T')[0]
    
    return {
      recentEventsCount: this.recentEvents.length,
      queuedEventsCount: this.eventQueue.length,
      todayEventCount: this.eventCount.get(today) || 0,
      config: { ...this.config }
    }
  }
}

// Export utility functions
export const AuditUtils = {
  isSecurityEvent: (event: AuditEvent): boolean => {
    return event.category === AuditCategory.SECURITY
  },

  isComplianceEvent: (event: AuditEvent): boolean => {
    return event.category === AuditCategory.COMPLIANCE || 
           (event.tags && event.tags.includes('gdpr')) ||
           (event.tags && event.tags.includes('sox'))
  },

  getEventSeverity: (event: AuditEvent): AuditSeverity => {
    return event.severity
  },

  shouldAlert: (event: AuditEvent, thresholds: AuditConfig['alertThresholds']): boolean => {
    if (event.severity === AuditSeverity.CRITICAL) return true
    if (event.category === AuditCategory.SECURITY) return true
    if (event.eventType === AuditEventType.PERFORMANCE_ISSUE) return true
    return false
  }
}