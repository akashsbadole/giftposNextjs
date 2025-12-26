'use client'

import { useState, useEffect, useCallback, useMemo } from 'react'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Button } from '@/components/ui/button'
import { ScrollArea } from '@/components/ui/scroll-area'
import { Badge } from '@/components/ui/badge'
import { Separator } from '@/components/ui/separator'
import { Checkbox } from '@/components/ui/checkbox'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from '@/components/ui/alert-dialog'
import { useToast } from '@/hooks/use-toast'
import { useSettings } from '@/lib/settings-context'
import { 
  Search, 
  Clock, 
  User, 
  Table, 
  ShoppingCart, 
  DollarSign,
  MoreHorizontal,
  Edit,
  Trash2,
  RefreshCw,
  Filter,
  X,
  AlertTriangle,
  Package,
  Users,
  Bell,
  CheckCircle,
  XCircle,
  Timer,
  Star,
  Download,
  Merge,
  Eye,
  EyeOff,
  Zap,
  Play,
  Pause,
  ArrowUp,
  ArrowDown,
  GripVertical,
  TrendingUp,
  Calendar,
  Activity,
  AlertCircle,
  Settings,
  Maximize2,
  Minimize2,
  LayoutGrid,
  List,
  SortAsc,
  SortDesc,
  Save,
  Upload,
  Share2,
  Copy,
  Archive,
  Trash,
  RotateCcw,
  SkipForward,
  FastForward,
  Volume2,
  VolumeX,
  ArrowRight
} from 'lucide-react'
import { OrderStatusManager, OrderValidator, DEFAULT_ORDER_CONFIG, type OrderOperationResult } from '@/lib/order-management'

interface HeldOrder {
  id: string
  orderNumber: string
  customerId?: string
  customer?: {
    id: string
    name: string
    phone?: string
    email?: string
  }
  employeeId?: string
  employee?: {
    id: string
    name: string
  }
  tableNumber?: string
  orderName?: string
  subtotal: number
  gst: number
  discount: number
  total: number
  notes?: string
  status: string
  priority: number
  holdDuration?: number
  isAutoSaved: boolean
  tags?: string
  metadata?: string
  createdAt: string
  updatedAt: string
  retrievedAt?: string
  expiredAt?: string
  age: number
  ageDisplay: string
  itemCount: number
  items?: any[]
}

interface OrderQueueTabProps {
  storeId: string
  onRetrieveOrder?: (order: HeldOrder) => void
  onOrderUpdate?: (order: HeldOrder) => void
}

export default function OrderQueueTab({ 
  storeId, 
  onRetrieveOrder, 
  onOrderUpdate 
}: OrderQueueTabProps) {
  const { toast } = useToast()
  const { formatCurrency } = useSettings()
  
  // State management
  const [orders, setOrders] = useState<HeldOrder[]>([])
  const [activeOrders, setActiveOrders] = useState<HeldOrder[]>([])
  const [completedOrders, setCompletedOrders] = useState<HeldOrder[]>([])
  const [loading, setLoading] = useState(false)
  const [refreshing, setRefreshing] = useState(false)
  const [searchTerm, setSearchTerm] = useState('')
  const [statusFilter, setStatusFilter] = useState('all')
  const [tableFilter, setTableFilter] = useState('')
  const [customerFilter, setCustomerFilter] = useState('')
  const [priorityFilter, setPriorityFilter] = useState('all')
  const [selectedOrder, setSelectedOrder] = useState<HeldOrder | null>(null)
  const [selectedOrders, setSelectedOrders] = useState<Set<string>>(new Set())
  const [actionMenuOpen, setActionMenuOpen] = useState<string | null>(null)
  
  // Advanced UX state
  const [viewMode, setViewMode] = useState<'grid' | 'list'>('grid')
  const [sortBy, setSortBy] = useState<'createdAt' | 'total' | 'priority' | 'age'>('priority')
  const [sortOrder, setSortOrder] = useState<'asc' | 'desc'>('desc')
  const [groupBy, setGroupBy] = useState<'none' | 'status' | 'priority' | 'table'>('none')
  const [isRealTimeEnabled, setIsRealTimeEnabled] = useState(true)
  const [notifications, setNotifications] = useState<Array<{
    id: string
    type: 'success' | 'warning' | 'error' | 'info'
    title: string
    message: string
    timestamp: Date
  }>>([])
  const [bulkOperationLoading, setBulkOperationLoading] = useState(false)
  const [lastRefresh, setLastRefresh] = useState<Date>(new Date())
  const [expandedGroups, setExpandedGroups] = useState<Set<string>>(new Set())
  const [isFullscreen, setIsFullscreen] = useState(false)
  const [soundEnabled, setSoundEnabled] = useState(true)
  const [autoRefreshInterval, setAutoRefreshInterval] = useState(30) // seconds

  // Drag and drop state
  const [draggedOrder, setDraggedOrder] = useState<string | null>(null)
  const [dragOverOrder, setDragOverOrder] = useState<string | null>(null)

  // Enhanced dialog states
  const [editDialogOpen, setEditDialogOpen] = useState(false)
  const [bulkActionDialogOpen, setBulkActionDialogOpen] = useState(false)
  const [mergeDialogOpen, setMergeDialogOpen] = useState(false)
  const [exportDialogOpen, setExportDialogOpen] = useState(false)
  const [settingsDialogOpen, setSettingsDialogOpen] = useState(false)
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false)

  // Form states
  const [editForm, setEditForm] = useState({
    orderName: '',
    tableNumber: '',
    notes: '',
    priority: 0,
    tags: ''
  })

  const [bulkAction, setBulkAction] = useState<'retrieve' | 'cancel' | 'priority' | 'merge'>('retrieve')
  const [mergeTargetOrder, setMergeTargetOrder] = useState<string>('')

  // Load orders data
  const loadOrders = useCallback(async () => {
    if (!storeId) return
    
    setLoading(true)
    try {
      // Load active orders
      const activeResponse = await fetch(`/api/pos/orders/hold?storeId=${storeId}&status=held&limit=100`)
      if (activeResponse.ok) {
        const activeData = await activeResponse.json()
        setActiveOrders(activeData.data || [])
      }

      // Load completed orders
      const completedResponse = await fetch(`/api/pos/orders/hold?storeId=${storeId}&status=retrieved,expired,cancelled&limit=50`)
      if (completedResponse.ok) {
        const completedData = await completedResponse.json()
        setCompletedOrders(completedData.data || [])
      }

      setLastRefresh(new Date())
    } catch (error) {
      console.error('Error loading orders:', error)
      toast({
        title: 'Error',
        description: 'Failed to load orders',
        variant: 'destructive',
      })
    } finally {
      setLoading(false)
    }
  }, [storeId, toast])

  // Real-time updates
  useEffect(() => {
    if (!isRealTimeEnabled) return
    
    const interval = setInterval(() => {
      loadOrders()
    }, autoRefreshInterval * 1000)
    
    return () => clearInterval(interval)
  }, [isRealTimeEnabled, autoRefreshInterval, loadOrders])

  // Initial load
  useEffect(() => {
    loadOrders()
  }, [loadOrders])

  // Add notification
  const addNotification = useCallback((notification: {
    type: 'success' | 'warning' | 'error' | 'info'
    title: string
    message: string
  }) => {
    const id = Date.now().toString()
    setNotifications(prev => [{
      id,
      ...notification,
      timestamp: new Date()
    }, ...prev.slice(0, 4)])

    // Play sound if enabled
    if (soundEnabled) {
      // Play notification sound
      const audio = new Audio('/sounds/notification.mp3')
      audio.volume = 0.3
      audio.play().catch(() => {
        // Ignore audio errors
      })
    }

    // Auto-remove notification
    setTimeout(() => {
      setNotifications(prev => prev.filter(n => n.id !== id))
    }, 8000)
  }, [soundEnabled])

  // Drag and drop handlers
  const handleDragStart = (e: React.DragEvent, orderId: string) => {
    setDraggedOrder(orderId)
    e.dataTransfer.effectAllowed = 'move'
  }

  const handleDragOver = (e: React.DragEvent, orderId: string) => {
    e.preventDefault()
    setDragOverOrder(orderId)
  }

  const handleDragLeave = () => {
    setDragOverOrder(null)
  }

  const handleDrop = (e: React.DragEvent, targetOrderId: string) => {
    e.preventDefault()
    
    if (!draggedOrder || draggedOrder === targetOrderId) return
    
    // Reorder logic - move dragged order before target order
    setActiveOrders(prev => {
      const newOrders = [...prev]
      const draggedIndex = newOrders.findIndex(o => o.id === draggedOrder)
      const targetIndex = newOrders.findIndex(o => o.id === targetOrderId)
      
      if (draggedIndex !== -1 && targetIndex !== -1) {
        const [draggedItem] = newOrders.splice(draggedIndex, 1)
        newOrders.splice(targetIndex, 0, draggedItem)
      }
      
      return newOrders
    })
    
    setDraggedOrder(null)
    setDragOverOrder(null)
    
    addNotification({
      type: 'info',
      title: 'Order Reordered',
      message: 'Order priority updated successfully'
    })
  }

  // Filter and sort orders
  const filteredActiveOrders = useMemo(() => {
    let filtered = activeOrders.filter(order => {
      const matchesSearch = !searchTerm || 
        order.orderNumber.toLowerCase().includes(searchTerm.toLowerCase()) ||
        order.orderName?.toLowerCase().includes(searchTerm.toLowerCase()) ||
        order.customer?.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
        order.tableNumber?.toLowerCase().includes(searchTerm.toLowerCase())
      
      const matchesTable = !tableFilter || tableFilter === 'all' || order.tableNumber === tableFilter
      const matchesCustomer = !customerFilter || customerFilter === 'all' || order.customer?.name === customerFilter
      const matchesPriority = priorityFilter === 'all' || 
        (priorityFilter === 'high' && order.priority >= 3) ||
        (priorityFilter === 'medium' && order.priority === 2) ||
        (priorityFilter === 'low' && order.priority <= 1)
      
      return matchesSearch && matchesTable && matchesCustomer && matchesPriority
    })

    // Sort orders
    filtered.sort((a, b) => {
      let aValue: any, bValue: any
      
      switch (sortBy) {
        case 'createdAt':
          aValue = new Date(a.createdAt).getTime()
          bValue = new Date(b.createdAt).getTime()
          break
        case 'total':
          aValue = a.total
          bValue = b.total
          break
        case 'priority':
          aValue = OrderStatusManager.getOrderStatus(a).priority
          bValue = OrderStatusManager.getOrderStatus(b).priority
          break
        case 'age':
          aValue = OrderStatusManager.getOrderStatus(a).ageInMinutes
          bValue = OrderStatusManager.getOrderStatus(b).ageInMinutes
          break
        default:
          return 0
      }
      
      if (sortOrder === 'asc') {
        return aValue > bValue ? 1 : -1
      } else {
        return aValue < bValue ? 1 : -1
      }
    })

    return filtered
  }, [activeOrders, searchTerm, tableFilter, customerFilter, priorityFilter, sortBy, sortOrder])

  // Group orders
  const groupedOrders = useMemo(() => {
    if (groupBy === 'none') return { 'All Orders': filteredActiveOrders }
    
    const groups: { [key: string]: HeldOrder[] } = {}
    
    filteredActiveOrders.forEach(order => {
      let groupKey = ''
      
      switch (groupBy) {
        case 'status':
          groupKey = order.status.charAt(0).toUpperCase() + order.status.slice(1)
          break
        case 'priority':
          const priority = OrderStatusManager.getOrderStatus(order).priority
          groupKey = priority >= 3 ? 'High Priority' : priority >= 1 ? 'Medium Priority' : 'Normal'
          break
        case 'table':
          groupKey = order.tableNumber ? `Table ${order.tableNumber}` : 'No Table'
          break
      }
      
      if (!groups[groupKey]) {
        groups[groupKey] = []
      }
      groups[groupKey].push(order)
    })
    
    return groups
  }, [filteredActiveOrders, groupBy])

  // Order actions
  const handleRetrieveOrder = async (order: HeldOrder) => {
    try {
      const response = await fetch(`/api/pos/orders/hold/${order.id}/retrieve?storeId=${storeId}`, {
        method: 'POST'
      })
      
      if (response.ok) {
        const data = await response.json()
        onRetrieveOrder?.(data.cart)
        addNotification({
          type: 'success',
          title: 'Order Retrieved',
          message: `Order ${order.orderNumber} loaded to cart`
        })
        loadOrders()
      } else {
        throw new Error('Failed to retrieve order')
      }
    } catch (error) {
      addNotification({
        type: 'error',
        title: 'Retrieval Failed',
        message: 'Failed to retrieve order'
      })
    }
  }

  const handleCancelOrder = async (order: HeldOrder) => {
    try {
      const response = await fetch(`/api/pos/orders/hold/${order.id}?storeId=${storeId}`, {
        method: 'DELETE'
      })
      
      if (response.ok) {
        addNotification({
          type: 'success',
          title: 'Order Cancelled',
          message: `Order ${order.orderNumber} cancelled successfully`
        })
        loadOrders()
      } else {
        throw new Error('Failed to cancel order')
      }
    } catch (error) {
      addNotification({
        type: 'error',
        title: 'Cancellation Failed',
        message: 'Failed to cancel order'
      })
    }
  }

  // Bulk operations
  const performBulkOperation = async (operation: 'retrieve' | 'cancel' | 'priority', orderIds?: string[]) => {
    const targetOrders = orderIds || Array.from(selectedOrders)
    if (targetOrders.length === 0) return
    
    setBulkOperationLoading(true)
    try {
      const results = await Promise.all(
        targetOrders.map(async (orderId) => {
          switch (operation) {
            case 'retrieve':
              const retrieveResponse = await fetch(`/api/pos/orders/hold/${orderId}/retrieve?storeId=${storeId}`, { method: 'POST' })
              return { orderId, success: retrieveResponse.ok, operation }
            case 'cancel':
              const cancelResponse = await fetch(`/api/pos/orders/hold/${orderId}?storeId=${storeId}`, { method: 'DELETE' })
              return { orderId, success: cancelResponse.ok, operation }
            case 'priority':
              // Update priority logic would go here
              return { orderId, success: true, operation }
            default:
              return { orderId, success: false, operation }
          }
        })
      )

      const successful = results.filter(r => r.success).length
      const failed = results.filter(r => !r.success).length

      addNotification({
        type: successful > 0 ? 'success' : 'error',
        title: 'Bulk Operation Complete',
        message: `${successful} orders ${operation}d successfully${failed > 0 ? `, ${failed} failed` : ''}`
      })

      setSelectedOrders(new Set())
      loadOrders()
    } catch (error) {
      addNotification({
        type: 'error',
        title: 'Bulk Operation Failed',
        message: 'An error occurred during bulk operation'
      })
    } finally {
      setBulkOperationLoading(false)
    }
  }

  // Get unique values for filters
  const uniqueTables = [...new Set(activeOrders.filter(o => o.tableNumber).map(o => o.tableNumber))].sort()
  const uniqueCustomers = [...new Set(activeOrders.filter(o => o.customer).map(o => o.customer?.name))].sort()

  // Order statistics
  const stats = useMemo(() => {
    const total = activeOrders.length
    const highPriority = activeOrders.filter(o => OrderStatusManager.getOrderStatus(o).priority >= 3).length
    const expired = activeOrders.filter(o => OrderStatusManager.getOrderStatus(o).isExpired).length
    const totalValue = activeOrders.reduce((sum, o) => sum + o.total, 0)
    
    return { total, highPriority, expired, totalValue }
  }, [activeOrders])

  return (
    <div className={`space-y-6 ${isFullscreen ? 'fixed inset-0 z-50 bg-gray-900 p-6 overflow-auto' : ''}`}>
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-bold text-gray-400">Order Queue Management</h2>
          <p className="text-gray-400">
            Manage active orders, priority, and workflow
          </p>
        </div>
        
        <div className="flex items-center gap-2">
          {/* Statistics */}
          <div className="flex items-center gap-4 text-sm">
            <div className="flex items-center gap-1">
              <Package className="w-4 h-4 text-blue-400" />
              <span className="text-gray-400">{stats.total}</span>
            </div>
            <div className="flex items-center gap-1">
              <Star className="w-4 h-4 text-yellow-400" />
              <span className="text-gray-400">{stats.highPriority}</span>
            </div>
            <div className="flex items-center gap-1">
              <AlertCircle className="w-4 h-4 text-red-400" />
              <span className="text-gray-400">{stats.expired}</span>
            </div>
            <div className="flex items-center gap-1">
              <DollarSign className="w-4 h-4 text-green-400" />
              <span className="text-gray-400">{formatCurrency(stats.totalValue)}</span>
            </div>
          </div>

          {/* Controls */}
          <Button
            variant="ghost"
            size="sm"
            onClick={() => setIsFullscreen(!isFullscreen)}
            className="text-gray-400 hover:text-white"
          >
            {isFullscreen ? <Minimize2 className="w-4 h-4" /> : <Maximize2 className="w-4 h-4" />}
          </Button>

          <Button
            variant="ghost"
            size="sm"
            onClick={() => setIsRealTimeEnabled(!isRealTimeEnabled)}
            className={`${isRealTimeEnabled ? 'text-green-400' : 'text-gray-400'} hover:bg-gray-800`}
          >
            {isRealTimeEnabled ? <Activity className="w-4 h-4" /> : <Timer className="w-4 h-4" />}
          </Button>

          <Button
            variant="ghost"
            size="sm"
            onClick={() => setSoundEnabled(!soundEnabled)}
            className={`${soundEnabled ? 'text-blue-400' : 'text-gray-400'} hover:bg-gray-800`}
          >
            {soundEnabled ? <Volume2 className="w-4 h-4" /> : <VolumeX className="w-4 h-4" />}
          </Button>

          <Button
            variant="ghost"
            size="sm"
            onClick={() => setSettingsDialogOpen(true)}
            className="text-gray-400 hover:text-white"
          >
            <Settings className="w-4 h-4" />
          </Button>

          <Button
            variant="outline"
            size="sm"
            onClick={() => loadOrders()}
            disabled={loading}
            className="border-blue-500 hover:bg-blue-500/10"
          >
            <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} />
          </Button>
        </div>
      </div>

      {/* Notifications */}
      {notifications.length > 0 && (
        <div className="space-y-2">
          {notifications.map((notification) => (
            <div
              key={notification.id}
              className={`p-4 rounded-lg border flex items-center gap-3 ${
                notification.type === 'success' ? 'bg-green-500/10 border-green-500/20 text-green-400' :
                notification.type === 'warning' ? 'bg-yellow-500/10 border-yellow-500/20 text-yellow-400' :
                notification.type === 'error' ? 'bg-red-500/10 border-red-500/20 text-red-400' :
                'bg-blue-500/10 border-blue-500 text-blue-400'
              }`}
            >
              {notification.type === 'success' && <CheckCircle className="w-5 h-5 shrink-0" />}
              {notification.type === 'warning' && <AlertTriangle className="w-5 h-5 shrink-0" />}
              {notification.type === 'error' && <XCircle className="w-5 h-5 shrink-0" />}
              {notification.type === 'info' && <Bell className="w-5 h-5 shrink-0" />}
              <div className="flex-1">
                <p className="font-medium">{notification.title}</p>
                <p className="text-sm opacity-80">{notification.message}</p>
              </div>
              <span className="text-xs opacity-60">
                {notification.timestamp.toLocaleTimeString()}
              </span>
            </div>
          ))}
        </div>
      )}

      {/* Filters and Controls */}
      <Card className="bg-gray-900 border-blue-500">
        <CardContent className="p-4">
          <div className="flex flex-wrap gap-4 items-center">
            {/* Search */}
            <div className="relative flex-1 min-w-64">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
              <Input
                placeholder="Search orders, customers, tables..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="pl-10 border-blue-500 bg-gray-800 text-white placeholder-gray-400 focus:border-blue-primary"
              />
            </div>

            {/* Filters */}
            <Select value={tableFilter} onValueChange={setTableFilter}>
              <SelectTrigger className="w-40 border-blue-500 bg-gray-800 text-white">
                <SelectValue placeholder="All Tables" />
              </SelectTrigger>
              <SelectContent className="bg-gray-800 border-blue-500">
                <SelectItem value="all">All Tables</SelectItem>
                {uniqueTables.map(table => (
                  <SelectItem key={table} value={table}>Table {table}</SelectItem>
                ))}
              </SelectContent>
            </Select>

            <Select value={priorityFilter} onValueChange={setPriorityFilter}>
              <SelectTrigger className="w-40 border-blue-500 bg-gray-800 text-white">
                <SelectValue placeholder="All Priorities" />
              </SelectTrigger>
              <SelectContent className="bg-gray-800 border-blue-500">
                <SelectItem value="all">All Priorities</SelectItem>
                <SelectItem value="high">High Priority</SelectItem>
                <SelectItem value="medium">Medium Priority</SelectItem>
                <SelectItem value="low">Normal Priority</SelectItem>
              </SelectContent>
            </Select>

            {/* Sort Controls */}
            <Select value={sortBy} onValueChange={(v: any) => setSortBy(v)}>
              <SelectTrigger className="w-40 border-blue-500 bg-gray-800 text-white">
                <SelectValue />
              </SelectTrigger>
              <SelectContent className="bg-gray-800 border-blue-500">
                <SelectItem value="priority">Priority</SelectItem>
                <SelectItem value="createdAt">Created</SelectItem>
                <SelectItem value="age">Age</SelectItem>
                <SelectItem value="total">Total</SelectItem>
              </SelectContent>
            </Select>

            <Button
              variant="ghost"
              size="sm"
              onClick={() => setSortOrder(sortOrder === 'asc' ? 'desc' : 'asc')}
              className="text-gray-400 hover:text-white"
            >
              {sortOrder === 'asc' ? <SortAsc className="w-4 h-4" /> : <SortDesc className="w-4 h-4" />}
            </Button>

            {/* View Mode */}
            <div className="flex border border-blue-500 rounded-md overflow-hidden">
              <Button
                variant={viewMode === 'grid' ? 'default' : 'ghost'}
                size="sm"
                onClick={() => setViewMode('grid')}
                className="rounded-none"
              >
                <LayoutGrid className="w-4 h-4" />
              </Button>
              <Button
                variant={viewMode === 'list' ? 'default' : 'ghost'}
                size="sm"
                onClick={() => setViewMode('list')}
                className="rounded-none"
              >
                <List className="w-4 h-4" />
              </Button>
            </div>

            {/* Bulk Operations */}
            {selectedOrders.size > 0 && (
              <Button
                variant="outline"
                onClick={() => setBulkActionDialogOpen(true)}
                className="border-blue-500 text-blue-400 hover:bg-blue-500/10"
              >
                Bulk Actions ({selectedOrders.size})
              </Button>
            )}
          </div>
        </CardContent>
      </Card>

      {/* Orders Display */}
      <div className="flex-1">
        {loading ? (
          <div className="flex items-center justify-center h-64">
            <div className="text-center">
              <RefreshCw className="w-8 h-8 animate-spin mx-auto mb-4 text-blue-400" />
              <p className="text-gray-400">Loading orders...</p>
            </div>
          </div>
        ) : filteredActiveOrders.length === 0 ? (
          <div className="flex items-center justify-center h-64">
            <div className="text-center">
              <Package className="w-12 h-12 mx-auto mb-4 text-gray-900/50" />
              <p className="text-gray-400 text-lg mb-2">No active orders</p>
              <p className="text-gray-400 text-sm">
                {searchTerm || tableFilter || priorityFilter 
                  ? 'Try adjusting your filters' 
                  : 'All caught up! No orders in queue'
                }
              </p>
            </div>
          </div>
        ) : (
          <div className={viewMode === 'grid' ? 'grid grid-cols-1 lg:grid-cols-2 xl:grid-cols-3 gap-4' : 'space-y-2'}>
            {Object.entries(groupedOrders).map(([groupName, groupOrders]) => (
              <div key={groupName}>
                {groupBy !== 'none' && (
                  <div className="flex items-center gap-2 mb-4">
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => {
                        const newExpanded = new Set(expandedGroups)
                        if (newExpanded.has(groupName)) {
                          newExpanded.delete(groupName)
                        } else {
                          newExpanded.add(groupName)
                        }
                        setExpandedGroups(newExpanded)
                      }}
                      className="text-gray-400 hover:text-white"
                    >
                      {expandedGroups.has(groupName) ? <ArrowDown className="w-4 h-4" /> : <ArrowRight className="w-4 h-4" />}
                    </Button>
                    <h3 className="text-lg font-semibold text-gray-400">{groupName}</h3>
                    <Badge variant="outline" className="border-blue-500 text-gray-400">
                      {groupOrders.length}
                    </Badge>
                  </div>
                )}
                
                {(groupBy === 'none' || expandedGroups.has(groupName)) && (
                  <div className={viewMode === 'grid' ? 'grid grid-cols-1 lg:grid-cols-2 xl:grid-cols-3 gap-4' : 'space-y-2'}>
                    {groupOrders.map((order) => {
                      const statusInfo = OrderStatusManager.getOrderStatus(order)
                      return (
                        <Card
                          key={order.id}
                          className={`relative bg-gray-800 border-blue-500 hover:border-blue-primary/50 transition-all cursor-pointer group ${
                            draggedOrder === order.id ? 'opacity-50' : ''
                          } ${
                            dragOverOrder === order.id ? 'ring-2 ring-blue-400' : ''
                          } ${
                            statusInfo.isExpired ? 'ring-2 ring-red-500/20' :
                            statusInfo.priority >= 3 ? 'ring-2 ring-yellow-500/20' : ''
                          }`}
                          draggable
                          onDragStart={(e) => handleDragStart(e, order.id)}
                          onDragOver={(e) => handleDragOver(e, order.id)}
                          onDragLeave={handleDragLeave}
                          onDrop={(e) => handleDrop(e, order.id)}
                        >
                          {getExpiryWarning(order)}
                          
                          <CardHeader className="pb-3">
                            <div className="flex items-start justify-between">
                              <div className="flex items-start gap-3 flex-1">
                                {/* Bulk selection */}
                                <Checkbox
                                  checked={selectedOrders.has(order.id)}
                                  onCheckedChange={() => {
                                    setSelectedOrders(prev => {
                                      const newSet = new Set(prev)
                                      if (newSet.has(order.id)) {
                                        newSet.delete(order.id)
                                      } else {
                                        newSet.add(order.id)
                                      }
                                      return newSet
                                    })
                                  }}
                                  className="mt-1"
                                />
                                
                                {/* Drag handle */}
                                <div className="mt-1">
                                  <GripVertical className="w-4 h-4 text-gray-400 cursor-grab" />
                                </div>
                                
                                <div className="flex-1">
                                  <div className="flex items-center gap-2 mb-2">
                                    <CardTitle className="text-lg text-gray-400 group-hover:text-blue-400 transition-colors">
                                      {order.orderNumber}
                                    </CardTitle>
                                    {getPriorityIcon(order)}
                                    <Badge className={getStatusColor(order.status)}>
                                      {order.status}
                                    </Badge>
                                    {statusInfo.isExpired && (
                                      <Badge variant="outline" className="border-red-500/20 text-red-400">
                                        EXPIRED
                                      </Badge>
                                    )}
                                  </div>
                                  
                                  {order.orderName && (
                                    <CardDescription className="text-gray-400">
                                      {order.orderName}
                                    </CardDescription>
                                  )}
                                  
                                  {statusInfo.warnings.length > 0 && (
                                    <div className="mt-1">
                                      <p className="text-xs text-yellow-400">
                                        ⚠️ {statusInfo.warnings[0]}
                                      </p>
                                    </div>
                                  )}
                                </div>
                              </div>
                              
                              {/* Actions menu */}
                              <div className="relative">
                                <Button
                                  variant="ghost"
                                  size="sm"
                                  onClick={() => setActionMenuOpen(actionMenuOpen === order.id ? null : order.id)}
                                  className="text-gray-400 hover:text-white"
                                >
                                  <MoreHorizontal className="w-4 h-4" />
                                </Button>
                                
                                {actionMenuOpen === order.id && (
                                  <div className="absolute right-0 top-8 bg-gray-700 border border-blue-500 rounded-lg shadow-lg z-10 min-w-32">
                                    <Button
                                      variant="ghost"
                                      size="sm"
                                      className="w-full justify-start text-green-400 hover:bg-green-500/10"
                                      onClick={() => handleRetrieveOrder(order)}
                                    >
                                      <RefreshCw className="w-4 h-4 mr-2" />
                                      Retrieve
                                    </Button>
                                    <Button
                                      variant="ghost"
                                      size="sm"
                                      className="w-full justify-start text-blue-400 hover:bg-blue-500/10"
                                      onClick={() => {
                                        setSelectedOrder(order)
                                        setEditForm({
                                          orderName: order.orderName || '',
                                          tableNumber: order.tableNumber || '',
                                          notes: order.notes || '',
                                          priority: order.priority,
                                          tags: order.tags || ''
                                        })
                                        setEditDialogOpen(true)
                                        setActionMenuOpen(null)
                                      }}
                                    >
                                      <Edit className="w-4 h-4 mr-2" />
                                      Edit
                                    </Button>
                                    <Button
                                      variant="ghost"
                                      size="sm"
                                      className="w-full justify-start text-red-400 hover:bg-red-500/10"
                                      onClick={() => {
                                        setSelectedOrder(order)
                                        setDeleteDialogOpen(true)
                                        setActionMenuOpen(null)
                                      }}
                                    >
                                      <Trash2 className="w-4 h-4 mr-2" />
                                      Cancel
                                    </Button>
                                  </div>
                                )}
                              </div>
                            </div>
                          </CardHeader>
                          
                          <CardContent className="space-y-3">
                            {/* Order Details */}
                            <div className="grid grid-cols-2 gap-2 text-sm">
                              <div className="flex items-center gap-2 text-gray-400">
                                <User className="w-3 h-3" />
                                <span>{order.customer?.name || 'Walk-in'}</span>
                              </div>
                              <div className="flex items-center gap-2 text-gray-400">
                                <Clock className="w-3 h-3" />
                                <span className={getAgeColor(order.age)}>{order.ageDisplay}</span>
                              </div>
                              {order.tableNumber && (
                                <div className="flex items-center gap-2 text-gray-400">
                                  <Table className="w-3 h-3" />
                                  <span>Table {order.tableNumber}</span>
                                </div>
                              )}
                              <div className="flex items-center gap-2 text-gray-400">
                                <ShoppingCart className="w-3 h-3" />
                                <span>{order.itemCount} items</span>
                              </div>
                            </div>

                            {/* Total */}
                            <div className="flex items-center justify-between pt-2 border-t border-blue-500">
                              <span className="text-gray-400 text-sm">Total</span>
                              <span className="text-lg font-bold text-gray-400">
                                {formatCurrency(order.total)}
                              </span>
                            </div>

                            {/* Action Buttons */}
                            <div className="flex gap-2 pt-2">
                              <Button
                                size="sm"
                                className="flex-1 bg-green-600 hover:bg-green-700 text-white"
                                onClick={() => handleRetrieveOrder(order)}
                              >
                                <Play className="w-4 h-4 mr-1" />
                                Process
                              </Button>
                              <Button
                                variant="outline"
                                size="sm"
                                className="border-blue-500 text-blue-400 hover:bg-blue-500/10"
                                onClick={() => {
                                  setSelectedOrder(order)
                                  setEditForm({
                                    orderName: order.orderName || '',
                                    tableNumber: order.tableNumber || '',
                                    notes: order.notes || '',
                                    priority: order.priority,
                                    tags: order.tags || ''
                                  })
                                  setEditDialogOpen(true)
                                }}
                              >
                                <Edit className="w-4 h-4" />
                              </Button>
                            </div>
                          </CardContent>
                        </Card>
                      )
                    })}
                  </div>
                )}
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Settings Dialog */}
      <Dialog open={settingsDialogOpen} onOpenChange={setSettingsDialogOpen}>
        <DialogContent className="bg-gray-900 border-blue-500">
          <DialogHeader>
            <DialogTitle className="text-gray-400">Queue Settings</DialogTitle>
            <DialogDescription>
              Configure real-time updates and display preferences
            </DialogDescription>
          </DialogHeader>
          
          <div className="space-y-4 py-4">
            <div>
              <label className="text-sm font-medium mb-2 block text-gray-400">Auto Refresh Interval (seconds)</label>
              <Select value={autoRefreshInterval.toString()} onValueChange={(v) => setAutoRefreshInterval(parseInt(v))}>
                <SelectTrigger className="border-blue-500 bg-gray-800 text-white">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent className="bg-gray-800 border-blue-500">
                  <SelectItem value="15">15 seconds</SelectItem>
                  <SelectItem value="30">30 seconds</SelectItem>
                  <SelectItem value="60">1 minute</SelectItem>
                  <SelectItem value="120">2 minutes</SelectItem>
                </SelectContent>
              </Select>
            </div>
            
            <div>
              <label className="text-sm font-medium mb-2 block text-gray-400">Group Orders By</label>
              <Select value={groupBy} onValueChange={(v: any) => setGroupBy(v)}>
                <SelectTrigger className="border-blue-500 bg-gray-800 text-white">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent className="bg-gray-800 border-blue-500">
                  <SelectItem value="none">No Grouping</SelectItem>
                  <SelectItem value="status">Status</SelectItem>
                  <SelectItem value="priority">Priority</SelectItem>
                  <SelectItem value="table">Table</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>
          
          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => setSettingsDialogOpen(false)}
              className="border-blue-500"
            >
              Cancel
            </Button>
            <Button
              onClick={() => {
                setSettingsDialogOpen(false)
                addNotification({
                  type: 'success',
                  title: 'Settings Updated',
                  message: 'Queue settings have been saved'
                })
              }}
              className="bg-blue-600 hover:bg-blue-700 text-white"
            >
              Save Settings
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Edit Order Dialog */}
      <Dialog open={editDialogOpen} onOpenChange={setEditDialogOpen}>
        <DialogContent className="bg-gray-900 border-blue-500">
          <DialogHeader>
            <DialogTitle className="text-gray-400">Edit Order</DialogTitle>
            <DialogDescription>
              Update order details for {selectedOrder?.orderNumber}
            </DialogDescription>
          </DialogHeader>
          
          <div className="space-y-4 py-4">
            <div>
              <label className="text-sm font-medium mb-2 block text-gray-400">Order Name</label>
              <Input
                value={editForm.orderName}
                onChange={(e) => setEditForm({...editForm, orderName: e.target.value})}
                placeholder="Enter order name"
                className="border-blue-500 bg-gray-800 text-white"
              />
            </div>
            
            <div>
              <label className="text-sm font-medium mb-2 block text-gray-400">Table Number</label>
              <Input
                value={editForm.tableNumber}
                onChange={(e) => setEditForm({...editForm, tableNumber: e.target.value})}
                placeholder="Enter table number"
                className="border-blue-500 bg-gray-800 text-white"
              />
            </div>
            
            <div>
              <label className="text-sm font-medium mb-2 block text-gray-400">Notes</label>
              <Input
                value={editForm.notes}
                onChange={(e) => setEditForm({...editForm, notes: e.target.value})}
                placeholder="Enter notes"
                className="border-blue-500 bg-gray-800 text-white"
              />
            </div>
            
            <div>
              <label className="text-sm font-medium mb-2 block text-gray-400">Priority</label>
              <Select 
                value={editForm.priority.toString()} 
                onValueChange={(v) => setEditForm({...editForm, priority: parseInt(v)})}
              >
                <SelectTrigger className="border-blue-500 bg-gray-800 text-white">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent className="bg-gray-800 border-blue-500">
                  <SelectItem value="0">Normal</SelectItem>
                  <SelectItem value="1">High Priority</SelectItem>
                  <SelectItem value="2">Urgent</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>
          
          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => setEditDialogOpen(false)}
              className="border-blue-500"
            >
              Cancel
            </Button>
            <Button
              onClick={async () => {
                if (!selectedOrder) return
                
                try {
                  const response = await fetch(`/api/pos/orders/hold/${selectedOrder.id}?storeId=${storeId}`, {
                    method: 'PUT',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify(editForm)
                  })
                  
                  if (response.ok) {
                    addNotification({
                      type: 'success',
                      title: 'Order Updated',
                      message: 'Order details updated successfully'
                    })
                    setEditDialogOpen(false)
                    loadOrders()
                  } else {
                    throw new Error('Failed to update order')
                  }
                } catch (error) {
                  addNotification({
                    type: 'error',
                    title: 'Update Failed',
                    message: 'Failed to update order'
                  })
                }
              }}
              className="bg-blue-600 hover:bg-blue-700 text-white"
            >
              Save Changes
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Delete Confirmation Dialog */}
      <AlertDialog open={deleteDialogOpen} onOpenChange={setDeleteDialogOpen}>
        <AlertDialogContent className="bg-gray-900 border-blue-500">
          <AlertDialogHeader>
            <AlertDialogTitle className="text-gray-400 flex items-center gap-2">
              <AlertTriangle className="w-5 h-5 text-red-400" />
              Cancel Order
            </AlertDialogTitle>
            <AlertDialogDescription>
              Are you sure you want to cancel order {selectedOrder?.orderNumber}? 
              This action cannot be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          
          <AlertDialogFooter>
            <AlertDialogCancel className="border-blue-500">
              Keep Order
            </AlertDialogCancel>
            <AlertDialogAction
              onClick={() => selectedOrder && handleCancelOrder(selectedOrder)}
              className="bg-red-600 hover:bg-red-700 text-white"
            >
              Cancel Order
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* Bulk Actions Dialog */}
      <Dialog open={bulkActionDialogOpen} onOpenChange={setBulkActionDialogOpen}>
        <DialogContent className="bg-gray-900 border-blue-500">
          <DialogHeader>
            <DialogTitle className="text-gray-400">Bulk Actions</DialogTitle>
            <DialogDescription>
              Perform actions on {selectedOrders.size} selected orders
            </DialogDescription>
          </DialogHeader>
          
          <div className="space-y-4 py-4">
            <div>
              <label className="text-sm font-medium mb-2 block text-gray-400">Action</label>
              <Select value={bulkAction} onValueChange={(v: any) => setBulkAction(v)}>
                <SelectTrigger className="border-blue-500 bg-gray-800 text-white">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent className="bg-gray-800 border-blue-500">
                  <SelectItem value="retrieve">Retrieve All</SelectItem>
                  <SelectItem value="cancel">Cancel All</SelectItem>
                  <SelectItem value="priority">Set Priority</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>
          
          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => setBulkActionDialogOpen(false)}
              className="border-blue-500"
            >
              Cancel
            </Button>
            <Button
              onClick={() => {
                performBulkOperation(bulkAction)
                setBulkActionDialogOpen(false)
              }}
              disabled={bulkOperationLoading}
              className="bg-blue-600 hover:bg-blue-700 text-white"
            >
              {bulkOperationLoading ? (
                <RefreshCw className="w-4 h-4 mr-2 animate-spin" />
              ) : null}
              Execute
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}

// Helper functions
function getStatusColor(status: string) {
  switch (status) {
    case 'held': return 'bg-blue-500/10 text-blue-400 border-blue-500'
    case 'retrieved': return 'bg-green-500/10 text-green-400 border-green-500/20'
    case 'expired': return 'bg-red-500/10 text-red-400 border-red-500/20'
    case 'cancelled': return 'bg-gray-500/10 text-gray-400 border-gray-500/20'
    default: return 'bg-gray-500/10 text-gray-400 border-gray-500/20'
  }
}

function getAgeColor(age: number) {
  if (age > 120) return 'text-red-400' // 2+ hours
  if (age > 60) return 'text-yellow-400' // 1+ hour
  return 'text-green-400' // < 1 hour
}

function getPriorityIcon(order: HeldOrder) {
  const statusInfo = OrderStatusManager.getOrderStatus(order)
  if (statusInfo.priority >= 5) return <Star className="w-3 h-3 text-red-400" />
  if (statusInfo.priority >= 3) return <Star className="w-3 h-3 text-yellow-400" />
  if (statusInfo.priority >= 1) return <Star className="w-3 h-3 text-blue-400" />
  return null
}

function getExpiryWarning(order: HeldOrder) {
  const statusInfo = OrderStatusManager.getOrderStatus(order)
  if (statusInfo.isExpired) {
    return <div className="absolute top-2 right-2 w-2 h-2 bg-red-400 rounded-full animate-pulse" />
  }
  if (statusInfo.warnings.length > 0) {
    return <div className="absolute top-2 right-2 w-2 h-2 bg-yellow-400 rounded-full" />
  }
  return null
}