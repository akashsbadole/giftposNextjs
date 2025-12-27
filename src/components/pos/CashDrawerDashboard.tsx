'use client'

import { useState, useEffect } from 'react'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { useToast } from '@/hooks/use-toast'
import { useSettings } from '@/lib/settings-context'
import ShiftManager from './ShiftManager'
import CashCountInterface from './CashCountInterface'
import ZReportViewer from './ZReportViewer'
import { 
  Vault, 
  Calculator, 
  FileText, 
  TrendingUp,
  Clock,
  DollarSign,
  AlertTriangle,
  CheckCircle,
  RefreshCw
} from 'lucide-react'

interface CashTransaction {
  id: string
  type: 'sale' | 'cash_in' | 'cash_out' | 'count' | 'adjustment' | 'refund'
  amount: number
  reason?: string
  createdAt: string
}

interface Shift {
  id: string
  employeeId: string
  startTime: string
  endTime?: string
  startingCash: number
  expectedCash: number
  actualCash?: number
  cashVariance?: number
  status: 'active' | 'closed' | 'suspended' | 'break'
  notes?: string
  isBreak: boolean
  employee: {
    id: string
    name: string
    email: string
    role: string
  }
  metrics: {
    totalSales: number
    totalCashIn: number
    totalCashOut: number
    expectedCash: number
    transactionCount: number
  }
}

interface CashCount {
  id: string
  countType: 'opening' | 'closing' | 'mid_shift' | 'variance_investigation'
  expectedAmount: number
  actualAmount: number
  variance: number
  status: 'pending' | 'approved' | 'rejected'
  createdAt: string
}

interface CashDrawerDashboardProps {
  employeeId: string
  storeId: string
  onShiftChange?: (shift: Shift | null) => void
}

export default function CashDrawerDashboard({ 
  employeeId, 
  storeId, 
  onShiftChange 
}: CashDrawerDashboardProps) {
  const { toast } = useToast()
  const { formatCurrency } = useSettings()
  const [currentShift, setCurrentShift] = useState<Shift | null>(null)
  const [recentTransactions, setRecentTransactions] = useState<CashTransaction[]>([])
  const [recentCounts, setRecentCounts] = useState<CashCount[]>([])
  const [activeTab, setActiveTab] = useState('overview')
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    loadDashboardData()
  }, [currentShift?.id])

  const loadDashboardData = async () => {
    if (!currentShift?.id) {
      setLoading(false)
      return
    }

    try {
      // Load recent transactions
      const transactionsResponse = await fetch(
        `/api/pos/shifts/${currentShift.id}/cash-transactions?limit=10`
      )
      if (transactionsResponse.ok) {
        const transactions = await transactionsResponse.json()
        setRecentTransactions(transactions)
      }

      // Load recent counts
      const countsResponse = await fetch(
        `/api/pos/shifts/${currentShift.id}/cash-counts?limit=5`
      )
      if (countsResponse.ok) {
        const counts = await countsResponse.json()
        setRecentCounts(counts)
      }
    } catch (error) {
      console.error('Error loading dashboard data:', error)
    } finally {
      setLoading(false)
    }
  }

  const handleShiftChange = (shift: Shift | null) => {
    setCurrentShift(shift)
    onShiftChange?.(shift)
    if (shift) {
      loadDashboardData()
    } else {
      setRecentTransactions([])
      setRecentCounts([])
    }
  }

  const getTransactionIcon = (type: string) => {
    switch (type) {
      case 'sale': return DollarSign
      case 'cash_in': return TrendingUp
      case 'cash_out': return AlertTriangle
      default: return RefreshCw
    }
  }

  const getTransactionColor = (type: string) => {
    switch (type) {
      case 'sale': return 'text-green-400'
      case 'cash_in': return 'text-blue-400'
      case 'cash_out': return 'text-red-400'
      default: return 'text-gray-400'
    }
  }

  const getCountStatusColor = (status: string) => {
    switch (status) {
      case 'approved': return 'text-green-400'
      case 'rejected': return 'text-red-400'
      default: return 'text-yellow-400'
    }
  }

  if (!currentShift) {
    return (
      <div className="space-y-6">
        <div className="text-center py-12">
          <Vault className="w-16 h-16 mx-auto mb-4 text-gray-600" />
          <h2 className="text-2xl font-semibold text-gray-400 mb-2">Cash Drawer Management</h2>
          <p className="text-gray-500 mb-6">
            Start a shift to begin managing cash drawer operations
          </p>
          <ShiftManager 
            employeeId={employeeId} 
            storeId={storeId} 
            onShiftChange={handleShiftChange}
          />
        </div>
      </div>
    )
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-bold text-gray-300 flex items-center gap-2">
            <Vault className="w-6 h-6" />
            Cash Drawer Dashboard
          </h2>
          <p className="text-gray-400">
            Active shift: {currentShift.employee.name} • 
            Started {new Date(currentShift.startTime).toLocaleTimeString()}
          </p>
        </div>
        <Badge variant={currentShift.status === 'active' ? 'default' : 'secondary'}>
          {currentShift.status}
        </Badge>
      </div>

      <Tabs value={activeTab} onValueChange={setActiveTab} className="space-y-4">
        <TabsList className="grid w-full grid-cols-4 bg-gray-800 border border-blue-500">
          <TabsTrigger 
            value="overview" 
            className="data-[state=active]:bg-blue-600 data-[state=active]:text-white"
          >
            <TrendingUp className="w-4 h-4 mr-2" />
            Overview
          </TabsTrigger>
          <TabsTrigger 
            value="shift" 
            className="data-[state=active]:bg-blue-600 data-[state=active]:text-white"
          >
            <Clock className="w-4 h-4 mr-2" />
            Shift
          </TabsTrigger>
          <TabsTrigger 
            value="count" 
            className="data-[state=active]:bg-blue-600 data-[state=active]:text-white"
          >
            <Calculator className="w-4 h-4 mr-2" />
            Count
          </TabsTrigger>
          <TabsTrigger 
            value="reports" 
            className="data-[state=active]:bg-blue-600 data-[state=active]:text-white"
          >
            <FileText className="w-4 h-4 mr-2" />
            Reports
          </TabsTrigger>
        </TabsList>

        <TabsContent value="overview" className="space-y-4">
          <div className="grid lg:grid-cols-3 gap-6">
            {/* Cash Summary */}
            <Card className="bg-gray-900 border-blue-500">
              <CardHeader>
                <CardTitle className="text-gray-300">Cash Summary</CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="grid grid-cols-2 gap-4 text-center">
                  <div>
                    <div className="text-2xl font-bold text-green-400">
                      {formatCurrency(currentShift.metrics.totalSales)}
                    </div>
                    <div className="text-sm text-gray-400">Total Sales</div>
                  </div>
                  <div>
                    <div className="text-2xl font-bold text-blue-400">
                      {formatCurrency(currentShift.metrics.expectedCash)}
                    </div>
                    <div className="text-sm text-gray-400">Expected Cash</div>
                  </div>
                </div>
                <Separator className="border-blue-500" />
                <div className="space-y-2">
                  <div className="flex justify-between">
                    <span className="text-gray-400">Starting Cash:</span>
                    <span className="text-gray-300">{formatCurrency(currentShift.startingCash)}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-gray-400">Cash In:</span>
                    <span className="text-green-400">{formatCurrency(currentShift.metrics.totalCashIn)}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-gray-400">Cash Out:</span>
                    <span className="text-red-400">{formatCurrency(currentShift.metrics.totalCashOut)}</span>
                  </div>
                </div>
              </CardContent>
            </Card>

            {/* Recent Transactions */}
            <Card className="bg-gray-900 border-blue-500 lg:col-span-2">
              <CardHeader>
                <CardTitle className="text-gray-300">Recent Transactions</CardTitle>
                <CardDescription className="text-gray-400">
                  Latest cash movements
                </CardDescription>
              </CardHeader>
              <CardContent>
                {loading ? (
                  <div className="space-y-3">
                    {[...Array(5)].map((_, i) => (
                      <div key={i} className="animate-pulse flex items-center gap-3">
                        <div className="h-8 w-8 bg-gray-700 rounded"></div>
                        <div className="flex-1 space-y-2">
                          <div className="h-4 bg-gray-700 rounded w-3/4"></div>
                          <div className="h-3 bg-gray-700 rounded w-1/2"></div>
                        </div>
                      </div>
                    ))}
                  </div>
                ) : recentTransactions.length === 0 ? (
                  <div className="text-center py-8">
                    <RefreshCw className="w-8 h-8 mx-auto mb-2 text-gray-600" />
                    <p className="text-gray-400">No transactions yet</p>
                  </div>
                ) : (
                  <div className="space-y-3 max-h-64 overflow-y-auto">
                    {recentTransactions.map((transaction) => {
                      const Icon = getTransactionIcon(transaction.type)
                      return (
                        <div key={transaction.id} className="flex items-center gap-3 p-3 bg-gray-800 rounded-lg">
                          <Icon className={`w-5 h-5 ${getTransactionColor(transaction.type)}`} />
                          <div className="flex-1">
                            <div className="flex items-center justify-between">
                              <span className="font-medium text-gray-300 capitalize">
                                {transaction.type.replace('_', ' ')}
                              </span>
                              <span className={`font-semibold ${getTransactionColor(transaction.type)}`}>
                                {transaction.type === 'cash_out' ? '-' : '+'}
                                {formatCurrency(transaction.amount)}
                              </span>
                            </div>
                            <div className="text-sm text-gray-400">
                              {transaction.reason || 'No reason provided'}
                            </div>
                          </div>
                          <div className="text-xs text-gray-500">
                            {new Date(transaction.createdAt).toLocaleTimeString()}
                          </div>
                        </div>
                      )
                    })}
                  </div>
                )}
              </CardContent>
            </Card>
          </div>

          {/* Recent Cash Counts */}
          <Card className="bg-gray-900 border-blue-500">
            <CardHeader>
              <CardTitle className="text-gray-300">Recent Cash Counts</CardTitle>
              <CardDescription className="text-gray-400">
                Latest cash counting activities
              </CardDescription>
            </CardHeader>
            <CardContent>
              {loading ? (
                <div className="space-y-3">
                  {[...Array(3)].map((_, i) => (
                    <div key={i} className="animate-pulse flex items-center gap-3">
                      <div className="h-10 w-10 bg-gray-700 rounded"></div>
                      <div className="flex-1 space-y-2">
                        <div className="h-4 bg-gray-700 rounded w-1/2"></div>
                        <div className="h-3 bg-gray-700 rounded w-1/4"></div>
                      </div>
                    </div>
                  ))}
                </div>
              ) : recentCounts.length === 0 ? (
                <div className="text-center py-8">
                  <Calculator className="w-8 h-8 mx-auto mb-2 text-gray-600" />
                  <p className="text-gray-400">No cash counts recorded</p>
                </div>
              ) : (
                <div className="space-y-3">
                  {recentCounts.map((count) => (
                    <div key={count.id} className="flex items-center gap-3 p-3 bg-gray-800 rounded-lg">
                      <Calculator className="w-5 h-5 text-blue-400" />
                      <div className="flex-1">
                        <div className="flex items-center justify-between">
                          <span className="font-medium text-gray-300 capitalize">
                            {count.countType.replace('_', ' ')}
                          </span>
                          <div className="flex items-center gap-2">
                            <span className="text-gray-300">{formatCurrency(count.actualAmount)}</span>
                            <Badge 
                              variant="outline" 
                              className={`text-xs ${getCountStatusColor(count.status)}`}
                            >
                              {count.status}
                            </Badge>
                          </div>
                        </div>
                        <div className="text-sm text-gray-400">
                          Expected: {formatCurrency(count.expectedAmount)} • 
                          Variance: {formatCurrency(count.variance)}
                        </div>
                      </div>
                      <div className="text-xs text-gray-500">
                        {new Date(count.createdAt).toLocaleDateString()}
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="shift" className="space-y-4">
          <ShiftManager 
            employeeId={employeeId} 
            storeId={storeId} 
            onShiftChange={handleShiftChange}
          />
        </TabsContent>

        <TabsContent value="count" className="space-y-4">
          <div className="grid lg:grid-cols-3 gap-6">
            <div className="lg:col-span-2">
              <CashCountInterface
                shiftId={currentShift.id}
                expectedAmount={currentShift.metrics.expectedCash}
                countType="mid_shift"
                onCountComplete={(count) => {
                  setRecentCounts(prev => [count, ...prev])
                  toast({
                    title: 'Cash count completed',
                    description: 'Count has been recorded successfully',
                  })
                }}
              />
            </div>
            <div>
              <Card className="bg-gray-900 border-blue-500">
                <CardHeader>
                  <CardTitle className="text-gray-300">Quick Actions</CardTitle>
                </CardHeader>
                <CardContent className="space-y-3">
                  <Button 
                    variant="outline" 
                    className="w-full border-green-500 text-green-400 hover:bg-green-500/10"
                    onClick={() => {
                      // Handle opening count
                      toast({
                        title: 'Opening Count',
                        description: 'Use the cash count interface to count your opening cash',
                      })
                    }}
                  >
                    <Calculator className="w-4 h-4 mr-2" />
                    Opening Count
                  </Button>
                  <Button 
                    variant="outline" 
                    className="w-full border-orange-500 text-orange-400 hover:bg-orange-500/10"
                    onClick={() => {
                      // Handle variance investigation
                      toast({
                        title: 'Variance Investigation',
                        description: 'Count cash to investigate any discrepancies',
                      })
                    }}
                  >
                    <AlertTriangle className="w-4 h-4 mr-2" />
                    Variance Investigation
                  </Button>
                </CardContent>
              </Card>
            </div>
          </div>
        </TabsContent>

        <TabsContent value="reports" className="space-y-4">
          <ZReportViewer 
            storeId={storeId} 
            shiftId={currentShift.id}
            onGenerateReport={(report) => {
              toast({
                title: 'Report generated',
                description: 'Z-report has been created successfully',
              })
            }}
          />
        </TabsContent>
      </Tabs>
    </div>
  )
}