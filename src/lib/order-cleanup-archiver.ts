// Automatic Cleanup and Archiving System for Order Management
// Comprehensive system for automated data lifecycle management with intelligent archiving

import { OrderState } from './order-state-machine'
import { OrderPerformanceOptimizer, JobPriority, OrderBackgroundJobs } from './order-performance-optimizer'
import { OrderAuditLogger, AuditEventType, AuditSeverity } from './order-audit-logger'

export enum CleanupType {
  EXPIRED_ORDERS = 'expired_orders',
  COMPLETED_ORDERS = 'completed_orders',
  FAILED_OPERATIONS = 'failed_operations',
  TEMPORARY_DATA = 'temporary_data',
  CACHE_CLEANUP = 'cache_cleanup',
  LOG_ROTATION = 'log_rotation',
  ANALYTICS_CLEANUP = 'analytics_cleanup',
  SESSION_CLEANUP = 'session_cleanup',
  LOCK_CLEANUP = 'lock_cleanup'
}

export enum ArchiveStatus {
  PENDING = 'pending',
  ARCHIVING = 'archiving',
  COMPLETED = 'completed',
  FAILED = 'failed',
  PARTIAL = 'partial'
}

export enum ArchiveDestination {
  COLD_STORAGE = 'cold_storage',
  EXTERNAL_BACKUP = 'external_backup',
  COMPRESSED_ARCHIVE = 'compressed_archive',
  DATABASE_ARCHIVE = 'database_archive'
}

export interface CleanupRule {
  id: string
  name: string
  type: CleanupType
  enabled: boolean
  schedule: string // Cron expression
  conditions: CleanupCondition[]
  actions: CleanupAction[]
  priority: JobPriority
  maxExecutionTime: number // milliseconds
  batchSize: number
  dryRun: boolean
  metadata?: Record<string, any>
}

export interface CleanupCondition {
  field: string
  operator: 'equals' | 'greater_than' | 'less_than' | 'contains' | 'in' | 'not_in'
  value: any
  logicalOperator?: 'AND' | 'OR'
}

export interface CleanupAction {
  type: 'delete' | 'archive' | 'compress' | 'move' | 'notify' | 'export'
  parameters: Record<string, any>
  continueOnError: boolean
}

export interface ArchiveJob {
  jobId: string
  archiveId: string
  type: CleanupType
  status: ArchiveStatus
  sourceCount: number
  archivedCount: number
  failedCount: number
  startTime: Date
  endTime?: Date
  destination: ArchiveDestination
  destinationPath?: string
  compressedSize?: number
  originalSize?: number
  compressionRatio?: number
  error?: string
  metadata?: Record<string, any>
}

export interface ArchiveReport {
  totalJobs: number
  successfulJobs: number
  failedJobs: number
  totalItemsProcessed: number
  totalSpaceFreed: number
  totalSpaceArchived: number
  averageExecutionTime: number
  jobsByType: Record<CleanupType, number>
  jobsByStatus: Record<ArchiveStatus, number>
  errors: Array<{ jobId: string; error: string; timestamp: Date }>
  recommendations: string[]
  generatedAt: Date
}

export interface CleanupConfig {
  enabled: boolean
  schedule: {
    cleanupIntervalHours: number
    archiveIntervalHours: number
    maintenanceWindowStart: string // HH:mm format
    maintenanceWindowEnd: string // HH:mm format
  }
  retention: {
    completedOrdersDays: number
    cancelledOrdersDays: number
    expiredOrdersDays: number
    failedOperationsDays: number
    temporaryDataHours: number
    logsDays: number
    analyticsDays: number
    sessionsHours: number
  }
  limits: {
    maxCleanupJobsPerDay: number
    maxArchiveJobsPerDay: number
    maxItemsPerJob: number
    maxExecutionTimeMinutes: number
  }
  destinations: {
    primary: ArchiveDestination
    secondary?: ArchiveDestination
    compressionEnabled: boolean
    encryptionEnabled: boolean
  }
  notifications: {
    enableAlerts: boolean
    alertThresholds: {
      failureRate: number
      executionTime: number
      spaceUsage: number
    }
  }
}

export class OrderCleanupArchiver {
  private static config: CleanupConfig = {
    enabled: true,
    schedule: {
      cleanupIntervalHours: 6,
      archiveIntervalHours: 24,
      maintenanceWindowStart: '02:00',
      maintenanceWindowEnd: '04:00'
    },
    retention: {
      completedOrdersDays: 365,
      cancelledOrdersDays: 90,
      expiredOrdersDays: 30,
      failedOperationsDays: 7,
      temporaryDataHours: 24,
      logsDays: 90,
      analyticsDays: 180,
      sessionsHours: 2
    },
    limits: {
      maxCleanupJobsPerDay: 100,
      maxArchiveJobsPerDay: 50,
      maxItemsPerJob: 1000,
      maxExecutionTimeMinutes: 120
    },
    destinations: {
      primary: ArchiveDestination.COMPRESSED_ARCHIVE,
      compressionEnabled: true,
      encryptionEnabled: true
    },
    notifications: {
      enableAlerts: true,
      alertThresholds: {
        failureRate: 0.1, // 10%
        executionTime: 3600000, // 1 hour
        spaceUsage: 0.8 // 80%
      }
    }
  }

  private static cleanupRules = new Map<string, CleanupRule>()
  private static activeJobs = new Map<string, ArchiveJob>()
  private static jobHistory: ArchiveJob[] = []
  private static jobMetrics = {
    totalJobs: 0,
    successfulJobs: 0,
    failedJobs: 0,
    totalExecutionTime: 0
  }

  static configure(config: Partial<CleanupConfig>): void {
    this.config = { ...this.config, ...config }
  }

  // Rule Management
  static addCleanupRule(rule: CleanupRule): void {
    this.cleanupRules.set(rule.id, rule)
  }

  static removeCleanupRule(ruleId: string): void {
    this.cleanupRules.delete(ruleId)
  }

  static getCleanupRule(ruleId: string): CleanupRule | undefined {
    return this.cleanupRules.get(ruleId)
  }

  static getAllCleanupRules(): CleanupRule[] {
    return Array.from(this.cleanupRules.values())
  }

  // Main Execution Methods
  static async executeCleanup(
    type: CleanupType,
    context: { storeId?: string; userId?: string } = {}
  ): Promise<ArchiveJob> {
    const jobId = this.generateJobId()
    const archiveJob: ArchiveJob = {
      jobId,
      archiveId: this.generateArchiveId(),
      type,
      status: ArchiveStatus.PENDING,
      sourceCount: 0,
      archivedCount: 0,
      failedCount: 0,
      startTime: new Date(),
      destination: this.config.destinations.primary
    }

    this.activeJobs.set(jobId, archiveJob)
    this.jobMetrics.totalJobs++

    try {
      archiveJob.status = ArchiveStatus.ARCHIVING

      // Execute specific cleanup based on type
      const result = await this.executeCleanupByType(type, archiveJob, context)
      
      archiveJob.sourceCount = result.sourceCount
      archiveJob.archivedCount = result.archivedCount
      archiveJob.failedCount = result.failedCount
      archiveJob.compressedSize = result.compressedSize
      archiveJob.originalSize = result.originalSize
      archiveJob.compressionRatio = result.compressionRatio

      if (result.failedCount === 0) {
        archiveJob.status = ArchiveStatus.COMPLETED
        this.jobMetrics.successfulJobs++
      } else if (result.archivedCount > 0) {
        archiveJob.status = ArchiveStatus.PARTIAL
        this.jobMetrics.successfulJobs++
      } else {
        archiveJob.status = ArchiveStatus.FAILED
        archiveJob.error = result.error
        this.jobMetrics.failedJobs++
      }

    } catch (error) {
      archiveJob.status = ArchiveStatus.FAILED
      archiveJob.error = error instanceof Error ? error.message : 'Unknown error'
      this.jobMetrics.failedJobs++
    } finally {
      archiveJob.endTime = new Date()
      this.jobMetrics.totalExecutionTime += archiveJob.endTime.getTime() - archiveJob.startTime.getTime()
      
      // Move to history
      this.jobHistory.push({ ...archiveJob })
      this.activeJobs.delete(jobId)

      // Log completion
      await this.logCleanupCompletion(archiveJob)
    }

    return archiveJob
  }

  private static async executeCleanupByType(
    type: CleanupType,
    job: ArchiveJob,
    context: { storeId?: string; userId?: string }
  ): Promise<{
    sourceCount: number
    archivedCount: number
    failedCount: number
    compressedSize?: number
    originalSize?: number
    compressionRatio?: number
    error?: string
  }> {
    switch (type) {
      case CleanupType.EXPIRED_ORDERS:
        return this.cleanupExpiredOrders(job, context)
      
      case CleanupType.COMPLETED_ORDERS:
        return this.cleanupCompletedOrders(job, context)
      
      case CleanupType.FAILED_OPERATIONS:
        return this.cleanupFailedOperations(job, context)
      
      case CleanupType.TEMPORARY_DATA:
        return this.cleanupTemporaryData(job, context)
      
      case CleanupType.CACHE_CLEANUP:
        return this.cleanupCache(job, context)
      
      case CleanupType.LOG_ROTATION:
        return this.rotateLogs(job, context)
      
      case CleanupType.ANALYTICS_CLEANUP:
        return this.cleanupAnalytics(job, context)
      
      case CleanupType.SESSION_CLEANUP:
        return this.cleanupSessions(job, context)
      
      case CleanupType.LOCK_CLEANUP:
        return this.cleanupLocks(job, context)
      
      default:
        throw new Error(`Unknown cleanup type: ${type}`)
    }
  }

  // Specific Cleanup Implementations
  private static async cleanupExpiredOrders(
    job: ArchiveJob,
    context: { storeId?: string; userId?: string }
  ): Promise<any> {
    const retentionDays = this.config.retention.expiredOrdersDays
    const cutoffDate = new Date(Date.now() - retentionDays * 24 * 60 * 60 * 1000)
    
    // In a real implementation, this would query the database
    const expiredOrders = await this.findExpiredOrders(cutoffDate, context.storeId)
    
    job.sourceCount = expiredOrders.length
    let archivedCount = 0
    let failedCount = 0
    let originalSize = 0
    let compressedSize = 0

    for (const order of expiredOrders) {
      try {
        const orderSize = JSON.stringify(order).length
        originalSize += orderSize

        // Archive the order
        await this.archiveOrderData(order, job.destination)
        archivedCount++

        // Delete from active database
        await this.deleteExpiredOrder(order.id, context.storeId)

      } catch (error) {
        failedCount++
        console.error(`Failed to cleanup order ${order.id}:`, error)
      }
    }

    if (this.config.destinations.compressionEnabled && archivedCount > 0) {
      compressedSize = originalSize * 0.3 // Simulate 70% compression
    }

    return {
      sourceCount: expiredOrders.length,
      archivedCount,
      failedCount,
      originalSize,
      compressedSize,
      compressionRatio: compressedSize > 0 ? compressedSize / originalSize : undefined
    }
  }

  private static async cleanupCompletedOrders(
    job: ArchiveJob,
    context: { storeId?: string; userId?: string }
  ): Promise<any> {
    const retentionDays = this.config.retention.completedOrdersDays
    const cutoffDate = new Date(Date.now() - retentionDays * 24 * 60 * 60 * 1000)
    
    const completedOrders = await this.findCompletedOrders(cutoffDate, context.storeId)
    
    job.sourceCount = completedOrders.length
    let archivedCount = 0
    let failedCount = 0

    for (const order of completedOrders) {
      try {
        await this.archiveOrderData(order, job.destination)
        await this.archiveOrderItems(order.id, context.storeId)
        archivedCount++
      } catch (error) {
        failedCount++
        console.error(`Failed to archive completed order ${order.id}:`, error)
      }
    }

    return {
      sourceCount: completedOrders.length,
      archivedCount,
      failedCount
    }
  }

  private static async cleanupFailedOperations(
    job: ArchiveJob,
    context: { storeId?: string; userId?: string }
  ): Promise<any> {
    const retentionDays = this.config.retention.failedOperationsDays
    const cutoffDate = new Date(Date.now() - retentionDays * 24 * 60 * 60 * 1000)
    
    const failedOperations = await this.findFailedOperations(cutoffDate, context.storeId)
    
    job.sourceCount = failedOperations.length
    let archivedCount = 0
    let failedCount = 0

    for (const operation of failedOperations) {
      try {
        await this.archiveOperationData(operation, job.destination)
        archivedCount++
      } catch (error) {
        failedCount++
        console.error(`Failed to archive operation ${operation.id}:`, error)
      }
    }

    return {
      sourceCount: failedOperations.length,
      archivedCount,
      failedCount
    }
  }

  private static async cleanupTemporaryData(
    job: ArchiveJob,
    context: { storeId?: string; userId?: string }
  ): Promise<any> {
    const retentionHours = this.config.retention.temporaryDataHours
    const cutoffDate = new Date(Date.now() - retentionHours * 60 * 60 * 1000)
    
    const tempData = await this.findTemporaryData(cutoffDate, context.storeId)
    
    job.sourceCount = tempData.length
    let archivedCount = 0
    let failedCount = 0

    for (const data of tempData) {
      try {
        await this.deleteTemporaryData(data.id, context.storeId)
        archivedCount++
      } catch (error) {
        failedCount++
        console.error(`Failed to delete temporary data ${data.id}:`, error)
      }
    }

    return {
      sourceCount: tempData.length,
      archivedCount,
      failedCount
    }
  }

  private static async cleanupCache(
    job: ArchiveJob,
    context: { storeId?: string; userId?: string }
  ): Promise<any> {
    // Clean up expired cache entries
    const cacheStats = await this.getCacheStatistics()
    
    job.sourceCount = cacheStats.totalEntries
    let cleanedCount = 0

    // This would integrate with the actual cache system
    cleanedCount = await this.clearExpiredCacheEntries()

    return {
      sourceCount: cacheStats.totalEntries,
      archivedCount: cleanedCount,
      failedCount: job.sourceCount - cleanedCount
    }
  }

  private static async rotateLogs(
    job: ArchiveJob,
    context: { storeId?: string; userId?: string }
  ): Promise<any> {
    const retentionDays = this.config.retention.logsDays
    const cutoffDate = new Date(Date.now() - retentionDays * 24 * 60 * 60 * 1000)
    
    const logFiles = await this.findOldLogFiles(cutoffDate, context.storeId)
    
    job.sourceCount = logFiles.length
    let archivedCount = 0
    let failedCount = 0

    for (const logFile of logFiles) {
      try {
        await this.archiveLogFile(logFile, job.destination)
        archivedCount++
      } catch (error) {
        failedCount++
        console.error(`Failed to archive log file ${logFile.name}:`, error)
      }
    }

    return {
      sourceCount: logFiles.length,
      archivedCount,
      failedCount
    }
  }

  private static async cleanupAnalytics(
    job: ArchiveJob,
    context: { storeId?: string; userId?: string }
  ): Promise<any> {
    const retentionDays = this.config.retention.analyticsDays
    const cutoffDate = new Date(Date.now() - retentionDays * 24 * 60 * 60 * 1000)
    
    const analyticsData = await this.findOldAnalyticsData(cutoffDate, context.storeId)
    
    job.sourceCount = analyticsData.length
    let archivedCount = 0
    let failedCount = 0

    for (const data of analyticsData) {
      try {
        await this.archiveAnalyticsData(data, job.destination)
        archivedCount++
      } catch (error) {
        failedCount++
        console.error(`Failed to archive analytics data ${data.id}:`, error)
      }
    }

    return {
      sourceCount: analyticsData.length,
      archivedCount,
      failedCount
    }
  }

  private static async cleanupSessions(
    job: ArchiveJob,
    context: { storeId?: string; userId?: string }
  ): Promise<any> {
    const retentionHours = this.config.retention.sessionsHours
    const cutoffDate = new Date(Date.now() - retentionHours * 60 * 60 * 1000)
    
    const expiredSessions = await this.findExpiredSessions(cutoffDate, context.storeId)
    
    job.sourceCount = expiredSessions.length
    let archivedCount = 0
    let failedCount = 0

    for (const session of expiredSessions) {
      try {
        await this.cleanupExpiredSession(session.id, context.storeId)
        archivedCount++
      } catch (error) {
        failedCount++
        console.error(`Failed to cleanup session ${session.id}:`, error)
      }
    }

    return {
      sourceCount: expiredSessions.length,
      archivedCount,
      failedCount
    }
  }

  private static async cleanupLocks(
    job: ArchiveJob,
    context: { storeId?: string; userId?: string }
  ): Promise<any> {
    const expiredLocks = await this.findExpiredLocks(context.storeId)
    
    job.sourceCount = expiredLocks.length
    let archivedCount = 0
    let failedCount = 0

    for (const lock of expiredLocks) {
      try {
        await this.releaseExpiredLock(lock.id, context.storeId)
        archivedCount++
      } catch (error) {
        failedCount++
        console.error(`Failed to cleanup lock ${lock.id}:`, error)
      }
    }

    return {
      sourceCount: expiredLocks.length,
      archivedCount,
      failedCount
    }
  }

  // Database Query Methods (Simulated)
  private static async findExpiredOrders(cutoffDate: Date, storeId?: string): Promise<any[]> {
    // Simulate finding expired orders
    return [
      { id: 'order1', status: 'expired', createdAt: new Date(cutoffDate.getTime() - 86400000) },
      { id: 'order2', status: 'expired', createdAt: new Date(cutoffDate.getTime() - 172800000) }
    ]
  }

  private static async findCompletedOrders(cutoffDate: Date, storeId?: string): Promise<any[]> {
    // Simulate finding completed orders
    return [
      { id: 'order3', status: 'completed', completedAt: new Date(cutoffDate.getTime() - 86400000) }
    ]
  }

  private static async findFailedOperations(cutoffDate: Date, storeId?: string): Promise<any[]> {
    // Simulate finding failed operations
    return [
      { id: 'op1', status: 'failed', createdAt: new Date(cutoffDate.getTime() - 86400000) }
    ]
  }

  private static async findTemporaryData(cutoffDate: Date, storeId?: string): Promise<any[]> {
    // Simulate finding temporary data
    return [
      { id: 'temp1', createdAt: new Date(cutoffDate.getTime() - 3600000) }
    ]
  }

  private static async findOldLogFiles(cutoffDate: Date, storeId?: string): Promise<any[]> {
    // Simulate finding old log files
    return [
      { id: 'log1', name: 'order.log.2024-01-01', modifiedAt: new Date(cutoffDate.getTime() - 86400000) }
    ]
  }

  private static async findOldAnalyticsData(cutoffDate: Date, storeId?: string): Promise<any[]> {
    // Simulate finding old analytics data
    return [
      { id: 'analytics1', date: new Date(cutoffDate.getTime() - 86400000) }
    ]
  }

  private static async findExpiredSessions(cutoffDate: Date, storeId?: string): Promise<any[]> {
    // Simulate finding expired sessions
    return [
      { id: 'session1', lastSeenAt: new Date(cutoffDate.getTime() - 7200000) }
    ]
  }

  private static async findExpiredLocks(storeId?: string): Promise<any[]> {
    // Simulate finding expired locks
    return [
      { id: 'lock1', expiresAt: new Date(Date.now() - 3600000) }
    ]
  }

  // Action Methods
  private static async archiveOrderData(order: any, destination: ArchiveDestination): Promise<void> {
    // Archive order data to destination
    console.log(`Archiving order ${order.id} to ${destination}`)
  }

  private static async archiveOrderItems(orderId: string, storeId?: string): Promise<void> {
    // Archive order items
    console.log(`Archiving items for order ${orderId}`)
  }

  private static async deleteExpiredOrder(orderId: string, storeId?: string): Promise<void> {
    // Delete expired order from active database
    console.log(`Deleting expired order ${orderId}`)
  }

  private static async archiveOperationData(operation: any, destination: ArchiveDestination): Promise<void> {
    // Archive operation data
    console.log(`Archiving operation ${operation.id} to ${destination}`)
  }

  private static async deleteTemporaryData(dataId: string, storeId?: string): Promise<void> {
    // Delete temporary data
    console.log(`Deleting temporary data ${dataId}`)
  }

  private static async getCacheStatistics(): Promise<{ totalEntries: number }> {
    // Get cache statistics
    return { totalEntries: 1000 }
  }

  private static async clearExpiredCacheEntries(): Promise<number> {
    // Clear expired cache entries
    console.log('Clearing expired cache entries')
    return 500
  }

  private static async archiveLogFile(logFile: any, destination: ArchiveDestination): Promise<void> {
    // Archive log file
    console.log(`Archiving log file ${logFile.name} to ${destination}`)
  }

  private static async archiveAnalyticsData(data: any, destination: ArchiveDestination): Promise<void> {
    // Archive analytics data
    console.log(`Archiving analytics data ${data.id} to ${destination}`)
  }

  private static async cleanupExpiredSession(sessionId: string, storeId?: string): Promise<void> {
    // Cleanup expired session
    console.log(`Cleaning up expired session ${sessionId}`)
  }

  private static async releaseExpiredLock(lockId: string, storeId?: string): Promise<void> {
    // Release expired lock
    console.log(`Releasing expired lock ${lockId}`)
  }

  // Utility Methods
  private static generateJobId(): string {
    return `cleanup_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`
  }

  private static generateArchiveId(): string {
    return `archive_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`
  }

  private static async logCleanupCompletion(job: ArchiveJob): Promise<void> {
    await OrderAuditLogger.log({
      eventType: AuditEventType.SYSTEM_ERROR,
      category: 'operations' as any,
      severity: job.status === ArchiveStatus.FAILED ? AuditSeverity.HIGH : AuditSeverity.MEDIUM,
      source: 'backend',
      description: `Cleanup job ${job.type} completed with status ${job.status}`,
      details: {
        jobId: job.jobId,
        type: job.type,
        status: job.status,
        sourceCount: job.sourceCount,
        archivedCount: job.archivedCount,
        failedCount: job.failedCount,
        duration: job.endTime ? job.endTime.getTime() - job.startTime.getTime() : 0
      },
      success: job.status === ArchiveStatus.COMPLETED || job.status === ArchiveStatus.PARTIAL,
      errorMessage: job.error
    })
  }

  // Scheduling and Automation
  static async scheduleAutomaticCleanup(): Promise<void> {
    // Schedule regular cleanup jobs
    await OrderBackgroundJobs.scheduleCleanup('global')
    
    // Schedule daily maintenance
    await OrderPerformanceOptimizer.scheduleJob(
      'daily_maintenance',
      { type: 'full_cleanup' },
      JobPriority.LOW,
      this.getNextMaintenanceTime()
    )
  }

  private static getNextMaintenanceTime(): Date {
    // Calculate next maintenance window
    const now = new Date()
    const [startHour, startMinute] = this.config.schedule.maintenanceWindowStart.split(':').map(Number)
    const [endHour, endMinute] = this.config.schedule.maintenanceWindowEnd.split(':').map(Number)
    
    const startTime = new Date(now)
    startTime.setHours(startHour, startMinute, 0, 0)
    
    // If we're past today's start time, schedule for tomorrow
    if (now > startTime) {
      startTime.setDate(startTime.getDate() + 1)
    }
    
    return startTime
  }

  // Monitoring and Reporting
  static getActiveJobs(): ArchiveJob[] {
    return Array.from(this.activeJobs.values())
  }

  static getJobHistory(limit: number = 100): ArchiveJob[] {
    return this.jobHistory.slice(-limit)
  }

  static getMetrics(): typeof this.jobMetrics {
    return { ...this.jobMetrics }
  }

  static async generateReport(timeRange?: { start: Date; end: Date }): Promise<ArchiveReport> {
    const jobs = this.getJobHistory(1000) // Get more jobs for analysis
    
    const filteredJobs = timeRange 
      ? jobs.filter(job => 
          job.startTime >= timeRange.start && 
          job.startTime <= timeRange.end
        )
      : jobs

    const jobsByType = filteredJobs.reduce((acc, job) => {
      acc[job.type] = (acc[job.type] || 0) + 1
      return acc
    }, {} as Record<CleanupType, number>)

    const jobsByStatus = filteredJobs.reduce((acc, job) => {
      acc[job.status] = (acc[job.status] || 0) + 1
      return acc
    }, {} as Record<ArchiveStatus, number>)

    const totalItemsProcessed = filteredJobs.reduce((sum, job) => sum + job.sourceCount, 0)
    const totalSpaceFreed = filteredJobs.reduce((sum, job) => sum + (job.compressedSize || 0), 0)
    const totalSpaceArchived = filteredJobs.reduce((sum, job) => sum + (job.originalSize || 0), 0)
    
    const completedJobs = filteredJobs.filter(job => job.endTime)
    const averageExecutionTime = completedJobs.length > 0
      ? completedJobs.reduce((sum, job) => 
          sum + (job.endTime!.getTime() - job.startTime.getTime()), 0
        ) / completedJobs.length
      : 0

    const errors = filteredJobs
      .filter(job => job.error)
      .map(job => ({
        jobId: job.jobId,
        error: job.error!,
        timestamp: job.endTime || job.startTime
      }))

    const recommendations = this.generateRecommendations(filteredJobs, jobsByStatus)

    return {
      totalJobs: filteredJobs.length,
      successfulJobs: filteredJobs.filter(j => j.status === ArchiveStatus.COMPLETED).length,
      failedJobs: filteredJobs.filter(j => j.status === ArchiveStatus.FAILED).length,
      totalItemsProcessed,
      totalSpaceFreed,
      totalSpaceArchived,
      averageExecutionTime,
      jobsByType,
      jobsByStatus,
      errors,
      recommendations,
      generatedAt: new Date()
    }
  }

  private static generateRecommendations(jobs: ArchiveJob[], jobsByStatus: Record<ArchiveStatus, number>): string[] {
    const recommendations: string[] = []

    // Failure rate analysis
    const totalJobs = jobs.length
    const failedJobs = jobsByStatus[ArchiveStatus.FAILED] || 0
    const failureRate = totalJobs > 0 ? failedJobs / totalJobs : 0

    if (failureRate > this.config.notifications.alertThresholds.failureRate) {
      recommendations.push(`High failure rate detected (${(failureRate * 100).toFixed(1)}%). Review failed jobs and optimize cleanup rules.`)
    }

    // Execution time analysis
    const completedJobs = jobs.filter(j => j.endTime)
    if (completedJobs.length > 0) {
      const avgExecutionTime = completedJobs.reduce((sum, job) => 
        sum + (job.endTime!.getTime() - job.startTime.getTime()), 0
      ) / completedJobs.length

      if (avgExecutionTime > this.config.notifications.alertThresholds.executionTime) {
        recommendations.push('Average execution time is high. Consider reducing batch sizes or optimizing queries.')
      }
    }

    // Job distribution analysis
    const partialJobs = jobsByStatus[ArchiveStatus.PARTIAL] || 0
    if (partialJobs > 0) {
      recommendations.push(`${partialJobs} jobs completed with partial success. Review error handling and retry logic.`)
    }

    if (recommendations.length === 0) {
      recommendations.push('Cleanup and archiving are performing well. No immediate action required.')
    }

    return recommendations
  }

  // System Health
  static getSystemHealth(): {
    status: 'healthy' | 'degraded' | 'critical'
    activeJobs: number
    failedJobs24h: number
    lastCleanupTime?: Date
    nextScheduledCleanup?: Date
    recommendations: string[]
  } {
    const activeJobsCount = this.activeJobs.size
    const last24hJobs = this.jobHistory.filter(job => 
      Date.now() - job.startTime.getTime() < 24 * 60 * 60 * 1000
    )
    const failedJobs24h = last24hJobs.filter(job => job.status === ArchiveStatus.FAILED).length

    let status: 'healthy' | 'degraded' | 'critical' = 'healthy'
    const recommendations: string[] = []

    if (activeJobsCount > 10) {
      status = 'degraded'
      recommendations.push('High number of active cleanup jobs. Consider increasing resources or optimizing job scheduling.')
    }

    if (failedJobs24h > 5) {
      status = 'critical'
      recommendations.push('High number of failed cleanup jobs in the last 24 hours. Immediate attention required.')
    }

    const lastCleanupTime = last24hJobs.length > 0 
      ? new Date(Math.max(...last24hJobs.map(job => job.startTime.getTime())))
      : undefined

    const nextScheduledCleanup = this.getNextMaintenanceTime()

    return {
      status,
      activeJobs: activeJobsCount,
      failedJobs24h,
      lastCleanupTime,
      nextScheduledCleanup,
      recommendations
    }
  }

  // Cleanup and Shutdown
  static async shutdown(): Promise<void> {
    // Wait for active jobs to complete (with timeout)
    const shutdownTimeout = 300000 // 5 minutes
    const startTime = Date.now()

    while (this.activeJobs.size > 0 && Date.now() - startTime < shutdownTimeout) {
      await new Promise(resolve => setTimeout(resolve, 1000))
    }

    // Force shutdown if jobs are still running
    if (this.activeJobs.size > 0) {
      console.warn(`Shutdown timeout reached. ${this.activeJobs.size} cleanup jobs still running.`)
    }

    // Generate final report
    const report = await this.generateReport()
    console.log('Final cleanup report:', report)
  }

  static destroy(): void {
    this.cleanupRules.clear()
    this.activeJobs.clear()
    this.jobHistory = []
  }
}

// Export convenience functions
export const CleanupScheduler = {
  scheduleDailyCleanup: () => OrderCleanupArchiver.scheduleAutomaticCleanup(),
  executeImmediateCleanup: (type: CleanupType, context?: any) => 
    OrderCleanupArchiver.executeCleanup(type, context),
  getCleanupStatus: () => OrderCleanupArchiver.getSystemHealth()
}