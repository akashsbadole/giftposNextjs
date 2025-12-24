import { clerkMiddleware, createRouteMatcher } from '@clerk/nextjs/server'
import { auth } from '@clerk/nextjs/server'
import { isUserAllowed } from '@/lib/access-control'

const isProtectedRoute = createRouteMatcher([
    '/api/pos/(.*)',
    '/' // Protect the main application
])

export default clerkMiddleware(async (auth, req) => {
    console.log('🔐 Middleware: Request to', req.nextUrl.pathname)
    
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
                return Response.redirect(new URL('/sign-in', req.url))
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
                return Response.redirect(new URL('/sign-in', req.url))
            }
            
            console.log('✅ Middleware: Access granted')
            
        } catch (error) {
            console.error('💥 Middleware: Error during auth check:', error)
            return Response.redirect(new URL('/sign-in', req.url))
        }
    } else {
        console.log('🌐 Middleware: Public route, no auth required')
    }
})

export const config = {
    matcher: [
        // Skip Next.js internals and all static files, unless found in search params
        '/((?!_next|[^?]*\\.(?:html?|css|js(?!on)|jpe?g|webp|png|gif|svg|ttf|woff2?|ico|csv|docx?|xlsx?|zip|webmanifest)).*)',
        // Always run for API routes
        '/(api|trpc)(.*)',
    ],
}