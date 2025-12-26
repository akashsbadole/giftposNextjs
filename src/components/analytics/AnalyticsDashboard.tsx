'use client'

import { useState, useEffect, useCallback } from 'react'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { ScrollArea } from '@/components/ui/scroll-area'
import { Separator } from '@/components/ui/separator'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import {
  LineChart,
  Line,
  AreaChart,
  Area,
  BarChart,
  Bar,
  PieChart,
  Pie,
  Cell,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  ResponsiveContainer
} from 'recharts'
import {
  TrendingUp,
  TrendingDown,
  DollarSign,
  ShoppingCart,
  Users,
  Clock,
  Activity,
  AlertCircle,
  CheckCircle,
  Timer,
  Package,
  Target,
  Zap,
  RefreshCw,
  Calendar,
  Filter,
  Download,
  Maximize2,
  Eye,
  BarChart3,
  PieChart as PieChartIcon,
  LineChart as LineChartIcon,
  Activity as ActivityIcon
} from 'lucide-react'

interface MetricData {
  timestamp: string
  value: number
  label?: string
  category?: string
}

interface PerformanceMetrics {
  totalOrders: number
  completedOrders: number
  averageOrderValue: number
  averageProcessingTime: number
  ordersPerHour: number
  revenue: number
  revenueGrowth: number
  orderGrowth: number
  efficiency: number
}

interface SystemHealth {
  status: 'healthy' | 'warning' | 'critical'
  cpuUsage: number
  memoryUsage: number
  responseTime: number
  errorRate: number
  activeConnections: number
  databaseConnections: number
}

interface UserActivity {
  userId: string
  userName: string
  role: string
  ordersProcessed: number
  averageTime: number
  lastActivity: Date
  status: 'active' | 'idle' | 'away'
}

interface AnalyticsDashboardProps {
  storeId: string
  isOpen: boolean
  onClose: () => void
  refreshInterval?: number
}

export default function AnalyticsDashboard({
  storeId,
  isOpen,
  onClose,
  refreshInterval = 30000 // 30 seconds
}: AnalyticsDashboardProps) {
  const [timeRange, setTimeRange] = useState<'1h' | '24h' | '7d' | '30d'>('24h')
  const [selectedMetric, setSelectedMetric] = useState<'revenue' | 'orders' | 'efficiency'>('revenue')
  const [isRealTime, setIsRealTime] = useState(true)
  const [isLoading, setIsLoading] = useState(false)
  
  // Data states
  const [performanceMetrics, setPerformanceMetrics] = useState<PerformanceMetrics | null>(null)
  const [systemHealth, setSystemHealth] = useState<SystemHealth | null>(null)
  const [userActivity, setUserActivity] = useState<UserActivity[]>([])
  const [revenueData, setRevenueData] = useState<MetricData[]>([])
  const [orderData, setOrderData] = useState<MetricData[]>([])
  const [efficiencyData, setEfficiencyData] = useState<MetricData[]>([])
  const [topProducts, setTopProducts] = useState<Array<{ name: string, sales: number, revenue: number }>>([])
  const [orderStatusDistribution, setOrderStatusDistribution] = useState<Array<{ status: string, count: number, color: string }>>([])

  // Load analytics data
  const loadAnalyticsData = useCallback(async () => {
    if (!storeId) return

    setIsLoading(true)
    try {
      // Load performance metrics
      const metricsResponse = await fetch(`/api/pos/orders/analytics/metrics?storeId=${storeId}&timeRange=${timeRange}`)
      if (metricsResponse.ok) {
        const metricsData = await metricsResponse.json()
        setPerformanceMetrics(metricsData)
      }

      // Load system health
      const healthResponse = await fetch(`/api/pos/orders/analytics/health?storeId=${storeId}`)
      if (healthResponse.ok) {
        const healthData = await healthResponse.json()
        setSystemHealth(healthData)
      }

      // Load revenue data
      const revenueResponse = await fetch(`/api/pos/orders/analytics/revenue?storeId=${storeId}&timeRange=${timeRange}`)
      if (revenueResponse.ok) {
        const revenueData = await revenueResponse.json()
        setRevenueData(revenueData.data || [])
      }

      // Load order data
      const ordersResponse = await fetch(`/api/pos/orders/analytics/orders?storeId=${storeId}&timeRange=${timeRange}`)
      if (ordersResponse.ok) {
        const ordersData = await ordersResponse.json()
        setOrderData(ordersData.data || [])
      }

      // Load efficiency data
      const efficiencyResponse = await fetch(`/api/pos/orders/analytics/efficiency?storeId=${storeId}&timeRange=${timeRange}`)
      if (efficiencyResponse.ok) {
        const efficiencyData = await efficiencyResponse.json()
        setEfficiencyData(efficiencyData.data || [])
      }

      // Load user activity
      const activityResponse = await fetch(`/api/pos/orders/analytics/users?storeId=${storeId}&timeRange=${timeRange}`)
      if (activityResponse.ok) {
        const activityData = await activityResponse.json()
        setUserActivity(activityData.users || [])
      }

      // Load top products
      const productsResponse = await fetch(`/api/pos/orders/analytics/products?storeId=${storeId}&timeRange=${timeRange}`)
      if (productsResponse.ok) {
        const productsData = await productsResponse.json()
        setTopProducts(productsData.products || [])
      }

      // Load order status distribution
      const statusResponse = await fetch(`/api/pos/orders/analytics/status?storeId=${storeId}&timeRange=${timeRange}`)
      if (statusResponse.ok) {
        const statusData = await statusResponse.json()
        setOrderStatusDistribution(statusData.distribution || [])
      }
    } catch (error) {
      console.error('Error loading analytics data:', error)
    } finally {
      setIsLoading(false)
    }
  }, [storeId, timeRange])

  // Auto-refresh data
  useEffect(() => {
    if (!isOpen || !storeId) return

    loadAnalyticsData()

    if (isRealTime) {
      const interval = setInterval(loadAnalyticsData, refreshInterval)
      return () => clearInterval(interval)
    }
  }, [isOpen, storeId, isRealTime, refreshInterval, loadAnalyticsData])

  const getHealthStatusColor = (status: string) => {
    switch (status) {
      case 'healthy': return 'text-green-400'
      case 'warning': return 'text-yellow-400'
      case 'critical': return 'text-red-400'
      default: return 'text-gray-400'
    }
  }

  const getHealthStatusIcon = (status: string) => {
    switch (status) {
      case 'healthy': return <CheckCircle className="w-4 h-4" />
      case 'warning': return <AlertCircle className="w-4 h-4" />
      case 'critical': return <AlertCircle className="w-4 h-4" />
      default: return <Activity className="w-4 h-4" />
    }
  }

  const formatCurrency = (value: number) => {
    return new Intl.NumberFormat('en-IN', {
      style: 'currency',
      currency: 'INR',
      minimumFractionDigits: 0,
      maximumFractionDigits: 0
    }).format(value)
  }

  const formatPercentage = (value: number) => {
    return `${value >= 0 ? '+' : ''}${value.toFixed(1)}%`
  }

  const formatTime = (minutes: number) => {
    if (minutes < 60) return `${Math.round(minutes)}m`
    const hours = Math.floor(minutes / 60)
    const remainingMinutes = Math.round(minutes % 60)
    return `${hours}h ${remainingMinutes}m`
  }

  if (!isOpen) return null

  return (
    <div className="fixed inset-0 z-50 bg-black/50 flex items-center justify-center">
      <div className="bg-gray-900 border border-blue-500 rounded-lg shadow-2xl w-full max-w-7xl h-[95vh] flex flex-col">
        {/* Header */}
        <div className="flex items-center justify-between p-6 border-b border-blue-500">
          <div>
            <h2 className="text-2xl font-bold text-gray-400">Analytics Dashboard</h2>
            <p className="text-gray-400">Real-time operational metrics and performance insights</p>
          </div>
          
          <div className="flex items-center gap-3">
            {/* Time Range Selector */}
            <Select value={timeRange} onValueChange={(v: any) => setTimeRange(v)}>
              <SelectTrigger className="w-32 border-blue-500 bg-gray-800 text-white">
                <SelectValue />
              </SelectTrigger>
              <SelectContent className="bg-gray-800 border-blue-500">
                <SelectItem value="1h">Last Hour</SelectItem>
                <SelectItem value="24h">Last 24h</SelectItem>
                <SelectItem value="7d">Last 7 Days</SelectItem>
                <SelectItem value="30d">Last 30 Days</SelectItem>
              </SelectContent>
            </Select>

            {/* Real-time Toggle */}
            <Button
              variant="ghost"
              size="sm"
              onClick={() => setIsRealTime(!isRealTime)}
              className={`${isRealTime ? 'text-green-400' : 'text-gray-400'} hover:bg-gray-800`}
            >
              <ActivityIcon className="w-4 h-4" />
            </Button>

            {/* Refresh Button */}
            <Button
              variant="outline"
              size="sm"
              onClick={loadAnalyticsData}
              disabled={isLoading}
              className="border-blue-500 hover:bg-blue-500/10"
            >
              <RefreshCw className={`w-4 h-4 ${isLoading ? 'animate-spin' : ''}`} />
            </Button>

            <Button variant="ghost" size="sm" onClick={onClose} className="text-gray-400 hover:text-white">
              ✕
            </Button>
          </div>
        </div>

        <Tabs defaultValue="overview" className="flex-1 flex flex-col overflow-hidden">
          <TabsList className="grid w-full grid-cols-4 bg-gray-800 border border-blue-500 m-4 mb-0">
            <TabsTrigger value="overview" className="data-[state=active]:bg-blue-600">Overview</TabsTrigger>
            <TabsTrigger value="performance" className="data-[state=active]:bg-blue-600">Performance</TabsTrigger>
            <TabsTrigger value="users" className="data-[state=active]:bg-blue-600">Users</TabsTrigger>
            <TabsTrigger value="system" className="data-[state=active]:bg-blue-600">System</TabsTrigger>
          </TabsList>

          <div className="flex-1 overflow-hidden p-4 pt-2">
            <TabsContent value="overview" className="h-full overflow-auto">
              <div className="grid grid-cols-1 lg:grid-cols-2 xl:grid-cols-4 gap-4 mb-6">
                {/* Key Metrics Cards */}
                <Card className="bg-gray-800 border-blue-500">
                  <CardHeader className="pb-3">
                    <div className="flex items-center justify-between">
                      <CardTitle className="text-sm font-medium text-gray-400">Total Revenue</CardTitle>
                      <DollarSign className="w-4 h-4 text-green-400" />
                    </div>
                  </CardHeader>
                  <CardContent>
                    <div className="text-2xl font-bold text-gray-400">
                      {performanceMetrics ? formatCurrency(performanceMetrics.revenue) : '--'}
                    </div>
                    <div className="flex items-center mt-1">
                      {performanceMetrics?.revenueGrowth !== undefined && (
                        <>
                          {performanceMetrics.revenueGrowth >= 0 ? (
                            <TrendingUp className="w-3 h-3 text-green-400 mr-1" />
                          ) : (
                            <TrendingDown className="w-3 h-3 text-red-400 mr-1" />
                          )}
                          <span className={`text-xs ${performanceMetrics.revenueGrowth >= 0 ? 'text-green-400' : 'text-red-400'}`}>
                            {formatPercentage(performanceMetrics.revenueGrowth)}
                          </span>
                        </>
                      )}
                    </div>
                  </CardContent>
                </Card>

                <Card className="bg-gray-800 border-blue-500">
                  <CardHeader className="pb-3">
                    <div className="flex items-center justify-between">
                      <CardTitle className="text-sm font-medium text-gray-400">Orders Processed</CardTitle>
                      <ShoppingCart className="w-4 h-4 text-blue-400" />
                    </div>
                  </CardHeader>
                  <CardContent>
                    <div className="text-2xl font-bold text-gray-400">
                      {performanceMetrics?.totalOrders || '--'}
                    </div>
                    <div className="flex items-center mt-1">
                      {performanceMetrics?.orderGrowth !== undefined && (
                        <>
                          {performanceMetrics.orderGrowth >= 0 ? (
                            <TrendingUp className="w-3 h-3 text-green-400 mr-1" />
                          ) : (
                            <TrendingDown className="w-3 h-3 text-red-400 mr-1" />
                          )}
                          <span className={`text-xs ${performanceMetrics.orderGrowth >= 0 ? 'text-green-400' : 'text-red-400'}`}>
                            {formatPercentage(performanceMetrics.orderGrowth)}
                          </span>
                        </>
                      )}
                    </div>
                  </CardContent>
                </Card>

                <Card className="bg-gray-800 border-blue-500">
                  <CardHeader className="pb-3">
                    <div className="flex items-center justify-between">
                      <CardTitle className="text-sm font-medium text-gray-400">Avg Order Value</CardTitle>
                      <Target className="w-4 h-4 text-purple-400" />
                    </div>
                  </CardHeader>
                  <CardContent>
                    <div className="text-2xl font-bold text-gray-400">
                      {performanceMetrics ? formatCurrency(performanceMetrics.averageOrderValue) : '--'}
                    </div>
                    <p className="text-xs text-gray-500 mt-1">
                      {performanceMetrics?.ordersPerHour || '--'} orders/hour
                    </p>
                  </CardContent>
                </Card>

                <Card className="bg-gray-800 border-blue-500">
                  <CardHeader className="pb-3">
                    <div className="flex items-center justify-between">
                      <CardTitle className="text-sm font-medium text-gray-400">System Health</CardTitle>
                      {systemHealth && getHealthStatusIcon(systemHealth.status)}
                    </div>
                  </CardHeader>
                  <CardContent>
                    <div className={`text-2xl font-bold capitalize ${getHealthStatusColor(systemHealth?.status || 'unknown')}`}>
                      {systemHealth?.status || 'Unknown'}
                    </div>
                    <p className="text-xs text-gray-500 mt-1">
                      {systemHealth?.responseTime || '--'}ms response time
                    </p>
                  </CardContent>
                </Card>
              </div>

              {/* Charts Grid */}
              <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                {/* Revenue Trend */}
                <Card className="bg-gray-800 border-blue-500">
                  <CardHeader>
                    <CardTitle className="text-gray-400">Revenue Trend</CardTitle>
                    <CardDescription>Revenue over time</CardDescription>
                  </CardHeader>
                  <CardContent>
                    <ResponsiveContainer width="100%" height={300}>
                      <AreaChart data={revenueData}>
                        <CartesianGrid strokeDasharray="3 3" stroke="#374151" />
                        <XAxis dataKey="timestamp" stroke="#9CA3AF" />
                        <YAxis stroke="#9CA3AF" tickFormatter={formatCurrency} />
                        <Tooltip 
                          contentStyle={{ 
                            backgroundColor: '#1F2937', 
                            border: '1px solid #374151',
                            borderRadius: '8px'
                          }}
                          formatter={[formatCurrency]}
                        />
                        <Area type="monotone" dataKey="value" stroke="#3B82F6" fill="#3B82F6" fillOpacity={0.3} />
                      </AreaChart>
                    </ResponsiveContainer>
                  </CardContent>
                </Card>

                {/* Orders Trend */}
                <Card className="bg-gray-800 border-blue-500">
                  <CardHeader>
                    <CardTitle className="text-gray-400">Orders Trend</CardTitle>
                    <CardDescription>Number of orders over time</CardDescription>
                  </CardHeader>
                  <CardContent>
                    <ResponsiveContainer width="100%" height={300}>
                      <LineChart data={orderData}>
                        <CartesianGrid strokeDasharray="3 3" stroke="#374151" />
                        <XAxis dataKey="timestamp" stroke="#9CA3AF" />
                        <YAxis stroke="#9CA3AF" />
                        <Tooltip 
                          contentStyle={{ 
                            backgroundColor: '#1F2937', 
                            border: '1px solid #374151',
                            borderRadius: '8px'
                          }}
                        />
                        <Line type="monotone" dataKey="value" stroke="#10B981" strokeWidth={2} />
                      </LineChart>
                    </ResponsiveContainer>
                  </CardContent>
                </Card>

                {/* Order Status Distribution */}
                <Card className="bg-gray-800 border-blue-500">
                  <CardHeader>
                    <CardTitle className="text-gray-400">Order Status Distribution</CardTitle>
                    <CardDescription>Current order status breakdown</CardDescription>
                  </CardHeader>
                  <CardContent>
                    <ResponsiveContainer width="100%" height={300}>
                      <PieChart>
                        <Pie
                          data={orderStatusDistribution}
                          cx="50%"
                          cy="50%"
                          outerRadius={80}
                          fill="#8884d8"
                          dataKey="count"
                          label={({ status, count }) => `${status}: ${count}`}
                        >
                          {orderStatusDistribution.map((entry, index) => (
                            <Cell key={`cell-${index}`} fill={entry.color} />
                          ))}
                        </Pie>
                        <Tooltip />
                      </PieChart>
                    </ResponsiveContainer>
                  </CardContent>
                </Card>

                {/* Top Products */}
                <Card className="bg-gray-800 border-blue-500">
                  <CardHeader>
                    <CardTitle className="text-gray-400">Top Products</CardTitle>
                    <CardDescription>Best performing products</CardDescription>
                  </CardHeader>
                  <CardContent>
                    <ScrollArea className="h-[300px]">
                      <div className="space-y-3">
                        {topProducts.map((product, index) => (
                          <div key={product.name} className="flex items-center justify-between p-3 rounded-lg bg-gray-700/50">
                            <div className="flex items-center gap-3">
                              <Badge variant="outline" className="text-xs">
                                #{index + 1}
                              </Badge>
                              <div>
                                <p className="font-medium text-gray-400">{product.name}</p>
                                <p className="text-sm text-gray-500">{product.sales} units sold</p>
                              </div>
                            </div>
                            <div className="text-right">
                              <p className="font-medium text-gray-400">{formatCurrency(product.revenue)}</p>
                            </div>
                          </div>
                        ))}
                      </div>
                    </ScrollArea>
                  </CardContent>
                </Card>
              </div>
            </TabsContent>

            <TabsContent value="performance" className="h-full overflow-auto">
              <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                {/* Efficiency Metrics */}
                <Card className="bg-gray-800 border-blue-500">
                  <CardHeader>
                    <CardTitle className="text-gray-400">Processing Efficiency</CardTitle>
                    <CardDescription>Average order processing time</CardDescription>
                  </CardHeader>
                  <CardContent>
                    <ResponsiveContainer width="100%" height={300}>
                      <LineChart data={efficiencyData}>
                        <CartesianGrid strokeDasharray="3 3" stroke="#374151" />
                        <XAxis dataKey="timestamp" stroke="#9CA3AF" />
                        <YAxis stroke="#9CA3AF" tickFormatter={formatTime} />
                        <Tooltip 
                          contentStyle={{ 
                            backgroundColor: '#1F2937', 
                            border: '1px solid #374151',
                            borderRadius: '8px'
                          }}
                          formatter={[formatTime]}
                        />
                        <Line type="monotone" dataKey="value" stroke="#F59E0B" strokeWidth={2} />
                      </LineChart>
                    </ResponsiveContainer>
                  </CardContent>
                </Card>

                {/* Performance Summary */}
                <Card className="bg-gray-800 border-blue-500">
                  <CardHeader>
                    <CardTitle className="text-gray-400">Performance Summary</CardTitle>
                    <CardDescription>Key performance indicators</CardDescription>
                  </CardHeader>
                  <CardContent className="space-y-4">
                    <div className="grid grid-cols-2 gap-4">
                      <div className="text-center p-4 rounded-lg bg-gray-700/50">
                        <p className="text-2xl font-bold text-gray-400">
                          {performanceMetrics ? `${performanceMetrics.completedOrders}/${performanceMetrics.totalOrders}` : '--/--'}
                        </p>
                        <p className="text-sm text-gray-500">Orders Completed</p>
                      </div>
                      <div className="text-center p-4 rounded-lg bg-gray-700/50">
                        <p className="text-2xl font-bold text-gray-400">
                          {performanceMetrics ? `${performanceMetrics.efficiency.toFixed(1)}%` : '--'}
                        </p>
                        <p className="text-sm text-gray-500">Efficiency Rate</p>
                      </div>
                    </div>
                    
                    <Separator className="border-blue-500" />
                    
                    <div className="space-y-3">
                      <div className="flex justify-between items-center">
                        <span className="text-sm text-gray-400">Average Processing Time</span>
                        <span className="font-medium text-gray-400">
                          {performanceMetrics ? formatTime(performanceMetrics.averageProcessingTime) : '--'}
                        </span>
                      </div>
                      <div className="flex justify-between items-center">
                        <span className="text-sm text-gray-400">Orders per Hour</span>
                        <span className="font-medium text-gray-400">
                          {performanceMetrics?.ordersPerHour || '--'}
                        </span>
                      </div>
                      <div className="flex justify-between items-center">
                        <span className="text-sm text-gray-400">Peak Hour</span>
                        <span className="font-medium text-gray-400">2:00 PM - 3:00 PM</span>
                      </div>
                    </div>
                  </CardContent>
                </Card>
              </div>
            </TabsContent>

            <TabsContent value="users" className="h-full overflow-auto">
              <Card className="bg-gray-800 border-blue-500">
                <CardHeader>
                  <CardTitle className="text-gray-400">User Activity</CardTitle>
                  <CardDescription>Performance by user</CardDescription>
                </CardHeader>
                <CardContent>
                  <ScrollArea className="h-[600px]">
                    <div className="space-y-4">
                      {userActivity.map((user) => (
                        <div key={user.userId} className="flex items-center justify-between p-4 rounded-lg bg-gray-700/50 border border-blue-500">
                          <div className="flex items-center gap-4">
                            <div className={`w-3 h-3 rounded-full ${
                              user.status === 'active' ? 'bg-green-400' :
                              user.status === 'idle' ? 'bg-yellow-400' : 'bg-red-400'
                            }`} />
                            <div>
                              <p className="font-medium text-gray-400">{user.userName}</p>
                              <p className="text-sm text-gray-500">{user.role}</p>
                            </div>
                          </div>
                          
                          <div className="flex items-center gap-8">
                            <div className="text-center">
                              <p className="font-bold text-gray-400">{user.ordersProcessed}</p>
                              <p className="text-xs text-gray-500">Orders</p>
                            </div>
                            <div className="text-center">
                              <p className="font-bold text-gray-400">{formatTime(user.averageTime)}</p>
                              <p className="text-xs text-gray-500">Avg Time</p>
                            </div>
                            <div className="text-center">
                              <p className="font-bold text-gray-400">
                                {new Date(user.lastActivity).toLocaleTimeString()}
                              </p>
                              <p className="text-xs text-gray-500">Last Activity</p>
                            </div>
                          </div>
                        </div>
                      ))}
                    </div>
                  </ScrollArea>
                </CardContent>
              </Card>
            </TabsContent>

            <TabsContent value="system" className="h-full overflow-auto">
              <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                {/* System Health */}
                <Card className="bg-gray-800 border-blue-500">
                  <CardHeader>
                    <CardTitle className="text-gray-400">System Health</CardTitle>
                    <CardDescription>Real-time system status</CardDescription>
                  </CardHeader>
                  <CardContent className="space-y-4">
                    <div className="flex items-center justify-between">
                      <span className="text-sm text-gray-400">Overall Status</span>
                      <div className="flex items-center gap-2">
                        {systemHealth && getHealthStatusIcon(systemHealth.status)}
                        <span className={`font-medium capitalize ${getHealthStatusColor(systemHealth?.status || 'unknown')}`}>
                          {systemHealth?.status || 'Unknown'}
                        </span>
                      </div>
                    </div>
                    
                    <div className="space-y-3">
                      <div className="flex justify-between items-center">
                        <span className="text-sm text-gray-400">CPU Usage</span>
                        <span className="font-medium text-gray-400">{systemHealth?.cpuUsage || '--'}%</span>
                      </div>
                      <div className="flex justify-between items-center">
                        <span className="text-sm text-gray-400">Memory Usage</span>
                        <span className="font-medium text-gray-400">{systemHealth?.memoryUsage || '--'}%</span>
                      </div>
                      <div className="flex justify-between items-center">
                        <span className="text-sm text-gray-400">Response Time</span>
                        <span className="font-medium text-gray-400">{systemHealth?.responseTime || '--'}ms</span>
                      </div>
                      <div className="flex justify-between items-center">
                        <span className="text-sm text-gray-400">Error Rate</span>
                        <span className="font-medium text-gray-400">{systemHealth?.errorRate || '--'}%</span>
                      </div>
                      <div className="flex justify-between items-center">
                        <span className="text-sm text-gray-400">Active Connections</span>
                        <span className="font-medium text-gray-400">{systemHealth?.activeConnections || '--'}</span>
                      </div>
                      <div className="flex justify-between items-center">
                        <span className="text-sm text-gray-400">DB Connections</span>
                        <span className="font-medium text-gray-400">{systemHealth?.databaseConnections || '--'}</span>
                      </div>
                    </div>
                  </CardContent>
                </Card>

                {/* Alerts */}
                <Card className="bg-gray-800 border-blue-500">
                  <CardHeader>
                    <CardTitle className="text-gray-400">System Alerts</CardTitle>
                    <CardDescription>Recent system alerts and warnings</CardDescription>
                  </CardHeader>
                  <CardContent>
                    <ScrollArea className="h-[300px]">
                      <div className="space-y-3">
                        <div className="flex items-start gap-3 p-3 rounded-lg bg-yellow-500/10 border border-yellow-500/20">
                          <AlertCircle className="w-4 h-4 text-yellow-400 mt-0.5" />
                          <div className="flex-1">
                            <p className="text-sm font-medium text-yellow-400">High Memory Usage</p>
                            <p className="text-xs text-gray-400">Memory usage is above 80%</p>
                            <p className="text-xs text-gray-500">2 minutes ago</p>
                          </div>
                        </div>
                        
                        <div className="flex items-start gap-3 p-3 rounded-lg bg-red-500/10 border border-red-500/20">
                          <AlertCircle className="w-4 h-4 text-red-400 mt-0.5" />
                          <div className="flex-1">
                            <p className="text-sm font-medium text-red-400">Database Connection Timeout</p>
                            <p className="text-xs text-gray-400">Several database queries timed out</p>
                            <p className="text-xs text-gray-500">5 minutes ago</p>
                          </div>
                        </div>
                        
                        <div className="flex items-start gap-3 p-3 rounded-lg bg-green-500/10 border border-green-500/20">
                          <CheckCircle className="w-4 h-4 text-green-400 mt-0.5" />
                          <div className="flex-1">
                            <p className="text-sm font-medium text-green-400">System Recovered</p>
                            <p className="text-xs text-gray-400">All systems are now operational</p>
                            <p className="text-xs text-gray-500">10 minutes ago</p>
                          </div>
                        </div>
                      </div>
                    </ScrollArea>
                  </CardContent>
                </Card>
              </div>
            </TabsContent>
          </div>
        </Tabs>
      </div>
    </div>
  )
}