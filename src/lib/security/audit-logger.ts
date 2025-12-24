import { db } from '@/lib/db'
import { auth } from '@clerk/nextjs/server'

// Type for auth state that might be null
type AuthState = {
  userId: string | null
  sessionClaims: any
  sessionId: string | null
} | null

export interface AuditLogEntry {
  id?: string
  timestamp: Date
  userId?: string
  userEmail?: string
  action: string
  resource: string
  resourceId?: string
  method: string
  path: string
  ipAddress?: string
  userAgent?: string
  status: 'success' | 'failure' | 'warning'
  severity: 'low' | 'medium' | 'high' | 'critical'
  details?: Record<string, any>
  previousValues?: Record<string, any>
  newValues?: Record<string, any>
  sessionId?: string
  correlationId?: string
}

export interface SecurityEventEntry {
  id?: string
  timestamp: Date
  eventType: 'failed_login' | 'rate_limit_exceeded' | 'suspicious_activity' | 
             'permission_denied' | 'data_breach_attempt' | 'system_breach' |
             'unauthorized_access' | 'brute_force_attempt' | 'sql_injection_attempt' |
             'xss_attempt' | 'csrf_violation' | 'file_upload_violation'
  severity: 'low' | 'medium' | 'high' | 'critical'
  userId?: string
  userEmail?: string
  ipAddress?: string
  userAgent?: string
  path?: string
  method?: string
  description: string
  details?: Record<string, any>
  resolved: boolean
  resolvedBy?: string
  resolvedAt?: Date
  prevention?: string[]
}

export class AuditLogger {
  /**
   * Log an audit event
   */
  static async log(entry: AuditLogEntry): Promise<string> {
    try {
      // Generate correlation ID if not provided
      const correlationId = entry.correlationId || this.generateCorrelationId()
      
      // Get additional context from auth (with fallback for public routes)
      let authState: AuthState = null
      try {
        const state = await auth()
        authState = {
          userId: state.userId,
          sessionClaims: state.sessionClaims,
          sessionId: state.sessionId
        }
      } catch (error) {
        // Auth might not be available in all contexts (e.g., public routes)
        console.warn('Auth not available for audit log:', error)
      }
      
      const auditLog = await db.auditLog.create({
        data: {
          timestamp: entry.timestamp,
          userId: entry.userId || authState?.userId || undefined,
          userEmail: entry.userEmail || this.extractUserEmail(authState),
          action: entry.action,
          resource: entry.resource,
          resourceId: entry.resourceId,
          method: entry.method,
          path: entry.path,
          ipAddress: entry.ipAddress || this.getClientIP(),
          userAgent: entry.userAgent || this.getUserAgent(),
          status: entry.status,
          severity: entry.severity,
          details: entry.details ? JSON.stringify(entry.details) : null,
          previousValues: entry.previousValues ? JSON.stringify(entry.previousValues) : null,
          newValues: entry.newValues ? JSON.stringify(entry.newValues) : null,
          sessionId: entry.sessionId || authState?.sessionId || undefined,
          correlationId,
        },
      })

      // Log to console for high-severity events
      if (entry.severity === 'high' || entry.severity === 'critical') {
        console.warn(`[AUDIT] ${entry.severity.toUpperCase()}: ${entry.action} on ${entry.resource}`, {
          correlationId,
          userId: entry.userId,
          path: entry.path,
          status: entry.status,
        })
      }

      return auditLog.id
    } catch (error) {
      console.error('Failed to log audit event:', error)
      throw new Error('Audit logging failed')
    }
  }

  /**
   * Log a security event
   */
  static async logSecurityEvent(event: SecurityEventEntry): Promise<string> {
    try {
      const correlationId = this.generateCorrelationId()
      
      // Get auth state with fallback for public routes
      let authState: AuthState = null
      try {
        const state = await auth()
        authState = {
          userId: state.userId,
          sessionClaims: state.sessionClaims,
          sessionId: state.sessionId
        }
      } catch (error) {
        // Auth might not be available in all contexts (e.g., public routes or middleware)
        console.warn('Auth not available for security event:', error)
      }
      
      const securityEvent = await db.securityEvent.create({
        data: {
          timestamp: event.timestamp,
          eventType: event.eventType,
          severity: event.severity,
          userId: event.userId || authState?.userId || null,
          userEmail: event.userEmail || this.extractUserEmail(authState),
          ipAddress: event.ipAddress || this.getClientIP(),
          userAgent: event.userAgent || this.getUserAgent(),
          path: event.path,
          method: event.method,
          description: event.description,
          details: event.details ? JSON.stringify(event.details) : null,
          resolved: event.resolved,
          resolvedBy: event.resolvedBy,
          resolvedAt: event.resolvedAt,
          prevention: event.prevention ? JSON.stringify(event.prevention) : null,
        },
      })

      // Log to console based on severity
      const logLevel = this.getLogLevel(event.severity)
      console[logLevel](`[SECURITY] ${event.eventType}: ${event.description}`, {
        correlationId,
        severity: event.severity,
        userId: event.userId,
        ipAddress: event.ipAddress,
        path: event.path,
      })

      return securityEvent.id
    } catch (error) {
      console.error('Failed to log security event:', error)
      // Don't throw error for security event logging failures to prevent cascading failures
      return 'security-event-log-failed'
    }
  }

  /**
   * Log authentication attempt
   */
  static async logAuthAttempt(
    action: 'login' | 'logout' | 'password_change' | 'account_lock',
    success: boolean,
    details?: Record<string, any>
  ): Promise<void> {
    const authState = await auth()
    const severity = success ? 'low' : 'medium'
    
    await this.log({
      timestamp: new Date(),
      userId: authState.userId || undefined,
      userEmail: this.extractUserEmail(authState),
      action: `auth_${action}`,
      resource: 'authentication',
      method: 'POST',
      path: `/api/auth/${action}`,
      status: success ? 'success' : 'failure',
      severity,
      details: {
        success,
        ...details,
      },
    })

    // Log security event for failed attempts
    if (!success && (action === 'login' || action === 'password_change')) {
      await this.logSecurityEvent({
        timestamp: new Date(),
        eventType: action === 'login' ? 'failed_login' : 'brute_force_attempt',
        severity: 'medium',
        userId: authState.userId || undefined,
        userEmail: this.extractUserEmail(authState),
        description: `Failed ${action} attempt`,
        details: { ...details, attempt: 'failed' },
        resolved: false,
      })
    }
  }

  /**
   * Log data access
   */
  static async logDataAccess(
    resource: string,
    action: 'create' | 'read' | 'update' | 'delete',
    resourceId?: string,
    previousValues?: Record<string, any>,
    newValues?: Record<string, any>
  ): Promise<void> {
    const authState = await auth()
    
    // Determine severity based on resource and action
    let severity: 'low' | 'medium' | 'high' | 'critical' = 'low'
    if (action === 'delete' || resource === 'employee' || resource === 'store_settings') {
      severity = 'medium'
    }
    if (resource === 'audit_log' || resource === 'security_event') {
      severity = 'high'
    }

    await this.log({
      timestamp: new Date(),
      userId: authState.userId || undefined,
      userEmail: this.extractUserEmail(authState),
      action: `data_${action}`,
      resource,
      resourceId,
      method: this.getMethodFromAction(action),
      path: `/api/pos/${resource}${resourceId ? `/${resourceId}` : ''}`,
      status: 'success',
      severity,
      previousValues,
      newValues,
    })
  }

  /**
   * Log rate limit exceeded
   */
  static async logRateLimitExceeded(
    path: string,
    method: string,
    userId?: string,
    details?: Record<string, any>
  ): Promise<void> {
    await this.logSecurityEvent({
      timestamp: new Date(),
      eventType: 'rate_limit_exceeded',
      severity: 'medium',
      userId,
      description: `Rate limit exceeded for ${method} ${path}`,
      path,
      method,
      details,
      resolved: false,
      prevention: [
        'Implement exponential backoff',
        'Add CAPTCHA for repeated violations',
        'Consider IP-based blocking for severe cases',
      ],
    })
  }

  /**
   * Log suspicious activity
   */
  static async logSuspiciousActivity(
    activity: string,
    severity: 'low' | 'medium' | 'high' | 'critical',
    details?: Record<string, any>
  ): Promise<void> {
    const authState = await auth()
    
    await this.logSecurityEvent({
      timestamp: new Date(),
      eventType: 'suspicious_activity',
      severity,
      userId: authState.userId || undefined,
      userEmail: this.extractUserEmail(authState),
      description: `Suspicious activity detected: ${activity}`,
      details,
      resolved: false,
      prevention: [
        'Monitor user activity patterns',
        'Implement additional authentication checks',
        'Review and potentially restrict permissions',
      ],
    })
  }

  /**
   * Get audit logs with filtering
   */
  static async getAuditLogs(filters?: {
    userId?: string
    action?: string
    resource?: string
    severity?: string
    startDate?: Date
    endDate?: Date
    limit?: number
  }) {
    const where: any = {}
    
    if (filters?.userId) where.userId = filters.userId
    if (filters?.action) where.action = { contains: filters.action }
    if (filters?.resource) where.resource = { contains: filters.resource }
    if (filters?.severity) where.severity = filters.severity
    if (filters?.startDate || filters?.endDate) {
      where.timestamp = {}
      if (filters.startDate) where.timestamp.gte = filters.startDate
      if (filters.endDate) where.timestamp.lte = filters.endDate
    }

    return await db.auditLog.findMany({
      where,
      orderBy: { timestamp: 'desc' },
      take: filters?.limit || 100,
      select: {
        id: true,
        timestamp: true,
        userId: true,
        userEmail: true,
        action: true,
        resource: true,
        resourceId: true,
        method: true,
        path: true,
        status: true,
        severity: true,
        details: true,
        correlationId: true,
      },
    })
  }

  /**
   * Get security events with filtering
   */
  static async getSecurityEvents(filters?: {
    eventType?: string
    severity?: string
    resolved?: boolean
    startDate?: Date
    endDate?: Date
    limit?: number
  }) {
    const where: any = {}
    
    if (filters?.eventType) where.eventType = filters.eventType
    if (filters?.severity) where.severity = filters.severity
    if (filters?.resolved !== undefined) where.resolved = filters.resolved
    if (filters?.startDate || filters?.endDate) {
      where.timestamp = {}
      if (filters.startDate) where.timestamp.gte = filters.startDate
      if (filters.endDate) where.timestamp.lte = filters.endDate
    }

    return await db.securityEvent.findMany({
      where,
      orderBy: { timestamp: 'desc' },
      take: filters?.limit || 100,
      select: {
        id: true,
        timestamp: true,
        eventType: true,
        severity: true,
        userId: true,
        userEmail: true,
        ipAddress: true,
        description: true,
        resolved: true,
        resolvedBy: true,
        resolvedAt: true,
      },
    })
  }

  /**
   * Generate correlation ID for request tracking
   */
  private static generateCorrelationId(): string {
    const array = new Uint8Array(16)
    crypto.getRandomValues(array)
    return Array.from(array, byte => byte.toString(16).padStart(2, '0')).join('')
  }

  /**
   * Extract user email from auth state
   */
  private static extractUserEmail(authState: any): string | undefined {
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
   * Extract session ID from auth state
   */
  private static extractSessionId(authState: any): string | undefined {
    return authState?.sessionId
  }

  /**
   * Get client IP address (placeholder - would need request context)
   */
  private static getClientIP(): string {
    // In a real implementation, this would extract from request headers
    return 'unknown'
  }

  /**
   * Get user agent (placeholder - would need request context)
   */
  private static getUserAgent(): string {
    // In a real implementation, this would extract from request headers
    return 'unknown'
  }

  /**
   * Get HTTP method from action
   */
  private static getMethodFromAction(action: string): string {
    switch (action) {
      case 'create': return 'POST'
      case 'read': return 'GET'
      case 'update': return 'PUT'
      case 'delete': return 'DELETE'
      default: return 'UNKNOWN'
    }
  }

  /**
   * Get console log level from severity
   */
  private static getLogLevel(severity: string): 'log' | 'warn' | 'error' {
    switch (severity) {
      case 'critical':
      case 'high':
        return 'error'
      case 'medium':
        return 'warn'
      default:
        return 'log'
    }
  }
}

// Utility functions for common audit scenarios
export const auditHelpers = {
  /**
   * Log successful data operation
   */
  logSuccess: (resource: string, action: string, resourceId?: string) => 
    AuditLogger.logDataAccess(resource, action as any, resourceId),

  /**
   * Log failed operation
   */
  logFailure: (resource: string, action: string, error: string, resourceId?: string) =>
    AuditLogger.log({
      timestamp: new Date(),
      action: `data_${action}_failed`,
      resource,
      resourceId,
      method: 'POST',
      path: `/api/pos/${resource}`,
      status: 'failure',
      severity: 'medium',
      details: { error },
    }),

  /**
   * Log security violation
   */
  logViolation: (violation: string, severity: 'low' | 'medium' | 'high' | 'critical', details?: any) =>
    AuditLogger.logSuspiciousActivity(violation, severity, details),
}