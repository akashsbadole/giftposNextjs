'use client'

import { useState, useEffect } from 'react'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { ScrollArea } from '@/components/ui/scroll-area'
import { Badge } from '@/components/ui/badge'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { Separator } from '@/components/ui/separator'
import {
  Dialog,
  DialogContent,
  DialogDescription,
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
import { Button } from '@/components/ui/button'
import { useToast } from '@/hooks/use-toast'
import {
  DollarSign,
  ShoppingCart,
  TrendingUp,
  Users,
  Receipt,
  Package,
  ArrowUp,
  ArrowDown,
  Calendar,
  Filter,
} from 'lucide-react'

interface Sale {
  id: string
  invoiceNumber: string
  subtotal: number
  tax: number
  discount: number
  total: number
  paymentMethod: string
  status: string
  createdAt: string
  customer?: {
    id: string
    name: string
  }
  employee?: {
    name: string
  }
  items: {
    quantity: number
    price: number
    subtotal: number
    product: {
      name: string
    }
  }[]
}

interface Stats {
  totalSales: number
  totalRevenue: number
  totalTransactions: number
  totalCustomers: number
  topProducts: { name: string; quantity: number; revenue: number }[]
  salesByPayment: { method: string; count: number; total: number }[]
}

export default function SalesReport() {
  const { toast } = useToast()
  const [sales, setSales] = useState<Sale[]>([])
  const [stats, setStats] = useState<Stats | null>(null)
  const [loading, setLoading] = useState(true)
  const [selectedSale, setSelectedSale] = useState<Sale | null>(null)
  const [dateFilter, setDateFilter] = useState<'today' | 'week' | 'month' | 'quarter' | 'year' | 'custom'>('month')
  const [customStartDate, setCustomStartDate] = useState('')
  const [customEndDate, setCustomEndDate] = useState('')
  const [filteredSales, setFilteredSales] = useState<Sale[]>([])
  const [filteredStats, setFilteredStats] = useState<Stats | null>(null)
  const [previousPeriodStats, setPreviousPeriodStats] = useState<Stats | null>(null)

  useEffect(() => {
    loadSalesData()
  }, [])

  useEffect(() => {
    filterSalesData()
  }, [sales, dateFilter, customStartDate, customEndDate])

  const loadSalesData = async () => {
    try {
      const [salesRes, statsRes] = await Promise.all([
        fetch('/api/pos/sales'),
        fetch('/api/pos/sales/stats'),
      ])

      if (salesRes.ok) {
        const data = await salesRes.json()
        setSales(data)
      }

      if (statsRes.ok) {
        const data = await statsRes.json()
        setStats(data)
      }
    } catch (error) {
      console.error('Error loading sales data:', error)
    } finally {
      setLoading(false)
    }
  }

  const getDateRange = (filter: string) => {
    const now = new Date()
    const start = new Date()
    const previousStart = new Date()
    const previousEnd = new Date()

    switch (filter) {
      case 'today':
        start.setHours(0, 0, 0, 0)
        previousStart.setDate(now.getDate() - 1)
        previousStart.setHours(0, 0, 0, 0)
        previousEnd.setDate(now.getDate() - 1)
        previousEnd.setHours(23, 59, 59, 999)
        break
      case 'week':
        start.setDate(now.getDate() - 7)
        previousStart.setDate(now.getDate() - 14)
        previousEnd.setDate(now.getDate() - 8)
        break
      case 'month':
        start.setMonth(now.getMonth() - 1)
        previousStart.setMonth(now.getMonth() - 2)
        previousEnd.setMonth(now.getMonth() - 1)
        previousEnd.setDate(0) // Last day of previous month
        break
      case 'quarter':
        start.setMonth(now.getMonth() - 3)
        previousStart.setMonth(now.getMonth() - 6)
        previousEnd.setMonth(now.getMonth() - 3)
        previousEnd.setDate(0)
        break
      case 'year':
        start.setFullYear(now.getFullYear() - 1)
        previousStart.setFullYear(now.getFullYear() - 2)
        previousEnd.setFullYear(now.getFullYear() - 1)
        previousEnd.setMonth(11, 31)
        break
      case 'custom':
        if (!customStartDate || !customEndDate) {
          return { currentStart: null, currentEnd: null, previousStart: null, previousEnd: null }
        }
        return {
          currentStart: new Date(customStartDate),
          currentEnd: new Date(customEndDate),
          previousStart: null,
          previousEnd: null,
        }
      default:
        return { currentStart: null, currentEnd: null, previousStart: null, previousEnd: null }
    }

    if (filter === 'custom') {
      if (!customStartDate || !customEndDate) {
        return { currentStart: null, currentEnd: null, previousStart: null, previousEnd: null }
      }
      return {
        currentStart: new Date(customStartDate),
        currentEnd: new Date(customEndDate),
        previousStart: null,
        previousEnd: null,
      }
    }

    return {
      currentStart: start,
      currentEnd: now,
      previousStart,
      previousEnd,
    }
  }

  const filterSalesData = () => {
    if (sales.length === 0) return

    const { currentStart, currentEnd, previousStart, previousEnd } = getDateRange(dateFilter)

    // Filter current period sales
    const currentSales = sales.filter(sale => {
      if (!currentStart || !currentEnd) return false
      const saleDate = new Date(sale.createdAt)
      return saleDate >= currentStart && saleDate <= currentEnd
    })

    // Filter previous period sales for comparison (skip for custom dates)
    const previousSales = dateFilter !== 'custom' && previousStart && previousEnd
      ? sales.filter(sale => {
          const saleDate = new Date(sale.createdAt)
          return saleDate >= previousStart && saleDate <= previousEnd
        })
      : []

    setFilteredSales(currentSales)

    // Calculate filtered stats
    const filteredStats = calculateStats(currentSales)
    const previousStats = calculateStats(previousSales)
    
    setFilteredStats(filteredStats)
    setPreviousPeriodStats(previousStats)
  }

  const calculateStats = (salesData: Sale[]): Stats => {
    const totalSales = salesData.length
    const totalRevenue = salesData.reduce((sum, sale) => sum + sale.total, 0)
    const totalCustomers = new Set(salesData.map(sale => sale.customer?.id).filter(Boolean)).size
    const totalTransactions = totalSales
    
    // Calculate top products
    const productSales: { [key: string]: { quantity: number; revenue: number; name: string } } = {}
    salesData.forEach(sale => {
      sale.items.forEach(item => {
        const key = item.product.name
        if (!productSales[key]) {
          productSales[key] = { quantity: 0, revenue: 0, name: key }
        }
        productSales[key].quantity += item.quantity
        productSales[key].revenue += item.subtotal
      })
    })
    
    const topProducts = Object.values(productSales)
      .sort((a, b) => b.revenue - a.revenue)
      .slice(0, 10)

    // Calculate payment method breakdown
    const paymentMethods: { [key: string]: { count: number; total: number } } = {}
    salesData.forEach(sale => {
      const method = sale.paymentMethod
      if (!paymentMethods[method]) {
        paymentMethods[method] = { count: 0, total: 0 }
      }
      paymentMethods[method].count++
      paymentMethods[method].total += sale.total
    })

    const salesByPayment = Object.entries(paymentMethods).map(([method, data]) => ({
      method,
      ...data,
    }))

    return {
      totalSales,
      totalRevenue,
      totalTransactions: totalSales,
      totalCustomers,
      topProducts,
      salesByPayment,
    }
  }

  const calculateTrend = (current: number, previous: number): number => {
    if (previous === 0) return current > 0 ? 100 : 0
    return ((current - previous) / previous) * 100
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center h-[600px]">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary"></div>
      </div>
    )
  }

  const StatCard = ({
    title,
    value,
    icon: Icon,
    trend,
    prefix = '',
    suffix = '',
  }: {
    title: string
    value: number | string
    icon: any
    trend?: number
    prefix?: string
    suffix?: string
  }) => (
    <Card>
      <CardContent className="p-6">
        <div className="flex items-center justify-between">
          <div>
            <p className="text-sm font-medium text-muted-foreground">{title}</p>
            <p className="text-2xl font-bold mt-2">
              {prefix}{typeof value === 'number' ? value.toLocaleString() : value}{suffix}
            </p>
            {trend !== undefined && (
              <div className="flex items-center mt-2 text-sm">
                {trend >= 0 ? (
                  <ArrowUp className="w-4 h-4 text-green-600 mr-1" />
                ) : (
                  <ArrowDown className="w-4 h-4 text-red-600 mr-1" />
                )}
                <span className={trend >= 0 ? 'text-green-600' : 'text-red-600'}>
                  {Math.abs(trend)}%
                </span>
                <span className="text-muted-foreground ml-1">from last period</span>
              </div>
            )}
          </div>
          <div className="p-3 bg-primary/10 rounded-lg">
            <Icon className="w-6 h-6 text-primary" />
          </div>
        </div>
      </CardContent>
    </Card>
  )

  return (
    <div className="space-y-6">
      {/* Date Filter Controls */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Filter className="w-5 h-5" />
            Time Filter
          </CardTitle>
          <CardDescription>Filter sales data by time period</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="flex flex-col sm:flex-row gap-4">
            <Select value={dateFilter} onValueChange={(value: any) => setDateFilter(value)}>
              <SelectTrigger className="w-[200px]">
                <Calendar className="w-4 h-4 mr-2" />
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="today">Today</SelectItem>
                <SelectItem value="week">Last 7 days</SelectItem>
                <SelectItem value="month">Last 30 days</SelectItem>
                <SelectItem value="quarter">Last 3 months</SelectItem>
                <SelectItem value="year">Last year</SelectItem>
                <SelectItem value="custom">Custom range</SelectItem>
              </SelectContent>
            </Select>
            
            {dateFilter === 'custom' && (
              <div className="flex gap-2">
                <Input
                  type="date"
                  value={customStartDate}
                  onChange={(e) => setCustomStartDate(e.target.value)}
                  placeholder="Start date"
                />
                <Input
                  type="date"
                  value={customEndDate}
                  onChange={(e) => setCustomEndDate(e.target.value)}
                  placeholder="End date"
                />
              </div>
            )}
          </div>
        </CardContent>
      </Card>

      {/* Stats Overview */}
      {filteredStats && (
        <div className="grid sm:grid-cols-2 lg:grid-cols-4 gap-4">
          <StatCard
            title="Total Revenue"
            value={filteredStats.totalRevenue}
            icon={DollarSign}
            prefix="$"
            trend={calculateTrend(
              filteredStats.totalRevenue,
              previousPeriodStats?.totalRevenue || 0
            )}
          />
          <StatCard
            title="Total Sales"
            value={filteredStats.totalSales}
            icon={ShoppingCart}
            trend={calculateTrend(
              filteredStats.totalSales,
              previousPeriodStats?.totalSales || 0
            )}
          />
          <StatCard
            title="Transactions"
            value={filteredStats.totalTransactions}
            icon={Receipt}
            trend={calculateTrend(
              filteredStats.totalTransactions,
              previousPeriodStats?.totalTransactions || 0
            )}
          />
          <StatCard
            title="Customers"
            value={filteredStats.totalCustomers}
            icon={Users}
            trend={calculateTrend(
              filteredStats.totalCustomers,
              previousPeriodStats?.totalCustomers || 0
            )}
          />
        </div>
      )}

      <Tabs defaultValue="sales" className="w-full">
        <TabsList>
          <TabsTrigger value="sales">Sales History</TabsTrigger>
          <TabsTrigger value="products">Top Products</TabsTrigger>
          <TabsTrigger value="payment">Payment Methods</TabsTrigger>
        </TabsList>

        <TabsContent value="sales" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle>Recent Sales</CardTitle>
              <CardDescription>
                View and manage your sales transactions
                {filteredSales.length > 0 && (
                  <span className="ml-2">({filteredSales.length} sales in selected period)</span>
                )}
              </CardDescription>
            </CardHeader>
            <CardContent>
              <ScrollArea className="h-[calc(100vh-400px)]">
                {filteredSales.length === 0 ? (
                  <div className="text-center py-12 text-muted-foreground">
                    <Receipt className="w-12 h-12 mx-auto mb-4 opacity-50" />
                    <p>No sales recorded in this period</p>
                    <p className="text-sm mt-1">Try selecting a different time range</p>
                  </div>
                ) : (
                  <div className="space-y-3">
                    {filteredSales.map((sale) => (
                      <Card
                        key={sale.id}
                        className="hover:shadow-md transition-shadow cursor-pointer"
                        onClick={() => setSelectedSale(sale)}
                      >
                        <CardContent className="p-4">
                          <div className="flex items-start justify-between">
                            <div className="flex-1">
                              <div className="flex items-center gap-2 mb-2">
                                <Badge variant="outline">{sale.invoiceNumber}</Badge>
                                <Badge
                                  variant={
                                    sale.status === 'completed'
                                      ? 'default'
                                      : sale.status === 'pending'
                                      ? 'secondary'
                                      : 'destructive'
                                  }
                                >
                                  {sale.status}
                                </Badge>
                              </div>
                              <div className="space-y-1 text-sm">
                                <p className="font-medium text-lg">${sale.total.toFixed(2)}</p>
                                <p className="text-muted-foreground">
                                  {sale.items.length} {sale.items.length === 1 ? 'item' : 'items'}
                                </p>
                                {sale.customer && (
                                  <p className="text-muted-foreground">
                                    Customer: {sale.customer.name}
                                  </p>
                                )}
                                <p className="text-xs text-muted-foreground">
                                  {new Date(sale.createdAt).toLocaleString()}
                                </p>
                              </div>
                            </div>
                            <Badge
                              variant={
                                sale.paymentMethod === 'cash'
                                  ? 'secondary'
                                  : sale.paymentMethod === 'card'
                                  ? 'default'
                                  : 'outline'
                              }
                            >
                              {sale.paymentMethod}
                            </Badge>
                          </div>
                        </CardContent>
                      </Card>
                    ))}
                  </div>
                )}
              </ScrollArea>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="products" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle>Top Products</CardTitle>
              <CardDescription>Best selling products by quantity and revenue</CardDescription>
            </CardHeader>
            <CardContent>
              <ScrollArea className="h-[calc(100vh-400px)]">
                {!stats?.topProducts || stats.topProducts.length === 0 ? (
                  <div className="text-center py-12 text-muted-foreground">
                    <Package className="w-12 h-12 mx-auto mb-4 opacity-50" />
                    <p>No product sales data yet</p>
                  </div>
                ) : (
                  <div className="space-y-3">
                    {stats.topProducts.map((product, index) => (
                      <Card key={index}>
                        <CardContent className="p-4">
                          <div className="flex items-center justify-between">
                            <div>
                              <h4 className="font-medium">{product.name}</h4>
                              <p className="text-sm text-muted-foreground">
                                {product.quantity} sold
                              </p>
                            </div>
                            <div className="text-right">
                              <p className="font-semibold text-lg">${product.revenue.toFixed(2)}</p>
                              <p className="text-sm text-muted-foreground">revenue</p>
                            </div>
                          </div>
                        </CardContent>
                      </Card>
                    ))}
                  </div>
                )}
              </ScrollArea>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="payment" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle>Payment Methods</CardTitle>
              <CardDescription>Breakdown of sales by payment method</CardDescription>
            </CardHeader>
            <CardContent>
              <ScrollArea className="h-[calc(100vh-400px)]">
                {!stats?.salesByPayment || stats.salesByPayment.length === 0 ? (
                  <div className="text-center py-12 text-muted-foreground">
                    <DollarSign className="w-12 h-12 mx-auto mb-4 opacity-50" />
                    <p>No payment data yet</p>
                  </div>
                ) : (
                  <div className="space-y-3">
                    {stats.salesByPayment.map((payment, index) => (
                      <Card key={index}>
                        <CardContent className="p-4">
                          <div className="flex items-center justify-between">
                            <div>
                              <h4 className="font-medium capitalize">{payment.method}</h4>
                              <p className="text-sm text-muted-foreground">
                                {payment.count} {payment.count === 1 ? 'transaction' : 'transactions'}
                              </p>
                            </div>
                            <div className="text-right">
                              <p className="font-semibold text-lg">${payment.total.toFixed(2)}</p>
                              <p className="text-sm text-muted-foreground">total</p>
                            </div>
                          </div>
                        </CardContent>
                      </Card>
                    ))}
                  </div>
                )}
              </ScrollArea>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>

      {/* Sale Detail Dialog */}
      {selectedSale && (
        <Dialog
          open={!!selectedSale}
          onOpenChange={() => setSelectedSale(null)}
        >
          <DialogContent className="sm:max-w-lg">
            <DialogHeader>
              <DialogTitle>Receipt Details</DialogTitle>
              <DialogDescription>Invoice #{selectedSale.invoiceNumber}</DialogDescription>
            </DialogHeader>

            <div className="space-y-4 py-4">
              <div className="flex justify-between text-sm">
                <span className="text-muted-foreground">Date</span>
                <span>{new Date(selectedSale.createdAt).toLocaleString()}</span>
              </div>

              {selectedSale.customer && (
                <div className="flex justify-between text-sm">
                  <span className="text-muted-foreground">Customer</span>
                  <span>{selectedSale.customer.name}</span>
                </div>
              )}

              {selectedSale.employee && (
                <div className="flex justify-between text-sm">
                  <span className="text-muted-foreground">Cashier</span>
                  <span>{selectedSale.employee.name}</span>
                </div>
              )}

              <Separator />

              <div className="space-y-2">
                <h4 className="font-medium">Items</h4>
                {selectedSale.items.map((item, index) => (
                  <div key={index} className="flex justify-between text-sm">
                    <div>
                      <span>{item.product.name}</span>
                      <span className="text-muted-foreground ml-2">
                        x{item.quantity}
                      </span>
                    </div>
                    <span>${item.subtotal.toFixed(2)}</span>
                  </div>
                ))}
              </div>

              <Separator />

              <div className="space-y-2">
                <div className="flex justify-between text-sm">
                  <span>Subtotal</span>
                  <span>${selectedSale.subtotal.toFixed(2)}</span>
                </div>
                <div className="flex justify-between text-sm">
                  <span>Tax</span>
                  <span>${selectedSale.tax.toFixed(2)}</span>
                </div>
                {selectedSale.discount > 0 && (
                  <div className="flex justify-between text-sm">
                    <span>Discount</span>
                    <span>-${selectedSale.discount.toFixed(2)}</span>
                  </div>
                )}
                <Separator />
                <div className="flex justify-between font-bold">
                  <span>Total</span>
                  <span>${selectedSale.total.toFixed(2)}</span>
                </div>
              </div>

              <div className="flex justify-between items-center">
                <span className="text-sm text-muted-foreground">Payment Method</span>
                <Badge variant="outline" className="capitalize">
                  {selectedSale.paymentMethod}
                </Badge>
              </div>
            </div>
          </DialogContent>
        </Dialog>
      )}
    </div>
  )
}
