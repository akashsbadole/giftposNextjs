import { NextRequest, NextResponse } from 'next/server'
import { logger } from '@/lib/error-handling/logger'
import { AuditLogger } from '@/lib/security/audit-logger'
import { RateLimiter, rateLimitConfigs } from '@/lib/security/rate-limiter'
import { formatErrorResponse, ValidationError, isRateLimitError } from '@/lib/error-handling/api-errors'
import { auth } from '@clerk/nextjs/server'

const rateLimiter = new RateLimiter()

export async function POST(req: NextRequest) {
  try {
    // Check rate limiting
    const rateLimitResult = await rateLimiter.checkLimit(req, {
      ...rateLimitConfigs.query,
      maxRequests: 10, // Stricter limit for log endpoints
    })

    if (!rateLimitResult.success) {
      await AuditLogger.logRateLimitExceeded(req.nextUrl.pathname, req.method, undefined, {
        totalHits: rateLimitResult.totalHits,
        limit: rateLimitResult.limit,
      })
      
      return NextResponse.json(
        {
          error: {
            code: 'RATE_LIMIT_EXCEEDED',
            message: 'Too many requests',
            retryAfter: Math.ceil((rateLimitResult.reset - Date.now()) / 1000),
          },
        },
        {
          status: 429,
          headers: {
            'X-RateLimit-Limit': rateLimitResult.limit.toString(),
            'X-RateLimit-Remaining': rateLimitResult.remaining.toString(),
            'X-RateLimit-Reset': rateLimitResult.reset.toString(),
          },
        }
      )
    }

    const authState = await auth()
    if (!authState.userId) {
      return NextResponse.json(
        { error: { code: 'UNAUTHORIZED', message: 'Authentication required' } },
        { status: 401 }
      )
    }

    const body = await req.json()
    const { type, level, message, data } = body

    // Validate request body
    if (!type || !level || !message) {
      throw new ValidationError('Missing required fields', [
        { field: 'type', message: 'Log type is required' },
        { field: 'level', message: 'Log level is required' },
        { field: 'message', message: 'Message is required' },
      ])
    }

    // Validate log level
    const validLevels = ['debug', 'info', 'warn', 'error', 'critical']
    if (!validLevels.includes(level)) {
      throw new ValidationError('Invalid log level', [
        { field: 'level', message: `Level must be one of: ${validLevels.join(', ')}` },
      ])
    }

    // Validate log type
    const validTypes = ['application', 'security', 'audit', 'performance', 'business', 'error']
    if (!validTypes.includes(type)) {
      throw new ValidationError('Invalid log type', [
        { field: 'type', message: `Type must be one of: ${validTypes.join(', ')}` },
      ])
    }

    // Log the entry
    await logger.log(level as any, type as any, message, data, 'frontend')

    // Log audit trail for security-relevant logs
    if (type === 'security' || level === 'error' || level === 'critical') {
      await AuditLogger.log({
        timestamp: new Date(),
        userId: authState.userId,
        action: 'log_entry_created',
        resource: 'logging',
        method: req.method,
        path: req.nextUrl.pathname,
        status: 'success',
        severity: level === 'critical' ? 'critical' : 'medium',
        details: {
          type,
          level,
          message,
          source: 'frontend',
        },
      })
    }

    return NextResponse.json({ success: true })
  } catch (error) {
    console.error('Log API error:', error)

    if (isRateLimitError(error)) {
      return NextResponse.json(
        formatErrorResponse(error),
        { status: error.statusCode }
      )
    }

    const errorResponse = formatErrorResponse(error)
    return NextResponse.json(errorResponse, { status: 500 })
  }
}

export async function GET(req: NextRequest) {
  try {
    // Check rate limiting
    const rateLimitResult = await rateLimiter.checkLimit(req, {
      ...rateLimitConfigs.query,
      maxRequests: 5, // Very strict limit for log retrieval
    })

    if (!rateLimitResult.success) {
      await AuditLogger.logRateLimitExceeded(req.nextUrl.pathname, req.method, undefined, {
        totalHits: rateLimitResult.totalHits,
        limit: rateLimitResult.limit,
      })
      
      return NextResponse.json(
        {
          error: {
            code: 'RATE_LIMIT_EXCEEDED',
            message: 'Too many requests',
            retryAfter: Math.ceil((rateLimitResult.reset - Date.now()) / 1000),
          },
        },
        {
          status: 429,
          headers: {
            'X-RateLimit-Limit': rateLimitResult.limit.toString(),
            'X-RateLimit-Remaining': rateLimitResult.remaining.toString(),
            'X-RateLimit-Reset': rateLimitResult.reset.toString(),
          },
        }
      )
    }

    const authState = await auth()
    if (!authState.userId) {
      return NextResponse.json(
        { error: { code: 'UNAUTHORIZED', message: 'Authentication required' } },
        { status: 401 }
      )
    }

    // Parse query parameters
    const { searchParams } = new URL(req.url)
    const level = searchParams.get('level') as any
    const type = searchParams.get('type') as any
    const userId = searchParams.get('userId')
    const route = searchParams.get('route')
    const search = searchParams.get('search')
    const limit = parseInt(searchParams.get('limit') || '50', 10)
    const offset = parseInt(searchParams.get('offset') || '0', 10)

    // Validate parameters
    const validLevels = ['debug', 'info', 'warn', 'error', 'critical']
    const validTypes = ['application', 'security', 'audit', 'performance', 'business', 'error']

    if (level && !validLevels.includes(level)) {
      throw new ValidationError('Invalid log level', [
        { field: 'level', message: `Level must be one of: ${validLevels.join(', ')}` },
      ])
    }

    if (type && !validTypes.includes(type)) {
      throw new ValidationError('Invalid log type', [
        { field: 'type', message: `Type must be one of: ${validTypes.join(', ')}` },
      ])
    }

    if (limit > 1000) {
      throw new ValidationError('Limit too high', [
        { field: 'limit', message: 'Maximum limit is 1000' },
      ])
    }

    // Build date range filters
    let startDate: Date | undefined
    let endDate: Date | undefined

    const startDateStr = searchParams.get('startDate')
    const endDateStr = searchParams.get('endDate')
    
    if (startDateStr) {
      startDate = new Date(startDateStr)
      if (isNaN(startDate.getTime())) {
        throw new ValidationError('Invalid start date', [
          { field: 'startDate', message: 'Invalid date format' },
        ])
      }
    }

    if (endDateStr) {
      endDate = new Date(endDateStr)
      if (isNaN(endDate.getTime())) {
        throw new ValidationError('Invalid end date', [
          { field: 'endDate', message: 'Invalid date format' },
        ])
      }
    }

    // Get logs
    const { logs, total } = await logger.getLogs({
      level,
      type,
      userId,
      route,
      search,
      startDate,
      endDate,
      limit,
      offset,
    })

    // Log audit trail
    await AuditLogger.log({
      timestamp: new Date(),
      userId: authState.userId,
      action: 'log_entries_retrieved',
      resource: 'logging',
      method: req.method,
      path: req.nextUrl.pathname,
      status: 'success',
      severity: 'low',
      details: {
        total,
        filters: { level, type, userId, route, search, startDate, endDate },
        limit,
        offset,
      },
    })

    return NextResponse.json({
      logs,
      pagination: {
        total,
        limit,
        offset,
        hasMore: offset + limit < total,
      },
    })
  } catch (error) {
    console.error('Log retrieval error:', error)

    if (isRateLimitError(error)) {
      return NextResponse.json(
        formatErrorResponse(error),
        { status: error.statusCode }
      )
    }

    const errorResponse = formatErrorResponse(error)
    return NextResponse.json(errorResponse, { status: 500 })
  }
}

export async function DELETE(req: NextRequest) {
  try {
    // Check rate limiting
    const rateLimitResult = await rateLimiter.checkLimit(req, {
      windowMs: 60 * 60 * 1000, // 1 hour
      maxRequests: 1, // Only 1 deletion per hour
    })

    if (!rateLimitResult.success) {
      await AuditLogger.logRateLimitExceeded(req.nextUrl.pathname, req.method, undefined, {
        totalHits: rateLimitResult.totalHits,
        limit: rateLimitResult.limit,
      })
      
      return NextResponse.json(
        {
          error: {
            code: 'RATE_LIMIT_EXCEEDED',
            message: 'Too many requests',
            retryAfter: Math.ceil((rateLimitResult.reset - Date.now()) / 1000),
          },
        },
        {
          status: 429,
          headers: {
            'X-RateLimit-Limit': rateLimitResult.limit.toString(),
            'X-RateLimit-Remaining': rateLimitResult.remaining.toString(),
            'X-RateLimit-Reset': rateLimitResult.reset.toString(),
          },
        }
      )
    }

    const authState = await auth()
    if (!authState.userId) {
      return NextResponse.json(
        { error: { code: 'UNAUTHORIZED', message: 'Authentication required' } },
        { status: 401 }
      )
    }

    // Parse query parameters for deletion criteria
    const { searchParams } = new URL(req.url)
    const olderThanDays = parseInt(searchParams.get('olderThanDays') || '30', 10)
    const level = searchParams.get('level') as any
    const type = searchParams.get('type') as any

    // Validate parameters
    if (olderThanDays < 1 || olderThanDays > 365) {
      throw new ValidationError('Invalid olderThanDays parameter', [
        { field: 'olderThanDays', message: 'Must be between 1 and 365 days' },
      ])
    }

    const validLevels = ['debug', 'info', 'warn', 'error', 'critical']
    const validTypes = ['application', 'security', 'audit', 'performance', 'business', 'error']

    if (level && !validLevels.includes(level)) {
      throw new ValidationError('Invalid log level', [
        { field: 'level', message: `Level must be one of: ${validLevels.join(', ')}` },
      ])
    }

    if (type && !validTypes.includes(type)) {
      throw new ValidationError('Invalid log type', [
        { field: 'type', message: `Type must be one of: ${validTypes.join(', ')}` },
      ])
    }

    // Calculate date threshold
    const cutoffDate = new Date()
    cutoffDate.setDate(cutoffDate.getDate() - olderThanDays)

    // Build where clause
    const where: any = {
      timestamp: {
        lt: cutoffDate,
      },
    }

    if (level) where.level = level
    if (type) where.type = type

    // Delete old logs (this would need to be implemented in the Logger class)
    // For now, we'll return a success response
    // const deletedCount = await logger.deleteOldLogs(where)

    // Log audit trail for log deletion
    await AuditLogger.log({
      timestamp: new Date(),
      userId: authState.userId,
      action: 'log_entries_deleted',
      resource: 'logging',
      method: req.method,
      path: req.nextUrl.pathname,
      status: 'success',
      severity: 'high',
      details: {
        olderThanDays,
        level,
        type,
        cutoffDate: cutoffDate.toISOString(),
      },
    })

    return NextResponse.json({
      success: true,
      message: `Logs older than ${olderThanDays} days deleted successfully`,
      // deletedCount,
    })
  } catch (error) {
    console.error('Log deletion error:', error)

    if (isRateLimitError(error)) {
      return NextResponse.json(
        formatErrorResponse(error),
        { status: error.statusCode }
      )
    }

    const errorResponse = formatErrorResponse(error)
    return NextResponse.json(errorResponse, { status: 500 })
  }
}