'use client'

import { useState, useEffect, useCallback } from 'react'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Separator } from '@/components/ui/separator'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from '@/components/ui/tooltip'
import {
  Zap,
  Users,
  BarChart3,
  Workflow,
  Keyboard,
  Menu,
  X,
  Maximize2,
  Minimize2,
  Settings,
  Activity,
  Clock,
  AlertCircle,
  CheckCircle,
  TrendingUp,
  Eye,
  EyeOff,
  Bell,
  RefreshCw,
  Filter,
  Search,
  Download,
  Upload,
  Play,
  Pause
} from 'lucide-react'

// Import all the advanced components
import CollaborationPanel from '@/components/collaboration/CollaborationPanel'
import AnalyticsDashboard from '@/components/analytics/AnalyticsDashboard'
import WorkflowManager from '@/components/workflow/WorkflowManager'
import KeyboardShortcutsManager from '@/components/pos/KeyboardShortcutsManager'
import { ContextualMenuProvider, BulkActionsToolbar } from '@/components/pos/ContextualMenus'
import EnhancedOrderIndicators from '@/components/pos/EnhancedOrderIndicators'

// Type definitions for the integration
interface AdvancedOrderManagementProps {
  storeId: string
  currentOrder?: any
  heldOrders?: any[]
  onOrderUpdate?: (order: any) => void
  onOrderRetrieve?: (orderId: string) => void
  onOrderHold?: (orderData: any) => void
  className?: string
  initialView?: 'pos' | 'collaboration' | 'analytics' | 'workflow'
  enableRealTime?: boolean
  enableCollaboration?: boolean
  enableAnalytics?: boolean
  enableWorkflow?: boolean
  enableKeyboardShortcuts?: boolean
}

interface ComponentState {
  collaboration: {
    isOpen: boolean
    activeUsers: number
    activeOrders: string[]
  }
  analytics: {
    isOpen: boolean
    metrics: any
    lastUpdated: Date | null
  }
  workflow: {
    isOpen: boolean
    activeRules: number
    pendingJobs: number
  }
  keyboard: {
    isOpen: boolean
    isEnabled: boolean
    recentCommands: string[]
  }
  notifications: Array<{
    id: string
    type: 'info' | 'success' | 'warning' | 'error'
    title: string
    message: string
    timestamp: Date
    component?: 'collaboration' | 'analytics' | 'workflow' | 'system'
  }>
}

export default function AdvancedOrderManagement({
  storeId,
  currentOrder,
  heldOrders = [],
  onOrderUpdate,
  onOrderRetrieve,
  onOrderHold,
  className,
  initialView = 'pos',
  enableRealTime = true,
  enableCollaboration = true,
  enableAnalytics = true,
  enableWorkflow = true,
  enableKeyboardShortcuts = true
}: AdvancedOrderManagementProps) {
  const [activeView, setActiveView] = useState(initialView)
  const [componentState, setComponentState] = useState<ComponentState>({
    collaboration: { isOpen: false, activeUsers: 0, activeOrders: [] },
    analytics: { isOpen: false, metrics: null, lastUpdated: null },
    workflow: { isOpen: false, activeRules: 0, pendingJobs: 0 },
    keyboard: { isOpen: false, isEnabled: true, recentCommands: [] },
    notifications: []
  })
  
  const [isFullscreen, setIsFullscreen] = useState(false)
  const [selectedOrders, setSelectedOrders] = useState<Set<string>>(new Set())
  const [searchTerm, setSearchTerm] = useState('')
  const [isLoading, setIsLoading] = useState(false)

  // Real-time updates
  useEffect(() => {
    if (!enableRealTime || !storeId) return

    const interval = setInterval(() => {
      // Update component states with real-time data
      loadComponentMetrics()
    }, 30000) // Update every 30 seconds

    return () => clearInterval(interval)
  }, [enableRealTime, storeId])

  // Keyboard shortcut handling
  useEffect(() => {
    if (!enableKeyboardShortcuts) return

    const handleKeyDown = (event: KeyboardEvent) => {
      // Command palette (Ctrl+K)
      if (event.ctrlKey && event.key === 'k') {
        event.preventDefault()
        setComponentState(prev => ({ ...prev, keyboard: { ...prev.keyboard, isOpen: true } }))
        return
      }

      // Toggle panels with function keys
      if (event.ctrlKey && event.shiftKey) {
        switch (event.key) {
          case 'C': // Ctrl+Shift+C - Collaboration
            if (enableCollaboration) {
              event.preventDefault()
              setActiveView('collaboration')
            }
            break
          case 'A': // Ctrl+Shift+A - Analytics
            if (enableAnalytics) {
              event.preventDefault()
              setActiveView('analytics')
            }
            break
          case 'W': // Ctrl+Shift+W - Workflow
            if (enableWorkflow) {
              event.preventDefault()
              setActiveView('workflow')
            }
            break
          case 'K': // Ctrl+Shift+K - Keyboard shortcuts
            event.preventDefault()
            setComponentState(prev => ({ ...prev, keyboard: { ...prev.keyboard, isOpen: true } }))
            break
        }
      }

      // Quick actions
      if (event.ctrlKey) {
        switch (event.key) {
          case 'b': // Ctrl+B - Toggle bulk actions
            event.preventDefault()
            // Toggle bulk selection mode
            break
          case 'r': // Ctrl+R - Refresh data
            event.preventDefault()
            loadComponentMetrics()
            break
        }
      }
    }

    document.addEventListener('keydown', handleKeyDown)
    return () => document.removeEventListener('keydown', handleKeyDown)
  }, [enableKeyboardShortcuts, enableCollaboration, enableAnalytics, enableWorkflow])

  const loadComponentMetrics = async () => {
    if (!storeId) return

    setIsLoading(true)
    try {
      // Load collaboration metrics
      if (enableCollaboration) {
        const collabResponse = await fetch(`/api/pos/orders/collaboration/metrics?storeId=${storeId}`)
        if (collabResponse.ok) {
          const collabData = await collabResponse.json()
          setComponentState(prev => ({
            ...prev,
            collaboration: {
              isOpen: prev.collaboration.isOpen,
              activeUsers: collabData.activeUsers || 0,
              activeOrders: collabData.activeOrders || []
            }
          }))
        }
      }

      // Load workflow metrics
      if (enableWorkflow) {
        const workflowResponse = await fetch(`/api/pos/orders/workflow/metrics?storeId=${storeId}`)
        if (workflowResponse.ok) {
          const workflowData = await workflowResponse.json()
          setComponentState(prev => ({
            ...prev,
            workflow: {
              isOpen: prev.workflow.isOpen,
              activeRules: workflowData.activeRules || 0,
              pendingJobs: workflowData.pendingJobs || 0
            }
          }))
        }
      }

      // Load analytics metrics
      if (enableAnalytics) {
        setComponentState(prev => ({
          ...prev,
          analytics: {
            ...prev.analytics,
            lastUpdated: new Date()
          }
        }))
      }
    } catch (error) {
      console.error('Error loading component metrics:', error)
    } finally {
      setIsLoading(false)
    }
  }

  const handleShortcutAction = useCallback((action: string, context?: any) => {
    switch (action) {
      case 'show_help':
        setComponentState(prev => ({ ...prev, keyboard: { ...prev.keyboard, isOpen: true } }))
        break
      case 'collaboration_panel':
        if (enableCollaboration) setActiveView('collaboration')
        break
      case 'analytics':
        if (enableAnalytics) setActiveView('analytics')
        break
      case 'workflow':
        if (enableWorkflow) setActiveView('workflow')
        break
      case 'refresh':
        loadComponentMetrics()
        break
      default:
        // Handle other shortcut actions
        console.log('Shortcut action:', action, context)
    }
  }, [enableCollaboration, enableAnalytics, enableWorkflow])

  const addNotification = (notification: Omit<ComponentState['notifications'][0], 'id' | 'timestamp'>) => {
    const id = Date.now().toString()
    setComponentState(prev => ({
      ...prev,
      notifications: [{
        id,
        timestamp: new Date(),
        ...notification
      }, ...prev.notifications.slice(0, 9)] // Keep only latest 10
    }))

    // Auto-remove after 5 seconds
    setTimeout(() => {
      setComponentState(prev => ({
        ...prev,
        notifications: prev.notifications.filter(n => n.id !== id)
      }))
    }, 5000)
  }

  const handleOrderAction = (action: string, orderData?: any) => {
    switch (action) {
      case 'retrieve':
        onOrderRetrieve?.(orderData.id)
        addNotification({
          type: 'success',
          title: 'Order Retrieved',
          message: `Order ${orderData.orderNumber} has been retrieved`
        })
        break
      case 'edit':
        // Handle order editing
        break
      case 'hold':
        onOrderHold?.(orderData)
        break
      case 'complete':
        onOrderUpdate?.(orderData)
        break
      default:
        console.log('Order action:', action, orderData)
    }
  }

  const filteredOrders = heldOrders.filter(order => 
    !searchTerm || 
    order.orderNumber.toLowerCase().includes(searchTerm.toLowerCase()) ||
    order.customer?.name.toLowerCase().includes(searchTerm.toLowerCase())
  )

  const getNotificationIcon = (type: string) => {
    switch (type) {
      case 'success': return <CheckCircle className="w-4 h-4" />
      case 'warning': return <AlertCircle className="w-4 h-4" />
      case 'error': return <AlertCircle className="w-4 h-4" />
      default: return <Bell className="w-4 h-4" />
    }
  }

  const getNotificationColor = (type: string) => {
    switch (type) {
      case 'success': return 'border-green-500/30 text-green-400 bg-green-500/10'
      case 'warning': return 'border-yellow-500/30 text-yellow-400 bg-yellow-500/10'
      case 'error': return 'border-red-500/30 text-red-400 bg-red-500/10'
      default: return 'border-blue-500/30 text-blue-400 bg-blue-500/10'
    }
  }

  return (
    <TooltipProvider>
      <div className={`${className} ${isFullscreen ? 'fixed inset-0 z-50 bg-gray-900' : ''}`}>
        {/* Header Bar */}
        <Card className="bg-gray-900 border-blue-500 mb-4">
          <CardContent className="p-4">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-4">
                <h2 className="text-xl font-bold text-gray-400">Advanced Order Management</h2>
                
                {/* Component Status Indicators */}
                <div className="flex items-center gap-2">
                  {enableCollaboration && (
                    <Tooltip>
                      <TooltipTrigger>
                        <div className="flex items-center gap-1">
                          <Users className="w-4 h-4 text-blue-400" />
                          <Badge variant="outline" className="border-blue-500/30 text-blue-400">
                            {componentState.collaboration.activeUsers}
                          </Badge>
                        </div>
                      </TooltipTrigger>
                      <TooltipContent>
                        <p>{componentState.collaboration.activeUsers} users online</p>
                      </TooltipContent>
                    </Tooltip>
                  )}
                  
                  {enableWorkflow && (
                    <Tooltip>
                      <TooltipTrigger>
                        <div className="flex items-center gap-1">
                          <Zap className="w-4 h-4 text-yellow-400" />
                          <Badge variant="outline" className="border-yellow-500/30 text-yellow-400">
                            {componentState.workflow.pendingJobs}
                          </Badge>
                        </div>
                      </TooltipTrigger>
                      <TooltipContent>
                        <p>{componentState.workflow.pendingJobs} pending jobs</p>
                      </TooltipContent>
                    </Tooltip>
                  )}
                  
                  {enableAnalytics && componentState.analytics.lastUpdated && (
                    <Tooltip>
                      <TooltipTrigger>
                        <div className="flex items-center gap-1">
                          <BarChart3 className="w-4 h-4 text-green-400" />
                          <span className="text-xs text-gray-400">
                            {componentState.analytics.lastUpdated.toLocaleTimeString()}
                          </span>
                        </div>
                      </TooltipTrigger>
                      <TooltipContent>
                        <p>Last updated: {componentState.analytics.lastUpdated.toLocaleString()}</p>
                      </TooltipContent>
                    </Tooltip>
                  )}
                </div>
              </div>
              
              <div className="flex items-center gap-2">
                {/* Search */}
                <div className="relative">
                  <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
                  <input
                    type="text"
                    placeholder="Search orders..."
                    value={searchTerm}
                    onChange={(e) => setSearchTerm(e.target.value)}
                    className="pl-10 pr-4 py-2 bg-gray-800 border border-blue-500 rounded-lg text-white placeholder-gray-400 focus:border-blue-500/40 focus:outline-none"
                  />
                </div>
                
                {/* Quick Actions */}
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={loadComponentMetrics}
                  disabled={isLoading}
                  className="text-gray-400 hover:text-white"
                >
                  <RefreshCw className={`w-4 h-4 ${isLoading ? 'animate-spin' : ''}`} />
                </Button>
                
                {enableKeyboardShortcuts && (
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => setComponentState(prev => ({ ...prev, keyboard: { ...prev.keyboard, isOpen: true } }))}
                    className="text-gray-400 hover:text-white"
                  >
                    <Keyboard className="w-4 h-4" />
                  </Button>
                )}
                
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => setIsFullscreen(!isFullscreen)}
                  className="text-gray-400 hover:text-white"
                >
                  {isFullscreen ? <Minimize2 className="w-4 h-4" /> : <Maximize2 className="w-4 h-4" />}
                </Button>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Main Interface */}
        <div className="grid grid-cols-1 lg:grid-cols-4 gap-4 h-full">
          {/* Left Sidebar - Order List */}
          <div className="lg:col-span-1 space-y-4">
            <Card className="bg-gray-900 border-blue-500">
              <CardHeader>
                <CardTitle className="text-gray-400 text-lg">Orders</CardTitle>
                <CardDescription>{filteredOrders.length} orders available</CardDescription>
              </CardHeader>
              <CardContent className="p-0">
                <div className="max-h-96 overflow-y-auto">
                  {filteredOrders.map((order) => (
                    <ContextualMenuProvider
                      key={order.id}
                      type="order"
                      data={order}
                      onAction={handleOrderAction}
                    >
                      <div className="p-3 border-b border-blue-500/10 hover:bg-gray-800/50 transition-colors">
                        <EnhancedOrderIndicators
                          order={order}
                          onRetrieve={(orderId) => handleOrderAction('retrieve', { id: orderId, orderNumber: order.orderNumber })}
                          onEdit={(orderId) => handleOrderAction('edit', { id: orderId })}
                          showCollaboration={enableCollaboration}
                          size="sm"
                          variant="compact"
                        />
                      </div>
                    </ContextualMenuProvider>
                  ))}
                </div>
              </CardContent>
            </Card>
            
            {/* Notifications Panel */}
            {componentState.notifications.length > 0 && (
              <Card className="bg-gray-900 border-blue-500">
                <CardHeader>
                  <CardTitle className="text-gray-400 text-lg flex items-center gap-2">
                    <Bell className="w-4 h-4" />
                    Notifications
                  </CardTitle>
                </CardHeader>
                <CardContent className="p-0">
                  <div className="max-h-48 overflow-y-auto space-y-2 p-3">
                    {componentState.notifications.map((notification) => (
                      <div
                        key={notification.id}
                        className={`p-2 rounded-lg border ${getNotificationColor(notification.type)}`}
                      >
                        <div className="flex items-start gap-2">
                          {getNotificationIcon(notification.type)}
                          <div className="flex-1">
                            <p className="text-sm font-medium">{notification.title}</p>
                            <p className="text-xs opacity-80">{notification.message}</p>
                            <p className="text-xs opacity-60 mt-1">
                              {notification.timestamp.toLocaleTimeString()}
                            </p>
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                </CardContent>
              </Card>
            )}
          </div>

          {/* Main Content Area */}
          <div className="lg:col-span-3">
            {/* Bulk Actions Toolbar */}
            {selectedOrders.size > 0 && (
              <BulkActionsToolbar
                selectedItems={Array.from(selectedOrders).map(id => 
                  filteredOrders.find(order => order.id === id)
                ).filter(Boolean)}
                onAction={(action, data) => {
                  console.log('Bulk action:', action, data)
                  setSelectedOrders(new Set())
                }}
                className="mb-4"
              />
            )}

            {/* Tabbed Interface */}
            <Tabs value={activeView} onValueChange={(v: any) => setActiveView(v)} className="h-full">
              <TabsList className="grid w-full grid-cols-4 bg-gray-800 border border-blue-500">
                <TabsTrigger value="pos" className="data-[state=active]:bg-blue-600">
                  <Play className="w-4 h-4 mr-2" />
                  POS
                </TabsTrigger>
                {enableCollaboration && (
                  <TabsTrigger value="collaboration" className="data-[state=active]:bg-blue-600">
                    <Users className="w-4 h-4 mr-2" />
                    Collaboration
                  </TabsTrigger>
                )}
                {enableAnalytics && (
                  <TabsTrigger value="analytics" className="data-[state=active]:bg-blue-600">
                    <BarChart3 className="w-4 h-4 mr-2" />
                    Analytics
                  </TabsTrigger>
                )}
                {enableWorkflow && (
                  <TabsTrigger value="workflow" className="data-[state=active]:bg-blue-600">
                    <Workflow className="w-4 h-4 mr-2" />
                    Workflow
                  </TabsTrigger>
                )}
              </TabsList>

              <div className="mt-4 h-[calc(100%-4rem)]">
                <TabsContent value="pos" className="h-full m-0">
                  <Card className="bg-gray-900 border-blue-500 h-full">
                    <CardContent className="p-6 h-full flex items-center justify-center">
                      <div className="text-center">
                        <Play className="w-12 h-12 mx-auto mb-4 text-blue-400" />
                        <h3 className="text-lg font-semibold text-gray-400 mb-2">Point of Sale Interface</h3>
                        <p className="text-gray-400">
                          Current order management and processing interface
                        </p>
                        {currentOrder && (
                          <div className="mt-4 p-4 bg-gray-800 rounded-lg">
                            <p className="text-sm text-gray-400">Active Order: {currentOrder.orderNumber}</p>
                          </div>
                        )}
                      </div>
                    </CardContent>
                  </Card>
                </TabsContent>

                {enableCollaboration && (
                  <TabsContent value="collaboration" className="h-full m-0">
                    <CollaborationPanel
                      storeId={storeId}
                      isOpen={true}
                      onClose={() => setActiveView('pos')}
                      onLockRequest={(orderId, field) => {
                        addNotification({
                          type: 'info',
                          title: 'Field Locked',
                          message: `Field "${field}" locked for editing`
                        })
                      }}
                      onUnlockRequest={(orderId, field) => {
                        addNotification({
                          type: 'info',
                          title: 'Field Unlocked',
                          message: `Field "${field}" is now available`
                        })
                      }}
                    />
                  </TabsContent>
                )}

                {enableAnalytics && (
                  <TabsContent value="analytics" className="h-full m-0">
                    <AnalyticsDashboard
                      storeId={storeId}
                      isOpen={true}
                      onClose={() => setActiveView('pos')}
                      refreshInterval={30000}
                    />
                  </TabsContent>
                )}

                {enableWorkflow && (
                  <TabsContent value="workflow" className="h-full m-0">
                    <WorkflowManager
                      storeId={storeId}
                      isOpen={true}
                      onClose={() => setActiveView('pos')}
                    />
                  </TabsContent>
                )}
              </div>
            </Tabs>
          </div>
        </div>

        {/* Keyboard Shortcuts Manager */}
        <KeyboardShortcutsManager
          isOpen={componentState.keyboard.isOpen}
          onClose={() => setComponentState(prev => ({ ...prev, keyboard: { ...prev.keyboard, isOpen: false } }))}
          onShortcutTrigger={handleShortcutAction}
          context="pos"
        />
      </div>
    </TooltipProvider>
  )
}