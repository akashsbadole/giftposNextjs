/**
 * Access Control Utility
 * Manages allowed users for Clerk authentication
 */

// Note: This file provides both client-side and server-side access control

export interface AccessControlConfig {
  mode: 'email' | 'user_id'
  allowedUsers: string[]
}

/**
 * Get access control configuration from environment
 */
export function getAccessControlConfig(): AccessControlConfig {
  console.log('🔧 Access Control: Getting configuration...')
  
  const mode = process.env.ACCESS_CONTROL_MODE || 'email'
  const allowedUsers = process.env.ALLOWED_USERS || ''
  const allowedUserIds = process.env.ALLOWED_USER_IDS || ''

  console.log('🔧 Access Control: Environment variables:', {
    mode,
    allowedUsers,
    allowedUserIds,
    allowedUsersLength: allowedUsers.length,
    allowedUserIdsLength: allowedUserIds.length
  })

  let users: string[] = []

  if (mode === 'email' && allowedUsers) {
    users = allowedUsers.split(',').map(email => email.trim().toLowerCase())
    console.log('🔧 Access Control: Email mode - parsed users:', users)
  } else if (mode === 'user_id' && allowedUserIds) {
    users = allowedUserIds.split(',').map(id => id.trim())
    console.log('🔧 Access Control: User ID mode - parsed users:', users)
  } else {
    console.log('🔧 Access Control: No valid configuration found')
  }

  const config = {
    mode: mode as 'email' | 'user_id',
    allowedUsers: users
  }
  
  console.log('🔧 Access Control: Final config:', config)
  
  return config
}

/**
 * Check if user email is allowed (client-side check)
 */
export function isEmailAllowed(userEmail: string): boolean {
  const config = getAccessControlConfig()
  
  if (config.mode !== 'email') return false
  
  return config.allowedUsers.includes(userEmail.toLowerCase())
}

/**
 * Check if user ID is allowed (client-side check)
 */
export function isUserIdAllowed(userId: string): boolean {
  const config = getAccessControlConfig()
  
  if (config.mode !== 'user_id') return false
  
  return config.allowedUsers.includes(userId)
}

/**
 * Server-side user access check
 */
export function isUserAllowed(userId: string, userEmail?: string): boolean {
  console.log('🛡️ Access Control: Checking access for:', {
    userId,
    userEmail,
    userEmailType: typeof userEmail
  })
  
  const config = getAccessControlConfig()
  
  console.log('🛡️ Access Control: Using config:', {
    mode: config.mode,
    allowedUsers: config.allowedUsers,
    allowedUsersLength: config.allowedUsers.length
  })
  
  let isAllowed = false
  
  if (config.mode === 'email' && userEmail) {
    isAllowed = config.allowedUsers.includes(userEmail.toLowerCase())
    console.log('🛡️ Access Control: Email check:', {
      userEmailLower: userEmail.toLowerCase(),
      allowedUsers: config.allowedUsers,
      isAllowed
    })
  } else if (config.mode === 'user_id') {
    isAllowed = config.allowedUsers.includes(userId)
    console.log('🛡️ Access Control: User ID check:', {
      userId,
      allowedUsers: config.allowedUsers,
      isAllowed
    })
  } else {
    console.log('🛡️ Access Control: No valid check conditions met')
  }
  
  console.log('🛡️ Access Control: Final result:', isAllowed)
  return isAllowed
}

/**
 * Get access control info for display/debugging
 */
export function getAccessControlInfo() {
  const config = getAccessControlConfig()
  return {
    mode: config.mode,
    allowedCount: config.allowedUsers.length,
    isConfigured: config.allowedUsers.length > 0
  }
}

/**
 * Get reason for access denial
 */
export function getAccessDenialReason(): string {
  const config = getAccessControlConfig()
  
  if (!config.allowedUsers.length) {
    return 'No allowed users configured. Set ALLOWED_USERS or ALLOWED_USER_IDS in environment variables.'
  }
  
  return `Access restricted to authorized personnel only. Contact your administrator for access.`
}