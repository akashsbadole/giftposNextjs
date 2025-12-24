import { Redis } from '@upstash/redis'
import { NextRequest } from 'next/server'

interface RateLimitConfig {
  windowMs: number
  maxRequests: number
  skipSuccessfulRequests?: boolean
  skipFailedRequests?: boolean
  keyGenerator?: (req: NextRequest) => string
}

interface RateLimitResult {
  success: boolean
  limit: number
  remaining: number
  reset: number
  totalHits: number
}

export class RateLimiter {
  private redis: Redis | null = null
  private memoryStore = new Map<string, { count: number; resetTime: number }>()

  constructor() {
    // Initialize Redis if available
    const redisUrl = process.env.UPSTASH_REDIS_REST_URL
    const redisToken = process.env.UPSTASH_REDIS_REST_TOKEN

    if (redisUrl && redisToken) {
      this.redis = new Redis({
        url: redisUrl,
        token: redisToken,
      })
    }
  }

  /**
   * Check rate limit for a request
   */
  async checkLimit(
    req: NextRequest,
    config: RateLimitConfig
  ): Promise<RateLimitResult> {
    const key = config.keyGenerator ? config.keyGenerator(req) : this.getDefaultKey(req)
    const now = Date.now()
    const windowStart = now - config.windowMs

    let totalHits = 0
    let resetTime = 0

    if (this.redis) {
      // Use Redis for distributed rate limiting
      const pipeline = this.redis.pipeline()
      
      // Remove old entries and add current request
      pipeline.zremrangebyscore(key, '-inf', windowStart)
      pipeline.zadd(key, { score: now, member: now.toString() })
      pipeline.zcard(key)
      pipeline.expire(key, Math.ceil(config.windowMs / 1000))
      
      const results = await pipeline.exec()
      totalHits = results[2] as number
      resetTime = now + config.windowMs
    } else {
      // Use memory store for single-instance deployments
      const record = this.memoryStore.get(key)
      
      if (!record || record.resetTime < now) {
        // New window
        totalHits = 1
        resetTime = now + config.windowMs
        this.memoryStore.set(key, { count: totalHits, resetTime })
      } else {
        // Continue existing window
        totalHits = record.count + 1
        record.count = totalHits
        resetTime = record.resetTime
      }
    }

    const remaining = Math.max(0, config.maxRequests - totalHits)
    const success = totalHits <= config.maxRequests

    return {
      success,
      limit: config.maxRequests,
      remaining,
      reset: resetTime,
      totalHits,
    }
  }

  /**
   * Middleware for Next.js API routes
   */
  middleware(config: RateLimitConfig) {
    return async (req: NextRequest) => {
      const result = await this.checkLimit(req, config)
      
      // Set rate limit headers
      const headers = new Headers()
      headers.set('X-RateLimit-Limit', result.limit.toString())
      headers.set('X-RateLimit-Remaining', result.remaining.toString())
      headers.set('X-RateLimit-Reset', result.reset.toString())

      if (!result.success) {
        // Return rate limit exceeded response
        return new Response(
          JSON.stringify({
            error: 'Rate limit exceeded',
            retryAfter: Math.ceil((result.reset - Date.now()) / 1000),
          }),
          {
            status: 429,
            headers: {
              ...Object.fromEntries(headers),
              'Content-Type': 'application/json',
              'Retry-After': Math.ceil((result.reset - Date.now()) / 1000).toString(),
            },
          }
        )
      }

      // Continue to next middleware/route
      return null
    }
  }

  /**
   * Get client IP address from request
   */
  private getClientIP(req: NextRequest): string {
    const forwarded = req.headers.get('x-forwarded-for')
    if (forwarded) {
      return forwarded.split(',')[0].trim()
    }
    
    const realIP = req.headers.get('x-real-ip')
    if (realIP) {
      return realIP
    }

    const remoteAddr = req.headers.get('remote-addr')
    if (remoteAddr) {
      return remoteAddr
    }

    return 'unknown'
  }

  /**
   * Get default rate limit key (IP + User ID if available)
   */
  private getDefaultKey(req: NextRequest): string {
    const ip = this.getClientIP(req)
    const userId = req.headers.get('x-user-id') || 'anonymous'
    return `rate_limit:${ip}:${userId}`
  }

  /**
   * Clean up expired entries from memory store
   */
  cleanup(): void {
    const now = Date.now()
    for (const [key, record] of this.memoryStore.entries()) {
      if (record.resetTime < now) {
        this.memoryStore.delete(key)
      }
    }
  }
}

// Pre-configured rate limiters for different endpoints
export const rateLimiters = {
  // Strict rate limiting for sensitive operations
  sensitive: new RateLimiter(),
  
  // Standard rate limiting for POS operations
  standard: new RateLimiter(),
  
  // Lenient rate limiting for public endpoints
  lenient: new RateLimiter(),
  
  // Authentication endpoints
  auth: new RateLimiter(),
}

// Common rate limiting configurations
export const rateLimitConfigs = {
  // Authentication endpoints (login, signup, etc.)
  auth: {
    windowMs: 15 * 60 * 1000, // 15 minutes
    maxRequests: 5, // 5 attempts per 15 minutes
    skipSuccessfulRequests: true,
  },

  // POS operations (sales, products, etc.)
  pos: {
    windowMs: 60 * 1000, // 1 minute
    maxRequests: 100, // 100 requests per minute
  },

  // Payment processing
  payments: {
    windowMs: 60 * 1000, // 1 minute
    maxRequests: 30, // 30 requests per minute
  },

  // File uploads
  uploads: {
    windowMs: 60 * 60 * 1000, // 1 hour
    maxRequests: 10, // 10 uploads per hour
  },

  // API queries
  query: {
    windowMs: 60 * 1000, // 1 minute
    maxRequests: 60, // 60 requests per minute
  },
}