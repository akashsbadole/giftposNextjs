'use client'

import { useState, useEffect, useCallback } from 'react'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Textarea } from '@/components/ui/textarea'
import { Switch } from '@/components/ui/switch'
import { ScrollArea } from '@/components/ui/scroll-area'
import { Separator } from '@/components/ui/separator'
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
import {
  Zap,
  Clock,
  CheckCircle,
  XCircle,
  Play,
  Pause,
  RefreshCw,
  Settings,
  Plus,
  Edit,
  Trash2,
  Copy,
  AlertTriangle,
  Timer,
  Activity,
  Target,
  Workflow,
  GitBranch,
  Shield,
  Bell,
  Mail,
  Printer,
  Database,
  Users,
  BarChart3,
  Filter,
  Search,
  Eye,
  EyeOff,
  ArrowRight,
  Save,
  Upload,
  Download
} from 'lucide-react'

interface WorkflowRule {
  id: string
  name: string
  description: string
  trigger: {
    type: 'order_status_change' | 'order_value' | 'time_based' | 'stock_level' | 'customer_type'
    conditions: Array<{
      field: string
      operator: 'equals' | 'greater_than' | 'less_than' | 'contains' | 'in'
      value: any
    }>
  }
  actions: Array<{
    type: 'notification' | 'email' | 'print' | 'status_update' | 'inventory_update' | 'assign_employee'
    config: any
    delay?: number
  }>
  isActive: boolean
  priority: 'low' | 'medium' | 'high' | 'critical'
  createdAt: string
  updatedAt: string
  executionCount: number
  successRate: number
  lastExecuted?: string
}

interface JobQueueItem {
  id: string
  ruleId: string
  ruleName: string
  status: 'pending' | 'running' | 'completed' | 'failed' | 'cancelled'
  progress: number
  createdAt: string
  startedAt?: string
  completedAt?: string
  errorMessage?: string
  payload: any
  result?: any
}

interface AutomationTemplate {
  id: string
  name: string
  description: string
  category: 'order_management' | 'inventory' | 'notifications' | 'reporting'
  rules: Partial<WorkflowRule>[]
  isPopular: boolean
  downloadCount: number
}

interface WorkflowManagerProps {
  storeId: string
  isOpen: boolean
  onClose: () => void
}

export default function WorkflowManager({
  storeId,
  isOpen,
  onClose
}: WorkflowManagerProps) {
  const [rules, setRules] = useState<WorkflowRule[]>([])
  const [jobQueue, setJobQueue] = useState<JobQueueItem[]>([])
  const [templates, setTemplates] = useState<AutomationTemplate[]>([])
  const [selectedRule, setSelectedRule] = useState<WorkflowRule | null>(null)
  const [selectedJob, setSelectedJob] = useState<JobQueueItem | null>(null)
  const [isLoading, setIsLoading] = useState(false)
  
  // Dialog states
  const [createRuleDialogOpen, setCreateRuleDialogOpen] = useState(false)
  const [editRuleDialogOpen, setEditRuleDialogOpen] = useState(false)
  const [jobDetailsDialogOpen, setJobDetailsDialogOpen] = useState(false)
  const [templateDialogOpen, setTemplateDialogOpen] = useState(false)
  const [importDialogOpen, setImportDialogOpen] = useState(false)
  
  // Form states
  const [ruleForm, setRuleForm] = useState({
    name: '',
    description: '',
    triggerType: 'order_status_change' as const,
    triggerConditions: [] as any[],
    actions: [] as any[],
    priority: 'medium' as const,
    isActive: true
  })

  // Filters and search
  const [searchTerm, setSearchTerm] = useState('')
  const [statusFilter, setStatusFilter] = useState<'all' | 'active' | 'inactive'>('all')
  const [priorityFilter, setPriorityFilter] = useState<'all' | 'low' | 'medium' | 'high' | 'critical'>('all')
  const [jobStatusFilter, setJobStatusFilter] = useState<'all' | 'pending' | 'running' | 'completed' | 'failed'>('all')

  // Load data
  const loadWorkflowData = useCallback(async () => {
    if (!storeId) return

    setIsLoading(true)
    try {
      // Load workflow rules
      const rulesResponse = await fetch(`/api/pos/orders/workflow/rules?storeId=${storeId}`)
      if (rulesResponse.ok) {
        const rulesData = await rulesResponse.json()
        setRules(rulesData.rules || [])
      }

      // Load job queue
      const queueResponse = await fetch(`/api/pos/orders/jobs/manage?storeId=${storeId}`)
      if (queueResponse.ok) {
        const queueData = await queueResponse.json()
        setJobQueue(queueData.jobs || [])
      }

      // Load automation templates
      const templatesResponse = await fetch('/api/pos/orders/workflow/templates')
      if (templatesResponse.ok) {
        const templatesData = await templatesResponse.json()
        setTemplates(templatesData.templates || [])
      }
    } catch (error) {
      console.error('Error loading workflow data:', error)
    } finally {
      setIsLoading(false)
    }
  }, [storeId])

  // Auto-refresh job queue
  useEffect(() => {
    if (!isOpen || !storeId) return

    loadWorkflowData()

    const interval = setInterval(loadWorkflowData, 10000) // Refresh every 10 seconds
    return () => clearInterval(interval)
  }, [isOpen, storeId, loadWorkflowData])

  // Filter rules
  const filteredRules = rules.filter(rule => {
    const matchesSearch = !searchTerm || 
      rule.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
      rule.description.toLowerCase().includes(searchTerm.toLowerCase())
    
    const matchesStatus = statusFilter === 'all' || 
      (statusFilter === 'active' && rule.isActive) ||
      (statusFilter === 'inactive' && !rule.isActive)
    
    const matchesPriority = priorityFilter === 'all' || rule.priority === priorityFilter
    
    return matchesSearch && matchesStatus && matchesPriority
  })

  // Filter jobs
  const filteredJobs = jobQueue.filter(job => {
    const matchesSearch = !searchTerm ||
      job.ruleName.toLowerCase().includes(searchTerm.toLowerCase())
    
    const matchesStatus = jobStatusFilter === 'all' || job.status === jobStatusFilter
    
    return matchesSearch && matchesStatus
  })

  // Rule management
  const createRule = async () => {
    try {
      const response = await fetch('/api/pos/orders/workflow/rules', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          ...ruleForm,
          storeId
        })
      })

      if (response.ok) {
        const newRule = await response.json()
        setRules(prev => [...prev, newRule])
        setCreateRuleDialogOpen(false)
        resetRuleForm()
      }
    } catch (error) {
      console.error('Error creating rule:', error)
    }
  }

  const updateRule = async () => {
    if (!selectedRule) return

    try {
      const response = await fetch(`/api/pos/orders/workflow/rules/${selectedRule.id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(ruleForm)
      })

      if (response.ok) {
        const updatedRule = await response.json()
        setRules(prev => prev.map(rule => rule.id === selectedRule.id ? updatedRule : rule))
        setEditRuleDialogOpen(false)
        setSelectedRule(null)
        resetRuleForm()
      }
    } catch (error) {
      console.error('Error updating rule:', error)
    }
  }

  const deleteRule = async (ruleId: string) => {
    try {
      const response = await fetch(`/api/pos/orders/workflow/rules/${ruleId}`, {
        method: 'DELETE'
      })

      if (response.ok) {
        setRules(prev => prev.filter(rule => rule.id !== ruleId))
      }
    } catch (error) {
      console.error('Error deleting rule:', error)
    }
  }

  const toggleRuleStatus = async (ruleId: string, isActive: boolean) => {
    try {
      const response = await fetch(`/api/pos/orders/workflow/rules/${ruleId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ isActive })
      })

      if (response.ok) {
        setRules(prev => prev.map(rule => 
          rule.id === ruleId ? { ...rule, isActive } : rule
        ))
      }
    } catch (error) {
      console.error('Error toggling rule status:', error)
    }
  }

  // Job management
  const retryJob = async (jobId: string) => {
    try {
      const response = await fetch(`/api/pos/orders/jobs/manage/${jobId}/retry`, {
        method: 'POST'
      })

      if (response.ok) {
        loadWorkflowData() // Refresh to get updated job status
      }
    } catch (error) {
      console.error('Error retrying job:', error)
    }
  }

  const cancelJob = async (jobId: string) => {
    try {
      const response = await fetch(`/api/pos/orders/jobs/manage/${jobId}/cancel`, {
        method: 'POST'
      })

      if (response.ok) {
        loadWorkflowData()
      }
    } catch (error) {
      console.error('Error cancelling job:', error)
    }
  }

  // Template management
  const applyTemplate = async (template: AutomationTemplate) => {
    try {
      const response = await fetch('/api/pos/orders/workflow/rules/batch', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          storeId,
          rules: template.rules.map(rule => ({ ...rule, storeId }))
        })
      })

      if (response.ok) {
        loadWorkflowData()
        setTemplateDialogOpen(false)
      }
    } catch (error) {
      console.error('Error applying template:', error)
    }
  }

  const resetRuleForm = () => {
    setRuleForm({
      name: '',
      description: '',
      triggerType: 'order_status_change',
      triggerConditions: [],
      actions: [],
      priority: 'medium',
      isActive: true
    })
  }

  const getPriorityColor = (priority: string) => {
    switch (priority) {
      case 'critical': return 'bg-red-500/20 text-red-400 border-red-500/30'
      case 'high': return 'bg-orange-500/20 text-orange-400 border-orange-500/30'
      case 'medium': return 'bg-yellow-500/20 text-yellow-400 border-yellow-500/30'
      case 'low': return 'bg-green-500/20 text-green-400 border-green-500/30'
      default: return 'bg-gray-500/20 text-gray-400 border-gray-500/30'
    }
  }

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'completed': return 'text-green-400'
      case 'running': return 'text-blue-400'
      case 'failed': return 'text-red-400'
      case 'pending': return 'text-yellow-400'
      case 'cancelled': return 'text-gray-400'
      default: return 'text-gray-400'
    }
  }

  const getStatusIcon = (status: string) => {
    switch (status) {
      case 'completed': return <CheckCircle className="w-4 h-4" />
      case 'running': return <RefreshCw className="w-4 h-4 animate-spin" />
      case 'failed': return <XCircle className="w-4 h-4" />
      case 'pending': return <Clock className="w-4 h-4" />
      case 'cancelled': return <XCircle className="w-4 h-4" />
      default: return <Clock className="w-4 h-4" />
    }
  }

  if (!isOpen) return null

  return (
    <div className="fixed inset-0 z-50 bg-black/50 flex items-center justify-center">
      <div className="bg-gray-900 border border-blue-500 rounded-lg shadow-2xl w-full max-w-7xl h-[95vh] flex flex-col">
        {/* Header */}
        <div className="flex items-center justify-between p-6 border-b border-blue-500">
          <div>
            <h2 className="text-2xl font-bold text-gray-400">Workflow Manager</h2>
            <p className="text-gray-400">Automate order processing and business rules</p>
          </div>
          
          <div className="flex items-center gap-3">
            <Button
              variant="outline"
              size="sm"
              onClick={() => setTemplateDialogOpen(true)}
              className="border-blue-500 hover:bg-blue-500/10"
            >
              <Download className="w-4 h-4 mr-2" />
              Templates
            </Button>
            
            <Button
              variant="outline"
              size="sm"
              onClick={() => setImportDialogOpen(true)}
              className="border-blue-500 hover:bg-blue-500/10"
            >
              <Upload className="w-4 h-4 mr-2" />
              Import
            </Button>

            <Button
              variant="default"
              size="sm"
              onClick={() => setCreateRuleDialogOpen(true)}
              className="bg-blue-600 hover:bg-blue-700 text-white"
            >
              <Plus className="w-4 h-4 mr-2" />
              New Rule
            </Button>

            <Button variant="ghost" size="sm" onClick={onClose} className="text-gray-400 hover:text-white">
              ✕
            </Button>
          </div>
        </div>

        <Tabs defaultValue="rules" className="flex-1 flex flex-col overflow-hidden">
          <TabsList className="grid w-full grid-cols-3 bg-gray-800 border border-blue-500 m-4 mb-0">
            <TabsTrigger value="rules" className="data-[state=active]:bg-blue-600">Workflow Rules</TabsTrigger>
            <TabsTrigger value="queue" className="data-[state=active]:bg-blue-600">Job Queue</TabsTrigger>
            <TabsTrigger value="analytics" className="data-[state=active]:bg-blue-600">Analytics</TabsTrigger>
          </TabsList>

          <div className="flex-1 overflow-hidden p-4 pt-2">
            <TabsContent value="rules" className="h-full overflow-hidden">
              {/* Filters */}
              <Card className="bg-gray-800 border-blue-500 mb-4">
                <CardContent className="p-4">
                  <div className="flex gap-4 items-center">
                    <div className="relative flex-1">
                      <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
                      <Input
                        placeholder="Search rules..."
                        value={searchTerm}
                        onChange={(e) => setSearchTerm(e.target.value)}
                        className="pl-10 border-blue-500 bg-gray-700 text-white"
                      />
                    </div>
                    
                    <Select value={statusFilter} onValueChange={(v: any) => setStatusFilter(v)}>
                      <SelectTrigger className="w-32 border-blue-500 bg-gray-700 text-white">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent className="bg-gray-800 border-blue-500">
                        <SelectItem value="all">All Status</SelectItem>
                        <SelectItem value="active">Active</SelectItem>
                        <SelectItem value="inactive">Inactive</SelectItem>
                      </SelectContent>
                    </Select>

                    <Select value={priorityFilter} onValueChange={(v: any) => setPriorityFilter(v)}>
                      <SelectTrigger className="w-32 border-blue-500 bg-gray-700 text-white">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent className="bg-gray-800 border-blue-500">
                        <SelectItem value="all">All Priority</SelectItem>
                        <SelectItem value="critical">Critical</SelectItem>
                        <SelectItem value="high">High</SelectItem>
                        <SelectItem value="medium">Medium</SelectItem>
                        <SelectItem value="low">Low</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                </CardContent>
              </Card>

              {/* Rules List */}
              <Card className="bg-gray-800 border-blue-500 flex-1 overflow-hidden">
                <CardHeader>
                  <CardTitle className="text-gray-400">Workflow Rules ({filteredRules.length})</CardTitle>
                </CardHeader>
                <CardContent className="flex-1 overflow-hidden p-0">
                  <ScrollArea className="h-full">
                    <div className="p-4 space-y-3">
                      {filteredRules.map((rule) => (
                        <Card key={rule.id} className="bg-gray-700/50 border-blue-500">
                          <CardContent className="p-4">
                            <div className="flex items-start justify-between">
                              <div className="flex-1">
                                <div className="flex items-center gap-3 mb-2">
                                  <h3 className="font-semibold text-gray-400">{rule.name}</h3>
                                  <Badge className={getPriorityColor(rule.priority)}>
                                    {rule.priority}
                                  </Badge>
                                  <Badge variant="outline" className={
                                    rule.isActive ? 'border-green-500/30 text-green-400' : 'border-gray-500/30 text-gray-400'
                                  }>
                                    {rule.isActive ? 'Active' : 'Inactive'}
                                  </Badge>
                                </div>
                                
                                <p className="text-sm text-gray-400 mb-3">{rule.description}</p>
                                
                                <div className="grid grid-cols-2 gap-4 text-sm">
                                  <div>
                                    <span className="text-gray-500">Trigger:</span>
                                    <span className="ml-2 text-gray-400">{rule.trigger.type.replace('_', ' ')}</span>
                                  </div>
                                  <div>
                                    <span className="text-gray-500">Actions:</span>
                                    <span className="ml-2 text-gray-400">{rule.actions.length} configured</span>
                                  </div>
                                  <div>
                                    <span className="text-gray-500">Executions:</span>
                                    <span className="ml-2 text-gray-400">{rule.executionCount}</span>
                                  </div>
                                  <div>
                                    <span className="text-gray-500">Success Rate:</span>
                                    <span className="ml-2 text-gray-400">{rule.successRate.toFixed(1)}%</span>
                                  </div>
                                </div>
                                
                                {rule.lastExecuted && (
                                  <p className="text-xs text-gray-500 mt-2">
                                    Last executed: {new Date(rule.lastExecuted).toLocaleString()}
                                  </p>
                                )}
                              </div>
                              
                              <div className="flex items-center gap-2">
                                <Switch
                                  checked={rule.isActive}
                                  onCheckedChange={(checked) => toggleRuleStatus(rule.id, checked)}
                                />
                                
                                <Button
                                  variant="ghost"
                                  size="sm"
                                  onClick={() => {
                                    setSelectedRule(rule)
                                    setRuleForm({
                                      name: rule.name,
                                      description: rule.description,
                                      triggerType: rule.trigger.type,
                                      triggerConditions: rule.trigger.conditions,
                                      actions: rule.actions,
                                      priority: rule.priority,
                                      isActive: rule.isActive
                                    })
                                    setEditRuleDialogOpen(true)
                                  }}
                                  className="text-blue-400 hover:bg-blue-500/10"
                                >
                                  <Edit className="w-4 h-4" />
                                </Button>
                                
                                <Button
                                  variant="ghost"
                                  size="sm"
                                  onClick={() => {
                                    navigator.clipboard.writeText(JSON.stringify(rule, null, 2))
                                  }}
                                  className="text-gray-400 hover:bg-gray-500/10"
                                >
                                  <Copy className="w-4 h-4" />
                                </Button>
                                
                                <AlertDialog>
                                  <AlertDialogTrigger asChild>
                                    <Button
                                      variant="ghost"
                                      size="sm"
                                      className="text-red-400 hover:bg-red-500/10"
                                    >
                                      <Trash2 className="w-4 h-4" />
                                    </Button>
                                  </AlertDialogTrigger>
                                  <AlertDialogContent className="bg-gray-800 border-blue-500">
                                    <AlertDialogHeader>
                                      <AlertDialogTitle className="text-gray-400">Delete Rule</AlertDialogTitle>
                                      <AlertDialogDescription className="text-gray-400">
                                        Are you sure you want to delete the rule "{rule.name}"? This action cannot be undone.
                                      </AlertDialogDescription>
                                    </AlertDialogHeader>
                                    <AlertDialogFooter>
                                      <AlertDialogCancel className="border-blue-500">Cancel</AlertDialogCancel>
                                      <AlertDialogAction
                                        onClick={() => deleteRule(rule.id)}
                                        className="bg-red-600 hover:bg-red-700 text-white"
                                      >
                                        Delete
                                      </AlertDialogAction>
                                    </AlertDialogFooter>
                                  </AlertDialogContent>
                                </AlertDialog>
                              </div>
                            </div>
                          </CardContent>
                        </Card>
                      ))}
                    </div>
                  </ScrollArea>
                </CardContent>
              </Card>
            </TabsContent>

            <TabsContent value="queue" className="h-full overflow-hidden">
              {/* Job Queue Filters */}
              <Card className="bg-gray-800 border-blue-500 mb-4">
                <CardContent className="p-4">
                  <div className="flex gap-4 items-center">
                    <div className="relative flex-1">
                      <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
                      <Input
                        placeholder="Search jobs..."
                        value={searchTerm}
                        onChange={(e) => setSearchTerm(e.target.value)}
                        className="pl-10 border-blue-500 bg-gray-700 text-white"
                      />
                    </div>
                    
                    <Select value={jobStatusFilter} onValueChange={(v: any) => setJobStatusFilter(v)}>
                      <SelectTrigger className="w-32 border-blue-500 bg-gray-700 text-white">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent className="bg-gray-800 border-blue-500">
                        <SelectItem value="all">All Status</SelectItem>
                        <SelectItem value="pending">Pending</SelectItem>
                        <SelectItem value="running">Running</SelectItem>
                        <SelectItem value="completed">Completed</SelectItem>
                        <SelectItem value="failed">Failed</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                </CardContent>
              </Card>

              {/* Job Queue List */}
              <Card className="bg-gray-800 border-blue-500 flex-1 overflow-hidden">
                <CardHeader>
                  <CardTitle className="text-gray-400">Job Queue ({filteredJobs.length})</CardTitle>
                </CardHeader>
                <CardContent className="flex-1 overflow-hidden p-0">
                  <ScrollArea className="h-full">
                    <div className="p-4 space-y-3">
                      {filteredJobs.map((job) => (
                        <Card key={job.id} className="bg-gray-700/50 border-blue-500">
                          <CardContent className="p-4">
                            <div className="flex items-center justify-between">
                              <div className="flex-1">
                                <div className="flex items-center gap-3 mb-2">
                                  <h3 className="font-semibold text-gray-400">{job.ruleName}</h3>
                                  <div className={`flex items-center gap-1 ${getStatusColor(job.status)}`}>
                                    {getStatusIcon(job.status)}
                                    <span className="text-sm capitalize">{job.status}</span>
                                  </div>
                                </div>
                                
                                <div className="grid grid-cols-3 gap-4 text-sm mb-2">
                                  <div>
                                    <span className="text-gray-500">Created:</span>
                                    <span className="ml-2 text-gray-400">{new Date(job.createdAt).toLocaleString()}</span>
                                  </div>
                                  {job.startedAt && (
                                    <div>
                                      <span className="text-gray-500">Started:</span>
                                      <span className="ml-2 text-gray-400">{new Date(job.startedAt).toLocaleString()}</span>
                                    </div>
                                  )}
                                  {job.completedAt && (
                                    <div>
                                      <span className="text-gray-500">Completed:</span>
                                      <span className="ml-2 text-gray-400">{new Date(job.completedAt).toLocaleString()}</span>
                                    </div>
                                  )}
                                </div>
                                
                                {job.status === 'running' && (
                                  <div className="mb-2">
                                    <div className="flex items-center justify-between text-sm mb-1">
                                      <span className="text-gray-400">Progress</span>
                                      <span className="text-gray-400">{job.progress}%</span>
                                    </div>
                                    <div className="w-full bg-gray-600 rounded-full h-2">
                                      <div 
                                        className="bg-blue-500 h-2 rounded-full transition-all" 
                                        style={{ width: `${job.progress}%` }}
                                      />
                                    </div>
                                  </div>
                                )}
                                
                                {job.errorMessage && (
                                  <p className="text-sm text-red-400">{job.errorMessage}</p>
                                )}
                              </div>
                              
                              <div className="flex items-center gap-2">
                                <Button
                                  variant="ghost"
                                  size="sm"
                                  onClick={() => {
                                    setSelectedJob(job)
                                    setJobDetailsDialogOpen(true)
                                  }}
                                  className="text-blue-400 hover:bg-blue-500/10"
                                >
                                  <Eye className="w-4 h-4" />
                                </Button>
                                
                                {(job.status === 'failed' || job.status === 'pending') && (
                                  <Button
                                    variant="ghost"
                                    size="sm"
                                    onClick={() => retryJob(job.id)}
                                    className="text-green-400 hover:bg-green-500/10"
                                  >
                                    <RefreshCw className="w-4 h-4" />
                                  </Button>
                                )}
                                
                                {job.status === 'pending' && (
                                  <Button
                                    variant="ghost"
                                    size="sm"
                                    onClick={() => cancelJob(job.id)}
                                    className="text-red-400 hover:bg-red-500/10"
                                  >
                                    <XCircle className="w-4 h-4" />
                                  </Button>
                                )}
                              </div>
                            </div>
                          </CardContent>
                        </Card>
                      ))}
                    </div>
                  </ScrollArea>
                </CardContent>
              </Card>
            </TabsContent>

            <TabsContent value="analytics" className="h-full overflow-auto">
              <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                {/* Workflow Statistics */}
                <Card className="bg-gray-800 border-blue-500">
                  <CardHeader>
                    <CardTitle className="text-gray-400">Workflow Statistics</CardTitle>
                  </CardHeader>
                  <CardContent className="space-y-4">
                    <div className="grid grid-cols-2 gap-4">
                      <div className="text-center p-4 rounded-lg bg-gray-700/50">
                        <p className="text-2xl font-bold text-gray-400">{rules.filter(r => r.isActive).length}</p>
                        <p className="text-sm text-gray-500">Active Rules</p>
                      </div>
                      <div className="text-center p-4 rounded-lg bg-gray-700/50">
                        <p className="text-2xl font-bold text-gray-400">{rules.length}</p>
                        <p className="text-sm text-gray-500">Total Rules</p>
                      </div>
                    </div>
                    
                    <Separator className="border-blue-500" />
                    
                    <div className="space-y-3">
                      <div className="flex justify-between items-center">
                        <span className="text-sm text-gray-400">Total Executions</span>
                        <span className="font-medium text-gray-400">
                          {rules.reduce((sum, rule) => sum + rule.executionCount, 0)}
                        </span>
                      </div>
                      <div className="flex justify-between items-center">
                        <span className="text-sm text-gray-400">Average Success Rate</span>
                        <span className="font-medium text-gray-400">
                          {rules.length > 0 
                            ? (rules.reduce((sum, rule) => sum + rule.successRate, 0) / rules.length).toFixed(1)
                            : 0}%
                        </span>
                      </div>
                      <div className="flex justify-between items-center">
                        <span className="text-sm text-gray-400">Jobs in Queue</span>
                        <span className="font-medium text-gray-400">
                          {jobQueue.filter(job => job.status === 'pending' || job.status === 'running').length}
                        </span>
                      </div>
                    </div>
                  </CardContent>
                </Card>

                {/* Recent Activity */}
                <Card className="bg-gray-800 border-blue-500">
                  <CardHeader>
                    <CardTitle className="text-gray-400">Recent Activity</CardTitle>
                  </CardHeader>
                  <CardContent>
                    <ScrollArea className="h-75">
                      <div className="space-y-3">
                        {jobQueue.slice(0, 10).map((job) => (
                          <div key={job.id} className="flex items-center gap-3 p-3 rounded-lg bg-gray-700/50">
                            <div className={`w-2 h-2 rounded-full ${getStatusColor(job.status).replace('text-', 'bg-')}`} />
                            <div className="flex-1">
                              <p className="text-sm text-gray-400">{job.ruleName}</p>
                              <p className="text-xs text-gray-500">{new Date(job.createdAt).toLocaleString()}</p>
                            </div>
                            <div className={`text-xs ${getStatusColor(job.status)}`}>
                              {job.status}
                            </div>
                          </div>
                        ))}
                      </div>
                    </ScrollArea>
                  </CardContent>
                </Card>
              </div>
            </TabsContent>
          </div>
        </Tabs>

        {/* Create Rule Dialog */}
        <Dialog open={createRuleDialogOpen} onOpenChange={setCreateRuleDialogOpen}>
          <DialogContent className="bg-gray-900 border-blue-500 max-w-2xl">
            <DialogHeader>
              <DialogTitle className="text-gray-400">Create Workflow Rule</DialogTitle>
              <DialogDescription className="text-gray-400">
                Configure automated actions based on order events
              </DialogDescription>
            </DialogHeader>
            
            <div className="space-y-4 py-4">
              <div>
                <label className="text-sm font-medium mb-2 block text-gray-400">Rule Name</label>
                <Input
                  value={ruleForm.name}
                  onChange={(e) => setRuleForm({...ruleForm, name: e.target.value})}
                  placeholder="Enter rule name"
                  className="border-blue-500 bg-gray-800 text-white"
                />
              </div>
              
              <div>
                <label className="text-sm font-medium mb-2 block text-gray-400">Description</label>
                <Textarea
                  value={ruleForm.description}
                  onChange={(e) => setRuleForm({...ruleForm, description: e.target.value})}
                  placeholder="Describe what this rule does"
                  className="border-blue-500 bg-gray-800 text-white"
                />
              </div>
              
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="text-sm font-medium mb-2 block text-gray-400">Priority</label>
                  <Select value={ruleForm.priority} onValueChange={(v: any) => setRuleForm({...ruleForm, priority: v})}>
                    <SelectTrigger className="border-blue-500 bg-gray-800 text-white">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent className="bg-gray-800 border-blue-500">
                      <SelectItem value="low">Low</SelectItem>
                      <SelectItem value="medium">Medium</SelectItem>
                      <SelectItem value="high">High</SelectItem>
                      <SelectItem value="critical">Critical</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                
                <div className="flex items-center space-x-2 pt-6">
                  <Switch
                    checked={ruleForm.isActive}
                    onCheckedChange={(checked) => setRuleForm({...ruleForm, isActive: checked})}
                  />
                  <label className="text-sm text-gray-400">Active</label>
                </div>
              </div>
            </div>
            
            <DialogFooter>
              <Button
                variant="outline"
                onClick={() => {
                  setCreateRuleDialogOpen(false)
                  resetRuleForm()
                }}
                className="border-blue-500"
              >
                Cancel
              </Button>
              <Button
                onClick={createRule}
                className="bg-blue-600 hover:bg-blue-700 text-white"
              >
                Create Rule
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>

        {/* Edit Rule Dialog */}
        <Dialog open={editRuleDialogOpen} onOpenChange={setEditRuleDialogOpen}>
          <DialogContent className="bg-gray-900 border-blue-500 max-w-2xl">
            <DialogHeader>
              <DialogTitle className="text-gray-400">Edit Workflow Rule</DialogTitle>
              <DialogDescription className="text-gray-400">
                Modify the selected workflow rule
              </DialogDescription>
            </DialogHeader>
            
            <div className="space-y-4 py-4">
              <div>
                <label className="text-sm font-medium mb-2 block text-gray-400">Rule Name</label>
                <Input
                  value={ruleForm.name}
                  onChange={(e) => setRuleForm({...ruleForm, name: e.target.value})}
                  placeholder="Enter rule name"
                  className="border-blue-500 bg-gray-800 text-white"
                />
              </div>
              
              <div>
                <label className="text-sm font-medium mb-2 block text-gray-400">Description</label>
                <Textarea
                  value={ruleForm.description}
                  onChange={(e) => setRuleForm({...ruleForm, description: e.target.value})}
                  placeholder="Describe what this rule does"
                  className="border-blue-500 bg-gray-800 text-white"
                />
              </div>
              
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="text-sm font-medium mb-2 block text-gray-400">Priority</label>
                  <Select value={ruleForm.priority} onValueChange={(v: any) => setRuleForm({...ruleForm, priority: v})}>
                    <SelectTrigger className="border-blue-500 bg-gray-800 text-white">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent className="bg-gray-800 border-blue-500">
                      <SelectItem value="low">Low</SelectItem>
                      <SelectItem value="medium">Medium</SelectItem>
                      <SelectItem value="high">High</SelectItem>
                      <SelectItem value="critical">Critical</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                
                <div className="flex items-center space-x-2 pt-6">
                  <Switch
                    checked={ruleForm.isActive}
                    onCheckedChange={(checked) => setRuleForm({...ruleForm, isActive: checked})}
                  />
                  <label className="text-sm text-gray-400">Active</label>
                </div>
              </div>
            </div>
            
            <DialogFooter>
              <Button
                variant="outline"
                onClick={() => {
                  setEditRuleDialogOpen(false)
                  setSelectedRule(null)
                  resetRuleForm()
                }}
                className="border-blue-500"
              >
                Cancel
              </Button>
              <Button
                onClick={updateRule}
                className="bg-blue-600 hover:bg-blue-700 text-white"
              >
                Update Rule
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>

        {/* Job Details Dialog */}
        <Dialog open={jobDetailsDialogOpen} onOpenChange={setJobDetailsDialogOpen}>
          <DialogContent className="bg-gray-900 border-blue-500 max-w-2xl">
            <DialogHeader>
              <DialogTitle className="text-gray-400">Job Details</DialogTitle>
              <DialogDescription className="text-gray-400">
                Detailed information about job execution
              </DialogDescription>
            </DialogHeader>
            
            {selectedJob && (
              <div className="space-y-4 py-4">
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="text-sm font-medium text-gray-400">Job ID</label>
                    <p className="text-gray-300 font-mono text-sm">{selectedJob.id}</p>
                  </div>
                  <div>
                    <label className="text-sm font-medium text-gray-400">Status</label>
                    <div className={`flex items-center gap-2 ${getStatusColor(selectedJob.status)}`}>
                      {getStatusIcon(selectedJob.status)}
                      <span className="capitalize">{selectedJob.status}</span>
                    </div>
                  </div>
                </div>
                
                <div>
                  <label className="text-sm font-medium text-gray-400">Rule Name</label>
                  <p className="text-gray-300">{selectedJob.ruleName}</p>
                </div>
                
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="text-sm font-medium text-gray-400">Created</label>
                    <p className="text-gray-300">{new Date(selectedJob.createdAt).toLocaleString()}</p>
                  </div>
                  {selectedJob.startedAt && (
                    <div>
                      <label className="text-sm font-medium text-gray-400">Started</label>
                      <p className="text-gray-300">{new Date(selectedJob.startedAt).toLocaleString()}</p>
                    </div>
                  )}
                </div>
                
                {selectedJob.errorMessage && (
                  <div>
                    <label className="text-sm font-medium text-red-400">Error Message</label>
                    <p className="text-red-300 bg-red-500/10 p-3 rounded-lg">{selectedJob.errorMessage}</p>
                  </div>
                )}
                
                <div>
                  <label className="text-sm font-medium text-gray-400">Payload</label>
                  <pre className="text-gray-300 bg-gray-800 p-3 rounded-lg text-xs overflow-auto max-h-40">
                    {JSON.stringify(selectedJob.payload, null, 2)}
                  </pre>
                </div>
                
                {selectedJob.result && (
                  <div>
                    <label className="text-sm font-medium text-gray-400">Result</label>
                    <pre className="text-gray-300 bg-gray-800 p-3 rounded-lg text-xs overflow-auto max-h-40">
                      {JSON.stringify(selectedJob.result, null, 2)}
                    </pre>
                  </div>
                )}
              </div>
            )}
            
            <DialogFooter>
              <Button
                variant="outline"
                onClick={() => {
                  setJobDetailsDialogOpen(false)
                  setSelectedJob(null)
                }}
                className="border-blue-500"
              >
                Close
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>

        {/* Template Dialog */}
        <Dialog open={templateDialogOpen} onOpenChange={setTemplateDialogOpen}>
          <DialogContent className="bg-gray-900 border-blue-500 max-w-4xl">
            <DialogHeader>
              <DialogTitle className="text-gray-400">Automation Templates</DialogTitle>
              <DialogDescription className="text-gray-400">
                Pre-built workflow templates to get you started quickly
              </DialogDescription>
            </DialogHeader>
            
            <ScrollArea className="h-125">
              <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 p-4">
                {templates.map((template) => (
                  <Card key={template.id} className="bg-gray-800 border-blue-500">
                    <CardContent className="p-4">
                      <div className="flex items-start justify-between mb-3">
                        <div>
                          <h3 className="font-semibold text-gray-400">{template.name}</h3>
                          <p className="text-sm text-gray-400">{template.description}</p>
                        </div>
                        {template.isPopular && (
                          <Badge className="bg-yellow-500/20 text-yellow-400 border-yellow-500/30">
                            Popular
                          </Badge>
                        )}
                      </div>
                      
                      <div className="flex items-center justify-between mb-3">
                        <Badge variant="outline" className="border-blue-500 text-gray-400">
                          {template.category.replace('_', ' ')}
                        </Badge>
                        <span className="text-xs text-gray-500">
                          {template.downloadCount} downloads
                        </span>
                      </div>
                      
                      <div className="flex gap-2">
                        <Button
                          size="sm"
                          onClick={() => applyTemplate(template)}
                          className="flex-1 bg-blue-600 hover:bg-blue-700 text-white"
                        >
                          Use Template
                        </Button>
                        <Button
                          variant="outline"
                          size="sm"
                          className="border-blue-500 text-blue-400 hover:bg-blue-500/10"
                        >
                          <Eye className="w-4 h-4" />
                        </Button>
                      </div>
                    </CardContent>
                  </Card>
                ))}
              </div>
            </ScrollArea>
            
            <DialogFooter>
              <Button
                variant="outline"
                onClick={() => setTemplateDialogOpen(false)}
                className="border-blue-500"
              >
                Close
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </div>
    </div>
  )
}