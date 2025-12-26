'use client'

import { useState, useEffect, useRef } from 'react'
import { Card, CardContent } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Separator } from '@/components/ui/separator'
import { ScrollArea } from '@/components/ui/scroll-area'
import {
  ContextMenu,
  ContextMenuContent,
  ContextMenuItem,
  ContextMenuSeparator,
  ContextMenuTrigger,
  ContextMenuSub,
  ContextMenuSubContent,
  ContextMenuSubTrigger,
} from '@/components/ui/context-menu'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
  DropdownMenuSub,
  DropdownMenuSubContent,
  DropdownMenuSubTrigger,
} from '@/components/ui/dropdown-menu'
import {
  Play,
  Pause,
  Edit,
  Trash2,
  Copy,
  Share2,
  Archive,
  Download,
  Upload,
  Eye,
  EyeOff,
  Lock,
  Unlock,
  Clock,
  Star,
  AlertTriangle,
  CheckCircle,
  XCircle,
  RefreshCw,
  Filter,
  SortAsc,
  SortDesc,
  MoreHorizontal,
  Zap,
  Users,
  Activity,
  BarChart3,
  Settings,
  Printer,
  Mail,
  Bell,
  Timer,
  Target,
  Merge,
  Split,
  Tag,
  Flag,
  MessageSquare,
  FileText,
  Calendar,
  User,
  Package,
  ShoppingCart,
  DollarSign,
  ArrowUp,
  ArrowDown,
  ArrowLeft,
  ArrowRight,
  Home,
  End,
  RotateCcw,
  SkipForward,
  FastForward,
  Volume2,
  VolumeX
} from 'lucide-react'

interface ContextualMenuProps {
  children: React.ReactNode
  type: 'order' | 'cart_item' | 'bulk_orders' | 'empty_space' | 'header' | 'sidebar'
  data?: any
  onAction?: (action: string, data?: any) => void
  position?: { x: number; y: number }
  disabled?: boolean
}

interface BulkAction {
  id: string
  label: string
  icon: React.ComponentType<{ className?: string }>
  description: string
  category: 'status' | 'priority' | 'operations' | 'export' | 'communication'
  requiresConfirmation?: boolean
  destructive?: boolean
  disabled?: (selectedItems: any[]) => boolean
}

export function ContextualMenuProvider({ children, type, data, onAction, position, disabled }: ContextualMenuProps) {
  const [isOpen, setIsOpen] = useState(false)
  const [menuPosition, setMenuPosition] = useState(position || { x: 0, y: 0 })

  const handleAction = (action: string, actionData?: any) => {
    onAction?.(action, { ...data, ...actionData })
    setIsOpen(false)
  }

  // Order-specific menu items
  const orderMenuItems = (
    <>
      <ContextMenuItem onClick={() => handleAction('retrieve')}>
        <Play className="w-4 h-4 mr-2" />
        Retrieve Order
      </ContextMenuItem>
      <ContextMenuItem onClick={() => handleAction('edit')}>
        <Edit className="w-4 h-4 mr-2" />
        Edit Order
      </ContextMenuItem>
      <ContextMenuItem onClick={() => handleAction('duplicate')}>
        <Copy className="w-4 h-4 mr-2" />
        Duplicate Order
      </ContextMenuItem>
      <ContextMenuSeparator />
      
      <ContextMenuSub>
        <ContextMenuSubTrigger>
          <Flag className="w-4 h-4 mr-2" />
          Set Priority
        </ContextMenuSubTrigger>
        <ContextMenuSubContent>
          <ContextMenuItem onClick={() => handleAction('set_priority', { priority: 0 })}>
            <Star className="w-4 h-4 mr-2 text-gray-400" />
            Normal
          </ContextMenuItem>
          <ContextMenuItem onClick={() => handleAction('set_priority', { priority: 1 })}>
            <Star className="w-4 h-4 mr-2 text-blue-400" />
            Medium
          </ContextMenuItem>
          <ContextMenuItem onClick={() => handleAction('set_priority', { priority: 3 })}>
            <Star className="w-4 h-4 mr-2 text-yellow-400" />
            High
          </ContextMenuItem>
          <ContextMenuItem onClick={() => handleAction('set_priority', { priority: 5 })}>
            <Star className="w-4 h-4 mr-2 text-red-400" />
            Critical
          </ContextMenuItem>
        </ContextMenuSubContent>
      </ContextMenuSub>
      
      <ContextMenuSub>
        <ContextMenuSubTrigger>
          <Tag className="w-4 h-4 mr-2" />
          Change Status
        </ContextMenuSubTrigger>
        <ContextMenuSubContent>
          <ContextMenuItem onClick={() => handleAction('set_status', { status: 'held' })}>
            <Pause className="w-4 h-4 mr-2" />
            Hold
          </ContextMenuItem>
          <ContextMenuItem onClick={() => handleAction('set_status', { status: 'retrieved' })}>
            <Play className="w-4 h-4 mr-2" />
            Process
          </ContextMenuItem>
          <ContextMenuItem onClick={() => handleAction('set_status', { status: 'completed' })}>
            <CheckCircle className="w-4 h-4 mr-2" />
            Complete
          </ContextMenuItem>
          <ContextMenuItem onClick={() => handleAction('set_status', { status: 'cancelled' })}>
            <XCircle className="w-4 h-4 mr-2" />
            Cancel
          </ContextMenuItem>
        </ContextMenuSubContent>
      </ContextMenuSub>
      
      <ContextMenuSeparator />
      
      <ContextMenuItem onClick={() => handleAction('merge')}>
        <Merge className="w-4 h-4 mr-2" />
        Merge Orders
      </ContextMenuItem>
      <ContextMenuItem onClick={() => handleAction('split')}>
        <Split className="w-4 h-4 mr-2" />
        Split Order
      </ContextMenuItem>
      
      <ContextMenuSeparator />
      
      <ContextMenuItem onClick={() => handleAction('print')}>
        <Printer className="w-4 h-4 mr-2" />
        Print Receipt
      </ContextMenuItem>
      <ContextMenuItem onClick={() => handleAction('email')}>
        <Mail className="w-4 h-4 mr-2" />
        Email Customer
      </ContextMenuItem>
      <ContextMenuItem onClick={() => handleAction('notify')}>
        <Bell className="w-4 h-4 mr-2" />
        Send Notification
      </ContextMenuItem>
      
      <ContextMenuSeparator />
      
      <ContextMenuItem onClick={() => handleAction('export')}>
        <Download className="w-4 h-4 mr-2" />
        Export Order
      </ContextMenuItem>
      <ContextMenuItem onClick={() => handleAction('archive')}>
        <Archive className="w-4 h-4 mr-2" />
        Archive
      </ContextMenuItem>
      
      <ContextMenuSeparator />
      
      <ContextMenuItem onClick={() => handleAction('cancel')} className="text-red-400">
        <Trash2 className="w-4 h-4 mr-2" />
        Cancel Order
      </ContextMenuItem>
    </>
  )

  // Cart item-specific menu items
  const cartItemMenuItems = (
    <>
      <ContextMenuItem onClick={() => handleAction('increase_quantity')}>
        <ArrowUp className="w-4 h-4 mr-2" />
        Increase Quantity
      </ContextMenuItem>
      <ContextMenuItem onClick={() => handleAction('decrease_quantity')}>
        <ArrowDown className="w-4 h-4 mr-2" />
        Decrease Quantity
      </ContextMenuItem>
      <ContextMenuItem onClick={() => handleAction('edit_quantity')}>
        <Edit className="w-4 h-4 mr-2" />
        Set Quantity
      </ContextMenuItem>
      
      <ContextMenuSeparator />
      
      <ContextMenuItem onClick={() => handleAction('apply_discount')}>
        <Tag className="w-4 h-4 mr-2" />
        Apply Discount
      </ContextMenuItem>
      <ContextMenuItem onClick={() => handleAction('add_note')}>
        <MessageSquare className="w-4 h-4 mr-2" />
        Add Note
      </ContextMenuItem>
      
      <ContextMenuSeparator />
      
      <ContextMenuItem onClick={() => handleAction('remove_item')} className="text-red-400">
        <Trash2 className="w-4 h-4 mr-2" />
        Remove Item
      </ContextMenuItem>
    </>
  )

  // Bulk orders menu items
  const bulkOrdersMenuItems = (
    <>
      <ContextMenuSub>
        <ContextMenuSubTrigger>
          <Play className="w-4 h-4 mr-2" />
          Process Orders
        </ContextMenuSubTrigger>
        <ContextMenuSubContent>
          <ContextMenuItem onClick={() => handleAction('bulk_retrieve')}>
            Retrieve All
          </ContextMenuItem>
          <ContextMenuItem onClick={() => handleAction('bulk_complete')}>
            Complete All
          </ContextMenuItem>
          <ContextMenuItem onClick={() => handleAction('bulk_prioritize')}>
            Set High Priority
          </ContextMenuItem>
        </ContextMenuSubContent>
      </ContextMenuSub>
      
      <ContextMenuSub>
        <ContextMenuSubTrigger>
          <Flag className="w-4 h-4 mr-2" />
          Status Operations
        </ContextMenuSubTrigger>
        <ContextMenuSubContent>
          <ContextMenuItem onClick={() => handleAction('bulk_status', { status: 'held' })}>
            Set as Held
          </ContextMenuItem>
          <ContextMenuItem onClick={() => handleAction('bulk_status', { status: 'retrieved' })}>
            Set as Processing
          </ContextMenuItem>
          <ContextMenuItem onClick={() => handleAction('bulk_status', { status: 'completed' })}>
            Mark as Completed
          </ContextMenuItem>
          <ContextMenuItem onClick={() => handleAction('bulk_status', { status: 'cancelled' })}>
            Cancel All
          </ContextMenuItem>
        </ContextMenuSubContent>
      </ContextMenuSub>
      
      <ContextMenuSub>
        <ContextMenuSubTrigger>
          <Merge className="w-4 h-4 mr-2" />
          Merge Operations
        </ContextMenuSubTrigger>
        <ContextMenuSubContent>
          <ContextMenuItem onClick={() => handleAction('bulk_merge')}>
            Merge Selected
          </ContextMenuItem>
          <ContextMenuItem onClick={() => handleAction('merge_by_customer')}>
            Merge by Customer
          </ContextMenuItem>
          <ContextMenuItem onClick={() => handleAction('merge_by_table')}>
            Merge by Table
          </ContextMenuItem>
        </ContextMenuSubContent>
      </ContextMenuSub>
      
      <ContextMenuSeparator />
      
      <ContextMenuSub>
        <ContextMenuSubTrigger>
          <Download className="w-4 h-4 mr-2" />
          Export
        </ContextMenuSubTrigger>
        <ContextMenuSubContent>
          <ContextMenuItem onClick={() => handleAction('export_csv')}>
            Export as CSV
          </ContextMenuItem>
          <ContextMenuItem onClick={() => handleAction('export_pdf')}>
            Export as PDF
          </ContextMenuItem>
          <ContextMenuItem onClick={() => handleAction('export_excel')}>
            Export as Excel
          </ContextMenuItem>
        </ContextMenuSubContent>
      </ContextMenuSub>
      
      <ContextMenuItem onClick={() => handleAction('bulk_print')}>
        <Printer className="w-4 h-4 mr-2" />
        Print All Receipts
      </ContextMenuItem>
      <ContextMenuItem onClick={() => handleAction('bulk_email')}>
        <Mail className="w-4 h-4 mr-2" />
        Email All Customers
      </ContextMenuItem>
      
      <ContextMenuSeparator />
      
      <ContextMenuItem onClick={() => handleAction('clear_selection')}>
        <EyeOff className="w-4 h-4 mr-2" />
        Clear Selection
      </ContextMenuItem>
    </>
  )

  // Empty space menu items
  const emptySpaceMenuItems = (
    <>
      <ContextMenuItem onClick={() => handleAction('refresh')}>
        <RefreshCw className="w-4 h-4 mr-2" />
        Refresh Data
      </ContextMenuItem>
      <ContextMenuItem onClick={() => handleAction('create_order')}>
        <Plus className="w-4 h-4 mr-2" />
        New Order
      </ContextMenuItem>
      
      <ContextMenuSeparator />
      
      <ContextMenuSub>
        <ContextMenuSubTrigger>
          <Filter className="w-4 h-4 mr-2" />
          Filters
        </ContextMenuSubTrigger>
        <ContextMenuSubContent>
          <ContextMenuItem onClick={() => handleAction('filter', { type: 'held' })}>
            Show Held Orders
          </ContextMenuItem>
          <ContextMenuItem onClick={() => handleAction('filter', { type: 'expired' })}>
            Show Expired Orders
          </ContextMenuItem>
          <ContextMenuItem onClick={() => handleAction('filter', { type: 'high_priority' })}>
            Show High Priority
          </ContextMenuItem>
          <ContextMenuItem onClick={() => handleAction('clear_filter')}>
            Clear Filters
          </ContextMenuItem>
        </ContextMenuSubContent>
      </ContextMenuSub>
      
      <ContextMenuSub>
        <ContextMenuSubTrigger>
          <SortAsc className="w-4 h-4 mr-2" />
          Sort By
        </ContextMenuSubTrigger>
        <ContextMenuSubContent>
          <ContextMenuItem onClick={() => handleAction('sort', { field: 'createdAt', order: 'desc' })}>
            Newest First
          </ContextMenuItem>
          <ContextMenuItem onClick={() => handleAction('sort', { field: 'createdAt', order: 'asc' })}>
            Oldest First
          </ContextMenuItem>
          <ContextMenuItem onClick={() => handleAction('sort', { field: 'priority', order: 'desc' })}>
            Priority (High to Low)
          </ContextMenuItem>
          <ContextMenuItem onClick={() => handleAction('sort', { field: 'total', order: 'desc' })}>
            Amount (High to Low)
          </ContextMenuItem>
        </ContextMenuSubContent>
      </ContextMenuSub>
      
      <ContextMenuSeparator />
      
      <ContextMenuItem onClick={() => handleAction('collaboration_panel')}>
        <Users className="w-4 h-4 mr-2" />
        Collaboration Panel
      </ContextMenuItem>
      <ContextMenuItem onClick={() => handleAction('analytics')}>
        <BarChart3 className="w-4 h-4 mr-2" />
        Analytics Dashboard
      </ContextMenuItem>
      <ContextMenuItem onClick={() => handleAction('workflow')}>
        <Zap className="w-4 h-4 mr-2" />
        Workflow Manager
      </ContextMenuItem>
    </>
  )

  const getMenuContent = () => {
    switch (type) {
      case 'order':
        return orderMenuItems
      case 'cart_item':
        return cartItemMenuItems
      case 'bulk_orders':
        return bulkOrdersMenuItems
      case 'empty_space':
        return emptySpaceMenuItems
      default:
        return null
    }
  }

  if (disabled) {
    return <>{children}</>
  }

  return (
    <ContextMenu>
      <ContextMenuTrigger asChild>
        {children}
      </ContextMenuTrigger>
      <ContextMenuContent className="bg-gray-800 border-blue-500">
        {getMenuContent()}
      </ContextMenuContent>
    </ContextMenu>
  )
}

// Bulk Actions Toolbar Component
interface BulkActionsToolbarProps {
  selectedItems: any[]
  onAction: (action: string, data?: any) => void
  className?: string
}

export function BulkActionsToolbar({ selectedItems, onAction, className }: BulkActionsToolbarProps) {
  const [showActions, setShowActions] = useState(false)

  const bulkActions: BulkAction[] = [
    {
      id: 'retrieve_all',
      label: 'Retrieve All',
      icon: Play,
      description: 'Process all selected orders',
      category: 'status',
      disabled: (items) => items.some(item => item.status !== 'held')
    },
    {
      id: 'complete_all',
      label: 'Complete All',
      icon: CheckCircle,
      description: 'Mark all selected orders as complete',
      category: 'status',
      disabled: (items) => items.some(item => item.status === 'completed' || item.status === 'cancelled')
    },
    {
      id: 'set_high_priority',
      label: 'Set High Priority',
      icon: Star,
      description: 'Set high priority for all selected',
      category: 'priority'
    },
    {
      id: 'merge_orders',
      label: 'Merge Orders',
      icon: Merge,
      description: 'Merge selected orders into one',
      category: 'operations',
      disabled: (items) => items.length < 2
    },
    {
      id: 'export_selected',
      label: 'Export Orders',
      icon: Download,
      description: 'Export selected orders',
      category: 'export'
    },
    {
      id: 'print_receipts',
      label: 'Print Receipts',
      icon: Printer,
      description: 'Print receipts for all selected',
      category: 'export'
    },
    {
      id: 'cancel_all',
      label: 'Cancel All',
      icon: XCircle,
      description: 'Cancel all selected orders',
      category: 'status',
      destructive: true,
      requiresConfirmation: true,
      disabled: (items) => items.some(item => item.status === 'completed' || item.status === 'cancelled')
    }
  ]

  const getActionsByCategory = (category: string) => {
    return bulkActions.filter(action => action.category === category)
  }

  const handleAction = (action: BulkAction) => {
    if (action.requiresConfirmation) {
      // Show confirmation dialog
      const confirmed = window.confirm(`Are you sure you want to ${action.label.toLowerCase()}?`)
      if (!confirmed) return
    }
    
    onAction(action.id, { selectedItems })
  }

  const availableActions = bulkActions.filter(action => !action.disabled?.(selectedItems))

  if (selectedItems.length === 0) {
    return null
  }

  return (
    <Card className={`bg-blue-500/10 border-blue-500 ${className}`}>
      <CardContent className="p-4">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <Badge className="bg-blue-600 text-white">
              {selectedItems.length} selected
            </Badge>
            <span className="text-sm text-gray-400">Bulk actions available</span>
          </div>
          
          <div className="flex items-center gap-2">
            {/* Quick Actions */}
            <div className="flex items-center gap-1">
              {getActionsByCategory('status').slice(0, 3).map((action) => (
                <Button
                  key={action.id}
                  size="sm"
                  variant="ghost"
                  onClick={() => handleAction(action)}
                  className={`h-8 ${action.destructive ? 'text-red-400 hover:bg-red-500/10' : 'text-blue-400 hover:bg-blue-500/10'}`}
                  title={action.description}
                >
                  <action.icon className="w-4 h-4" />
                </Button>
              ))}
            </div>
            
            <Separator orientation="vertical" className="h-6" />
            
            {/* More Actions Dropdown */}
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button size="sm" variant="ghost" className="text-gray-400 hover:text-white">
                  <MoreHorizontal className="w-4 h-4" />
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent className="bg-gray-800 border-blue-500">
                {['status', 'priority', 'operations', 'export'].map((category) => {
                  const categoryActions = getActionsByCategory(category).filter(action => 
                    !getActionsByCategory('status').includes(action) || category !== 'status'
                  )
                  
                  if (categoryActions.length === 0) return null
                  
                  return (
                    <div key={category}>
                      {category !== 'status' && <DropdownMenuSeparator />}
                      <DropdownMenuSub>
                        <DropdownMenuSubTrigger className="text-gray-400">
                          {category === 'status' && 'Status Operations'}
                          {category === 'priority' && 'Priority Settings'}
                          {category === 'operations' && 'Order Operations'}
                          {category === 'export' && 'Export & Print'}
                        </DropdownMenuSubTrigger>
                        <DropdownMenuSubContent className="bg-gray-800 border-blue-500">
                          {categoryActions.map((action) => (
                            <DropdownMenuItem
                              key={action.id}
                              onClick={() => handleAction(action)}
                              className={`${action.destructive ? 'text-red-400' : 'text-gray-400'} hover:bg-gray-700`}
                            >
                              <action.icon className="w-4 h-4 mr-2" />
                              {action.label}
                            </DropdownMenuItem>
                          ))}
                        </DropdownMenuSubContent>
                      </DropdownMenuSub>
                    </div>
                  )
                })}
              </DropdownMenuContent>
            </DropdownMenu>
            
            <Button
              size="sm"
              variant="ghost"
              onClick={() => onAction('clear_selection')}
              className="text-gray-400 hover:text-white"
            >
              ✕
            </Button>
          </div>
        </div>
      </CardContent>
    </Card>
  )
}

// Quick Action Button Component
interface QuickActionButtonProps {
  action: string
  icon: React.ComponentType<{ className?: string }>
  label: string
  description?: string
  onClick: () => void
  disabled?: boolean
  variant?: 'default' | 'destructive' | 'outline'
  size?: 'sm' | 'md' | 'lg'
  className?: string
}

export function QuickActionButton({
  action,
  icon: Icon,
  label,
  description,
  onClick,
  disabled = false,
  variant = 'outline',
  size = 'sm',
  className
}: QuickActionButtonProps) {
  const [showTooltip, setShowTooltip] = useState(false)

  return (
    <div className="relative inline-block">
      <Button
        variant={variant}
        size={size}
        onClick={onClick}
        disabled={disabled}
        className={`${className} ${disabled ? 'opacity-50 cursor-not-allowed' : ''}`}
        onMouseEnter={() => setShowTooltip(true)}
        onMouseLeave={() => setShowTooltip(false)}
      >
        <Icon className="w-4 h-4" />
        <span className="ml-1">{label}</span>
      </Button>
      
      {showTooltip && description && (
        <div className="absolute bottom-full left-1/2 transform -translate-x-1/2 mb-2 px-2 py-1 bg-gray-900 text-white text-xs rounded shadow-lg whitespace-nowrap z-50">
          {description}
        </div>
      )}
    </div>
  )
}