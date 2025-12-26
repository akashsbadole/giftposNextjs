# Clerk Session Configuration Guide

## Overview

This guide provides comprehensive instructions for configuring Clerk authentication sessions in your POS application. By default, sessions are set to 15 days (1,296,000 seconds) to minimize friction for retail environments while maintaining security.

## Configuration Methods

You can configure session duration using either of these methods:

1. **Environment Variable Configuration** (Recommended for development/staging)
2. **Clerk Dashboard Configuration** (Recommended for production)

## Method 1: Environment Variable Configuration

### Step 1: Update Environment Variables

Add the session duration variable to your `.env` file:

```bash
# Set session duration to 15 days (1,296,000 seconds)
NEXT_PUBLIC_CLERK_SESSION_DURATION=1296000
```

### Step 2: Session Duration Options

Choose the appropriate duration for your use case:

| Duration | Value | Use Case |
|----------|-------|----------|
| 1 minute | 60 | Development only |
| 1 hour | 3600 | Development/testing |
| 1 day | 86400 | Short sessions |
| 1 week | 604800 | Standard sessions |
| **15 days** | **1296000** | **Recommended for POS** |
| 30 days | 2592000 | Maximum for production |

### Step 3: Restart Application

After updating the environment variable, restart your development server:

```bash
npm run dev
```

## Method 2: Clerk Dashboard Configuration

### Step 1: Access Clerk Dashboard

1. Go to [Clerk Dashboard](https://dashboard.clerk.com)
2. Sign in to your account
3. Select your application

### Step 2: Navigate to Session Settings

1. In the left sidebar, click **"Configure"**
2. Click **"Authentication"**
3. Click **"Session"** tab

### Step 3: Configure Session Duration

1. In the **"Session lifetime"** section, click **"Custom"**
2. Set the duration to **15 days** (or your preferred duration)
3. Click **"Apply changes"**

### Step 4: Save Configuration

1. Click **"Save changes"** at the bottom of the page
2. Wait for the changes to propagate (usually 1-2 minutes)

## Testing Your Configuration

### Verify Session Duration

1. **Login Test**:
   - Open your application
   - Login with valid credentials
   - Check browser developer tools (Application > Cookies)

2. **Check Cookie Expiry**:
   - Look for `__session` cookie
   - Verify expiration date is 15 days from now

3. **Session Persistence Test**:
   - Close browser completely
   - Reopen application
   - Confirm user remains logged in

### Browser Developer Tools Verification

1. Open Developer Tools (F12)
2. Go to **Application** tab
3. Navigate to **Cookies** > Your domain
4. Check `__clerk_session` cookie expiration

## Troubleshooting

### Common Issues

#### Issue: Session expires too quickly

**Possible Causes:**
- Environment variable not loaded
- Dashboard configuration conflict
- Browser settings clearing cookies

**Solutions:**
1. Verify environment variable is set correctly
2. Clear browser cookies and test again
3. Check for multiple session configurations (environment vs dashboard)

#### Issue: Session never expires

**Possible Causes:**
- Duration set too high
- Multiple applications sharing session

**Solutions:**
1. Reduce session duration for security
2. Use different domains/subdomains for different applications

#### Issue: Configuration not taking effect

**Possible Causes:**
- Server not restarted
- Environment variable format incorrect
- Cache issues

**Solutions:**
1. Restart development server
2. Verify variable format (should be numeric value)
3. Clear application cache

### Debugging Steps

1. **Check Environment Variables**:
   ```bash
   # Check if variable is loaded
   echo $NEXT_PUBLIC_CLERK_SESSION_DURATION
   ```

2. **Verify Clerk Configuration**:
   - Check Clerk Dashboard for active sessions
   - Review session settings

3. **Browser Console Check**:
   - Open browser console
   - Check for Clerk-related errors
   - Verify session information

### Security Considerations

- **15-day sessions** are suitable for POS systems but may be too long for high-security applications
- Consider shorter durations (1-7 days) for applications handling sensitive data
- Always use HTTPS in production to secure session cookies
- Regularly audit user sessions and implement session revocation when needed

## Production Deployment

### Environment-Specific Configuration

**Development:**
```bash
NEXT_PUBLIC_CLERK_SESSION_DURATION=3600  # 1 hour
```

**Staging:**
```bash
NEXT_PUBLIC_CLERK_SESSION_DURATION=86400  # 1 day
```

**Production:**
```bash
NEXT_PUBLIC_CLERK_SESSION_DURATION=1296000  # 15 days
```

### Deployment Checklist

- [ ] Environment variables set in deployment platform
- [ ] Clerk Dashboard configured for production
- [ ] Session duration appropriate for security requirements
- [ ] HTTPS enabled for secure cookies
- [ ] Session monitoring enabled
- [ ] Error tracking configured

## Session Management API

### Programmatic Session Control

You can also manage sessions programmatically:

```typescript
import { useUser } from '@clerk/nextjs';

function SessionManager() {
  const { signOut, getToken } = useUser();
  
  const handleLogout = async () => {
    await signOut();
  };
  
  const refreshSession = async () => {
    const token = await getToken();
    // Token will use the configured session duration
  };
  
  return (
    <div>
      <button onClick={handleLogout}>Logout</button>
      <button onClick={refreshSession}>Refresh Session</button>
    </div>
  );
}
```

### Session Events

Monitor session events for better user experience:

```typescript
import { useEffect } from 'react';
import { useUser } from '@clerk/nextjs';

function SessionMonitor() {
  const { isLoaded, isSignedIn } = useUser();
  
  useEffect(() => {
    if (isLoaded && isSignedIn) {
      console.log('User session active');
      // Implement session tracking
    }
  }, [isLoaded, isSignedIn]);
  
  return null;
}
```

## Support and Resources

### Documentation Links

- [Clerk Session Management](https://clerk.com/docs/references/javascript/clerk/session)
- [Clerk Environment Variables](https://clerk.com/docs/deployments/environment-variables)
- [Clerk Dashboard Guide](https://clerk.com/docs/dashboard/overview)

### Getting Help

1. Check Clerk documentation
2. Review application logs for errors
3. Test with different session durations
4. Contact support if configuration issues persist

## Summary

This configuration provides a flexible approach to session management:

- **Environment variables** for development flexibility
- **Dashboard configuration** for production control
- **15-day default** for optimal POS user experience
- **Multiple duration options** for different security requirements
- **Comprehensive testing** and troubleshooting guides

Choose the method that best fits your deployment needs and security requirements.