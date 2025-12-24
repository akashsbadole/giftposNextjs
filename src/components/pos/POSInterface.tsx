'use client'

import { useState, useEffect } from 'react'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Button } from '@/components/ui/button'
import { ScrollArea } from '@/components/ui/scroll-area'
import { Badge } from '@/components/ui/badge'
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
import { useToast } from '@/hooks/use-toast'
import { Search, Plus, Minus, Trash2, Receipt, DollarSign, CreditCard, Smartphone, Database, Package, ShoppingCart } from 'lucide-react'
import ReceiptDialog from '@/components/pos/ReceiptDialog'
import React from 'react';

// Types
interface Product {
  id: string
  name: string
  sku: string
  barcode?: string
  price: number
  stock: number
  category: {
    id: string
    name: string
    color?: string
  }
}

interface CartItem extends Product {
  quantity: number
  subtotal: number
}

interface Customer {
  id: string
  name: string
  email?: string
  phone?: string
  points: number
}

export default function POSInterface() {
  const { toast } = useToast()
  const [products, setProducts] = useState<Product[]>([])
  const [categories, setCategories] = useState<any[]>([])
  const [customers, setCustomers] = useState<Customer[]>([])
  const [cart, setCart] = useState<CartItem[]>([])
  const [selectedCustomer, setSelectedCustomer] = useState<Customer | null>(null)
  const [searchTerm, setSearchTerm] = useState('')
  const [selectedCategory, setSelectedCategory] = useState<string>('all')
  const [loading, setLoading] = useState(true)
  const [checkoutOpen, setCheckoutOpen] = useState(false)
  const [paymentMethod, setPaymentMethod] = useState<'cash' | 'card' | 'digital'>('cash')
  const [tenderAmount, setTenderAmount] = useState('')
  const [store, setStore] = useState<any>(null)
  const [receiptSale, setReceiptSale] = useState<any>(null)
  const [receiptOpen, setReceiptOpen] = useState(false)

  // Load data
  useEffect(() => {
    loadInitialData()
  }, [])

  const loadInitialData = async () => {
    try {
      const [productsRes, categoriesRes, customersRes, storeRes] = await Promise.all([
        fetch('/api/pos/products'),
        fetch('/api/pos/categories'),
        fetch('/api/pos/customers'),
        fetch('/api/pos/store/settings'),
      ])

      if (productsRes.ok) {
        const productsData = await productsRes.json()
        setProducts(productsData)
      }

      if (categoriesRes.ok) {
        const categoriesData = await categoriesRes.json()
        setCategories(categoriesData)
      }

      if (customersRes.ok) {
        const customersData = await customersRes.json()
        setCustomers(customersData)
      }

      if (storeRes.ok) {
        const storeData = await storeRes.json()
        setStore(storeData)
      }
    } catch (error) {
      console.error('Error loading data:', error)
    } finally {
      setLoading(false)
    }
  }

  // Filter products
  const filteredProducts = products.filter((product) => {
    const matchesSearch =
      product.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
      product.sku.toLowerCase().includes(searchTerm.toLowerCase()) ||
      product.barcode?.toLowerCase().includes(searchTerm.toLowerCase())

    const matchesCategory =
      selectedCategory === 'all' || product.category.id === selectedCategory

    return matchesSearch && matchesCategory && product.stock > 0
  })

  // Add to cart
  const addToCart = (product: Product) => {
    setCart((prevCart) => {
      const existingItem = prevCart.find((item) => item.id === product.id)

      if (existingItem) {
        if (existingItem.quantity >= product.stock) {
          toast({
            title: 'Stock limit reached',
            description: 'Cannot add more items than available in stock',
            variant: 'destructive',
          })
          return prevCart
        }
        return prevCart.map((item) =>
          item.id === product.id
            ? { ...item, quantity: item.quantity + 1, subtotal: (item.quantity + 1) * item.price }
            : item
        )
      }

      return [...prevCart, { ...product, quantity: 1, subtotal: product.price }]
    })
  }

  // Update quantity
  const updateQuantity = (productId: string, delta: number) => {
    setCart((prevCart) =>
      prevCart
        .map((item) => {
          if (item.id !== productId) return item

          const newQuantity = Math.max(0, Math.min(item.quantity + delta, item.stock))
          return { ...item, quantity: newQuantity, subtotal: newQuantity * item.price }
        })
        .filter((item) => item.quantity > 0)
    )
  }

  // Remove from cart
  const removeFromCart = (productId: string) => {
    setCart((prevCart) => prevCart.filter((item) => item.id !== productId))
  }

  // Clear cart
  const clearCart = () => {
    setCart([])
    setSelectedCustomer(null)
    setSearchTerm('')
  }

  // Calculate totals
  const subtotal = cart.reduce((sum, item) => sum + item.subtotal, 0)
  const gst = subtotal * (store?.gstRate || 10) / 100
  const total = subtotal + gst

  // Handle checkout
  const handleCheckout = async () => {
    if (cart.length === 0) {
      toast({
        title: 'Cart is empty',
        description: 'Please add items to the cart before checkout',
        variant: 'destructive',
      })
      return
    }

    const saleData = {
      items: cart.map((item) => ({
        productId: item.id,
        quantity: item.quantity,
        price: item.price,
        subtotal: item.subtotal,
      })),
      subtotal,
      gst,
      discount: 0,
      total,
      paymentMethod: paymentMethod,
      customerId: selectedCustomer?.id || null,
    }

    try {
      const response = await fetch('/api/pos/sales', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(saleData),
      })

      if (response.ok) {
        const sale = await response.json()
        toast({
          title: 'Sale completed successfully',
          description: `Invoice #${sale.invoiceNumber}`,
        })
        setReceiptSale(sale)
        setReceiptOpen(true)
        clearCart()
        setCheckoutOpen(false)
        setPaymentMethod('cash')
        setTenderAmount('')
        loadInitialData() // Reload to update stock
      } else {
        throw new Error('Failed to complete sale')
      }
    } catch (error) {
      toast({
        title: 'Checkout failed',
        description: 'Please try again',
        variant: 'destructive',
      })
    }
  }

  // Initialize database with sample data
  const handleInitialize = async () => {
    try {
      const response = await fetch('/api/pos/initialize', {
        method: 'POST',
      })

      if (response.ok) {
        toast({
          title: 'Database initialized',
          description: 'Sample data has been added',
        })
        loadInitialData()
      }
    } catch (error) {
      toast({
        title: 'Initialization failed',
        description: 'Please try again',
        variant: 'destructive',
      })
    }
  }

  // Payment icons
  const paymentIcons: { [key in typeof paymentMethod]: any } = {
    cash: DollarSign,
    card: CreditCard,
    digital: Smartphone,
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center h-[600px]">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary mx-auto mb-4"></div>
          <p className="text-muted-foreground">Loading POS system...</p>
        </div>
      </div>
    )
  }

  // Show initialize button if no products
  if (products.length === 0 && categories.length === 0) {
    return (
      <div className="flex items-center justify-center h-[600px]">
        <Card className="max-w-md w-full">
          <CardContent className="p-8">
            <div className="text-center">
              <Database className="w-16 h-16 mx-auto mb-4 text-muted-foreground" />
              <h3 className="text-xl font-semibold mb-2">No Data Found</h3>
              <p className="text-muted-foreground mb-6">
                Initialize the database with sample products, categories, and customers to get started.
              </p>
              <Button onClick={handleInitialize} className="w-full" size="lg">
                <Database className="w-5 h-5 mr-2" />
                Initialize Database
              </Button>
            </div>
          </CardContent>
        </Card>
      </div>
    )
  }

  return (
    <div className="grid lg:grid-cols-3 gap-6 h-[calc(100vh-180px)]">
      {/* Products Section */}
      <div className="lg:col-span-2 flex flex-col gap-4">
        {/* Search and Filter Bar */}
        <Card>
          <CardContent className="p-4">
            <div className="flex gap-3">
              <div className="relative flex-1">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                <Input
                  placeholder="Search products, SKU, or scan barcode..."
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  className="pl-10"
                />
              </div>
              <Select value={selectedCategory} onValueChange={setSelectedCategory}>
                <SelectTrigger className="w-[200px]">
                  <SelectValue placeholder="All Categories" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Categories</SelectItem>
                  {categories.map((category) => (
                    <SelectItem key={category.id} value={category.id}>
                      {category.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </CardContent>
        </Card>

        {/* Products Grid */}
        <Card className="flex-1 overflow-hidden">
          <CardContent className="p-4 h-full">
            <ScrollArea className="h-[calc(100%-20px)]">
              {filteredProducts.length === 0 ? (
                <div className="flex items-center justify-center h-full text-muted-foreground">
                  <div className="text-center">
                    <Package className="w-12 h-12 mx-auto mb-4 opacity-50" />
                    <p>No products found</p>
                  </div>
                </div>
              ) : (
                <div className="grid sm:grid-cols-2 xl:grid-cols-3 gap-4">
                  {filteredProducts.map((product) => (
                    <Card
                      key={product.id}
                      className="cursor-pointer hover:shadow-lg transition-all hover:scale-[1.02]"
                      onClick={() => addToCart(product)}
                    >
                      <CardContent className="p-4">
                        <div className="space-y-2">
                          <Badge
                            variant="outline"
                            style={{
                              borderColor: product.category.color || undefined,
                              backgroundColor: product.category.color ? `${product.category.color}20` : undefined,
                            }}
                          >
                            {product.category.name}
                          </Badge>
                          <h3 className="font-semibold text-sm line-clamp-2">{product.name}</h3>
                          <div className="flex items-center justify-between">
                            <span className="text-lg font-bold">${product.price.toFixed(2)}</span>
                            <Badge variant={product.stock <= 5 ? 'destructive' : 'secondary'}>
                              Stock: {product.stock}
                            </Badge>
                          </div>
                          <p className="text-xs text-muted-foreground">SKU: {product.sku}</p>
                        </div>
                      </CardContent>
                    </Card>
                  ))}
                </div>
              )}
            </ScrollArea>
          </CardContent>
        </Card>
      </div>

      {/* Cart Section */}
      <div className="flex flex-col gap-4">
        <Card className="flex flex-col h-full">
          <CardHeader>
            <div className="flex items-center justify-between">
              <div>
                <CardTitle>Shopping Cart</CardTitle>
                <CardDescription>
                  {cart.length} {cart.length === 1 ? 'item' : 'items'}
                </CardDescription>
              </div>
              {cart.length > 0 && (
                <Button variant="ghost" size="sm" onClick={clearCart}>
                  <Trash2 className="w-4 h-4" />
                </Button>
              )}
            </div>
          </CardHeader>
          <CardContent className="flex-1 flex flex-col overflow-hidden">
            {/* Customer Selection */}
            <div className="mb-4">
              <label className="text-sm font-medium mb-2 block">Customer</label>
              <Select
                value={selectedCustomer?.id || ''}
                onValueChange={(value) => setSelectedCustomer(customers.find((c) => c.id === value) || null)}
              >
                <SelectTrigger>
                  <SelectValue placeholder="Walk-in customer" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="null">Walk-in customer</SelectItem>
                  {customers.map((customer) => (
                    <SelectItem key={customer.id} value={customer.id}>
                      {customer.name} {customer.points > 0 && `(${customer.points} pts)`}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <Separator className="mb-4" />

            {/* Cart Items */}
            <ScrollArea className="flex-1">
              {cart.length === 0 ? (
                <div className="flex items-center justify-center h-full text-muted-foreground">
                  <div className="text-center">
                    <ShoppingCart className="w-12 h-12 mx-auto mb-4 opacity-50" />
                    <p>Cart is empty</p>
                    <p className="text-xs mt-1">Click products to add them</p>
                  </div>
                </div>
              ) : (
                <div className="space-y-3">
                  {cart.map((item) => (
                    <div key={item.id} className="flex items-start gap-3 p-3 rounded-lg border">
                      <div className="flex-1 min-w-0">
                        <p className="font-medium text-sm truncate">{item.name}</p>
                        <p className="text-xs text-muted-foreground">${item.price.toFixed(2)} each</p>
                      </div>
                      <div className="flex items-center gap-1">
                        <Button
                          variant="outline"
                          size="icon"
                          className="h-7 w-7"
                          onClick={() => updateQuantity(item.id, -1)}
                        >
                          <Minus className="w-3 h-3" />
                        </Button>
                        <span className="w-8 text-center text-sm font-medium">{item.quantity}</span>
                        <Button
                          variant="outline"
                          size="icon"
                          className="h-7 w-7"
                          onClick={() => updateQuantity(item.id, 1)}
                        >
                          <Plus className="w-3 h-3" />
                        </Button>
                      </div>
                      <div className="text-right min-w-[60px]">
                        <p className="font-semibold text-sm">${item.subtotal.toFixed(2)}</p>
                      </div>
                      <Button
                        variant="ghost"
                        size="icon"
                        className="h-7 w-7 text-destructive"
                        onClick={() => removeFromCart(item.id)}
                      >
                        <Trash2 className="w-3 h-3" />
                      </Button>
                    </div>
                  ))}
                </div>
              )}
            </ScrollArea>

            <Separator className="my-4" />

            {/* Totals */}
            <div className="space-y-2">
              <div className="flex justify-between text-sm">
                <span className="text-muted-foreground">Subtotal</span>
                <span className="font-medium">${subtotal.toFixed(2)}</span>
              </div>
              <div className="flex justify-between text-sm">
                <span className="text-muted-foreground">GST ({store?.gstRate || 10}%)</span>
                <span className="font-medium">${gst.toFixed(2)}</span>
              </div>
              <Separator />
              <div className="flex justify-between text-lg font-bold">
                <span>Total</span>
                <span>${total.toFixed(2)}</span>
              </div>
            </div>

            {/* Checkout Button */}
            <Button
              className="w-full mt-4 h-12 text-lg"
              size="lg"
              disabled={cart.length === 0}
              onClick={() => setCheckoutOpen(true)}
            >
              <Receipt className="w-5 h-5 mr-2" />
              Checkout
            </Button>
          </CardContent>
        </Card>
      </div>

      {/* Checkout Dialog */}
      <Dialog open={checkoutOpen} onOpenChange={setCheckoutOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Complete Payment</DialogTitle>
            <DialogDescription>Total amount: ${total.toFixed(2)}</DialogDescription>
          </DialogHeader>

          <div className="space-y-4 py-4">
            {/* Payment Method Selection */}
            <div>
              <label className="text-sm font-medium mb-3 block">Payment Method</label>
              <Tabs value={paymentMethod} onValueChange={(v: any) => setPaymentMethod(v)}>
                <TabsList className="grid grid-cols-3 w-full">
                  <TabsTrigger value="cash">Cash</TabsTrigger>
                  <TabsTrigger value="card">Card</TabsTrigger>
                  <TabsTrigger value="digital">Digital</TabsTrigger>
                </TabsList>
              </Tabs>
            </div>

            {paymentMethod === 'cash' && (
              <div>
                <label className="text-sm font-medium mb-2 block">Tender Amount</label>
                <Input
                  type="number"
                  placeholder="Enter amount"
                  value={tenderAmount}
                  onChange={(e) => setTenderAmount(e.target.value)}
                />
                {tenderAmount && parseFloat(tenderAmount) >= total && (
                  <p className="text-sm text-green-600 mt-2">
                    Change: ${(parseFloat(tenderAmount) - total).toFixed(2)}
                  </p>
                )}
              </div>
            )}

            {/* Order Summary */}
            <div className="bg-muted rounded-lg p-4 space-y-2">
              <div className="flex justify-between text-sm">
                <span>Items</span>
                <span>{cart.reduce((sum, item) => sum + item.quantity, 0)}</span>
              </div>
              <div className="flex justify-between text-sm">
                <span>Subtotal</span>
                <span>${subtotal.toFixed(2)}</span>
              </div>
              <div className="flex justify-between text-sm">
                <span>Tax</span>
                <span>${gst.toFixed(2)}</span>
              </div>
              <Separator />
              <div className="flex justify-between font-bold">
                <span>Total</span>
                <span>${total.toFixed(2)}</span>
              </div>
            </div>
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => setCheckoutOpen(false)}>
              Cancel
            </Button>
            <Button
              onClick={handleCheckout}
              disabled={
                paymentMethod === 'cash' &&
                (!tenderAmount || parseFloat(tenderAmount) < total)
              }
              className="gap-2"
            >
              {React.createElement(paymentIcons[paymentMethod], { className: 'w-4 h-4' })}
              Complete Payment
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <ReceiptDialog
        open={receiptOpen}
        onClose={() => setReceiptOpen(false)}
        sale={receiptSale}
      />
    </div>
  )
}
