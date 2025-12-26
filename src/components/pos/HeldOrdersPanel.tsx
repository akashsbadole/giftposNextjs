'use client'

import { useState, useEffect, useCallback } from 'react'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Button } from '@/components/ui/button'
import { ScrollArea } from '@/components/ui/scroll-area'
import { Badge } from '@/components/ui/badge'
import { Separator } from '@/components/ui/separator'
import { Checkbox } from '@/components/ui/checkbox'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
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
  EyeOff
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
}

interface HeldOrdersPanelProps {
  isOpen: boolean
  onClose: () => void
  onRetrieveOrder: (order: HeldOrder) => void
  storeId: string
}

export default function HeldOrdersPanel({ 
  isOpen, 
  onClose, 
  onRetrieveOrder, 
  storeId 
}: HeldOrdersPanelProps) {
  const { toast } = useToast()
  const { formatCurrency } = useSettings()
  const [orders, setOrders] = useState<HeldOrder[]>([])
  const [loading, setLoading] = useState(false)
  const [searchTerm, setSearchTerm] = useState('')
  const [statusFilter, setStatusFilter] = useState('held')
  const [tableFilter, setTableFilter] = useState('')
  const [customerFilter, setCustomerFilter] = useState('')
  const [selectedOrder, setSelectedOrder] = useState<HeldOrder | null>(null)
  const [actionMenuOpen, setActionMenuOpen] = useState<string | null>(null)
  const [editDialogOpen, setEditDialogOpen] = useState(false)
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false)
  const [editForm, setEditForm] = useState({
    orderName: '',
    tableNumber: '',
    notes: '',
    priority: 0
  })
  
  // Advanced UX state
  const [notifications, setNotifications] = useState<Array<{
    id: string
    type: 'success' | 'warning' | 'error' | 'info'
    title: string
    message: string
    timestamp: Date
  }>>([])
  const [sortBy, setSortBy] = useState<'createdAt' | 'total' | 'priority' | 'age'>('createdAt')
  const [sortOrder, setSortOrder] = useState<'asc' | 'desc'>('desc')
  const [selectedOrders, setSelectedOrders] = useState<Set<string>>(new Set())
  const [bulkOperationLoading, setBulkOperationLoading] = useState(false)
  const [lastRefresh, setLastRefresh] = useState<Date>(new Date())
  const [isRealTimeEnabled, setIsRealTimeEnabled] = useState(true)
  const [keyboardShortcuts, setKeyboardShortcuts] = useState(true)

  // Load held orders
  const loadHeldOrders = useCallback(async () => {
    if (!storeId) return
    
    setLoading(true)
    try {
      const params = new URLSearchParams({
        storeId,
        status: statusFilter,
        limit: '100'
      })
      
      if (searchTerm) params.append('search', searchTerm)
      if (tableFilter) params.append('tableNumber', tableFilter)
      if (customerFilter) params.append('customerId', customerFilter)

      const response = await fetch(`/api/pos/orders/hold?${params}`)
      
      if (response.ok) {
        const data = await response.json()
        setOrders(data.data || [])
      } else {
        throw new Error('Failed to load held orders')
      }
    } catch (error) {
      console.error('Error loading held orders:', error)
      toast({
        title: 'Error',
        description: 'Failed to load held orders',
        variant: 'destructive',
      })
    } finally {
      setLoading(false)
    }
  }, [storeId, statusFilter, searchTerm, tableFilter, customerFilter, toast])

  // Load orders when panel opens or filters change
  useEffect(() => {
    if (isOpen) {
      loadHeldOrders()
    }
  }, [isOpen, loadHeldOrders])

  // Auto-refresh with real-time updates
  useEffect(() => {
    if (!isOpen || !isRealTimeEnabled) return
    
    const interval = setInterval(() => {
      loadHeldOrders()
      setLastRefresh(new Date())
    }, 15000) // Refresh every 15 seconds
    
    return () => clearInterval(interval)
  }, [isOpen, isRealTimeEnabled, loadHeldOrders])

  // Real-time status updates
  useEffect(() => {
    if (!isOpen || !isRealTimeEnabled) return

    const checkForUpdates = () => {
      orders.forEach(order => {
        const statusInfo = OrderStatusManager.getOrderStatus(order)
        
        // Check for warnings and expiry
        if (statusInfo.isExpired && order.status === 'held') {
          addNotification({
            type: 'warning',
            title: 'Order Expired',
            message: `Order ${order.orderNumber} has expired`
          })
        }
        
        if (statusInfo.warnings.length > 0) {
          addNotification({
            type: 'info',
            title: 'Order Warning',
            message: statusInfo.warnings.join(', ')
          })
        }
      })
    }

    const updateInterval = setInterval(checkForUpdates, 60000) // Check every minute
    return () => clearInterval(updateInterval)
  }, [isOpen, isRealTimeEnabled, orders])

  // Add notification
  const addNotification = (notification: {
    type: 'success' | 'warning' | 'error' | 'info'
    title: string
    message: string
  }) => {
    const id = Date.now().toString()
    setNotifications(prev => [{
      id,
      ...notification,
      timestamp: new Date()
    }, ...prev.slice(0, 4)]) // Keep only latest 5 notifications

    // Auto-remove notification after 5 seconds
    setTimeout(() => {
      setNotifications(prev => prev.filter(n => n.id !== id))
    }, 5000)
  }

  // Keyboard shortcuts
  useEffect(() => {
    if (!isOpen || !keyboardShortcuts) return

    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.ctrlKey || e.metaKey) {
        switch (e.key) {
          case 'r':
            e.preventDefault()
            loadHeldOrders()
            addNotification({ type: 'info', title: 'Refreshed', message: 'Orders list refreshed' })
            break
          case 'f':
            e.preventDefault()
            document.querySelector<HTMLInputElement>('input[placeholder="Search orders..."]')?.focus()
            break
          case 'a':
            e.preventDefault()
            toggleSelectAll()
            break
        }
      }
    }

    document.addEventListener('keydown', handleKeyDown)
    return () => document.removeEventListener('keydown', handleKeyDown)
  }, [isOpen, keyboardShortcuts, orders])

  // Retrieve order
  const handleRetrieveOrder = async (order: HeldOrder) => {
    try {
      const response = await fetch(`/api/pos/orders/hold/${order.id}/retrieve?storeId=${storeId}`, {
        method: 'POST'
      })
      
      if (response.ok) {
        const data = await response.json()
        onRetrieveOrder(data.order)
        toast({
          title: 'Success',
          description: `Order ${order.orderNumber} retrieved successfully`,
        })
        loadHeldOrders() // Refresh list
      } else {
        throw new Error('Failed to retrieve order')
      }
    } catch (error) {
      console.error('Error retrieving order:', error)
      toast({
        title: 'Error',
        description: 'Failed to retrieve order',
        variant: 'destructive',
      })
    }
  }

  // Edit order
  const handleEditOrder = (order: HeldOrder) => {
    setSelectedOrder(order)
    setEditForm({
      orderName: order.orderName || '',
      tableNumber: order.tableNumber || '',
      notes: order.notes || '',
      priority: order.priority
    })
    setEditDialogOpen(true)
    setActionMenuOpen(null)
  }

  // Save edited order
  const saveEditedOrder = async () => {
    if (!selectedOrder) return
    
    try {
      const response = await fetch(`/api/pos/orders/hold/${selectedOrder.id}?storeId=${storeId}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(editForm)
      })
      
      if (response.ok) {
        toast({
          title: 'Success',
          description: 'Order updated successfully',
        })
        setEditDialogOpen(false)
        loadHeldOrders()
      } else {
        throw new Error('Failed to update order')
      }
    } catch (error) {
      console.error('Error updating order:', error)
      toast({
        title: 'Error',
        description: 'Failed to update order',
        variant: 'destructive',
      })
    }
  }

  // Delete/cancel order
  const handleDeleteOrder = async (order: HeldOrder) => {
    try {
      const response = await fetch(`/api/pos/orders/hold/${order.id}?storeId=${storeId}`, {
        method: 'DELETE'
      })
      
      if (response.ok) {
        toast({
          title: 'Success',
          description: 'Order cancelled successfully',
        })
        setDeleteDialogOpen(false)
        setSelectedOrder(null)
        loadHeldOrders()
      } else {
        throw new Error('Failed to cancel order')
      }
    } catch (error) {
      console.error('Error cancelling order:', error)
      toast({
        title: 'Error',
        description: 'Failed to cancel order',
        variant: 'destructive',
      })
    }
  }

  // Enhanced status and visual management
  const getStatusColor = (status: string) => {
    switch (status) {
      case 'held': return 'bg-blue-500/10 text-blue-400 border-blue-500'
      case 'retrieved': return 'bg-green-500/10 text-green-400 border-green-500/20'
      case 'expired': return 'bg-red-500/10 text-red-400 border-red-500/20'
      case 'cancelled': return 'bg-gray-500/10 text-gray-400 border-gray-500/20'
      default: return 'bg-gray-500/10 text-gray-400 border-gray-500/20'
    }
  }

  const getAgeColor = (age: number) => {
    if (age > 120) return 'text-red-400' // 2+ hours
    if (age > 60) return 'text-yellow-400' // 1+ hour
    return 'text-green-400' // < 1 hour
  }

  const getPriorityIcon = (order: HeldOrder) => {
    const statusInfo = OrderStatusManager.getOrderStatus(order)
    if (statusInfo.priority >= 5) return <Star className="w-3 h-3 text-red-400" />
    if (statusInfo.priority >= 3) return <Star className="w-3 h-3 text-yellow-400" />
    if (statusInfo.priority >= 1) return <Star className="w-3 h-3 text-blue-400" />
    return null
  }

  const getExpiryWarning = (order: HeldOrder) => {
    const statusInfo = OrderStatusManager.getOrderStatus(order)
    if (statusInfo.isExpired) {
      return <div className="absolute top-2 right-2 w-2 h-2 bg-red-400 rounded-full animate-pulse" />
    }
    if (statusInfo.warnings.length > 0) {
      return <div className="absolute top-2 right-2 w-2 h-2 bg-yellow-400 rounded-full" />
    }
    return null
  }

  // Enhanced filtering and sorting
  const filteredOrders = orders
    .filter(order => {
      const matchesSearch = !searchTerm || 
        order.orderNumber.toLowerCase().includes(searchTerm.toLowerCase()) ||
        order.orderName?.toLowerCase().includes(searchTerm.toLowerCase()) ||
        order.customer?.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
        order.tableNumber?.toLowerCase().includes(searchTerm.toLowerCase())
      
      const matchesTable = !tableFilter || tableFilter === 'all' || order.tableNumber === tableFilter
      const matchesCustomer = !customerFilter || customerFilter === 'all' || order.customer?.name === customerFilter
      
      return matchesSearch && matchesTable && matchesCustomer
    })
    .sort((a, b) => {
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

  // Bulk operations
  const toggleSelectOrder = (orderId: string) => {
    setSelectedOrders(prev => {
      const newSet = new Set(prev)
      if (newSet.has(orderId)) {
        newSet.delete(orderId)
      } else {
        newSet.add(orderId)
      }
      return newSet
    })
  }

  const toggleSelectAll = () => {
    if (selectedOrders.size === filteredOrders.length) {
      setSelectedOrders(new Set())
    } else {
      setSelectedOrders(new Set(filteredOrders.map(o => o.id)))
    }
  }

  const performBulkOperation = async (operation: 'cancel' | 'retrieve' | 'export') => {
    if (selectedOrders.size === 0) return
    
    setBulkOperationLoading(true)
    try {
      const results = await Promise.all(
        Array.from(selectedOrders).map(async (orderId) => {
          switch (operation) {
            case 'cancel':
              const cancelResponse = await fetch(`/api/pos/orders/hold/${orderId}?storeId=${storeId}`, { method: 'DELETE' })
              return { orderId, success: cancelResponse.ok, operation }
            case 'retrieve':
              const retrieveResponse = await fetch(`/api/pos/orders/hold/${orderId}/retrieve?storeId=${storeId}`, { method: 'POST' })
              return { orderId, success: retrieveResponse.ok, operation }
            case 'export':
              // Export functionality would be implemented here
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
      loadHeldOrders()
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

  // Get unique tables and customers for filters
  const uniqueTables = [...new Set(orders.filter(o => o.tableNumber).map(o => o.tableNumber))].sort()
  const uniqueCustomers = [...new Set(orders.filter(o => o.customer).map(o => o.customer?.name))].sort()

  if (!isOpen) return null

  return (
    <div className="fixed inset-0 z-50 bg-black/50 flex items-center justify-center">
      <div className="bg-gray-900 border border-blue-500 rounded-lg shadow-2xl w-full max-w-6xl h-[90vh] flex flex-col">
        {/* Header */}
        <div className="flex items-center justify-between p-6 border-b border-blue-500">
          <div>
            <h2 className="text-2xl font-bold text-gray-400">Held Orders</h2>
            <div className="flex items-center gap-4 mt-1">
              <p className="text-gray-400">
                Manage suspended transactions and pending orders
              </p>
              {lastRefresh && (
                <p className="text-xs text-gray-500">
                  Last updated: {lastRefresh.toLocaleTimeString()}
                </p>
              )}
            </div>
          </div>
          <div className="flex items-center gap-2">
            {/* Notifications */}
            {notifications.length > 0 && (
              <div className="relative">
                <Bell className="w-5 h-5 text-blue-400" />
                <Badge className="absolute -top-2 -right-2 bg-red-500 text-white text-xs w-5 h-5 rounded-full flex items-center justify-center">
                  {notifications.length}
                </Badge>
              </div>
            )}
            
            {/* Real-time toggle */}
            <Button
              variant="ghost"
              size="sm"
              onClick={() => setIsRealTimeEnabled(!isRealTimeEnabled)}
              className={`${isRealTimeEnabled ? 'text-green-400' : 'text-gray-400'} hover:bg-gray-800`}
              title={isRealTimeEnabled ? 'Disable real-time updates' : 'Enable real-time updates'}
            >
              {isRealTimeEnabled ? <Timer className="w-4 h-4" /> : <Timer className="w-4 h-4 opacity-50" />}
            </Button>
            
            {/* Sort controls */}
            <Select value={sortBy} onValueChange={(v: any) => setSortBy(v)}>
              <SelectTrigger className="w-32 border-blue-500 bg-gray-800 text-white">
                <SelectValue />
              </SelectTrigger>
              <SelectContent className="bg-gray-400 border-amber-500">
                <SelectItem value="createdAt">Created</SelectItem>
                <SelectItem value="total">Total</SelectItem>
                <SelectItem value="priority">Priority</SelectItem>
                <SelectItem value="age">Age</SelectItem>
              </SelectContent>
            </Select>
            
            <Button
              variant="ghost"
              size="sm"
              onClick={() => setSortOrder(sortOrder === 'asc' ? 'desc' : 'asc')}
              className="text-gray-400 hover:text-white"
            >
              {sortOrder === 'asc' ? '↑' : '↓'}
            </Button>
            
            <Badge variant="outline" className="border-blue-500 text-gray-400">
              {filteredOrders.length} orders
            </Badge>
            
            <Button
              variant="outline"
              size="sm"
              onClick={loadHeldOrders}
              disabled={loading}
              className="border-blue-500 hover:bg-blue-accent/10"
            >
              <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} />
            </Button>
            
            <Button
              variant="ghost"
              size="sm"
              onClick={onClose}
              className="text-gray-400 hover:text-white hover:bg-gray-800"
            >
              <X className="w-4 h-4" />
            </Button>
          </div>
        </div>

        {/* Bulk Operations Bar */}
        {selectedOrders.size > 0 && (
          <div className="p-4 bg-blue-500/10 border-b border-blue-500">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Checkbox 
                  checked={selectedOrders.size === filteredOrders.length}
                  onCheckedChange={toggleSelectAll}
                />
                <span className="text-blue-400 font-medium">
                  {selectedOrders.size} order{selectedOrders.size !== 1 ? 's' : ''} selected
                </span>
              </div>
              <div className="flex items-center gap-2">
                <Button
                  size="sm"
                  onClick={() => performBulkOperation('retrieve')}
                  disabled={bulkOperationLoading}
                  className="bg-green-600 hover:bg-green-700 text-white"
                >
                  <RefreshCw className="w-4 h-4 mr-1" />
                  Retrieve All
                </Button>
                <Button
                  size="sm"
                  onClick={() => performBulkOperation('cancel')}
                  disabled={bulkOperationLoading}
                  className="bg-red-600 hover:bg-red-700 text-white"
                >
                  <XCircle className="w-4 h-4 mr-1" />
                  Cancel All
                </Button>
                <Button
                  size="sm"
                  onClick={() => performBulkOperation('export')}
                  disabled={bulkOperationLoading}
                  className="bg-blue-600 hover:bg-blue-700 text-white"
                >
                  <Download className="w-4 h-4 mr-1" />
                  Export
                </Button>
              </div>
            </div>
          </div>
        )}

        {/* Notifications Display */}
        {notifications.length > 0 && (
          <div className="p-4 space-y-2 bg-gray-800/50 border-b border-blue-500">
            {notifications.map((notification) => (
              <div
                key={notification.id}
                className={`p-3 rounded-lg border flex items-center gap-3 ${
                  notification.type === 'success' ? 'bg-green-500/10 border-green-500/20 text-green-400' :
                  notification.type === 'warning' ? 'bg-yellow-500/10 border-yellow-500/20 text-yellow-400' :
                  notification.type === 'error' ? 'bg-red-500/10 border-red-500/20 text-red-400' :
                  'bg-blue-500/10 border-blue-500 text-blue-400'
                }`}
              >
                {notification.type === 'success' && <CheckCircle className="w-4 h-4 shrink-0" />}
                {notification.type === 'warning' && <AlertTriangle className="w-4 h-4 shrink-0" />}
                {notification.type === 'error' && <XCircle className="w-4 h-4 shrink-0" />}
                {notification.type === 'info' && <Bell className="w-4 h-4 shrink-0" />}
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

        {/* Filters */}
        <div className="p-6 border-b border-blue-500">
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
            {/* Search */}
            <div className="relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
              <Input
                placeholder="Search orders..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="pl-10 border-blue-500 bg-gray-800 text-white placeholder-gray-400 focus:border-blue-primary"
              />
            </div>

            {/* Status Filter */}
            <Select value={statusFilter} onValueChange={setStatusFilter}>
              <SelectTrigger className="border-blue-500 bg-gray-800 text-white">
                <SelectValue />
              </SelectTrigger>
              <SelectContent className="bg-gray-400 border-amber-500">
                <SelectItem value="held">Held</SelectItem>
                <SelectItem value="retrieved">Retrieved</SelectItem>
                <SelectItem value="expired">Expired</SelectItem>
                <SelectItem value="cancelled">Cancelled</SelectItem>
              </SelectContent>
            </Select>

            {/* Table Filter */}
            <Select value={tableFilter} onValueChange={setTableFilter}>
              <SelectTrigger className="border-blue-500 bg-gray-800 text-white">
                <SelectValue placeholder="All Tables" />
              </SelectTrigger>
              <SelectContent className="bg-gray-400 border-amber-500">
                <SelectItem value="all">All Tables</SelectItem>
                {uniqueTables.map(table => (
                  <SelectItem key={table} value={table}>Table {table}</SelectItem>
                ))}
              </SelectContent>
            </Select>

            {/* Customer Filter */}
            <Select value={customerFilter} onValueChange={setCustomerFilter}>
              <SelectTrigger className="border-blue-500 bg-gray-800 text-white">
                <SelectValue placeholder="All Customers" />
              </SelectTrigger>
              <SelectContent className="bg-gray-400 border-amber-500">
                <SelectItem value="all">All Customers</SelectItem>
                {uniqueCustomers.map(customer => (
                  <SelectItem key={customer} value={customer}>{customer}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        </div>

        {/* Orders List */}
        <div className="flex-1 overflow-hidden">
          {loading ? (
            <div className="flex items-center justify-center h-full">
              <div className="text-center">
                <RefreshCw className="w-8 h-8 animate-spin mx-auto mb-4 text-blue-400" />
                <p className="text-gray-400">Loading held orders...</p>
              </div>
            </div>
          ) : filteredOrders.length === 0 ? (
            <div className="flex items-center justify-center h-full">
              <div className="text-center">
                <Package className="w-12 h-12 mx-auto mb-4 text-gray-900/50" />
                <p className="text-gray-400 text-lg mb-2">No held orders found</p>
                <p className="text-gray-400 text-sm">
                  {searchTerm || tableFilter || customerFilter 
                    ? 'Try adjusting your filters' 
                    : 'No orders are currently on hold'
                  }
                </p>
              </div>
            </div>
          ) : (
            <ScrollArea className="h-full p-6">
              <div className="grid grid-cols-1 lg:grid-cols-2 xl:grid-cols-3 gap-4">
                {filteredOrders.map((order) => {
                  const statusInfo = OrderStatusManager.getOrderStatus(order)
                  return (
                    <Card
                      key={order.id}
                      className={`relative bg-gray-800 border-blue-500 hover:border-blue-primary/50 transition-all cursor-pointer group ${
                        statusInfo.isExpired ? 'ring-2 ring-red-500/20' :
                        statusInfo.priority >= 3 ? 'ring-2 ring-yellow-500/20' : ''
                      }`}
                    >
                      {getExpiryWarning(order)}
                    <CardHeader className="pb-3">
                      <div className="flex items-start justify-between">
                        <div className="flex items-start gap-3 flex-1">
                          {/* Bulk selection checkbox */}
                          <Checkbox
                            checked={selectedOrders.has(order.id)}
                            onCheckedChange={() => toggleSelectOrder(order.id)}
                            className="mt-1"
                          />
                          
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
                              {statusInfo.priority >= 3 && !statusInfo.isExpired && (
                                <Badge variant="outline" className="border-yellow-500/20 text-yellow-400">
                                  HIGH PRIORITY
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
                              {order.status === 'held' && (
                                <>
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
                                    onClick={() => handleEditOrder(order)}
                                  >
                                    <Edit className="w-4 h-4 mr-2" />
                                    Edit
                                  </Button>
                                </>
                              )}
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
                      {order.status === 'held' && (
                        <div className="flex gap-2 pt-2">
                          <Button
                            size="sm"
                            className="flex-1 bg-green-600 hover:bg-green-700 text-white"
                            onClick={() => handleRetrieveOrder(order)}
                          >
                            <RefreshCw className="w-4 h-4 mr-1" />
                            Retrieve
                          </Button>
                          <Button
                            variant="outline"
                            size="sm"
                            className="border-blue-500 text-blue-400 hover:bg-blue-500/10"
                            onClick={() => handleEditOrder(order)}
                          >
                            <Edit className="w-4 h-4" />
                          </Button>
                        </div>
                      )}
                    </CardContent>
                    </Card>
                  )
                })}
              </div>
            </ScrollArea>
          )}
        </div>
      </div>

      {/* Edit Order Dialog */}
      <Dialog open={editDialogOpen} onOpenChange={setEditDialogOpen}>
        <DialogContent className="bg-gray-900 border-blue-500">
          <DialogHeader>
            <DialogTitle className="text-gray-400">Edit Held Order</DialogTitle>
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
                <SelectContent className="bg-gray-400 border-amber-500">
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
              onClick={saveEditedOrder}
              className="bg-blue-600 hover:bg-blue-700 text-white"
            >
              Save Changes
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Delete Confirmation Dialog */}
      <Dialog open={deleteDialogOpen} onOpenChange={setDeleteDialogOpen}>
        <DialogContent className="bg-gray-900 border-blue-500">
          <DialogHeader>
            <DialogTitle className="text-gray-400 flex items-center gap-2">
              <AlertTriangle className="w-5 h-5 text-red-400" />
              Cancel Held Order
            </DialogTitle>
            <DialogDescription>
              Are you sure you want to cancel order {selectedOrder?.orderNumber}? 
              This action cannot be undone.
            </DialogDescription>
          </DialogHeader>
          
          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => setDeleteDialogOpen(false)}
              className="border-blue-500"
            >
              Keep Order
            </Button>
            <Button
              onClick={() => selectedOrder && handleDeleteOrder(selectedOrder)}
              className="bg-red-600 hover:bg-red-700 text-white"
            >
              Cancel Order
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}