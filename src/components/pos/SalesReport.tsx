'use client'

import { useState, useEffect } from 'react'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
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

  useEffect(() => {
    loadSalesData()
  }, [])

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
      {/* Stats Overview */}
      {stats && (
        <div className="grid sm:grid-cols-2 lg:grid-cols-4 gap-4">
          <StatCard
            title="Total Revenue"
            value={stats.totalRevenue}
            icon={DollarSign}
            prefix="$"
            trend={12.5}
          />
          <StatCard
            title="Total Sales"
            value={stats.totalSales}
            icon={ShoppingCart}
            trend={8.2}
          />
          <StatCard
            title="Transactions"
            value={stats.totalTransactions}
            icon={Receipt}
            trend={5.1}
          />
          <StatCard
            title="Customers"
            value={stats.totalCustomers}
            icon={Users}
            trend={3.7}
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
              <CardDescription>View and manage your sales transactions</CardDescription>
            </CardHeader>
            <CardContent>
              <ScrollArea className="h-[calc(100vh-400px)]">
                {sales.length === 0 ? (
                  <div className="text-center py-12 text-muted-foreground">
                    <Receipt className="w-12 h-12 mx-auto mb-4 opacity-50" />
                    <p>No sales recorded yet</p>
                  </div>
                ) : (
                  <div className="space-y-3">
                    {sales.map((sale) => (
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
