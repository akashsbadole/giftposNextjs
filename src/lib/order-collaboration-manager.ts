// Collaboration Management Logic for Real-time Order Collaboration
// Comprehensive system for managing real-time collaboration sessions, locks, and conflict resolution

import { OrderState } from './order-state-machine'

export enum CollaborationRole {
  OWNER = 'owner',
  EDITOR = 'editor',
  VIEWER = 'viewer',
  COLLABORATOR = 'collaborator'
}

export enum LockType {
  FULL = 'full',
  ITEMS = 'items',
  CUSTOMER = 'customer',
  PAYMENT = 'payment',
  METADATA = 'metadata'
}

export enum LockScope {
  EXCLUSIVE = 'exclusive',
  SHARED = 'shared',
  READ = 'read'
}

export interface CollaborationSession {
  sessionId: string
  orderId: string
  userId: string
  userEmail?: string
  userName: string
  role: CollaborationRole
  isActive: boolean
  lastSeenAt: Date
  cursorPosition?: CursorPosition
  editLock?: string
  heartbeatAt: Date
  metadata?: Record<string, any>
  createdAt: Date
  updatedAt: Date
}

export interface CursorPosition {
  field: string
  position: number
  selection?: {
    start: number
    end: number
  }
}

export interface EditLock {
  lockId: string
  orderId: string
  userId: string
  userEmail?: string
  userName: string
  lockType: LockType
  lockScope: LockScope
  reason?: string
  isActive: boolean
  expiresAt?: Date
  acquiredAt: Date
  lastRenewedAt: Date
  metadata?: Record<string, any>
  createdAt: Date
  updatedAt: Date
}

export interface ConflictResolution {
  strategy: 'auto_merge' | 'manual_merge' | 'version_control' | 'user_choice'
  conflicts: Conflict[]
  resolution?: {
    field: string
    value: any
    resolvedBy: string
    resolvedAt: Date
  }[]
  resolved: boolean
}

export interface Conflict {
  field: string
  currentValue: any
  incomingValue: any
  conflictType: 'simultaneous_edit' | 'delete_vs_update' | 'type_mismatch'
  severity: 'low' | 'medium' | 'high'
  timestamp: Date
}

export interface UserPresence {
  userId: string
  userName: string
  userEmail?: string
  orderId: string
  sessionId: string
  role: CollaborationRole
  lastSeen: Date
  isActive: boolean
  currentField?: string
  cursorPosition?: CursorPosition
  status: 'active' | 'idle' | 'away' | 'offline'
}

export interface CollaborationConfig {
  enableRealTimeSync: boolean
  sessionTimeoutMinutes: number
  heartbeatIntervalMs: number
  maxConcurrentUsers: number
  enableConflictResolution: boolean
  enableLockTimeout: boolean
  lockTimeoutMinutes: number
  enableAuditLogging: boolean
  enablePresenceTracking: boolean
}

export class CollaborationManager {
  private static config: CollaborationConfig = {
    enableRealTimeSync: true,
    sessionTimeoutMinutes: 30,
    heartbeatIntervalMs: 30000, // 30 seconds
    maxConcurrentUsers: 10,
    enableConflictResolution: true,
    enableLockTimeout: true,
    lockTimeoutMinutes: 15,
    enableAuditLogging: true,
    enablePresenceTracking: true
  }

  private static sessions = new Map<string, CollaborationSession>()
  private static locks = new Map<string, EditLock>()
  private static presenceMap = new Map<string, UserPresence>()
  private static conflictCache = new Map<string, ConflictResolution>()
  private static heartbeatTimers = new Map<string, NodeJS.Timeout>()
  private static cleanupTimers = new Map<string, NodeJS.Timeout>()

  static configure(config: Partial<CollaborationConfig>): void {
    this.config = { ...this.config, ...config }
  }

  // Session Management
  static async createSession(
    orderId: string,
    userId: string,
    userName: string,
    userEmail?: string,
    role: CollaborationRole = CollaborationRole.COLLABORATOR
  ): Promise<{ success: boolean; sessionId?: string; error?: string }> {
    try {
      // Check if user already has an active session
      const existingSession = this.getActiveSession(orderId, userId)
      if (existingSession) {
        return {
          success: true,
          sessionId: existingSession.sessionId,
          error: 'User already has an active session'
        }
      }

      // Check concurrent user limit
      const activeUsers = this.getActiveSessions(orderId)
      if (activeUsers.length >= this.config.maxConcurrentUsers) {
        return {
          success: false,
          error: `Maximum concurrent users (${this.config.maxConcurrentUsers}) exceeded`
        }
      }

      const sessionId = this.generateSessionId()
      const session: CollaborationSession = {
        sessionId,
        orderId,
        userId,
        userName,
        userEmail,
        role,
        isActive: true,
        lastSeenAt: new Date(),
        heartbeatAt: new Date(),
        createdAt: new Date(),
        updatedAt: new Date()
      }

      this.sessions.set(sessionId, session)
      await this.updatePresence(session)

      // Set up heartbeat
      this.startHeartbeat(sessionId)

      // Set up session cleanup
      this.scheduleSessionCleanup(sessionId)

      if (this.config.enableAuditLogging) {
        await this.logSessionEvent('session_created', session)
      }

      return { success: true, sessionId }
    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Failed to create session'
      }
    }
  }

  static async endSession(sessionId: string): Promise<{ success: boolean; error?: string }> {
    try {
      const session = this.sessions.get(sessionId)
      if (!session) {
        return { success: false, error: 'Session not found' }
      }

      session.isActive = false
      session.updatedAt = new Date()

      // Clean up locks owned by this session
      await this.releaseLocksByUser(session.userId, session.orderId)

      // Update presence
      await this.removePresence(session.userId, session.orderId)

      // Clean up timers
      this.stopHeartbeat(sessionId)
      this.clearSessionCleanup(sessionId)

      if (this.config.enableAuditLogging) {
        await this.logSessionEvent('session_ended', session)
      }

      this.sessions.delete(sessionId)

      return { success: true }
    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Failed to end session'
      }
    }
  }

  static getActiveSessions(orderId: string): CollaborationSession[] {
    return Array.from(this.sessions.values()).filter(
      session => session.orderId === orderId && session.isActive
    )
  }

  static getActiveSession(orderId: string, userId: string): CollaborationSession | null {
    return Array.from(this.sessions.values()).find(
      session => session.orderId === orderId && session.userId === userId && session.isActive
    ) || null
  }

  static async updateSessionActivity(
    sessionId: string,
    activity: {
      cursorPosition?: CursorPosition
      editLock?: string
      metadata?: Record<string, any>
    }
  ): Promise<{ success: boolean; error?: string }> {
    try {
      const session = this.sessions.get(sessionId)
      if (!session || !session.isActive) {
        return { success: false, error: 'Session not found or inactive' }
      }

      session.lastSeenAt = new Date()
      session.heartbeatAt = new Date()
      session.updatedAt = new Date()

      if (activity.cursorPosition) {
        session.cursorPosition = activity.cursorPosition
      }

      if (activity.editLock !== undefined) {
        session.editLock = activity.editLock
      }

      if (activity.metadata) {
        session.metadata = { ...session.metadata, ...activity.metadata }
      }

      // Update presence
      await this.updatePresence(session)

      return { success: true }
    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Failed to update session activity'
      }
    }
  }

  // Lock Management
  static async acquireLock(
    orderId: string,
    userId: string,
    lockType: LockType = LockType.FULL,
    scope: LockScope = LockScope.EXCLUSIVE,
    reason?: string,
    timeoutMinutes?: number
  ): Promise<{ success: boolean; lockId?: string; error?: string }> {
    try {
      // Check if lock already exists for this order and type
      const existingLock = this.getLock(orderId, lockType)
      if (existingLock && existingLock.isActive) {
        if (existingLock.userId === userId) {
          // Renew existing lock
          existingLock.lastRenewedAt = new Date()
          existingLock.updatedAt = new Date()
          return { success: true, lockId: existingLock.lockId }
        }

        // Check if existing lock has expired
        if (this.config.enableLockTimeout && existingLock.expiresAt && new Date() > existingLock.expiresAt) {
          // Lock has expired, release it
          await this.releaseLock(existingLock.lockId)
        } else {
          // Lock is active and not expired
          return {
            success: false,
            error: `Order is already locked by ${existingLock.userName}`
          }
        }
      }

      // For shared locks, allow multiple users
      if (scope === LockScope.SHARED) {
        const sharedLocks = this.getSharedLocks(orderId, lockType)
        if (sharedLocks.length >= 5) { // Limit shared locks
          return {
            success: false,
            error: 'Maximum number of shared locks reached'
          }
        }
      }

      const lockId = this.generateLockId()
      const expiresAt = timeoutMinutes || this.config.lockTimeoutMinutes
      const expiresAtDate = this.config.enableLockTimeout 
        ? new Date(Date.now() + expiresAt * 60 * 1000)
        : undefined

      const lock: EditLock = {
        lockId,
        orderId,
        userId,
        userName: this.getUserName(userId),
        lockType,
        lockScope: scope,
        reason,
        isActive: true,
        expiresAt: expiresAtDate,
        acquiredAt: new Date(),
        lastRenewedAt: new Date(),
        createdAt: new Date(),
        updatedAt: new Date()
      }

      this.locks.set(lockId, lock)

      // Set up lock cleanup timer
      if (expiresAtDate) {
        this.scheduleLockCleanup(lockId, expiresAtDate)
      }

      if (this.config.enableAuditLogging) {
        await this.logLockEvent('lock_acquired', lock)
      }

      return { success: true, lockId }
    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Failed to acquire lock'
      }
    }
  }

  static async releaseLock(lockId: string): Promise<{ success: boolean; error?: string }> {
    try {
      const lock = this.locks.get(lockId)
      if (!lock) {
        return { success: false, error: 'Lock not found' }
      }

      lock.isActive = false
      lock.updatedAt = new Date()

      if (this.config.enableAuditLogging) {
        await this.logLockEvent('lock_released', lock)
      }

      this.locks.delete(lockId)
      this.clearLockCleanup(lockId)

      return { success: true }
    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Failed to release lock'
      }
    }
  }

  static async releaseLocksByUser(userId: string, orderId: string): Promise<void> {
    const userLocks = Array.from(this.locks.values()).filter(
      lock => lock.userId === userId && lock.orderId === orderId && lock.isActive
    )

    for (const lock of userLocks) {
      await this.releaseLock(lock.lockId)
    }
  }

  static getLock(orderId: string, lockType: LockType): EditLock | null {
    return Array.from(this.locks.values()).find(
      lock => lock.orderId === orderId && lock.lockType === lockType && lock.isActive
    ) || null
  }

  static getSharedLocks(orderId: string, lockType: LockType): EditLock[] {
    return Array.from(this.locks.values()).filter(
      lock => lock.orderId === orderId && 
              lock.lockType === lockType && 
              lock.lockScope === LockScope.SHARED &&
              lock.isActive
    )
  }

  static getOrderLocks(orderId: string): EditLock[] {
    return Array.from(this.locks.values()).filter(
      lock => lock.orderId === orderId && lock.isActive
    )
  }

  // Conflict Detection and Resolution
  static async detectConflicts(
    orderId: string,
    incomingChanges: Record<string, any>,
    currentOrderData: Record<string, any>
  ): Promise<{ hasConflicts: boolean; conflicts: Conflict[] }> {
    const conflicts: Conflict[] = []

    for (const [field, incomingValue] of Object.entries(incomingChanges)) {
      const currentValue = currentOrderData[field]

      if (currentValue !== undefined && this.hasConflict(field, currentValue, incomingValue)) {
        conflicts.push({
          field,
          currentValue,
          incomingValue,
          conflictType: this.determineConflictType(field, currentValue, incomingValue),
          severity: this.assessConflictSeverity(field, currentValue, incomingValue),
          timestamp: new Date()
        })
      }
    }

    return {
      hasConflicts: conflicts.length > 0,
      conflicts
    }
  }

  static async resolveConflicts(
    orderId: string,
    conflicts: Conflict[],
    strategy: 'auto_merge' | 'manual_merge' | 'version_control' | 'user_choice',
    resolutionData?: Record<string, any>
  ): Promise<{ success: boolean; resolution?: ConflictResolution; error?: string }> {
    try {
      let resolution: ConflictResolution

      switch (strategy) {
        case 'auto_merge':
          resolution = await this.performAutoMerge(conflicts)
          break
        case 'manual_merge':
          resolution = await this.performManualMerge(conflicts, resolutionData)
          break
        case 'version_control':
          resolution = await this.performVersionControl(conflicts)
          break
        case 'user_choice':
          resolution = await this.performUserChoice(conflicts, resolutionData)
          break
        default:
          return { success: false, error: 'Unknown conflict resolution strategy' }
      }

      this.conflictCache.set(orderId, resolution)

      return { success: true, resolution }
    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Failed to resolve conflicts'
      }
    }
  }

  private static async performAutoMerge(conflicts: Conflict[]): Promise<ConflictResolution> {
    const resolutions = conflicts.map(conflict => {
      // Simple auto-merge logic: prefer most recent or higher value
      let resolvedValue = conflict.incomingValue

      if (typeof conflict.currentValue === 'number' && typeof conflict.incomingValue === 'number') {
        resolvedValue = Math.max(conflict.currentValue, conflict.incomingValue)
      } else if (typeof conflict.currentValue === 'string' && typeof conflict.incomingValue === 'string') {
        resolvedValue = conflict.incomingValue.length >= conflict.currentValue.length 
          ? conflict.incomingValue 
          : conflict.currentValue
      }

      return {
        field: conflict.field,
        value: resolvedValue,
        resolvedBy: 'auto_merge',
        resolvedAt: new Date()
      }
    })

    return {
      strategy: 'auto_merge',
      conflicts,
      resolution: resolutions,
      resolved: true
    }
  }

  private static async performManualMerge(
    conflicts: Conflict[],
    resolutionData?: Record<string, any>
  ): Promise<ConflictResolution> {
    const resolutions = conflicts.map(conflict => {
      const userChoice = resolutionData?.[conflict.field]
      return {
        field: conflict.field,
        value: userChoice || conflict.currentValue, // Default to current value
        resolvedBy: 'manual_merge',
        resolvedAt: new Date()
      }
    })

    return {
      strategy: 'manual_merge',
      conflicts,
      resolution: resolutions,
      resolved: true
    }
  }

  private static async performVersionControl(conflicts: Conflict[]): Promise<ConflictResolution> {
    // Create version control approach - keep both values with prefixes
    const resolutions = conflicts.map(conflict => {
      const timestamp = new Date().toISOString()
      return {
        field: conflict.field,
        value: {
          original: conflict.currentValue,
          incoming: conflict.incomingValue,
          timestamp,
          merged: false
        },
        resolvedBy: 'version_control',
        resolvedAt: new Date()
      }
    })

    return {
      strategy: 'version_control',
      conflicts,
      resolution: resolutions,
      resolved: true
    }
  }

  private static async performUserChoice(
    conflicts: Conflict[],
    resolutionData?: Record<string, any>
  ): Promise<ConflictResolution> {
    // User choice requires manual resolution
    return {
      strategy: 'user_choice',
      conflicts,
      resolved: false
    }
  }

  // Presence Management
  static async updatePresence(session: CollaborationSession): Promise<void> {
    if (!this.config.enablePresenceTracking) return

    const presence: UserPresence = {
      userId: session.userId,
      userName: session.userName,
      userEmail: session.userEmail,
      orderId: session.orderId,
      sessionId: session.sessionId,
      role: session.role,
      lastSeen: session.lastSeenAt,
      isActive: session.isActive,
      currentField: session.editLock,
      cursorPosition: session.cursorPosition,
      status: this.determineUserStatus(session)
    }

    this.presenceMap.set(`${session.orderId}_${session.userId}`, presence)
  }

  static async removePresence(userId: string, orderId: string): Promise<void> {
    this.presenceMap.delete(`${orderId}_${userId}`)
  }

  static getOrderPresence(orderId: string): UserPresence[] {
    return Array.from(this.presenceMap.values()).filter(
      presence => presence.orderId === orderId && presence.isActive
    )
  }

  // Utility Methods
  private static generateSessionId(): string {
    return `session_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`
  }

  private static generateLockId(): string {
    return `lock_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`
  }

  private static getUserName(userId: string): string {
    const session = Array.from(this.sessions.values()).find(s => s.userId === userId)
    return session?.userName || `User ${userId}`
  }

  private static hasConflict(field: string, currentValue: any, incomingValue: any): boolean {
    return JSON.stringify(currentValue) !== JSON.stringify(incomingValue)
  }

  private static determineConflictType(field: string, currentValue: any, incomingValue: any): 'simultaneous_edit' | 'delete_vs_update' | 'type_mismatch' {
    if (currentValue === null && incomingValue !== null) return 'delete_vs_update'
    if (typeof currentValue !== typeof incomingValue) return 'type_mismatch'
    return 'simultaneous_edit'
  }

  private static assessConflictSeverity(field: string, currentValue: any, incomingValue: any): 'low' | 'medium' | 'high' {
    const criticalFields = ['total', 'payment', 'customerId']
    if (criticalFields.includes(field)) return 'high'
    if (field.includes('metadata') || field.includes('notes')) return 'low'
    return 'medium'
  }

  private static determineUserStatus(session: CollaborationSession): 'active' | 'idle' | 'away' | 'offline' {
    const timeSinceActivity = Date.now() - session.lastSeenAt.getTime()
    
    if (timeSinceActivity < 60000) return 'active'      // 1 minute
    if (timeSinceActivity < 300000) return 'idle'       // 5 minutes  
    if (timeSinceActivity < 600000) return 'away'       // 10 minutes
    return 'offline'
  }

  // Heartbeat Management
  private static startHeartbeat(sessionId: string): void {
    if (!this.config.enableRealTimeSync) return

    const timer = setInterval(async () => {
      const session = this.sessions.get(sessionId)
      if (!session || !session.isActive) {
        this.stopHeartbeat(sessionId)
        return
      }

      // Update heartbeat
      session.heartbeatAt = new Date()
      await this.updatePresence(session)
    }, this.config.heartbeatIntervalMs)

    this.heartbeatTimers.set(sessionId, timer)
  }

  private static stopHeartbeat(sessionId: string): void {
    const timer = this.heartbeatTimers.get(sessionId)
    if (timer) {
      clearInterval(timer)
      this.heartbeatTimers.delete(sessionId)
    }
  }

  // Cleanup Management
  private static scheduleSessionCleanup(sessionId: string): void {
    const cleanupTime = this.config.sessionTimeoutMinutes * 60 * 1000
    const timer = setTimeout(async () => {
      await this.endSession(sessionId)
    }, cleanupTime)

    this.cleanupTimers.set(sessionId, timer)
  }

  private static clearSessionCleanup(sessionId: string): void {
    const timer = this.cleanupTimers.get(sessionId)
    if (timer) {
      clearTimeout(timer)
      this.cleanupTimers.delete(sessionId)
    }
  }

  private static scheduleLockCleanup(lockId: string, expiresAt: Date): void {
    const delay = expiresAt.getTime() - Date.now()
    const timer = setTimeout(async () => {
      await this.releaseLock(lockId)
    }, delay)

    this.cleanupTimers.set(`lock_${lockId}`, timer)
  }

  private static clearLockCleanup(lockId: string): void {
    const timer = this.cleanupTimers.get(`lock_${lockId}`)
    if (timer) {
      clearTimeout(timer)
      this.cleanupTimers.delete(`lock_${lockId}`)
    }
  }

  // Audit Logging
  private static async logSessionEvent(event: string, session: CollaborationSession): Promise<void> {
    const logEntry = {
      event,
      sessionId: session.sessionId,
      orderId: session.orderId,
      userId: session.userId,
      userName: session.userName,
      role: session.role,
      timestamp: new Date()
    }
    
    console.log('Collaboration session event:', logEntry)
  }

  private static async logLockEvent(event: string, lock: EditLock): Promise<void> {
    const logEntry = {
      event,
      lockId: lock.lockId,
      orderId: lock.orderId,
      userId: lock.userId,
      userName: lock.userName,
      lockType: lock.lockType,
      lockScope: lock.lockScope,
      timestamp: new Date()
    }
    
    console.log('Collaboration lock event:', logEntry)
  }

  // Cleanup and Maintenance
  static cleanupInactiveSessions(): void {
    const now = new Date()
    const timeoutMs = this.config.sessionTimeoutMinutes * 60 * 1000

    for (const [sessionId, session] of this.sessions.entries()) {
      if (session.isActive && (now.getTime() - session.lastSeenAt.getTime()) > timeoutMs) {
        this.endSession(sessionId)
      }
    }
  }

  static cleanupExpiredLocks(): void {
    const now = new Date()

    for (const [lockId, lock] of this.locks.entries()) {
      if (lock.isActive && lock.expiresAt && now > lock.expiresAt) {
        this.releaseLock(lockId)
      }
    }
  }

  static getCollaborationStats(): {
    activeSessions: number
    activeLocks: number
    presenceCount: number
    pendingConflicts: number
  } {
    return {
      activeSessions: this.sessions.size,
      activeLocks: Array.from(this.locks.values()).filter(l => l.isActive).length,
      presenceCount: this.presenceMap.size,
      pendingConflicts: this.conflictCache.size
    }
  }

  static destroy(): void {
    // Clean up all timers
    this.heartbeatTimers.forEach(timer => clearInterval(timer))
    this.cleanupTimers.forEach(timer => clearTimeout(timer))
    
    this.heartbeatTimers.clear()
    this.cleanupTimers.clear()
    this.sessions.clear()
    this.locks.clear()
    this.presenceMap.clear()
    this.conflictCache.clear()
  }
}

// Export utility functions
export const CollaborationUtils = {
  canUserEdit: (session: CollaborationSession, lockType: LockType): boolean => {
    return session.role === CollaborationRole.OWNER || 
           session.role === CollaborationRole.EDITOR ||
           (session.role === CollaborationRole.COLLABORATOR && lockType !== LockType.FULL)
  },

  getLockPriority: (lockType: LockType): number => {
    const priorities: Record<LockType, number> = {
      [LockType.FULL]: 100,
      [LockType.PAYMENT]: 80,
      [LockType.CUSTOMER]: 60,
      [LockType.ITEMS]: 40,
      [LockType.METADATA]: 20
    }
    return priorities[lockType] || 0
  },

  isLockCompatible: (lock1: EditLock, lock2: EditLock): boolean => {
    if (lock1.lockScope === LockScope.READ || lock2.lockScope === LockScope.READ) {
      return true
    }
    
    if (lock1.lockType !== lock2.lockType) {
      return true
    }
    
    return lock1.lockScope === LockScope.SHARED && lock2.lockScope === LockScope.SHARED
  }
}