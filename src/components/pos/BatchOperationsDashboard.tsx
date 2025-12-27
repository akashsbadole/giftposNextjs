'use client'

import React, { useState, useEffect } from 'react'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Progress } from '@/components/ui/progress'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { 
  Download, 
  Upload, 
  RefreshCw, 
  Play, 
  Pause, 
  Square, 
  AlertCircle, 
  CheckCircle, 
  Clock,
  FileText,
  Users,
  Package,
  ShoppingCart,
  BarChart3,
  Calendar,
  Settings,
  Plus,
  Filter,
  Search,
  MoreHorizontal,
  Eye,
  Download as DownloadIcon,
  Trash2,
  Edit
} from 'lucide-react'
import { useToast } from '@/hooks/use-toast'
import { Input } from '@/components/ui/input'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger, DropdownMenuSeparator } from '@/components/ui/dropdown-menu'
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'

interface BatchOperation {
  id: string
  operationId: string
  name: string
  description?: string
  type: string
  entityType: string
  status: 'pending' | 'queued' | 'running' | 'paused' | 'completed' | 'failed' | 'cancelled'
  progressPercentage: number
  totalRecords: number
  processedRecords: number
  successRecords: number
  failedRecords: number
  skippedRecords: number
  startedAt?: string
  completedAt?: string
  createdAt: string
  user?: {
    name: string
    email: string
  }
  template?: {
    name: string
    operationType: string
  }
}

interface BatchOperationStats {
  total: number
  byStatus: Record<string, number>
}

export default function BatchOperationsDashboard() {
  const [operations, setOperations] = useState<BatchOperation[]>([])
  const [stats, setStats] = useState<BatchOperationStats>({ total: 0, byStatus: {} })
  const [loading, setLoading] = useState(true)
  const [selectedOperation, setSelectedOperation] = useState<BatchOperation | null>(null)
  const [showCreateDialog, setShowCreateDialog] = useState(false)
  const [showTemplatesDialog, setShowTemplatesDialog] = useState(false)
  const [showImportDialog, setShowImportDialog] = useState(false)
  const [showExportDialog, setShowExportDialog] = useState(false)
  const [searchTerm, setSearchTerm] = useState('')
  const [statusFilter, setStatusFilter] = useState('all')
  const [typeFilter, setTypeFilter] = useState('all')
  const [currentPage, setCurrentPage] = useState(1)
  const [totalPages, setTotalPages] = useState(1)
  const { toast } = useToast()

  // Fetch batch operations
  const fetchOperations = async (page = 1) => {
    try {
      setLoading(true)
      const params = new URLSearchParams({
        page: page.toString(),
        limit: '20',
        storeId: 'default-store' // This would come from context in real implementation
      })

      if (statusFilter !== 'all') params.append('status', statusFilter)
      if (typeFilter !== 'all') params.append('type', typeFilter)
      if (searchTerm) params.append('search', searchTerm)

      const response = await fetch(`/api/pos/batch-operations?${params}`)
      const data = await response.json()

      if (response.ok) {
        setOperations(data.operations)
        setStats(data.stats)
        setTotalPages(data.pagination.pages)
      } else {
        toast({
          title: 'Error',
          description: data.error || 'Failed to fetch batch operations',
          variant: 'destructive'
        })
      }
    } catch (error) {
      toast({
        title: 'Error',
        description: 'Failed to fetch batch operations',
        variant: 'destructive'
      })
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    fetchOperations(currentPage)
  }, [currentPage, statusFilter, typeFilter, searchTerm])

  // Get status color and icon
  const getStatusInfo = (status: string) => {
    switch (status) {
      case 'pending':
        return { color: 'bg-gray-500', icon: Clock, text: 'Pending' }
      case 'queued':
        return { color: 'bg-blue-500', icon: Clock, text: 'Queued' }
      case 'running':
        return { color: 'bg-yellow-500', icon: RefreshCw, text: 'Running' }
      case 'paused':
        return { color: 'bg-orange-500', icon: Pause, text: 'Paused' }
      case 'completed':
        return { color: 'bg-green-500', icon: CheckCircle, text: 'Completed' }
      case 'failed':
        return { color: 'bg-red-500', icon: AlertCircle, text: 'Failed' }
      case 'cancelled':
        return { color: 'bg-gray-600', icon: Square, text: 'Cancelled' }
      default:
        return { color: 'bg-gray-500', icon: Clock, text: status }
    }
  }

  // Get entity type icon
  const getEntityIcon = (entityType: string) => {
    switch (entityType) {
      case 'products':
        return Package
      case 'customers':
        return Users
      case 'orders':
        return ShoppingCart
      case 'inventory':
        return BarChart3
      case 'categories':
        return FileText
      default:
        return FileText
    }
  }

  // Handle operation action
  const handleOperationAction = async (operationId: string, action: string) => {
    try {
      const response = await fetch(`/api/pos/batch-operations/${operationId}`, {
        method: 'PATCH',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          action,
          storeId: 'default-store',
          userName: 'Current User', // This would come from auth context
          userEmail: 'user@example.com'
        })
      })

      const data = await response.json()

      if (response.ok) {
        toast({
          title: 'Success',
          description: `Operation ${action}ed successfully`
        })
        fetchOperations(currentPage)
      } else {
        toast({
          title: 'Error',
          description: data.error || `Failed to ${action} operation`,
          variant: 'destructive'
        })
      }
    } catch (error) {
      toast({
        title: 'Error',
        description: `Failed to ${action} operation`,
        variant: 'destructive'
      })
    }
  }

  // Handle delete operation
  const handleDeleteOperation = async (operationId: string) => {
    try {
      const response = await fetch(`/api/pos/batch-operations/${operationId}?storeId=default-store&force=true`, {
        method: 'DELETE'
      })

      if (response.ok) {
        toast({
          title: 'Success',
          description: 'Operation deleted successfully'
        })
        fetchOperations(currentPage)
      } else {
        const data = await response.json()
        toast({
          title: 'Error',
          description: data.error || 'Failed to delete operation',
          variant: 'destructive'
        })
      }
    } catch (error) {
      toast({
        title: 'Error',
        description: 'Failed to delete operation',
        variant: 'destructive'
      })
    }
  }

  // Quick action buttons
  const QuickActions = () => (
    <div className="flex gap-2">
      <Dialog open={showImportDialog} onOpenChange={setShowImportDialog}>
        <DialogTrigger asChild>
          <Button className="gap-2">
            <Upload className="h-4 w-4" />
            Import Data
          </Button>
        </DialogTrigger>
        <ImportDialog onClose={() => setShowImportDialog(false)} />
      </Dialog>

      <Dialog open={showExportDialog} onOpenChange={setShowExportDialog}>
        <DialogTrigger asChild>
          <Button variant="outline" className="gap-2">
            <Download className="h-4 w-4" />
            Export Data
          </Button>
        </DialogTrigger>
        <ExportDialog onClose={() => setShowExportDialog(false)} />
      </Dialog>

      <Dialog open={showTemplatesDialog} onOpenChange={setShowTemplatesDialog}>
        <DialogTrigger asChild>
          <Button variant="outline" className="gap-2">
            <Settings className="h-4 w-4" />
            Templates
          </Button>
        </DialogTrigger>
        <TemplatesDialog onClose={() => setShowTemplatesDialog(false)} />
      </Dialog>

      <Dialog open={showCreateDialog} onOpenChange={setShowCreateDialog}>
        <DialogTrigger asChild>
          <Button className="gap-2">
            <Plus className="h-4 w-4" />
            New Operation
          </Button>
        </DialogTrigger>
        <CreateOperationDialog onClose={() => setShowCreateDialog(false)} />
      </Dialog>
    </div>
  )

  return (
    <div className="p-6 space-y-6">
      {/* Header */}
      <div className="flex justify-between items-center">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Batch Operations</h1>
          <p className="text-muted-foreground">
            Manage bulk operations for products, customers, inventory, and more
          </p>
        </div>
        <QuickActions />
      </div>

      {/* Stats Cards */}
      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Total Operations</CardTitle>
            <BarChart3 className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{stats.total}</div>
            <p className="text-xs text-muted-foreground">All time</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Running</CardTitle>
            <RefreshCw className="h-4 w-4 text-yellow-500" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{stats.byStatus.running || 0}</div>
            <p className="text-xs text-muted-foreground">Currently processing</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Completed</CardTitle>
            <CheckCircle className="h-4 w-4 text-green-500" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{stats.byStatus.completed || 0}</div>
            <p className="text-xs text-muted-foreground">Successfully finished</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Failed</CardTitle>
            <AlertCircle className="h-4 w-4 text-red-500" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{stats.byStatus.failed || 0}</div>
            <p className="text-xs text-muted-foreground">Needs attention</p>
          </CardContent>
        </Card>
      </div>

      {/* Filters and Search */}
      <Card>
        <CardContent className="pt-6">
          <div className="flex gap-4">
            <div className="flex-1">
              <Input
                placeholder="Search operations..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="w-full"
              />
            </div>
            <Select value={statusFilter} onValueChange={setStatusFilter}>
              <SelectTrigger className="w-[180px]">
                <SelectValue placeholder="Filter by status" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Statuses</SelectItem>
                <SelectItem value="pending">Pending</SelectItem>
                <SelectItem value="queued">Queued</SelectItem>
                <SelectItem value="running">Running</SelectItem>
                <SelectItem value="paused">Paused</SelectItem>
                <SelectItem value="completed">Completed</SelectItem>
                <SelectItem value="failed">Failed</SelectItem>
                <SelectItem value="cancelled">Cancelled</SelectItem>
              </SelectContent>
            </Select>

            <Select value={typeFilter} onValueChange={setTypeFilter}>
              <SelectTrigger className="w-[180px]">
                <SelectValue placeholder="Filter by type" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Types</SelectItem>
                <SelectItem value="import">Import</SelectItem>
                <SelectItem value="export">Export</SelectItem>
                <SelectItem value="bulk_update">Bulk Update</SelectItem>
                <SelectItem value="mass_processing">Mass Processing</SelectItem>
              </SelectContent>
            </Select>

            <Button variant="outline" onClick={() => fetchOperations(currentPage)}>
              <RefreshCw className="h-4 w-4" />
            </Button>
          </div>
        </CardContent>
      </Card>

      {/* Operations List */}
      <Card>
        <CardHeader>
          <CardTitle>Batch Operations</CardTitle>
          <CardDescription>
            Monitor and manage your bulk operations
          </CardDescription>
        </CardHeader>
        <CardContent>
          {loading ? (
            <div className="flex items-center justify-center py-8">
              <RefreshCw className="h-6 w-6 animate-spin" />
              <span className="ml-2">Loading operations...</span>
            </div>
          ) : operations.length === 0 ? (
            <div className="text-center py-8">
              <BarChart3 className="h-12 w-12 text-muted-foreground mx-auto mb-4" />
              <h3 className="text-lg font-medium mb-2">No batch operations found</h3>
              <p className="text-muted-foreground mb-4">
                Create your first batch operation to get started
              </p>
              <Button onClick={() => setShowCreateDialog(true)}>
                <Plus className="h-4 w-4 mr-2" />
                New Operation
              </Button>
            </div>
          ) : (
            <div className="space-y-4">
              {operations.map((operation) => {
                const statusInfo = getStatusInfo(operation.status)
                const StatusIcon = statusInfo.icon
                const EntityIcon = getEntityIcon(operation.entityType)

                return (
                  <div
                    key={operation.id}
                    className="flex items-center justify-between p-4 border rounded-lg hover:bg-muted/50 transition-colors"
                  >
                    <div className="flex items-center space-x-4">
                      <div className="flex items-center space-x-2">
                        <EntityIcon className="h-5 w-5 text-muted-foreground" />
                        <div>
                          <h4 className="font-medium">{operation.name}</h4>
                          <p className="text-sm text-muted-foreground">
                            {operation.description || `${operation.type} ${operation.entityType}`}
                          </p>
                        </div>
                      </div>
                    </div>

                    <div className="flex items-center space-x-4">
                      <div className="text-right">
                        <div className="flex items-center space-x-2 mb-1">
                          <Badge variant={operation.status === 'completed' ? 'default' : 'secondary'}>
                            <StatusIcon className="h-3 w-3 mr-1" />
                            {statusInfo.text}
                          </Badge>
                        </div>
                        {operation.status === 'running' && (
                          <div className="space-y-1">
                            <Progress value={operation.progressPercentage} className="w-32" />
                            <div className="text-xs text-muted-foreground">
                              {operation.processedRecords}/{operation.totalRecords} records
                            </div>
                          </div>
                        )}
                        <div className="text-xs text-muted-foreground">
                          {operation.successRecords > 0 && (
                            <span className="text-green-600">
                              {operation.successRecords} successful
                            </span>
                          )}
                          {operation.failedRecords > 0 && (
                            <span className="text-red-600 ml-2">
                              {operation.failedRecords} failed
                            </span>
                          )}
                        </div>
                      </div>

                      <DropdownMenu>
                        <DropdownMenuTrigger asChild>
                          <Button variant="ghost" size="sm">
                            <MoreHorizontal className="h-4 w-4" />
                          </Button>
                        </DropdownMenuTrigger>
                        <DropdownMenuContent align="end">
                          <DropdownMenuItem onClick={() => setSelectedOperation(operation)}>
                            <Eye className="h-4 w-4 mr-2" />
                            View Details
                          </DropdownMenuItem>
                          
                          {operation.status === 'running' && (
                            <DropdownMenuItem onClick={() => handleOperationAction(operation.operationId, 'pause')}>
                              <Pause className="h-4 w-4 mr-2" />
                              Pause
                            </DropdownMenuItem>
                          )}
                          
                          {operation.status === 'paused' && (
                            <DropdownMenuItem onClick={() => handleOperationAction(operation.operationId, 'resume')}>
                              <Play className="h-4 w-4 mr-2" />
                              Resume
                            </DropdownMenuItem>
                          )}
                          
                          {['running', 'queued', 'pending'].includes(operation.status) && (
                            <DropdownMenuItem onClick={() => handleOperationAction(operation.operationId, 'cancel')}>
                              <Square className="h-4 w-4 mr-2" />
                              Cancel
                            </DropdownMenuItem>
                          )}
                          
                          {operation.status === 'failed' && operation.retryCount < operation.maxRetries && (
                            <DropdownMenuItem onClick={() => handleOperationAction(operation.operationId, 'retry')}>
                              <RefreshCw className="h-4 w-4 mr-2" />
                              Retry
                            </DropdownMenuItem>
                          )}
                          
                          <DropdownMenuSeparator />
                          
                          {operation.type === 'export' && operation.status === 'completed' && (
                            <DropdownMenuItem>
                              <DownloadIcon className="h-4 w-4 mr-2" />
                              Download
                            </DropdownMenuItem>
                          )}
                          
                          <DropdownMenuItem 
                            onClick={() => handleDeleteOperation(operation.operationId)}
                            className="text-red-600"
                          >
                            <Trash2 className="h-4 w-4 mr-2" />
                            Delete
                          </DropdownMenuItem>
                        </DropdownMenuContent>
                      </DropdownMenu>
                    </div>
                  </div>
                )
              })}

              {/* Pagination */}
              {totalPages > 1 && (
                <div className="flex justify-center space-x-2">
                  <Button
                    variant="outline"
                    onClick={() => setCurrentPage(Math.max(1, currentPage - 1))}
                    disabled={currentPage === 1}
                  >
                    Previous
                  </Button>
                  <span className="flex items-center px-4 text-sm">
                    Page {currentPage} of {totalPages}
                  </span>
                  <Button
                    variant="outline"
                    onClick={() => setCurrentPage(Math.min(totalPages, currentPage + 1))}
                    disabled={currentPage === totalPages}
                  >
                    Next
                  </Button>
                </div>
              )}
            </div>
          )}
        </CardContent>
      </Card>

      {/* Operation Details Dialog */}
      {selectedOperation && (
        <OperationDetailsDialog
          operation={selectedOperation}
          open={!!selectedOperation}
          onClose={() => setSelectedOperation(null)}
        />
      )}
    </div>
  )
}

// Import Dialog Component
function ImportDialog({ onClose }: { onClose: () => void }) {
  const [selectedEntity, setSelectedEntity] = useState('')
  const [selectedFile, setSelectedFile] = useState<File | null>(null)
  const [uploading, setUploading] = useState(false)

  const handleFileSelect = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0]
    setSelectedFile(file || null)
  }

  const handleImport = async () => {
    if (!selectedFile || !selectedEntity) return

    setUploading(true)
    // Implementation would handle file upload and processing
    setTimeout(() => {
      setUploading(false)
      onClose()
    }, 2000)
  }

  return (
    <DialogContent className="sm:max-w-[425px]">
      <DialogHeader>
        <DialogTitle>Import Data</DialogTitle>
        <DialogDescription>
          Upload a CSV, Excel, or JSON file to import data in bulk
        </DialogDescription>
      </DialogHeader>
      <div className="space-y-4">
        <div className="space-y-2">
          <Label htmlFor="entity">Data Type</Label>
          <Select value={selectedEntity} onValueChange={setSelectedEntity}>
            <SelectTrigger>
              <SelectValue placeholder="Select data type to import" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="products">Products</SelectItem>
              <SelectItem value="customers">Customers</SelectItem>
              <SelectItem value="inventory">Inventory</SelectItem>
              <SelectItem value="categories">Categories</SelectItem>
            </SelectContent>
          </Select>
        </div>

        <div className="space-y-2">
          <Label htmlFor="file">File</Label>
          <Input
            id="file"
            type="file"
            accept=".csv,.xlsx,.json"
            onChange={handleFileSelect}
          />
          <p className="text-xs text-muted-foreground">
            Supported formats: CSV, Excel (.xlsx), JSON. Maximum file size: 50MB
          </p>
        </div>

        <div className="flex justify-end space-x-2">
          <Button variant="outline" onClick={onClose}>
            Cancel
          </Button>
          <Button onClick={handleImport} disabled={!selectedFile || !selectedEntity || uploading}>
            {uploading ? 'Importing...' : 'Import'}
          </Button>
        </div>
      </div>
    </DialogContent>
  )
}

// Export Dialog Component
function ExportDialog({ onClose }: { onClose: () => void }) {
  const [selectedEntity, setSelectedEntity] = useState('')
  const [format, setFormat] = useState('csv')
  const [filters, setFilters] = useState({})

  const handleExport = async () => {
    if (!selectedEntity) return

    // Implementation would handle export generation
    const params = new URLSearchParams({
      operationType: 'export',
      entityType: selectedEntity,
      format,
      ...filters
    })

    window.open(`/api/pos/batch-operations/import-export?${params}`, '_blank')
    onClose()
  }

  return (
    <DialogContent className="sm:max-w-[425px]">
      <DialogHeader>
        <DialogTitle>Export Data</DialogTitle>
        <DialogDescription>
          Export data in bulk to CSV, Excel, or JSON format
        </DialogDescription>
      </DialogHeader>
      <div className="space-y-4">
        <div className="space-y-2">
          <Label htmlFor="entity">Data Type</Label>
          <Select value={selectedEntity} onValueChange={setSelectedEntity}>
            <SelectTrigger>
              <SelectValue placeholder="Select data type to export" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="products">Products</SelectItem>
              <SelectItem value="customers">Customers</SelectItem>
              <SelectItem value="orders">Orders</SelectItem>
              <SelectItem value="inventory">Inventory</SelectItem>
              <SelectItem value="sales">Sales</SelectItem>
            </SelectContent>
          </Select>
        </div>

        <div className="space-y-2">
          <Label htmlFor="format">Format</Label>
          <Select value={format} onValueChange={setFormat}>
            <SelectTrigger>
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="csv">CSV</SelectItem>
              <SelectItem value="xlsx">Excel (.xlsx)</SelectItem>
              <SelectItem value="json">JSON</SelectItem>
            </SelectContent>
          </Select>
        </div>

        <div className="flex justify-end space-x-2">
          <Button variant="outline" onClick={onClose}>
            Cancel
          </Button>
          <Button onClick={handleExport} disabled={!selectedEntity}>
            Export
          </Button>
        </div>
      </div>
    </DialogContent>
  )
}

// Templates Dialog Component
function TemplatesDialog({ onClose }: { onClose: () => void }) {
  return (
    <DialogContent className="sm:max-w-[600px]">
      <DialogHeader>
        <DialogTitle>Operation Templates</DialogTitle>
        <DialogDescription>
          Manage reusable templates for batch operations
        </DialogDescription>
      </DialogHeader>
      <div className="space-y-4">
        <p className="text-sm text-muted-foreground">
          Templates feature coming soon. You'll be able to create and save reusable operation templates.
        </p>
        <div className="flex justify-end">
          <Button onClick={onClose}>Close</Button>
        </div>
      </div>
    </DialogContent>
  )
}

// Create Operation Dialog Component
function CreateOperationDialog({ onClose }: { onClose: () => void }) {
  const [name, setName] = useState('')
  const [description, setDescription] = useState('')
  const [type, setType] = useState('')
  const [entityType, setEntityType] = useState('')
  const [parameters, setParameters] = useState('')

  const handleCreate = async () => {
    if (!name || !type || !entityType) return

    try {
      const response = await fetch('/api/pos/batch-operations', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          name,
          description,
          type,
          entityType,
          parameters: parameters ? JSON.parse(parameters) : {},
          storeId: 'default-store'
        })
      })

      if (response.ok) {
        onClose()
        // Refresh operations list
      }
    } catch (error) {
      // Handle error
    }
  }

  return (
    <DialogContent className="sm:max-w-[425px]">
      <DialogHeader>
        <DialogTitle>Create Batch Operation</DialogTitle>
        <DialogDescription>
          Create a new batch operation to process data in bulk
        </DialogDescription>
      </DialogHeader>
      <div className="space-y-4">
        <div className="space-y-2">
          <Label htmlFor="name">Name</Label>
          <Input
            id="name"
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="Operation name"
          />
        </div>

        <div className="space-y-2">
          <Label htmlFor="description">Description</Label>
          <Textarea
            id="description"
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            placeholder="Optional description"
          />
        </div>

        <div className="space-y-2">
          <Label htmlFor="type">Operation Type</Label>
          <Select value={type} onValueChange={setType}>
            <SelectTrigger>
              <SelectValue placeholder="Select operation type" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="import">Import</SelectItem>
              <SelectItem value="export">Export</SelectItem>
              <SelectItem value="bulk_update">Bulk Update</SelectItem>
              <SelectItem value="mass_processing">Mass Processing</SelectItem>
            </SelectContent>
          </Select>
        </div>

        <div className="space-y-2">
          <Label htmlFor="entityType">Data Type</Label>
          <Select value={entityType} onValueChange={setEntityType}>
            <SelectTrigger>
              <SelectValue placeholder="Select data type" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="products">Products</SelectItem>
              <SelectItem value="customers">Customers</SelectItem>
              <SelectItem value="orders">Orders</SelectItem>
              <SelectItem value="inventory">Inventory</SelectItem>
              <SelectItem value="categories">Categories</SelectItem>
              <SelectItem value="sales">Sales</SelectItem>
            </SelectContent>
          </Select>
        </div>

        <div className="space-y-2">
          <Label htmlFor="parameters">Parameters (JSON)</Label>
          <Textarea
            id="parameters"
            value={parameters}
            onChange={(e) => setParameters(e.target.value)}
            placeholder='{"key": "value"}'
            rows={3}
          />
        </div>

        <div className="flex justify-end space-x-2">
          <Button variant="outline" onClick={onClose}>
            Cancel
          </Button>
          <Button onClick={handleCreate} disabled={!name || !type || !entityType}>
            Create
          </Button>
        </div>
      </div>
    </DialogContent>
  )
}

// Operation Details Dialog Component
function OperationDetailsDialog({ 
  operation, 
  open, 
  onClose 
}: { 
  operation: BatchOperation
  open: boolean
  onClose: () => void 
}) {
  return (
    <Dialog open={open} onOpenChange={onClose}>
      <DialogContent className="sm:max-w-[600px]">
        <DialogHeader>
          <DialogTitle>Operation Details</DialogTitle>
          <DialogDescription>
            Detailed information about batch operation {operation.operationId}
          </DialogDescription>
        </DialogHeader>
        <div className="space-y-4">
          <div className="grid grid-cols-2 gap-4">
            <div>
              <Label className="text-sm font-medium">Name</Label>
              <p className="text-sm">{operation.name}</p>
            </div>
            <div>
              <Label className="text-sm font-medium">Status</Label>
              <p className="text-sm">{operation.status}</p>
            </div>
            <div>
              <Label className="text-sm font-medium">Type</Label>
              <p className="text-sm">{operation.type}</p>
            </div>
            <div>
              <Label className="text-sm font-medium">Entity Type</Label>
              <p className="text-sm">{operation.entityType}</p>
            </div>
            <div>
              <Label className="text-sm font-medium">Total Records</Label>
              <p className="text-sm">{operation.totalRecords}</p>
            </div>
            <div>
              <Label className="text-sm font-medium">Progress</Label>
              <p className="text-sm">{operation.progressPercentage}%</p>
            </div>
          </div>

          {operation.description && (
            <div>
              <Label className="text-sm font-medium">Description</Label>
              <p className="text-sm">{operation.description}</p>
            </div>
          )}

          <div className="flex justify-end">
            <Button onClick={onClose}>Close</Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  )
}