import { clerkMiddleware, createRouteMatcher } from '@clerk/nextjs/server'
import { auth } from '@clerk/nextjs/server'
import { isUserAllowed } from '@/lib/access-control'
import { RateLimiter, rateLimitConfigs } from '@/lib/security/rate-limiter'
import { InputSanitizer, sanitizationRules } from '@/lib/security/input-sanitizer'

// Web Crypto API functions for edge runtime compatibility

// Generate random bytes using Web Crypto API
function generateRandomBytes(length: number): Uint8Array {
    const array = new Uint8Array(length)
    crypto.getRandomValues(array)
    return array
}

// Generate correlation ID using Web Crypto API
async function generateCorrelationId(): Promise<string> {
    const array = generateRandomBytes(16)
    return Array.from(array, byte => byte.toString(16).padStart(2, '0')).join('')
}

// Generate CSRF token using Web Crypto API
function generateCSRFToken(): string {
    const array = generateRandomBytes(32)
    return Array.from(array, byte => byte.toString(16).padStart(2, '0')).join('')
}

// Timing-safe comparison for CSRF tokens
function timingSafeEqual(a: string, b: string): boolean {
    if (a.length !== b.length) {
        return false
    }
    
    let result = 0
    for (let i = 0; i < a.length; i++) {
        result |= a.charCodeAt(i) ^ b.charCodeAt(i)
    }
    
    return result === 0
}

const isProtectedRoute = createRouteMatcher([
    '/api/pos/(.*)',
    '/'
])

const isSensitiveRoute = createRouteMatcher([
    '/api/pos/payments/(.*)',
    '/api/pos/store/settings/(.*)',
    '/api/pos/employees/(.*)',
    '/api/pos/audit/(.*)',
    '/api/pos/security/(.*)'
])

// Initialize rate limiters
const globalRateLimiter = new RateLimiter()
const sensitiveRateLimiter = new RateLimiter()

// Validate CSRF token
function validateCSRFToken(token: string, sessionToken: string): boolean {
    if (!token || !sessionToken) return false
    
    try {
        // Convert hex strings to byte arrays for comparison
        const tokenBytes = new Uint8Array(token.match(/.{2}/g)?.map(byte => parseInt(byte, 16)) || [])
        const sessionBytes = new Uint8Array(sessionToken.match(/.{2}/g)?.map(byte => parseInt(byte, 16)) || [])
        
        if (tokenBytes.length !== sessionBytes.length) {
            return false
        }
        
        // Use timing-safe comparison
        return timingSafeEqual(token, sessionToken)
    } catch (error) {
        return false
    }
}

// Get client IP with enhanced detection
function getClientIP(req: Request): string {
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

// Detect suspicious activity
function detectSuspiciousActivity(req: Request, userAgent: string): boolean {
    const suspiciousPatterns = [
        /sqlmap/i,
        /nikto/i,
        /nessus/i,
        /burp/i,
        /zap/i,
        /acunetix/i,
        /<script/i,
        /javascript:/i,
        /vbscript:/i,
        /onload=/i,
        /onerror=/i,
        /union.*select/i,
        /drop.*table/i,
        /script.*src/i
    ]

    const url = req.url.toLowerCase()
    const headers = Object.fromEntries(req.headers.entries())
    const combinedString = `${url} ${JSON.stringify(headers)} ${userAgent}`

    return suspiciousPatterns.some(pattern => pattern.test(combinedString))
}

export default clerkMiddleware(async (auth, req) => {
    console.log('🔐 Middleware: Request to', req.nextUrl.pathname)
    
    // Generate correlation ID for request tracing
    const correlationId = await generateCorrelationId()
    const clientIP = getClientIP(req)
    const userAgent = req.headers.get('user-agent') || 'unknown'
    
    // Detect suspicious activity
    if (detectSuspiciousActivity(req, userAgent)) {
        console.warn('🚨 Middleware: Suspicious activity detected', {
            correlationId,
            ip: clientIP,
            userAgent,
            path: req.nextUrl.pathname
        })
        
        return new Response(
            JSON.stringify({ error: { code: 'SUSPICIOUS_ACTIVITY', message: 'Request blocked' } }),
            {
                status: 403,
                headers: {
                    'Content-Type': 'application/json',
                    'X-Correlation-ID': correlationId,
                    'X-Content-Type-Options': 'nosniff',
                    'X-Frame-Options': 'DENY',
                    'X-XSS-Protection': '1; mode=block',
                    'Referrer-Policy': 'strict-origin-when-cross-origin'
                }
            }
        )
    }
    
    // Apply rate limiting
    try {
        const isSensitive = isSensitiveRoute(req)
        const rateLimiter = isSensitive ? sensitiveRateLimiter : globalRateLimiter
        const rateLimitConfig = isSensitive 
            ? { ...rateLimitConfigs.payments, maxRequests: 20 }
            : rateLimitConfigs.pos
        
        const rateLimitResult = await rateLimiter.checkLimit(req, {
            ...rateLimitConfig,
            keyGenerator: (request) => {
                const ip = getClientIP(request)
                const userId = request.headers.get('x-user-id') || 'anonymous'
                return `rate_limit:${ip}:${userId}:${isSensitive ? 'sensitive' : 'standard'}`
            }
        })
        
        if (!rateLimitResult.success) {
            console.warn('Rate limit exceeded:', {
                path: req.nextUrl.pathname,
                method: req.method,
                correlationId,
                totalHits: rateLimitResult.totalHits,
                limit: rateLimitResult.limit,
                ip: clientIP
            })
            
            return new Response(
                JSON.stringify({
                    error: {
                        code: 'RATE_LIMIT_EXCEEDED',
                        message: 'Too many requests',
                        retryAfter: Math.ceil((rateLimitResult.reset - Date.now()) / 1000)
                    }
                }),
                {
                    status: 429,
                    headers: {
                        'Content-Type': 'application/json',
                        'Retry-After': Math.ceil((rateLimitResult.reset - Date.now()) / 1000).toString(),
                        'X-Correlation-ID': correlationId,
                        'X-Content-Type-Options': 'nosniff',
                        'X-Frame-Options': 'DENY',
                        'X-XSS-Protection': '1; mode=block',
                        'Referrer-Policy': 'strict-origin-when-cross-origin'
                    }
                }
            )
        }
    } catch (error) {
        console.error('Rate limiting error:', error)
    }
    
    if (isProtectedRoute(req)) {
        console.log('🔒 Middleware: Protected route detected')
        
        try {
            // Get auth state
            const authState = await auth()
            console.log('🔑 Middleware: Auth state:', {
                userId: authState.userId,
                sessionClaims: authState.sessionClaims
            })
            
            if (!authState.userId) {
                console.log('❌ Middleware: No user ID found, redirecting to sign-in')
                console.warn('Unauthorized access attempt:', {
                    path: req.nextUrl.pathname,
                    method: req.method,
                    ip: clientIP,
                    userAgent
                })
                
                // Simple redirect without modifying immutable headers
                const redirectUrl = new URL('/sign-in', req.url)
                return new Response(null, {
                    status: 302,
                    headers: {
                        'Location': redirectUrl.toString(),
                        'X-Correlation-ID': correlationId,
                        'X-Content-Type-Options': 'nosniff',
                        'X-Frame-Options': 'DENY',
                        'X-XSS-Protection': '1; mode=block',
                        'Referrer-Policy': 'strict-origin-when-cross-origin'
                    }
                })
            }
            
            // Extract user information
            const userId = authState.userId
            const sessionClaims = authState.sessionClaims
            
            // Different ways to get email from Clerk
            const sessionClaimsObj = sessionClaims as any
            const email = sessionClaimsObj?.email || 
                         sessionClaimsObj?.['email'] ||
                         sessionClaimsObj?.['email_address'] ||
                         sessionClaimsObj?.['email_addresses']?.[0] ||
                         sessionClaimsObj?.user?.email ||
                         sessionClaimsObj?.metadata?.email
            
            console.log('📧 Middleware: User info:', {
                userId,
                email: email || 'NOT_FOUND',
                sessionClaimsKeys: Object.keys(sessionClaims || {})
            })
            
            // Check if user is allowed access
            const isAllowed = isUserAllowed(userId, email)
            console.log('🛡️ Middleware: Access check result:', {
                userId,
                email,
                isAllowed,
                accessControlMode: process.env.ACCESS_CONTROL_MODE,
                allowedUsers: process.env.ALLOWED_USERS,
                allowedUserIds: process.env.ALLOWED_USER_IDS
            })
            
            if (!isAllowed) {
                console.log('🚫 Middleware: Access denied, redirecting to sign-in')
                console.warn('Access denied - user not in allowed list:', {
                    userId,
                    userEmail: email,
                    path: req.nextUrl.pathname,
                    method: req.method,
                    ip: clientIP,
                    userAgent
                })
                
                // Simple redirect without modifying immutable headers
                const redirectUrl = new URL('/sign-in', req.url)
                return new Response(null, {
                    status: 302,
                    headers: {
                        'Location': redirectUrl.toString(),
                        'X-Correlation-ID': correlationId,
                        'X-Content-Type-Options': 'nosniff',
                        'X-Frame-Options': 'DENY',
                        'X-XSS-Protection': '1; mode=block',
                        'Referrer-Policy': 'strict-origin-when-cross-origin'
                    }
                })
            }
            
            // CSRF protection for state-changing operations
            if (['POST', 'PUT', 'PATCH', 'DELETE'].includes(req.method)) {
                const csrfToken = req.headers.get('x-csrf-token')
                const sessionCSRF = sessionClaimsObj?.csrfToken
                
                if (!csrfToken || !validateCSRFToken(csrfToken, sessionCSRF)) {
                    console.warn('CSRF token validation failed:', {
                        userId,
                        userEmail: email,
                        path: req.nextUrl.pathname,
                        method: req.method,
                        ip: clientIP,
                        userAgent
                    })
                    
                    return new Response(
                        JSON.stringify({ error: { code: 'CSRF_TOKEN_INVALID', message: 'Invalid CSRF token' } }),
                        {
                            status: 403,
                            headers: {
                                'Content-Type': 'application/json',
                                'X-Correlation-ID': correlationId,
                                'X-Content-Type-Options': 'nosniff',
                                'X-Frame-Options': 'DENY',
                                'X-XSS-Protection': '1; mode=block',
                                'Referrer-Policy': 'strict-origin-when-cross-origin'
                            }
                        }
                    )
                }
            }
            
            console.log('✅ Middleware: Access granted')
            
            // Log successful access for sensitive routes
            if (isSensitiveRoute(req)) {
                console.log('Sensitive route access:', {
                    userId,
                    userEmail: email,
                    path: req.nextUrl.pathname,
                    method: req.method,
                    correlationId,
                    ip: clientIP,
                    userAgent
                })
            }
            
        } catch (error) {
            console.error('💥 Middleware: Error during auth check:', error)
            console.error('System error during authentication middleware:', {
                path: req.nextUrl.pathname,
                method: req.method,
                ip: clientIP,
                userAgent,
                error: error instanceof Error ? error.message : 'Unknown error',
                correlationId
            })
            
            // Simple redirect without modifying immutable headers
            const redirectUrl = new URL('/sign-in', req.url)
            return new Response(null, {
                status: 302,
                headers: {
                    'Location': redirectUrl.toString(),
                    'X-Correlation-ID': correlationId,
                    'X-Content-Type-Options': 'nosniff',
                    'X-Frame-Options': 'DENY',
                    'X-XSS-Protection': '1; mode=block',
                    'Referrer-Policy': 'strict-origin-when-cross-origin'
                }
            })
        }
    } else {
        console.log('🌐 Middleware: Public route, no auth required')
    }
    
    // Let Clerk handle the rest of the middleware chain
    return
})

export const config = {
    matcher: [
        // Skip Next.js internals and all static files, unless found in search params
        '/((?!_next|[^?]*\\.(?:html?|css|js(?!on)|jpe?g|webp|png|gif|svg|ttf|woff2?|ico|csv|docx?|xlsx?|zip|webmanifest)).*)',
        // Always run for API routes
        '/(api|trpc)(.*)',
    ],
}