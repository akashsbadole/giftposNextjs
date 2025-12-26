'use client'

import { useState, useEffect, useCallback } from 'react'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip'
import { Avatar } from '@/components/ui/avatar'
import {
  Clock,
  Users,
  AlertTriangle,
  CheckCircle,
  XCircle,
  Pause,
  Play,
  Star,
  Timer,
  Eye,
  Edit,
  Lock,
  Zap,
  Activity,
  TrendingUp,
  User,
  ShoppingCart
} from 'lucide-react'

interface OrderIndicatorProps {
  order: {
    id: string
    orderNumber: string
    status: string
    priority: number
    holdDuration?: number
    age: number
    ageDisplay: string
    customer?: {
      name: string
    }
    employee?: {
      name: string
    }
    tableNumber?: string
    itemCount: number
    total: number
    isExpired?: boolean
    isAutoSaved?: boolean
    collaborators?: Array<{
      id: string
      name: string
      status: 'viewing' | 'editing' | 'idle'
      lastActivity: string
    }>
    locks?: Array<{
      field: string
      lockedBy: string
      lockedByName: string
    }>
    processingTime?: number
    estimatedCompletion?: string
  }
  onStatusChange?: (orderId: string, newStatus: string) => void
  onRetrieve?: (orderId: string) => void
  onEdit?: (orderId: string) => void
  onQuickAction?: (action: string, orderId: string) => void
  showCollaboration?: boolean
  size?: 'sm' | 'md' | 'lg'
  variant?: 'default' | 'compact' | 'minimal'
}

export default function EnhancedOrderIndicators({
  order,
  onStatusChange,
  onRetrieve,
  onEdit,
  onQuickAction,
  showCollaboration = true,
  size = 'md',
  variant = 'default'
}: OrderIndicatorProps) {
  const [isHovered, setIsHovered] = useState(false)
  const [processingTimer, setProcessingTimer] = useState<number | null>(null)

  // Get status configuration
  const getStatusConfig = useCallback((status: string) => {
    const configs = {
      held: { 
        color: 'bg-blue-500/20 text-blue-400 border-blue-500/30',
        icon: <Pause className="w-3 h-3" />,
        label: 'Held',
        urgent: false
      },
      retrieved: { 
        color: 'bg-green-500/20 text-green-400 border-green-500/30',
        icon: <Play className="w-3 h-3" />,
        label: 'Processing',
        urgent: false
      },
      expired: { 
        color: 'bg-red-500/20 text-red-400 border-red-500/30',
        icon: <XCircle className="w-3 h-3" />,
        label: 'Expired',
        urgent: true
      },
      cancelled: { 
        color: 'bg-gray-500/20 text-gray-400 border-gray-500/30',
        icon: <XCircle className="w-3 h-3" />,
        label: 'Cancelled',
        urgent: false
      },
      completed: { 
        color: 'bg-green-500/20 text-green-400 border-green-500/30',
        icon: <CheckCircle className="w-3 h-3" />,
        label: 'Completed',
        urgent: false
      }
    }
    return configs[status as keyof typeof configs] || configs.held
  }, [])

  // Get priority configuration
  const getPriorityConfig = useCallback((priority: number) => {
    if (priority >= 5) {
      return {
        color: 'text-red-400',
        icon: <Star className="w-3 h-3 fill-current" />,
        level: 'Critical',
        urgent: true
      }
    }
    if (priority >= 3) {
      return {
        color: 'text-yellow-400',
        icon: <Star className="w-3 h-3 fill-current" />,
        level: 'High',
        urgent: true
      }
    }
    if (priority >= 1) {
      return {
        color: 'text-blue-400',
        icon: <Star className="w-3 h-3 fill-current" />,
        level: 'Medium',
        urgent: false
      }
    }
    return null
  }, [])

  // Get urgency indicators
  const getUrgencyIndicators = useCallback(() => {
    const indicators = []
    
    if (order.isExpired) {
      indicators.push({
        type: 'expired',
        color: 'bg-red-500',
        message: 'Order has expired',
        icon: <AlertTriangle className="w-3 h-3" />
      })
    }
    
    if (order.age > 120) { // 2+ hours
      indicators.push({
        type: 'long_hold',
        color: 'bg-red-500',
        message: 'Order held for over 2 hours',
        icon: <Clock className="w-3 h-3" />
      })
    } else if (order.age > 60) { // 1+ hour
      indicators.push({
        type: 'extended_hold',
        color: 'bg-yellow-500',
        message: 'Order held for over 1 hour',
        icon: <Timer className="w-3 h-3" />
      })
    }
    
    const priorityConfig = getPriorityConfig(order.priority)
    if (priorityConfig?.urgent) {
      indicators.push({
        type: 'priority',
        color: priorityConfig.color.replace('text-', 'bg-').replace('400', '500'),
        message: `${priorityConfig.level} priority order`,
        icon: priorityConfig.icon
      })
    }
    
    return indicators
  }, [order.age, order.isExpired, order.priority, getPriorityConfig])

  // Auto-start processing timer for retrieved orders
  useEffect(() => {
    if (order.status === 'retrieved' && !processingTimer) {
      setProcessingTimer(Date.now())
    }
  }, [order.status, processingTimer])

  const statusConfig = getStatusConfig(order.status)
  const priorityConfig = getPriorityConfig(order.priority)
  const urgencyIndicators = getUrgencyIndicators()

  // Size configurations
  const sizeConfig = {
    sm: {
      badge: 'text-xs px-2 py-1',
      icon: 'w-3 h-3',
      avatar: 'w-5 h-5',
      spacing: 'gap-1'
    },
    md: {
      badge: 'text-sm px-3 py-1.5',
      icon: 'w-4 h-4',
      avatar: 'w-6 h-6',
      spacing: 'gap-2'
    },
    lg: {
      badge: 'text-base px-4 py-2',
      icon: 'w-5 h-5',
      avatar: 'w-7 h-7',
      spacing: 'gap-3'
    }
  }

  const config = sizeConfig[size]

  if (variant === 'minimal') {
    return (
      <div className={`flex items-center ${config.spacing}`}>
        <Badge className={`${statusConfig.color} ${config.badge} border`}>
          {statusConfig.icon}
          <span className="ml-1">{statusConfig.label}</span>
        </Badge>
        {priorityConfig && (
          <Tooltip>
            <TooltipTrigger>
              <div className={`${priorityConfig.color}`}>
                {priorityConfig.icon}
              </div>
            </TooltipTrigger>
            <TooltipContent>
              <p>{priorityConfig.level} Priority</p>
            </TooltipContent>
          </Tooltip>
        )}
      </div>
    )
  }

  if (variant === 'compact') {
    return (
      <TooltipProvider>
        <div className="flex items-center space-x-2">
          <Badge className={`${statusConfig.color} ${config.badge} border`}>
            {statusConfig.icon}
            <span className="ml-1">{statusConfig.label}</span>
          </Badge>
          
          {urgencyIndicators.length > 0 && (
            <Tooltip>
              <TooltipTrigger>
                <div className="flex items-center space-x-1">
                  {urgencyIndicators.slice(0, 2).map((indicator, index) => (
                    <div
                      key={index}
                      className={`w-2 h-2 rounded-full ${indicator.color}`}
                    />
                  ))}
                  {urgencyIndicators.length > 2 && (
                    <span className="text-xs text-gray-400">+{urgencyIndicators.length - 2}</span>
                  )}
                </div>
              </TooltipTrigger>
              <TooltipContent>
                <div className="space-y-1">
                  {urgencyIndicators.map((indicator, index) => (
                    <div key={index} className="flex items-center gap-2">
                      {indicator.icon}
                      <span>{indicator.message}</span>
                    </div>
                  ))}
                </div>
              </TooltipContent>
            </Tooltip>
          )}
          
          {showCollaboration && order.collaborators && order.collaborators.length > 0 && (
            <div className="flex -space-x-1">
              {order.collaborators.slice(0, 3).map((collaborator, index) => (
                <Tooltip key={index}>
                  <TooltipTrigger>
                    <Avatar className={`${config.avatar} border-2 border-gray-800`}>
                      <div className="w-full h-full bg-blue-500 rounded-full flex items-center justify-center text-white text-xs">
                        {collaborator.name.charAt(0).toUpperCase()}
                      </div>
                    </Avatar>
                  </TooltipTrigger>
                  <TooltipContent>
                    <p>{collaborator.name} - {collaborator.status}</p>
                  </TooltipContent>
                </Tooltip>
              ))}
              {order.collaborators.length > 3 && (
                <div className={`${config.avatar} bg-gray-600 rounded-full flex items-center justify-center text-white text-xs border-2 border-gray-800`}>
                  +{order.collaborators.length - 3}
                </div>
              )}
            </div>
          )}
        </div>
      </TooltipProvider>
    )
  }

  // Default variant with full details
  return (
    <TooltipProvider>
      <div 
        className="flex items-center justify-between p-3 rounded-lg bg-gray-800/50 border border-blue-500 hover:border-blue-500/40 transition-all"
        onMouseEnter={() => setIsHovered(true)}
        onMouseLeave={() => setIsHovered(false)}
      >
        <div className="flex items-center space-x-3">
          {/* Order Number */}
          <div className="font-mono text-sm text-gray-400">
            #{order.orderNumber}
          </div>
          
          {/* Status Badge */}
          <Badge className={`${statusConfig.color} ${config.badge} border`}>
            {statusConfig.icon}
            <span className="ml-1">{statusConfig.label}</span>
          </Badge>
          
          {/* Priority */}
          {priorityConfig && (
            <Tooltip>
              <TooltipTrigger>
                <div className={`${priorityConfig.color}`}>
                  {priorityConfig.icon}
                </div>
              </TooltipTrigger>
              <TooltipContent>
                <p>{priorityConfig.level} Priority</p>
              </TooltipContent>
            </Tooltip>
          )}
          
          {/* Age */}
          <Tooltip>
            <TooltipTrigger>
              <div className="flex items-center space-x-1 text-xs text-gray-400">
                <Clock className="w-3 h-3" />
                <span>{order.ageDisplay}</span>
              </div>
            </TooltipTrigger>
            <TooltipContent>
              <p>Order age: {order.age} minutes</p>
            </TooltipContent>
          </Tooltip>
          
          {/* Table Number */}
          {order.tableNumber && (
            <Badge variant="outline" className="text-xs border-blue-500/30 text-blue-400">
              Table {order.tableNumber}
            </Badge>
          )}
        </div>
        
        <div className="flex items-center space-x-2">
          {/* Urgency Indicators */}
          {urgencyIndicators.length > 0 && (
            <Tooltip>
              <TooltipTrigger>
                <div className="flex items-center space-x-1">
                  {urgencyIndicators.slice(0, 3).map((indicator, index) => (
                    <div
                      key={index}
                      className={`w-2 h-2 rounded-full ${indicator.color}`}
                    />
                  ))}
                  {urgencyIndicators.length > 3 && (
                    <span className="text-xs text-gray-400">+{urgencyIndicators.length - 3}</span>
                  )}
                </div>
              </TooltipTrigger>
              <TooltipContent>
                <div className="space-y-1">
                  {urgencyIndicators.map((indicator, index) => (
                    <div key={index} className="flex items-center gap-2">
                      {indicator.icon}
                      <span>{indicator.message}</span>
                    </div>
                  ))}
                </div>
              </TooltipContent>
            </Tooltip>
          )}
          
          {/* Processing Timer */}
          {processingTimer && order.status === 'retrieved' && (
            <Tooltip>
              <TooltipTrigger>
                <div className="flex items-center space-x-1 text-xs text-green-400">
                  <Activity className="w-3 h-3" />
                  <span>{Math.floor((Date.now() - processingTimer) / 60000)}m</span>
                </div>
              </TooltipTrigger>
              <TooltipContent>
                <p>Processing time</p>
              </TooltipContent>
            </Tooltip>
          )}
          
          {/* Collaborators */}
          {showCollaboration && order.collaborators && order.collaborators.length > 0 && (
            <Tooltip>
              <TooltipTrigger>
                <div className="flex items-center space-x-1">
                  <Users className="w-3 h-3 text-gray-400" />
                  <span className="text-xs text-gray-400">{order.collaborators.length}</span>
                </div>
              </TooltipTrigger>
              <TooltipContent>
                <div className="space-y-1">
                  {order.collaborators.map((collaborator, index) => (
                    <div key={index} className="flex items-center gap-2">
                      <Avatar className="w-4 h-4">
                        <div className="w-full h-full bg-blue-500 rounded-full flex items-center justify-center text-white text-xs">
                          {collaborator.name.charAt(0).toUpperCase()}
                        </div>
                      </Avatar>
                      <span>{collaborator.name} - {collaborator.status}</span>
                    </div>
                  ))}
                </div>
              </TooltipContent>
            </Tooltip>
          )}
          
          {/* Field Locks */}
          {order.locks && order.locks.length > 0 && (
            <Tooltip>
              <TooltipTrigger>
                <Lock className="w-3 h-3 text-red-400" />
              </TooltipTrigger>
              <TooltipContent>
                <div className="space-y-1">
                  {order.locks.map((lock, index) => (
                    <div key={index}>
                      <p className="font-medium">{lock.field} locked by {lock.lockedByName}</p>
                    </div>
                  ))}
                </div>
              </TooltipContent>
            </Tooltip>
          )}
          
          {/* Quick Actions (shown on hover) */}
          {isHovered && (
            <div className="flex items-center space-x-1">
              {order.status === 'held' && (
                <>
                  <Tooltip>
                    <TooltipTrigger>
                      <Button
                        size="sm"
                        variant="ghost"
                        onClick={() => onRetrieve?.(order.id)}
                        className="h-6 w-6 p-0 text-green-400 hover:bg-green-500/10"
                      >
                        <Play className="w-3 h-3" />
                      </Button>
                    </TooltipTrigger>
                    <TooltipContent>
                      <p>Retrieve Order</p>
                    </TooltipContent>
                  </Tooltip>
                  
                  <Tooltip>
                    <TooltipTrigger>
                      <Button
                        size="sm"
                        variant="ghost"
                        onClick={() => onEdit?.(order.id)}
                        className="h-6 w-6 p-0 text-blue-400 hover:bg-blue-500/10"
                      >
                        <Edit className="w-3 h-3" />
                      </Button>
                    </TooltipTrigger>
                    <TooltipContent>
                      <p>Edit Order</p>
                    </TooltipContent>
                  </Tooltip>
                </>
              )}
              
              {order.status === 'retrieved' && (
                <Tooltip>
                  <TooltipTrigger>
                    <Button
                      size="sm"
                      variant="ghost"
                      onClick={() => onQuickAction?.('complete', order.id)}
                      className="h-6 w-6 p-0 text-green-400 hover:bg-green-500/10"
                    >
                      <CheckCircle className="w-3 h-3" />
                    </Button>
                  </TooltipTrigger>
                  <TooltipContent>
                    <p>Complete Order</p>
                  </TooltipContent>
                </Tooltip>
              )}
            </div>
          )}
        </div>
      </div>
    </TooltipProvider>
  )
}