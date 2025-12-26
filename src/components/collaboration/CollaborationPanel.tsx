'use client'

import { useState, useEffect, useCallback, useRef } from 'react'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Avatar } from '@/components/ui/avatar'
import { ScrollArea } from '@/components/ui/scroll-area'
import { Separator } from '@/components/ui/separator'
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog'
import {
  Users,
  Eye,
  Edit,
  Lock,
  Unlock,
  User,
  Clock,
  Activity,
  AlertTriangle,
  CheckCircle,
  XCircle,
  Zap,
  Wifi,
  WifiOff,
  UserPlus,
  UserMinus,
  MessageSquare,
  AlertCircle
} from 'lucide-react'

interface User {
  id: string
  name: string
  email: string
  avatar?: string
  role: 'admin' | 'manager' | 'cashier' | 'viewer'
  isOnline: boolean
  lastSeen: Date
  cursor?: {
    x: number
    y: number
    orderId?: string
    timestamp: Date
  }
  activeOrders: string[]
  lockedOrders: string[]
  status: 'active' | 'idle' | 'away'
}

interface CollaborationSession {
  id: string
  orderId: string
  participants: User[]
  lockedBy?: string
  locks: Array<{
    userId: string
    field: string
    timestamp: Date
  }>
  conflicts: Array<{
    userId: string
    field: string
    value: any
    timestamp: Date
  }>
  lastActivity: Date
}

interface CollaborationPanelProps {
  storeId: string
  orderId?: string
  isOpen: boolean
  onClose: () => void
  onLockRequest?: (orderId: string, field: string) => void
  onUnlockRequest?: (orderId: string, field: string) => void
}

export default function CollaborationPanel({
  storeId,
  orderId,
  isOpen,
  onClose,
  onLockRequest,
  onUnlockRequest
}: CollaborationPanelProps) {
  const [users, setUsers] = useState<User[]>([])
  const [sessions, setSessions] = useState<CollaborationSession[]>([])
  const [currentUser, setCurrentUser] = useState<User | null>(null)
  const [notifications, setNotifications] = useState<Array<{
    id: string
    type: 'user_join' | 'user_leave' | 'lock' | 'unlock' | 'conflict' | 'activity'
    message: string
    userId: string
    timestamp: Date
  }>>([])
  const [activityFeed, setActivityFeed] = useState<Array<{
    id: string
    userId: string
    action: string
    target: string
    timestamp: Date
    type: 'edit' | 'lock' | 'unlock' | 'view' | 'conflict'
  }>>([])
  const [realtimeConnected, setRealtimeConnected] = useState(false)
  const wsRef = useRef<WebSocket | null>(null)

  // Initialize WebSocket connection for real-time collaboration
  useEffect(() => {
    if (!isOpen || !storeId) return

    const connectWebSocket = () => {
      const protocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:'
      const wsUrl = `${protocol}//${window.location.host}/ws/collaboration?storeId=${storeId}`
      
      const ws = new WebSocket(wsUrl)
      wsRef.current = ws

      ws.onopen = () => {
        setRealtimeConnected(true)
        // Join collaboration session
        ws.send(JSON.stringify({
          type: 'join',
          storeId,
          userId: currentUser?.id,
          orderId
        }))
      }

      ws.onmessage = (event) => {
        const data = JSON.parse(event.data)
        handleRealtimeMessage(data)
      }

      ws.onclose = () => {
        setRealtimeConnected(false)
        // Attempt to reconnect after 3 seconds
        setTimeout(connectWebSocket, 3000)
      }

      ws.onerror = (error) => {
        console.error('WebSocket error:', error)
        setRealtimeConnected(false)
      }
    }

    connectWebSocket()

    return () => {
      if (wsRef.current) {
        wsRef.current.close()
      }
    }
  }, [isOpen, storeId, currentUser?.id, orderId])

  // Load initial data
  useEffect(() => {
    if (!isOpen || !storeId) return

    loadUsers()
    loadSessions()
    loadCurrentUser()
  }, [isOpen, storeId])

  // Handle real-time messages
  const handleRealtimeMessage = useCallback((data: any) => {
    switch (data.type) {
      case 'user_joined':
        addNotification({
          type: 'user_join',
          message: `${data.user.name} joined the session`,
          userId: data.user.id
        })
        setUsers(prev => [...prev.filter(u => u.id !== data.user.id), data.user])
        break

      case 'user_left':
        addNotification({
          type: 'user_leave',
          message: `${data.user.name} left the session`,
          userId: data.user.id
        })
        setUsers(prev => prev.filter(u => u.id !== data.user.id))
        break

      case 'cursor_update':
        setUsers(prev => prev.map(user => 
          user.id === data.userId 
            ? { ...user, cursor: data.cursor }
            : user
        ))
        break

      case 'order_locked':
        addNotification({
          type: 'lock',
          message: `${data.userName} locked ${data.field} in order ${data.orderId}`,
          userId: data.userId
        })
        updateSessionLocks(data.orderId, data.userId, data.field, true)
        break

      case 'order_unlocked':
        addNotification({
          type: 'unlock',
          message: `${data.userName} unlocked ${data.field} in order ${data.orderId}`,
          userId: data.userId
        })
        updateSessionLocks(data.orderId, data.userId, data.field, false)
        break

      case 'conflict_detected':
        addNotification({
          type: 'conflict',
          message: `Conflict detected in ${data.field} - ${data.userName} vs ${data.otherUserName}`,
          userId: data.userId
        })
        addConflict(data.orderId, data.userId, data.field, data.value)
        break

      case 'activity':
        addActivity({
          userId: data.userId,
          action: data.action,
          target: data.target,
          type: data.activityType
        })
        break

      default:
        console.log('Unknown message type:', data.type)
    }
  }, [])

  const loadUsers = async () => {
    try {
      const response = await fetch(`/api/pos/orders/collaboration/users?storeId=${storeId}`)
      if (response.ok) {
        const data = await response.json()
        setUsers(data.users || [])
      }
    } catch (error) {
      console.error('Error loading users:', error)
    }
  }

  const loadSessions = async () => {
    try {
      const response = await fetch(`/api/pos/orders/collaboration/sessions?storeId=${storeId}${orderId ? `&orderId=${orderId}` : ''}`)
      if (response.ok) {
        const data = await response.json()
        setSessions(data.sessions || [])
      }
    } catch (error) {
      console.error('Error loading sessions:', error)
    }
  }

  const loadCurrentUser = async () => {
    try {
      const response = await fetch('/api/auth/user')
      if (response.ok) {
        const data = await response.json()
        setCurrentUser(data.user)
      }
    } catch (error) {
      console.error('Error loading current user:', error)
    }
  }

  const addNotification = (notification: {
    type: 'user_join' | 'user_leave' | 'lock' | 'unlock' | 'conflict' | 'activity'
    message: string
    userId: string
  }) => {
    const id = Date.now().toString()
    setNotifications(prev => [{
      id,
      ...notification,
      timestamp: new Date()
    }, ...prev.slice(0, 9)]) // Keep latest 10 notifications
  }

  const addActivity = (activity: {
    userId: string
    action: string
    target: string
    type: 'edit' | 'lock' | 'unlock' | 'view' | 'conflict'
  }) => {
    const id = Date.now().toString()
    setActivityFeed(prev => [{
      id,
      ...activity,
      timestamp: new Date()
    }, ...prev.slice(0, 49)]) // Keep latest 50 activities
  }

  const updateSessionLocks = (orderId: string, userId: string, field: string, locked: boolean) => {
    setSessions(prev => prev.map(session => {
      if (session.orderId === orderId) {
        const updatedLocks = locked
          ? [...session.locks, { userId, field, timestamp: new Date() }]
          : session.locks.filter(lock => !(lock.userId === userId && lock.field === field))
        
        return { ...session, locks: updatedLocks }
      }
      return session
    }))
  }

  const addConflict = (orderId: string, userId: string, field: string, value: any) => {
    setSessions(prev => prev.map(session => {
      if (session.orderId === orderId) {
        return {
          ...session,
          conflicts: [...session.conflicts, { userId, field, value, timestamp: new Date() }]
        }
      }
      return session
    }))
  }

  const requestLock = async (orderId: string, field: string) => {
    if (wsRef.current && wsRef.current.readyState === WebSocket.OPEN) {
      wsRef.current.send(JSON.stringify({
        type: 'lock_request',
        orderId,
        field,
        userId: currentUser?.id
      }))
      onLockRequest?.(orderId, field)
    }
  }

  const releaseLock = async (orderId: string, field: string) => {
    if (wsRef.current && wsRef.current.readyState === WebSocket.OPEN) {
      wsRef.current.send(JSON.stringify({
        type: 'unlock_request',
        orderId,
        field,
        userId: currentUser?.id
      }))
      onUnlockRequest?.(orderId, field)
    }
  }

  const getUserStatusColor = (status: string) => {
    switch (status) {
      case 'active': return 'bg-green-400'
      case 'idle': return 'bg-yellow-400'
      case 'away': return 'bg-red-400'
      default: return 'bg-gray-400'
    }
  }

  const getUserRoleColor = (role: string) => {
    switch (role) {
      case 'admin': return 'bg-purple-500/20 text-purple-400 border-purple-500/30'
      case 'manager': return 'bg-blue-500/20 text-blue-400 border-blue-500/30'
      case 'cashier': return 'bg-green-500/20 text-green-400 border-green-500/30'
      case 'viewer': return 'bg-gray-500/20 text-gray-400 border-gray-500/30'
      default: return 'bg-gray-500/20 text-gray-400 border-gray-500/30'
    }
  }

  const formatTimeAgo = (date: Date) => {
    const now = new Date()
    const diff = now.getTime() - date.getTime()
    const minutes = Math.floor(diff / 60000)
    const hours = Math.floor(minutes / 60)
    const days = Math.floor(hours / 24)

    if (days > 0) return `${days}d ago`
    if (hours > 0) return `${hours}h ago`
    if (minutes > 0) return `${minutes}m ago`
    return 'Just now'
  }

  if (!isOpen) return null

  return (
    <div className="fixed inset-0 z-50 bg-black/50 flex items-center justify-center">
      <div className="bg-gray-900 border border-blue-500 rounded-lg shadow-2xl w-full max-w-6xl h-[90vh] flex flex-col">
        {/* Header */}
        <div className="flex items-center justify-between p-6 border-b border-blue-500">
          <div className="flex items-center gap-4">
            <h2 className="text-2xl font-bold text-gray-400">Real-time Collaboration</h2>
            <div className="flex items-center gap-2">
              <div className={`w-3 h-3 rounded-full ${realtimeConnected ? 'bg-green-400 animate-pulse' : 'bg-red-400'}`} />
              <span className="text-sm text-gray-400">
                {realtimeConnected ? 'Connected' : 'Disconnected'}
              </span>
            </div>
          </div>
          
          <div className="flex items-center gap-2">
            <Badge variant="outline" className="border-blue-500 text-gray-400">
              <Users className="w-3 h-3 mr-1" />
              {users.length} online
            </Badge>
            <Button variant="ghost" size="sm" onClick={onClose} className="text-gray-400 hover:text-white">
              ✕
            </Button>
          </div>
        </div>

        <div className="flex-1 flex overflow-hidden">
          {/* Left Panel - Active Users */}
          <div className="w-1/3 border-r border-blue-500 p-4">
            <div className="space-y-4">
              <div>
                <h3 className="text-lg font-semibold text-gray-400 mb-3">Active Users</h3>
                <ScrollArea className="h-64">
                  <div className="space-y-2">
                    {users.map((user) => (
                      <Card key={user.id} className="bg-gray-800 border-blue-500">
                        <CardContent className="p-3">
                          <div className="flex items-center gap-3">
                            <div className="relative">
                              <Avatar className="w-8 h-8">
                                <div className="w-full h-full bg-blue-500 rounded-full flex items-center justify-center text-white text-sm font-medium">
                                  {user.name.charAt(0).toUpperCase()}
                                </div>
                              </Avatar>
                              <div className={`absolute -bottom-1 -right-1 w-3 h-3 rounded-full border-2 border-gray-800 ${getUserStatusColor(user.status)}`} />
                            </div>
                            
                            <div className="flex-1 min-w-0">
                              <p className="text-sm font-medium text-gray-400 truncate">{user.name}</p>
                              <div className="flex items-center gap-2">
                                <Badge className={`text-xs ${getUserRoleColor(user.role)}`}>
                                  {user.role}
                                </Badge>
                                {user.cursor && (
                                  <Tooltip>
                                    <TooltipTrigger>
                                      <Eye className="w-3 h-3 text-blue-400" />
                                    </TooltipTrigger>
                                    <TooltipContent>
                                      Viewing order: {user.cursor.orderId}
                                    </TooltipContent>
                                  </Tooltip>
                                )}
                              </div>
                            </div>
                          </div>
                          
                          {user.activeOrders.length > 0 && (
                            <div className="mt-2">
                              <p className="text-xs text-gray-500 mb-1">Active Orders:</p>
                              <div className="flex flex-wrap gap-1">
                                {user.activeOrders.slice(0, 3).map(orderId => (
                                  <Badge key={orderId} variant="outline" className="text-xs">
                                    {orderId}
                                  </Badge>
                                ))}
                                {user.activeOrders.length > 3 && (
                                  <Badge variant="outline" className="text-xs">
                                    +{user.activeOrders.length - 3}
                                  </Badge>
                                )}
                              </div>
                            </div>
                          )}
                        </CardContent>
                      </Card>
                    ))}
                  </div>
                </ScrollArea>
              </div>

              {/* Collaboration Sessions */}
              {sessions.length > 0 && (
                <div>
                  <h3 className="text-lg font-semibold text-gray-400 mb-3">Active Sessions</h3>
                  <ScrollArea className="h-48">
                    <div className="space-y-2">
                      {sessions.map((session) => (
                        <Card key={session.id} className="bg-gray-800 border-blue-500">
                          <CardContent className="p-3">
                            <div className="flex items-center justify-between mb-2">
                              <p className="text-sm font-medium text-gray-400">Order {session.orderId}</p>
                              <Badge variant="outline" className="text-xs">
                                {session.participants.length} users
                              </Badge>
                            </div>
                            
                            {session.locks.length > 0 && (
                              <div className="mb-2">
                                <p className="text-xs text-gray-500 mb-1">Locked Fields:</p>
                                <div className="flex flex-wrap gap-1">
                                  {session.locks.map((lock, index) => (
                                    <Tooltip key={index}>
                                      <TooltipTrigger>
                                        <Lock className="w-3 h-3 text-red-400" />
                                      </TooltipTrigger>
                                      <TooltipContent>
                                        Locked by user {lock.userId} at {formatTimeAgo(lock.timestamp)}
                                      </TooltipContent>
                                    </Tooltip>
                                  ))}
                                </div>
                              </div>
                            )}
                            
                            {session.conflicts.length > 0 && (
                              <div className="flex items-center gap-1 text-red-400">
                                <AlertTriangle className="w-3 h-3" />
                                <span className="text-xs">{session.conflicts.length} conflicts</span>
                              </div>
                            )}
                          </CardContent>
                        </Card>
                      ))}
                    </div>
                  </ScrollArea>
                </div>
              )}
            </div>
          </div>

          {/* Center Panel - Activity Feed */}
          <div className="flex-1 p-4">
            <h3 className="text-lg font-semibold text-gray-400 mb-3">Activity Feed</h3>
            <ScrollArea className="h-full">
              <div className="space-y-3">
                {activityFeed.map((activity) => {
                  const user = users.find(u => u.id === activity.userId)
                  return (
                    <div key={activity.id} className="flex items-start gap-3 p-3 rounded-lg bg-gray-800/50 border border-blue-500">
                      <Avatar className="w-6 h-6">
                        <div className="w-full h-full bg-blue-500 rounded-full flex items-center justify-center text-white text-xs">
                          {user?.name.charAt(0).toUpperCase() || '?'}
                        </div>
                      </Avatar>
                      
                      <div className="flex-1">
                        <p className="text-sm text-gray-400">
                          <span className="font-medium">{user?.name || 'Unknown'}</span>
                          {' '}
                          <span className="capitalize">{activity.action}</span>
                          {' '}
                          <span className="font-mono text-blue-400">{activity.target}</span>
                        </p>
                        <p className="text-xs text-gray-500">{formatTimeAgo(activity.timestamp)}</p>
                      </div>
                      
                      <div className="flex items-center gap-1">
                        {activity.type === 'edit' && <Edit className="w-3 h-3 text-blue-400" />}
                        {activity.type === 'lock' && <Lock className="w-3 h-3 text-red-400" />}
                        {activity.type === 'unlock' && <Unlock className="w-3 h-3 text-green-400" />}
                        {activity.type === 'view' && <Eye className="w-3 h-3 text-gray-400" />}
                        {activity.type === 'conflict' && <AlertTriangle className="w-3 h-3 text-yellow-400" />}
                      </div>
                    </div>
                  )
                })}
              </div>
            </ScrollArea>
          </div>

          {/* Right Panel - Notifications */}
          <div className="w-80 border-l border-blue-500 p-4">
            <h3 className="text-lg font-semibold text-gray-400 mb-3">Notifications</h3>
            <ScrollArea className="h-full">
              <div className="space-y-2">
                {notifications.map((notification) => {
                  const user = users.find(u => u.id === notification.userId)
                  return (
                    <Card key={notification.id} className="bg-gray-800 border-blue-500">
                      <CardContent className="p-3">
                        <div className="flex items-start gap-2">
                          <div className="mt-1">
                            {notification.type === 'user_join' && <UserPlus className="w-4 h-4 text-green-400" />}
                            {notification.type === 'user_leave' && <UserMinus className="w-4 h-4 text-red-400" />}
                            {notification.type === 'lock' && <Lock className="w-4 h-4 text-red-400" />}
                            {notification.type === 'unlock' && <Unlock className="w-4 h-4 text-green-400" />}
                            {notification.type === 'conflict' && <AlertTriangle className="w-4 h-4 text-yellow-400" />}
                            {notification.type === 'activity' && <Activity className="w-4 h-4 text-blue-400" />}
                          </div>
                          
                          <div className="flex-1">
                            <p className="text-sm text-gray-400">{notification.message}</p>
                            <p className="text-xs text-gray-500">{formatTimeAgo(notification.timestamp)}</p>
                          </div>
                        </div>
                      </CardContent>
                    </Card>
                  )
                })}
              </div>
            </ScrollArea>
          </div>
        </div>
      </div>
    </div>
  )
}