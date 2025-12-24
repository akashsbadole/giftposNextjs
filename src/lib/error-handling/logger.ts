import { db } from '@/lib/db'
import { auth } from '@clerk/nextjs/server'

export type LogLevel = 'debug' | 'info' | 'warn' | 'error' | 'critical'
export type LogType = 'application' | 'security' | 'audit' | 'performance' | 'business' | 'error'

export interface LogEntry {
  id?: string
  timestamp: Date
  level: LogLevel
  type: LogType
  message: string
  data?: Record<string, any>
  userId?: string
  userEmail?: string
  sessionId?: string
  requestId?: string
  route?: string
  method?: string
  ipAddress?: string
  userAgent?: string
  userStack?: string
  correlationId?: string
  source: 'frontend' | 'backend' | 'api' | 'worker' | 'cron'
  environment: string
  tags?: string[]
  stackTrace?: string
  isSensitive?: boolean
}

export interface LogFilter {
  level?: LogLevel
  type?: LogType
  userId?: string
  route?: string
  startDate?: Date
  endDate?: Date
  search?: string
  limit?: number
  offset?: number
}

export interface LogStats {
  total: number
  byLevel: Record<LogLevel, number>
  byType: Record<LogType, number>
  recentErrors: number
  errorRate: number
  timeRange: {
    start: Date
    end: Date
  }
}

export class Logger {
  private static instance: Logger
  private logs: LogEntry[] = []
  private buffer: LogEntry[] = []
  private bufferSize = 100
  private flushInterval = 5000 // 5 seconds
  private flushTimer?: NodeJS.Timeout

  constructor() {
    this.startBufferFlush()
  }

  static getInstance(): Logger {
    if (!Logger.instance) {
      Logger.instance = new Logger()
    }
    return Logger.instance
  }

  /**
   * Create a log entry
   */
  private async createLogEntry(
    level: LogLevel,
    type: LogType,
    message: string,
    data?: Record<string, any>,
    source: LogEntry['source'] = 'backend'
  ): Promise<LogEntry> {
    const authState = await auth()
    
    const logEntry: LogEntry = {
      timestamp: new Date(),
      level,
      type,
      message,
      data: data ? this.sanitizeData(data) : undefined,
      userId: authState.userId || undefined,
      userEmail: this.extractUserEmail(authState),
      sessionId: authState.sessionId || undefined,
      route: this.extractRoute(),
      method: this.extractMethod(),
      ipAddress: this.getClientIP(),
      userAgent: this.getUserAgent(),
      source,
      environment: process.env.NODE_ENV || 'development',
      correlationId: this.generateCorrelationId(),
      stackTrace: level === 'error' || level === 'critical' ? this.getStackTrace() : undefined,
    }

    return logEntry
  }

  /**
   * Log a message
   */
  async log(
    level: LogLevel,
    type: LogType,
    message: string,
    data?: Record<string, any>,
    source: LogEntry['source'] = 'backend'
  ): Promise<void> {
    const logEntry = await this.createLogEntry(level, type, message, data, source)
    
    // Add to buffer
    this.buffer.push(logEntry)
    
    // Console logging based on level
    this.logToConsole(logEntry)
    
    // Flush buffer if it's full
    if (this.buffer.length >= this.bufferSize) {
      await this.flush()
    }
  }

  /**
   * Convenience methods for different log levels
   */
  async debug(type: LogType, message: string, data?: Record<string, any>): Promise<void> {
    await this.log('debug', type, message, data)
  }

  async info(type: LogType, message: string, data?: Record<string, any>): Promise<void> {
    await this.log('info', type, message, data)
  }

  async warn(type: LogType, message: string, data?: Record<string, any>): Promise<void> {
    await this.log('warn', type, message, data)
  }

  async error(type: LogType, message: string, data?: Record<string, any>): Promise<void> {
    await this.log('error', type, message, data)
  }

  async critical(type: LogType, message: string, data?: Record<string, any>): Promise<void> {
    await this.log('critical', type, message, data)
  }

  /**
   * Log application events
   */
  async logApplication(message: string, data?: Record<string, any>): Promise<void> {
    await this.info('application', message, data)
  }

  /**
   * Log security events
   */
  async logSecurity(message: string, level: LogLevel = 'warn', data?: Record<string, any>): Promise<void> {
    await this.log(level, 'security', message, data)
  }

  /**
   * Log audit events
   */
  async logAudit(action: string, resource: string, data?: Record<string, any>): Promise<void> {
    await this.info('audit', `${action} on ${resource}`, data)
  }

  /**
   * Log business events
   */
  async logBusiness(event: string, data?: Record<string, any>): Promise<void> {
    await this.info('business', event, data)
  }

  /**
   * Log performance metrics
   */
  async logPerformance(operation: string, duration: number, data?: Record<string, any>): Promise<void> {
    await this.info('performance', `${operation} completed in ${duration}ms`, {
      operation,
      duration,
      ...data,
    })
  }

  /**
   * Log errors with context
   */
  async logError(
    error: Error | string,
    context?: Record<string, any>,
    source: LogEntry['source'] = 'backend'
  ): Promise<void> {
    const message = typeof error === 'string' ? error : error.message
    const data = {
      error: typeof error === 'string' ? undefined : {
        name: error.name,
        message: error.message,
        stack: error.stack,
      },
      context,
    }
    
    await this.error('error', message, data)
    
    // Also log to database with source information
    const logEntry = await this.createLogEntry('error', 'error', message, data, source)
    this.buffer.push(logEntry)
  }

  /**
   * Get logs with filtering
   */
  async getLogs(filter: LogFilter = {}): Promise<{ logs: LogEntry[]; total: number }> {
    const where: any = {}

    if (filter.level) where.level = filter.level
    if (filter.type) where.type = filter.type
    if (filter.userId) where.userId = filter.userId
    if (filter.route) where.route = { contains: filter.route }

    if (filter.startDate || filter.endDate) {
      where.timestamp = {}
      if (filter.startDate) where.timestamp.gte = filter.startDate
      if (filter.endDate) where.timestamp.lte = filter.endDate
    }

    if (filter.search) {
      where.OR = [
        { message: { contains: filter.search } },
        { route: { contains: filter.search } },
        { userEmail: { contains: filter.search } },
      ]
    }

    const [logs, total] = await Promise.all([
      db.errorLog.findMany({
        where,
        orderBy: { timestamp: 'desc' },
        take: filter.limit || 100,
        skip: filter.offset || 0,
      }),
      db.errorLog.count({ where }),
    ])

    // Convert database records to LogEntry format
    const logEntries: LogEntry[] = logs.map(log => ({
      id: log.id,
      timestamp: log.timestamp,
      level: log.level as LogLevel,
      type: log.type as LogType,
      message: log.message,
      data: log.data ? JSON.parse(log.data) : undefined,
      userId: log.userId || undefined,
      userEmail: log.userEmail || undefined,
      sessionId: log.sessionId || undefined,
      requestId: log.requestId || undefined,
      route: log.route || undefined,
      method: log.method || undefined,
      ipAddress: log.ipAddress || undefined,
      userAgent: log.userAgent || undefined,
      source: log.source as LogEntry['source'],
      environment: log.environment,
      correlationId: log.correlationId,
      stackTrace: log.stackTrace,
    }))

    return { logs: logEntries, total }
  }

  /**
   * Get log statistics
   */
  async getLogStats(timeRange: { hours?: number; days?: number } = {}): Promise<LogStats> {
    const endDate = new Date()
    const startDate = new Date()
    
    if (timeRange.hours) {
      startDate.setHours(startDate.getHours() - timeRange.hours)
    } else if (timeRange.days) {
      startDate.setDate(startDate.getDate() - timeRange.days)
    } else {
      startDate.setDate(startDate.getDate() - 7) // Default: last 7 days
    }

    const where = {
      timestamp: {
        gte: startDate,
        lte: endDate,
      },
    }

    const [
      total,
      errorLogs,
      recentErrors,
    ] = await Promise.all([
      db.errorLog.count({ where }),
      db.errorLog.groupBy({
        by: ['level', 'type'],
        where,
        _count: true,
      }),
      db.errorLog.count({
        where: {
          ...where,
          level: { in: ['error', 'critical'] },
          timestamp: { gte: new Date(Date.now() - 24 * 60 * 60 * 1000) }, // Last 24 hours
        },
      }),
    ])

    // Process statistics
    const byLevel: Record<LogLevel, number> = {
      debug: 0,
      info: 0,
      warn: 0,
      error: 0,
      critical: 0,
    }

    const byType: Record<LogType, number> = {
      application: 0,
      security: 0,
      audit: 0,
      performance: 0,
      business: 0,
      error: 0,
    }

    errorLogs.forEach(log => {
      byLevel[log.level as LogLevel] = log._count
      byType[log.type as LogType] = log._count
    })

    const errorRate = total > 0 ? (recentErrors / total) * 100 : 0

    return {
      total,
      byLevel,
      byType,
      recentErrors,
      errorRate,
      timeRange: { start: startDate, end: endDate },
    }
  }

  /**
   * Flush buffer to database
   */
  private async flush(): Promise<void> {
    if (this.buffer.length === 0) return

    const logsToFlush = [...this.buffer]
    this.buffer = []

    try {
      await db.errorLog.createMany({
        data: logsToFlush.map(log => ({
          timestamp: log.timestamp,
          level: log.level,
          type: log.type,
          message: log.message,
          data: log.data ? JSON.stringify(log.data) : null,
          userId: log.userId,
          userEmail: log.userEmail,
          sessionId: log.sessionId,
          requestId: log.requestId,
          route: log.route,
          method: log.method,
          ipAddress: log.ipAddress,
          userAgent: log.userAgent,
          source: log.source,
          environment: log.environment,
          correlationId: log.correlationId,
          stackTrace: log.stackTrace,
        })),
      })
    } catch (error) {
      console.error('Failed to flush logs to database:', error)
      // Re-add failed logs to buffer (but avoid infinite loop)
      this.logs.push(...logsToFlush.slice(0, 10))
    }
  }

  /**
   * Start automatic buffer flushing
   */
  private startBufferFlush(): void {
    this.flushTimer = setInterval(() => {
      this.flush().catch(console.error)
    }, this.flushInterval)

    // Flush on process exit
    process.on('beforeExit', () => {
      if (this.flushTimer) {
        clearInterval(this.flushTimer)
      }
      this.flush().catch(console.error)
    })
  }

  /**
   * Sanitize sensitive data
   */
  private sanitizeData(data: Record<string, any>): Record<string, any> {
    const sensitiveFields = ['password', 'token', 'key', 'secret', 'auth', 'credential']
    const sanitized = { ...data }

    const sanitizeObject = (obj: any): any => {
      if (typeof obj !== 'object' || obj === null) return obj

      const result = Array.isArray(obj) ? [] : {}
      
      for (const [key, value] of Object.entries(obj)) {
        const lowerKey = key.toLowerCase()
        
        if (sensitiveFields.some(field => lowerKey.includes(field))) {
          result[key] = '[REDACTED]'
        } else if (typeof value === 'object') {
          result[key] = sanitizeObject(value)
        } else {
          result[key] = value
        }
      }
      
      return result
    }

    return sanitizeObject(sanitized)
  }

  /**
   * Log to console based on level
   */
  private logToConsole(logEntry: LogEntry): void {
    const logData = {
      timestamp: logEntry.timestamp.toISOString(),
      level: logEntry.level.toUpperCase(),
      type: logEntry.type,
      message: logEntry.message,
      userId: logEntry.userId,
      route: logEntry.route,
      correlationId: logEntry.correlationId,
      ...logEntry.data,
    }

    switch (logEntry.level) {
      case 'debug':
        console.debug('[LOG]', logData)
        break
      case 'info':
        console.info('[LOG]', logData)
        break
      case 'warn':
        console.warn('[LOG]', logData)
        break
      case 'error':
        console.error('[LOG]', logData)
        break
      case 'critical':
        console.error('[CRITICAL]', logData)
        break
    }
  }

  /**
   * Extract user email from auth state
   */
  private extractUserEmail(authState: any): string | undefined {
    const sessionClaims = authState?.sessionClaims
    if (!sessionClaims) return undefined

    const sessionClaimsObj = sessionClaims as any
    return sessionClaimsObj?.email || 
           sessionClaimsObj?.['email'] ||
           sessionClaimsObj?.['email_address'] ||
           sessionClaimsObj?.['email_addresses']?.[0] ||
           sessionClaimsObj?.user?.email ||
           sessionClaimsObj?.metadata?.email
  }

  /**
   * Extract route from request context
   */
  private extractRoute(): string | undefined {
    // In a real implementation, this would extract from request context
    return undefined
  }

  /**
   * Extract HTTP method from request context
   */
  private extractMethod(): string | undefined {
    // In a real implementation, this would extract from request context
    return undefined
  }

  /**
   * Get client IP address
   */
  private getClientIP(): string {
    // In a real implementation, this would extract from request headers
    return 'unknown'
  }

  /**
   * Get user agent
   */
  private getUserAgent(): string {
    // In a real implementation, this would extract from request headers
    return 'unknown'
  }

  /**
   * Generate correlation ID
   */
  private generateCorrelationId(): string {
    return `${Date.now()}-${Math.random().toString(36).substr(2, 9)}`
  }

  /**
   * Get stack trace
   */
  private getStackTrace(): string {
    const error = new Error()
    return error.stack || ''
  }
}

// Export singleton instance
export const logger = Logger.getInstance()

// Export convenience functions
export const log = {
  debug: (type: LogType, message: string, data?: Record<string, any>) => logger.debug(type, message, data),
  info: (type: LogType, message: string, data?: Record<string, any>) => logger.info(type, message, data),
  warn: (type: LogType, message: string, data?: Record<string, any>) => logger.warn(type, message, data),
  error: (type: LogType, message: string, data?: Record<string, any>) => logger.error(type, message, data),
  critical: (type: LogType, message: string, data?: Record<string, any>) => logger.critical(type, message, data),
  security: (message: string, level: LogLevel = 'warn', data?: Record<string, any>) => logger.logSecurity(message, level, data),
  audit: (action: string, resource: string, data?: Record<string, any>) => logger.logAudit(action, resource, data),
  business: (event: string, data?: Record<string, any>) => logger.logBusiness(event, data),
  performance: (operation: string, duration: number, data?: Record<string, any>) => logger.logPerformance(operation, duration, data),
  errorLog: (error: Error | string, context?: Record<string, any>, source?: LogEntry['source']) => logger.logError(error, context, source),
}