'use client'

import { useState, useEffect, useCallback } from 'react'
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
import { useSettings } from '@/lib/settings-context'
import { useBarcodeScanner, type ScanResult } from '@/hooks/use-barcode-scanner'
import { Search, Plus, Minus, Trash2, Receipt, DollarSign, CreditCard, Smartphone, Database, Package, ShoppingCart, AlertCircle, Camera, CameraOff, Scan, Zap, Printer, Terminal, Wifi, WifiOff, Clock, Pause, Play, List } from 'lucide-react'
import ReceiptDialog from '@/components/pos/ReceiptDialog'
import HeldOrdersPanel from '@/components/pos/HeldOrdersPanel'
import OrderQueueTab from '@/components/pos/OrderQueueTab'
import React from 'react';

// Types
interface Product {
  id: string
  name: string
  sku: string
  barcode?: string
  price: number
  stock: number
  minStock?: number
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

interface Printer {
  id: string
  name: string
  type: string
  brand: string
  model: string
  connection: string
  status: string
  isDefault: boolean
  statusInfo?: {
    online: boolean
    status: string
    queueLength: number
  }
}

export default function POSInterface() {
  const { toast } = useToast()
  const { store, loading: settingsLoading, formatCurrency } = useSettings()
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
  const [receiptSale, setReceiptSale] = useState<any>(null)
  const [receiptOpen, setReceiptOpen] = useState(false)
  
  // Hold Order functionality
  const [heldOrdersPanelOpen, setHeldOrdersPanelOpen] = useState(false)
  const [holdOrderDialogOpen, setHoldOrderDialogOpen] = useState(false)
  const [tableNumber, setTableNumber] = useState('')
  const [orderName, setOrderName] = useState('')
  const [orderNotes, setOrderNotes] = useState('')
  const [holdOrderLoading, setHoldOrderLoading] = useState(false)
  const [heldOrdersCount, setHeldOrdersCount] = useState(0)
  
  // Barcode scanning state
  const [scanFeedback, setScanFeedback] = useState<{show: boolean, type: 'success' | 'error' | 'info', message: string}>({show: false, type: 'info', message: ''})
  const [lastScannedProduct, setLastScannedProduct] = useState<Product | null>(null)
  
  // Printer state
  const [printers, setPrinters] = useState<Printer[]>([])
  const [selectedReceiptPrinter, setSelectedReceiptPrinter] = useState<string>('')
  const [selectedInvoicePrinter, setSelectedInvoicePrinter] = useState<string>('')

  // Payment terminals state
  const [paymentProviders, setPaymentProviders] = useState<any[]>([])
  const [paymentTerminals, setPaymentTerminals] = useState<any[]>([])
  const [selectedPaymentProvider, setSelectedPaymentProvider] = useState<string>('')
  const [selectedPaymentTerminal, setSelectedPaymentTerminal] = useState<string>('')
  const [paymentStatus, setPaymentStatus] = useState<{show: boolean, type: 'processing' | 'success' | 'error', message: string, transactionId?: string}>({show: false, type: 'processing', message: ''})
  const [showPaymentDialog, setShowPaymentDialog] = useState(false)

  // Handle barcode scan result
  const handleBarcodeScan = useCallback(async (result: ScanResult) => {
    try {
      const response = await fetch(`/api/pos/barcode?barcode=${encodeURIComponent(result.code)}`)
      
      if (response.ok) {
        const product = await response.json()
        setLastScannedProduct(product)
        setScanFeedback({show: true, type: 'success', message: `Found: ${product.name}`})
        
        // Auto-add to cart if product is found
        setTimeout(() => {
          addToCart(product)
          setScanFeedback({show: false, type: 'info', message: ''})
        }, 1500)
      } else {
        const errorData = await response.json()
        setScanFeedback({show: true, type: 'error', message: `Product not found: ${result.code}`})
        
        // Offer to create new product
        setTimeout(() => {
          setScanFeedback({show: false, type: 'info', message: ''})
        }, 3000)
      }
    } catch (error) {
      console.error('Barcode scan error:', error)
      setScanFeedback({show: true, type: 'error', message: 'Scan error occurred'})
      
      setTimeout(() => {
        setScanFeedback({show: false, type: 'info', message: ''})
      }, 3000)
    }
  }, [])

  // Barcode scanner hook
  const {
    isScanning,
    lastScan,
    scannerType,
    isCameraActive,
    error: scannerError,
    startScan,
    stopScan,
    toggleCamera,
    manualInput
  } = useBarcodeScanner(handleBarcodeScan, {
    debounceMs: 100,
    autoDetection: true,
    cameraEnabled: true,
    soundFeedback: true,
    visualFeedback: false // We handle visual feedback manually
  })

  // Load data
  useEffect(() => {
    loadInitialData()
    // Start barcode scanning on component mount
    startScan()
    
    return () => {
      stopScan()
    }
  }, [])

  // Load printers when store is available
  useEffect(() => {
    if (store?.id) {
      loadPrinters()
      loadPaymentProviders()
    }
  }, [store?.id])

  // Load payment providers and terminals
  const loadPaymentProviders = async () => {
    try {
      const response = await fetch('/api/pos/payments?limit=1') // This will be a different endpoint in real implementation
      if (response.ok) {
        // For now, we'll create a simple providers list
        setPaymentProviders([
          { id: 'paytm', name: 'paytm', displayName: 'Paytm', type: 'hybrid' },
          { id: 'pinelabs', name: 'pinelabs', displayName: 'PineLabs', type: 'terminal' }
        ])
        await loadPaymentTerminals()
      }
    } catch (error) {
      console.error('Error loading payment providers:', error)
    }
  }

  const loadPaymentTerminals = async () => {
    try {
      const response = await fetch('/api/pos/payments/terminals')
      if (response.ok) {
        const data = await response.json()
        setPaymentTerminals(data.data || [])
      }
    } catch (error) {
      console.error('Error loading payment terminals:', error)
    }
  }

  // Process terminal payment
  const processTerminalPayment = async (amount: number, paymentMethod: string) => {
    if (!selectedPaymentTerminal || !selectedPaymentProvider) {
      toast({
        title: 'Terminal not selected',
        description: 'Please select a payment terminal',
        variant: 'destructive',
      })
      return null
    }

    const terminal = paymentTerminals.find(t => t.id === selectedPaymentTerminal)
    if (!terminal || terminal.status !== 'online') {
      toast({
        title: 'Terminal offline',
        description: 'Selected payment terminal is not online',
        variant: 'destructive',
      })
      return null
    }

    setPaymentStatus({show: true, type: 'processing', message: 'Processing payment...'})

    try {
      const orderId = `ORDER_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`
      const response = await fetch('/api/pos/payments', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          providerId: selectedPaymentProvider,
          terminalId: selectedPaymentTerminal,
          amount,
          currency: 'INR',
          orderId,
          paymentMethod,
          description: `POS Sale - ${formatCurrency(amount)}`
        })
      })

      const data = await response.json()

      if (data.success) {
        setPaymentStatus({
          show: true,
          type: 'processing',
          message: 'Waiting for customer to complete payment...',
          transactionId: data.data.transactionId
        })

        // Poll for payment status
        const pollPayment = async (transactionId: string) => {
          let attempts = 0
          const maxAttempts = 60 // 5 minutes timeout

          while (attempts < maxAttempts) {
            await new Promise(resolve => setTimeout(resolve, 5000)) // Wait 5 seconds

            const statusResponse = await fetch('/api/pos/payments', {
              method: 'PATCH',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({
                transactionId,
                providerId: selectedPaymentProvider,
                action: 'status_check'
              })
            })

            const statusData = await statusResponse.json()

            if (statusData.success) {
              if (statusData.data.status === 'completed') {
                setPaymentStatus({show: true, type: 'success', message: 'Payment completed successfully!'})
                return { success: true, transactionId, data: statusData.data }
              } else if (statusData.data.status === 'failed') {
                setPaymentStatus({show: true, type: 'error', message: 'Payment failed'})
                return { success: false, error: 'Payment failed' }
              }
            }

            attempts++
          }

          setPaymentStatus({show: true, type: 'error', message: 'Payment timeout'})
          return { success: false, error: 'Payment timeout' }
        }

        return await pollPayment(data.data.transactionId)
      } else {
        setPaymentStatus({show: true, type: 'error', message: data.error})
        return { success: false, error: data.error }
      }
    } catch (error) {
      console.error('Terminal payment error:', error)
      setPaymentStatus({show: true, type: 'error', message: 'Payment processing failed'})
      return { success: false, error: 'Payment processing failed' }
    }
  }

  const loadInitialData = async () => {
    try {
      // First, sync the user to create employee record
      const syncRes = await fetch('/api/auth/sync-user')
      if (!syncRes.ok) {
        console.error('Failed to sync user:', await syncRes.text())
        return
      }

      // Now load the data (settings are loaded by context)
      const [productsRes, categoriesRes, customersRes] = await Promise.all([
        fetch('/api/pos/products'),
        fetch('/api/pos/categories'),
        fetch('/api/pos/customers'),
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
    } catch (error) {
      console.error('Error loading data:', error)
    } finally {
      setLoading(false)
    }
  }

  // Load printers
  const loadPrinters = async () => {
    if (!store?.id) return
    
    try {
      const response = await fetch(`/api/pos/printers?storeId=${store.id}`)
      if (response.ok) {
        const data = await response.json()
        const printerList = data.data || []
        setPrinters(printerList)
        
        // Set default printers if not already selected
        const thermalPrinters = printerList.filter((p: Printer) => p.type === 'thermal')
        const inkjetPrinters = printerList.filter((p: Printer) => p.type === 'inkjet')
        
        if (!selectedReceiptPrinter && thermalPrinters.length > 0) {
          const defaultThermal = thermalPrinters.find((p: Printer) => p.isDefault) || thermalPrinters[0]
          setSelectedReceiptPrinter(defaultThermal.id)
        }
        
        if (!selectedInvoicePrinter && inkjetPrinters.length > 0) {
          const defaultInkjet = inkjetPrinters.find((p: Printer) => p.isDefault) || inkjetPrinters[0]
          setSelectedInvoicePrinter(defaultInkjet.id)
        }
      }
    } catch (error) {
      console.error('Error loading printers:', error)
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

  // Calculate low stock alerts
  const lowStockProducts = products.filter((p) => 
    p.stock <= (p.minStock || store?.globalMinStock || 5)
  )
  const lowStockCount = lowStockProducts.length

  // Print receipt
  const printReceipt = async (sale: any) => {
    try {
      const response = await fetch(`/api/pos/printers/${selectedReceiptPrinter}/print`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          type: 'receipt',
          content: generateReceiptContent(sale),
        })
      })
      
      if (!response.ok) {
        throw new Error('Failed to print receipt')
      }
    } catch (error) {
      console.error('Receipt printing error:', error)
      throw error
    }
  }

  // Print invoice
  const printInvoice = async (sale: any) => {
    if (!selectedInvoicePrinter || selectedInvoicePrinter === 'none') {
      return // Skip printing if no printer selected
    }
    
    try {
      const response = await fetch(`/api/pos/printers/${selectedInvoicePrinter}/print`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          type: 'invoice',
          content: generateInvoiceContent(sale),
        })
      })
      
      if (!response.ok) {
        throw new Error('Failed to print invoice')
      }
    } catch (error) {
      console.error('Invoice printing error:', error)
      throw error
    }
  }

  // Generate receipt content
  const generateReceiptContent = (sale: any): string => {
    const items = sale.items || []
    return `
${'='.repeat(32)}
    RECEIPT
${'='.repeat(32)}
Invoice: ${sale.invoiceNumber}
Date: ${new Date(sale.createdAt).toLocaleString()}
${selectedCustomer ? `Customer: ${selectedCustomer.name}` : ''}
${'='.repeat(32)}

ITEMS:
${'-'.repeat(32)}
${items.map((item: any) => 
  `${item.product.name.substring(0, 15).padEnd(15)} ${item.quantity.toString().padStart(3)} ${item.price.toFixed(2).padStart(6)}`
).join('\n')}
${'-'.repeat(32)}

Subtotal:     ${sale.subtotal.toFixed(2).padStart(8)}
Tax:          ${sale.gst.toFixed(2).padStart(8)}
${'='.repeat(32)}
TOTAL:        ${sale.total.toFixed(2).padStart(8)}
Payment:      ${sale.paymentMethod}
${'='.repeat(32)}

Thank you for your business!
${' '.repeat(32)}
`
  }

  // Generate invoice content
  const generateInvoiceContent = (sale: any): string => {
    const items = sale.items || []
    const storeName = store?.name || 'Your Store'
    const storeAddress = store?.address || ''
    const storePhone = store?.phone || ''

    return `
${storeName}
${storeAddress}
${storePhone ? 'Phone: ' + storePhone : ''}
${'='.repeat(50)}

INVOICE
Invoice #: ${sale.invoiceNumber}
Date: ${new Date(sale.createdAt).toLocaleString()}
${selectedCustomer ? `Customer: ${selectedCustomer.name}` : ''}
${'='.repeat(50)}

ITEMS:
${'-'.repeat(50)}
Name                    Qty    Price    Total
${'-'.repeat(50)}
${items.map((item: any) => 
  `${item.product.name.substring(0, 20).padEnd(20)} ${item.quantity.toString().padStart(3)} ${item.price.toFixed(2).padStart(8)} ${item.subtotal.toFixed(2).padStart(8)}`
).join('\n')}
${'-'.repeat(50)}

Subtotal:               ${sale.subtotal.toFixed(2)}
Tax:                    ${sale.gst.toFixed(2)}
${'='.repeat(50)}
TOTAL:                  ${sale.total.toFixed(2)}

Payment Method: ${sale.paymentMethod}
${'='.repeat(50)}

Thank you for your business!
`
  }

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
      let paymentResult: { success: boolean; transactionId?: string; data?: any; error?: string } | null = null

      // Handle terminal payments for card/digital payments
      if ((paymentMethod === 'card' || paymentMethod === 'digital') && selectedPaymentTerminal) {
        const result = await processTerminalPayment(total, paymentMethod)
        paymentResult = result
        
        if (!paymentResult || !paymentResult.success) {
          toast({
            title: 'Payment failed',
            description: paymentResult?.error || 'Payment processing failed',
            variant: 'destructive',
          })
          return
        }
      }

      const response = await fetch('/api/pos/sales', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(saleData),
      })

      if (response.ok) {
        const sale = await response.json()
        
        // Update payment method if terminal payment was used
        if (paymentResult && paymentResult.transactionId) {
          await fetch(`/api/pos/sales/${sale.id}`, {
            method: 'PATCH',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              paymentMethod: paymentMethod,
              paymentReference: paymentResult.transactionId
            })
          })
        }

        toast({
          title: 'Sale completed successfully',
          description: `Invoice #${sale.invoiceNumber}`,
        })
        
        // Print receipt if printer is selected
        if (selectedReceiptPrinter) {
          try {
            await printReceipt(sale)
          } catch (printError) {
            console.error('Receipt printing failed:', printError)
            toast({
              title: 'Sale completed',
              description: 'Receipt printing failed, but sale was recorded',
              variant: 'destructive',
            })
          }
        }
        
        // Print invoice if printer is selected
        if (selectedInvoicePrinter && selectedInvoicePrinter !== 'none') {
          try {
            await printInvoice(sale)
          } catch (printError) {
            console.error('Invoice printing failed:', printError)
          }
        }
        
        setReceiptSale(sale)
        setReceiptOpen(true)
        clearCart()
        setCheckoutOpen(false)
        setPaymentMethod('cash')
        setTenderAmount('')
        setPaymentStatus({show: false, type: 'processing', message: ''})
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

  // Hold Order Functions
  const holdCurrentOrder = async () => {
    if (cart.length === 0) {
      toast({
        title: 'Cart is empty',
        description: 'Cannot hold an empty cart',
        variant: 'destructive',
      })
      return
    }

    setHoldOrderLoading(true)
    try {
      const orderData = {
        items: cart.map((item) => ({
          productId: item.id,
          name: item.name,
          sku: item.sku,
          price: item.price,
          quantity: item.quantity,
          subtotal: item.subtotal,
          category: item.category
        })),
        customerId: selectedCustomer?.id || null,
        tableNumber: tableNumber || null,
        orderName: orderName || null,
        subtotal,
        gst,
        discount: 0,
        total,
        notes: orderNotes || null,
        storeId: store?.id,
        priority: 0,
        isAutoSaved: false
      }

      const response = await fetch('/api/pos/orders/hold', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(orderData),
      })

      if (response.ok) {
        const heldOrder = await response.json()
        toast({
          title: 'Order held successfully',
          description: `Order ${heldOrder.orderNumber} has been saved`,
        })
        
        // Clear current cart
        clearCart()
        setHoldOrderDialogOpen(false)
        setTableNumber('')
        setOrderName('')
        setOrderNotes('')
        
        // Update held orders count
        setHeldOrdersCount(prev => prev + 1)
      } else {
        throw new Error('Failed to hold order')
      }
    } catch (error) {
      console.error('Error holding order:', error)
      toast({
        title: 'Failed to hold order',
        description: 'Please try again',
        variant: 'destructive',
      })
    } finally {
      setHoldOrderLoading(false)
    }
  }

  // Retrieve held order and load into cart
  const retrieveHeldOrder = (heldOrder: any) => {
    try {
      // Clear current cart first
      clearCart()
      
      // Set customer if available
      if (heldOrder.customer) {
        setSelectedCustomer(heldOrder.customer)
      }
      
      // Load items into cart
      if (heldOrder.items && Array.isArray(heldOrder.items)) {
        heldOrder.items.forEach((item: any) => {
          const product = products.find(p => p.id === item.productId)
          if (product) {
            addToCart(product)
          }
        })
      }
      
      // Set table number and order name if available
      if (heldOrder.tableNumber) {
        setTableNumber(heldOrder.tableNumber)
      }
      if (heldOrder.orderName) {
        setOrderName(heldOrder.orderName)
      }
      if (heldOrder.notes) {
        setOrderNotes(heldOrder.notes)
      }
      
      toast({
        title: 'Order retrieved successfully',
        description: `${heldOrder.orderNumber} has been loaded into the cart`,
      })
      
      setHeldOrdersPanelOpen(false)
    } catch (error) {
      console.error('Error retrieving held order:', error)
      toast({
        title: 'Failed to retrieve order',
        description: 'Please try again',
        variant: 'destructive',
      })
    }
  }

  // Load held orders count for display
  const loadHeldOrdersCount = async () => {
    if (!store?.id) return
    
    try {
      const response = await fetch(`/api/pos/orders/hold?storeId=${store.id}&status=held&limit=1`)
      if (response.ok) {
        const data = await response.json()
        setHeldOrdersCount(data.pagination?.total || 0)
      }
    } catch (error) {
      console.error('Error loading held orders count:', error)
    }
  }

  // Load held orders count when store is available
  useEffect(() => {
    if (store?.id) {
      loadHeldOrdersCount()
    }
  }, [store?.id])

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

  if (loading || settingsLoading) {
    return (
      <div className="flex items-center justify-center h-150">
        <div className="text-center bg-gray-900 rounded-xl p-8 shadow-lg border border-blue-500">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-primary mx-auto mb-4"></div>
          <p className="text-gray-300 font-medium">Loading POS system...</p>
        </div>
      </div>
    )
  }

  // Show initialize button if no products
  if (products.length === 0 && categories.length === 0) {
    return (
      <div className="flex items-center justify-center h-150">
        <Card className="max-w-md w-full bg-gray-900 border-blue-500 shadow-xl">
          <CardContent className="p-8">
            <div className="text-center">
              <Database className="w-16 h-16 mx-auto mb-4 text-gray-900" />
              <h3 className="text-xl font-semibold mb-2 text-gray-900">No Data Found</h3>
              <p className="text-gray-300 mb-6">
                Initialize the database with sample products, categories, and customers to get started.
              </p>
              <Button onClick={handleInitialize} className="w-full bg-amber-600 hover:bg-blue-accent text-white" size="lg">
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
    <div className="space-y-4">
      {/* Store Header */}
      {store && (
        <Card className=" bg-gray-900 border-blue-500 shadow-md">
          <CardContent className="p-6">
            <div className="text-center">
              <h1 className="text-2xl font-bold text-gray-400">{store.name}</h1>
              {store.address && <p className="text-gray-300">{store.address}</p>}
              {store.phone && <p className="text-gray-300">Tel: {store.phone}</p>}
              {store.email && <p className="text-gray-300">{store.email}</p>}
            </div>
          </CardContent>
        </Card>
      )}

      {/* Low Stock Alert */}
      {lowStockCount > 0 && (
        <Card className="border-blue-accent/30 bg-linear-to-r from-blue-accent/10 to-blue-secondary/10">
          <CardContent className="p-3">
            <div className="flex items-center gap-2 text-blue-accent">
              <AlertCircle className="w-4 h-4" />
              <span className="text-sm font-medium">
                {lowStockCount} product{lowStockCount !== 1 ? 's' : ''} {lowStockCount === 1 ? 'is' : 'are'} running low on stock
              </span>
            </div>
          </CardContent>
        </Card>
      )}

      <Tabs defaultValue="pos" className="space-y-4">
        <TabsList className="grid w-full grid-cols-2 bg-gray-800 border border-blue-500">
          <TabsTrigger value="pos" className="data-[state=active]:bg-blue-600 data-[state=active]:text-white">
            <ShoppingCart className="w-4 h-4 mr-2" />
            Point of Sale
          </TabsTrigger>
          <TabsTrigger value="queue" className="data-[state=active]:bg-blue-600 data-[state=active]:text-white">
            <List className="w-4 h-4 mr-2" />
            Order Queue
            {heldOrdersCount > 0 && (
              <Badge className="ml-2 bg-blue-600 text-white text-xs">
                {heldOrdersCount}
              </Badge>
            )}
          </TabsTrigger>
        </TabsList>

        <TabsContent value="pos" className="space-y-4">
          <div className="grid lg:grid-cols-3 gap-6 min-h-screen">
        {/* Products Section */}
        <div className="lg:col-span-2 flex flex-col gap-4">
        {/* Search and Filter Bar */}
        <Card className="bg-gray-900 border-blue-500 shadow-sm">
          <CardContent className="p-4">
            <div className="flex gap-3">
              <div className="relative flex-1">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
                <Input
                  placeholder="Search products, SKU, or scan barcode..."
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter') {
                      const code = e.currentTarget.value.trim()
                      if (code) {
                        manualInput(code)
                        setSearchTerm('')
                      }
                    }
                  }}
                  className="pl-10 border-blue-500 bg-gray-800 text-white placeholder-gray-400 focus:border-blue-primary focus:ring-blue-primary/20"
                />
              </div>
              <Select value={selectedCategory} onValueChange={setSelectedCategory}>
                <SelectTrigger className="w-50 border-blue-500 bg-gray-800 text-white focus:border-blue-primary focus:ring-blue-primary/20">
                  <SelectValue placeholder="All Categories" />
                </SelectTrigger>
                <SelectContent className="bg-gray-400 border-amber-500">
                  <SelectItem value="all">All Categories</SelectItem>
                  {categories.map((category) => (
                    <SelectItem key={category.id} value={category.id}>
                      {category.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <Button
                variant="outline"
                size="sm"
                onClick={toggleCamera}
                className={`border-white hover:bg-amber-600 ${
                  isCameraActive ? 'text-red-500 border-red-400/50' : 'text-gray-400'
                }`}
                title={isCameraActive ? 'Stop camera scanning' : 'Start camera scanning'}
              >
                {isCameraActive ? <CameraOff className="w-4 h-4" /> : <Camera className="w-4 h-4" />}
              </Button>
              <Button
                variant="outline"
                size="sm"
                onClick={() => {
                  if (isScanning) {
                    stopScan()
                  } else {
                    startScan()
                  }
                }}
                className={`border-blue-500 hover:bg-amber-600 ${
                  isScanning ? 'text-green-400 border-green-400/50' : 'text-gray-900'
                }`}
                title={isScanning ? 'Stop barcode scanning' : 'Start barcode scanning'}
              >
                <Scan className="w-4 h-4" />
              </Button>
            </div>
            
            {/* Scanner Status */}
            <div className="flex items-center gap-4 mt-3 text-xs">
              <div className="flex items-center gap-2">
                <div className={`w-2 h-2 rounded-full ${
                  isScanning ? 'bg-green-400 animate-pulse' : 'bg-gray-900'
                }`} />
                <span className="text-gray-400 ">
                  {isScanning ? 'Scanner Active' : 'Scanner Inactive'}
                </span>
              </div>
              
              {lastScan && (
                <div className="flex items-center gap-2 text-gray-900">
                  <Zap className="w-3 h-3" />
                  <span>Last: {lastScan.code}</span>
                  {lastScan.format && (
                    <Badge variant="outline" className="text-xs px-1 py-0">
                      {lastScan.format}
                    </Badge>
                  )}
                </div>
              )}
              
              {scannerError && (
                <div className="text-red-400">
                  Error: {scannerError}
                </div>
              )}
            </div>
            
            {/* Scan Feedback */}
            {scanFeedback.show && (
              <div className={`mt-3 p-3 rounded-lg border ${
                scanFeedback.type === 'success' 
                  ? 'bg-green-500/10 border-green-500/30 text-green-400'
                  : scanFeedback.type === 'error'
                  ? 'bg-red-500/10 border-red-500/30 text-red-400'
                  : 'bg-blue-500/10 border-blue-500/30 text-blue-400'
              }`}>
                <div className="flex items-center gap-2">
                  {scanFeedback.type === 'success' && <Zap className="w-4 h-4" />}
                  {scanFeedback.type === 'error' && <AlertCircle className="w-4 h-4" />}
                  <span className="font-medium">{scanFeedback.message}</span>
                </div>
              </div>
            )}
            
            {/* Last Scanned Product */}
            {lastScannedProduct && (
              <div className="mt-3 p-3 rounded-lg border border-blue-500/30 bg-blue-500/10">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="font-medium text-gray-900">{lastScannedProduct.name}</p>
                    <p className="text-sm text-gray-400 ">
                      {formatCurrency(lastScannedProduct.price)} • Stock: {lastScannedProduct.stock}
                    </p>
                  </div>
                  <Badge variant="outline" className="border-blue-primary/30 text-gray-900">
                    Added to Cart
                  </Badge>
                </div>
              </div>
            )}
          </CardContent>
        </Card>

        {/* Products Grid */}
        <Card className="flex-1 overflow-hidden bg-gray-900 border-blue-500 shadow-sm">
          <CardContent className="p-4 h-full">
            <ScrollArea className="h-[calc(100%-20px)]">
              {filteredProducts.length === 0 ? (
                <div className="flex items-center justify-center h-full text-gray-400 ">
                  <div className="text-center">
                    <Package className="w-12 h-12 mx-auto mb-4 text-gray-900/50" />
                    <p>No products found</p>
                  </div>
                </div>
              ) : (
                <div className="grid sm:grid-cols-2 xl:grid-cols-3 gap-4">
                  {filteredProducts.map((product) => (
                    <Card
                      key={product.id}
                      className="cursor-pointer hover:shadow-xl transition-all hover:scale-[1.02] bg-gray-800 border-blue-500 hover:border-blue-primary/50 group"
                      onClick={() => addToCart(product)}
                    >
                      <CardContent className="p-4">
                        <div className="space-y-2">
                          <Badge
                            variant="outline"
                            className="text-xs border-blue-primary/30 bg-amber-600 text-gray-500"
                            style={{
                              borderColor: product.category.color || 'var(--blue-primary)',
                              backgroundColor: product.category.color ? `${product.category.color}20` : 'var(--blue-primary)',
                            }}
                          >
                            {product.category.name}
                          </Badge>
                          <h3 className="font-semibold text-sm line-clamp-2 group-hover:text-amber-500 transition-colors text-white">{product.name}</h3>
                          <div className="flex items-center justify-between">
                            <span className="text-lg font-bold text-white">{formatCurrency(product.price)}</span>
                            <Badge variant={product.stock <= (product.minStock || store?.globalMinStock || 5) ? 'destructive' : 'secondary'}>
                              Stock: {product.stock}
                            </Badge>
                          </div>
                          <p className="text-xs text-gray-400 ">SKU: {product.sku}</p>
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
        <Card className="flex flex-col h-full bg-gray-900 shadow-md">
          <CardHeader className="bg-linear-to-r from-blue-primary/10 to-blue-accent/10">
            <div className="flex items-center justify-between">
              <div>
                <CardTitle className="text-gray-400">Shopping Cart</CardTitle>
                <CardDescription>
                  {cart.length} {cart.length === 1 ? 'item' : 'items'}
                </CardDescription>
              </div>
              {cart.length > 0 && (
                <Button variant="ghost" size="sm" onClick={clearCart} className="text-gray-400 hover:text-white hover:bg-blue-accent">
                  <Trash2 className="w-4 h-4" />
                </Button>
              )}
            </div>
          </CardHeader>
          <CardContent className="flex-1 flex flex-col overflow-hidden">
            {/* Customer Selection */}
            <div className="mb-4">
              <label className="text-sm font-medium mb-2 block text-gray-400">Customer</label>
              <Select
                value={selectedCustomer?.id || ''}
                onValueChange={(value) => setSelectedCustomer(customers.find((c) => c.id === value) || null)}
              >
                <SelectTrigger className="border-blue-500 bg-gray-800 text-white focus:border-blue-primary focus:ring-blue-primary/20">
                  <SelectValue placeholder="Walk-in customer" />
                </SelectTrigger>
                <SelectContent className="bg-gray-400 border-amber-500">
                  <SelectItem value="null">Walk-in customer</SelectItem>
                  {customers.map((customer) => (
                    <SelectItem key={customer.id} value={customer.id}>
                      {customer.name} {customer.points > 0 && `(${customer.points} pts)`}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <Separator className="mb-4 border-blue-500" />

            {/* Cart Items */}
            <ScrollArea className="flex-1">
              {cart.length === 0 ? (
                <div className="flex items-center justify-center h-full text-gray-400 ">
                  <div className="text-center">
                    <ShoppingCart className="w-12 h-12 mx-auto mb-4 text-gray-900/50" />
                    <p className="text-gray-900/70">Cart is empty</p>
                    <p className="text-xs mt-1">Click products to add them</p>
                  </div>
                </div>
              ) : (
                <div className="space-y-3">
                  {cart.map((item) => (
                    <div key={item.id} className="flex items-start gap-3 p-3 rounded-lg border border-blue-500 bg-gray-800/50">
                      <div className="flex-1 min-w-0">
                        <p className="font-medium text-sm truncate text-gray-400">{item.name}</p>
                        <p className="text-xs text-gray-400 ">{formatCurrency(item.price)} each</p>
                      </div>
                      <div className="flex items-center gap-1 bg-amber-300">
                        <Button
                          variant="outline"
                          size="icon"
                          className="h-7 w-7 border-lime-border hover:border-lime-primary hover:bg-lime-primary/10"
                          onClick={() => updateQuantity(item.id, -1)}
                        >
                          <Minus className="w-3 h-3" />
                        </Button>
                        <span className="w-8 text-center text-sm font-medium text-gray-900">{item.quantity}</span>
                        <Button
                          variant="outline"
                          size="icon"
                          className="h-7 w-7 border-lime-border hover:border-lime-primary hover:bg-lime-primary/10"
                          onClick={() => updateQuantity(item.id, 1)}
                        >
                          <Plus className="w-3 h-3" />
                        </Button>
                      </div>
                      <div className="text-right min-w-15">
                        <p className="font-semibold text-sm text-gray-400">{formatCurrency(item.subtotal)}</p>
                      </div>
                      <Button
                        variant="ghost"
                        size="icon"
                        className="h-7 w-7 text-gray-400 hover:text-white hover:bg-destructive"
                        onClick={() => removeFromCart(item.id)}
                      >
                        <Trash2 className="w-3 h-3" />
                      </Button>
                    </div>
                  ))}
                </div>
              )}
            </ScrollArea>

            <Separator className="my-4 border-blue-500" />

            {/* Totals */}
            <div className="space-y-2">
              <div className="flex justify-between text-sm">
                <span className="text-gray-400 ">Subtotal</span>
                <span className="font-medium text-gray-900">{formatCurrency(subtotal)}</span>
              </div>
              <div className="flex justify-between text-sm">
                <span className="text-gray-400 ">GST ({store?.gstRate || 10}%)</span>
                <span className="font-medium text-gray-900">{formatCurrency(gst)}</span>
              </div>
              <Separator className="border-blue-500" />
              <div className="flex justify-between text-lg font-bold text-white">
                <span>Total</span>
                <span>{formatCurrency(total)}</span>
              </div>
            </div>

            {/* Action Buttons */}
            <div className="space-y-2 mt-4">
              {/* Recall Held Orders Button */}
              <Button
                variant="outline"
                className="w-full h-10 border-blue-500 text-blue-400 hover:bg-blue-500/10"
                onClick={() => setHeldOrdersPanelOpen(true)}
              >
                <Clock className="w-4 h-4 mr-2" />
                Recall Orders
                {heldOrdersCount > 0 && (
                  <Badge className="ml-2 bg-blue-600 text-white text-xs">
                    {heldOrdersCount}
                  </Badge>
                )}
              </Button>
              
              {/* Hold Order Button */}
              <Button
                variant="outline"
                className="w-full h-10 border-orange-500/20 text-orange-400 hover:bg-orange-500/10"
                disabled={cart.length === 0}
                onClick={() => setHoldOrderDialogOpen(true)}
              >
                <Pause className="w-4 h-4 mr-2" />
                Hold Order
              </Button>
              
              {/* Checkout Button */}
              <Button
                className="w-full h-12 text-lg bg-amber-600 hover:bg-blue-accent text-black shadow-lg hover:shadow-xl transition-all"
                size="lg"
                disabled={cart.length === 0}
                onClick={() => setCheckoutOpen(true)}
              >
                <Receipt className="w-5 h-5 mr-2 " />
                Checkout
              </Button>
            </div>
          </CardContent>
        </Card>
        </div>
      </div>

      {/* Checkout Dialog */}
      <Dialog open={checkoutOpen} onOpenChange={setCheckoutOpen}>
        <DialogContent className="sm:max-w-md bg-gray-900 border-blue-500">
          <DialogHeader>
            <DialogTitle className="text-gray-300">Complete Payment</DialogTitle>
            <DialogDescription>Total amount: <span className="text-gray-300 font-semibold">{formatCurrency(total)}</span></DialogDescription>
          </DialogHeader>

          <div className="space-y-4 py-4">
            {/* Payment Method Selection */}
            <div>
              <label className="text-sm font-medium mb-3 block text-gray-300">Payment Method</label>
              <Tabs value={paymentMethod} onValueChange={(v: any) => setPaymentMethod(v)}>
                <TabsList className="grid grid-cols-3 w-full bg-gray-800 border border-blue-500">
                  <TabsTrigger value="cash" className="data-[state=active]:bg-amber-600 data-[state=active]:text-white">Cash</TabsTrigger>
                  <TabsTrigger value="card" className="data-[state=active]:bg-amber-600 data-[state=active]:text-white">Card</TabsTrigger>
                  <TabsTrigger value="digital" className="data-[state=active]:bg-amber-600 data-[state=active]:text-white">Digital</TabsTrigger>
                </TabsList>
              </Tabs>
            </div>

            {paymentMethod === 'cash' && (
              <div>
                <label className="text-sm font-medium mb-2 block text-gray-400">Tender Amount</label>
                <Input
                  type="number"
                  placeholder="Enter amount"
                  value={tenderAmount}
                  onChange={(e) => setTenderAmount(e.target.value)}
                  className="border-blue-500 bg-gray-800 text-white placeholder-gray-400 focus:border-blue-primary focus:ring-blue-primary/20"
                />
                {tenderAmount && parseFloat(tenderAmount) >= total && (
                  <p className="text-sm text-gray-900 mt-2 font-medium">
                    Change: {formatCurrency(parseFloat(tenderAmount) - total)}
                  </p>
                )}
              </div>
            )}

            {/* Payment Terminal Selection for Card/Digital Payments */}
            {(paymentMethod === 'card' || paymentMethod === 'digital') && (
              <div className="space-y-4">
                <div>
                  <label className="text-sm font-medium mb-2 block text-gray-400">Payment Provider</label>
                  <Select
                    value={selectedPaymentProvider}
                    onValueChange={setSelectedPaymentProvider}
                  >
                    <SelectTrigger className="border-blue-500 bg-gray-800 text-white focus:border-blue-primary focus:ring-blue-primary/20">
                      <SelectValue placeholder="Select payment provider" />
                    </SelectTrigger>
                    <SelectContent className="bg-gray-400 border-amber-500">
                      {paymentProviders.map((provider) => (
                        <SelectItem key={provider.id} value={provider.id}>
                          <div className="flex items-center gap-2">
                            <Terminal className="w-4 h-4" />
                            <span>{provider.displayName}</span>
                            <Badge variant="outline" className="text-xs ml-auto">
                              {provider.type}
                            </Badge>
                          </div>
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>

                {selectedPaymentProvider && (
                  <div>
                    <label className="text-sm font-medium mb-2 block text-gray-400">Payment Terminal</label>
                    <Select
                      value={selectedPaymentTerminal}
                      onValueChange={setSelectedPaymentTerminal}
                    >
                      <SelectTrigger className="border-blue-500 bg-gray-800 text-white focus:border-blue-primary focus:ring-blue-primary/20">
                        <SelectValue placeholder="Select payment terminal" />
                      </SelectTrigger>
                      <SelectContent className="bg-gray-400 border-amber-500">
                        {paymentTerminals
                          .filter(terminal => terminal.providerId === selectedPaymentProvider)
                          .map((terminal) => (
                            <SelectItem key={terminal.id} value={terminal.id}>
                              <div className="flex items-center gap-2">
                                {terminal.statusInfo?.online ? (
                                  <Wifi className="w-4 h-4 text-green-400" />
                                ) : (
                                  <WifiOff className="w-4 h-4 text-red-400" />
                                )}
                                <span>{terminal.name}</span>
                                {terminal.model && (
                                  <Badge variant="outline" className="text-xs ml-auto">
                                    {terminal.model}
                                  </Badge>
                                )}
                                <Badge 
                                  variant={terminal.statusInfo?.online ? "default" : "destructive"}
                                  className="text-xs ml-auto"
                                >
                                  {terminal.statusInfo?.status || terminal.status}
                                </Badge>
                              </div>
                            </SelectItem>
                          ))
                        }
                      </SelectContent>
                    </Select>
                  </div>
                )}
              </div>
            )}

            {/* Payment Status Display */}
            {paymentStatus.show && (
              <div className={`p-4 rounded-lg border ${
                paymentStatus.type === 'processing' ? 'bg-blue-500/10 border-blue-500/30 text-blue-400' :
                paymentStatus.type === 'success' ? 'bg-green-500/10 border-green-500/30 text-green-400' :
                'bg-red-500/10 border-red-500/30 text-red-400'
              }`}>
                <div className="flex items-center gap-2">
                  {paymentStatus.type === 'processing' && (
                    <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-blue-400" />
                  )}
                  {paymentStatus.type === 'success' && (
                    <div className="w-4 h-4 bg-green-400 rounded-full flex items-center justify-center">
                      <div className="w-2 h-2 bg-white rounded-full" />
                    </div>
                  )}
                  {paymentStatus.type === 'error' && (
                    <div className="w-4 h-4 bg-red-400 rounded-full flex items-center justify-center">
                      <div className="w-2 h-2 bg-white rounded-full" />
                    </div>
                  )}
                  <span className="font-medium">{paymentStatus.message}</span>
                </div>
                {paymentStatus.transactionId && (
                  <p className="text-xs mt-2 opacity-75">
                    Transaction ID: {paymentStatus.transactionId}
                  </p>
                )}
              </div>
            )}

            {/* Printer Selection */}
            <div className="space-y-3">
              <div>
                <label className="text-sm font-medium mb-2 block text-gray-400">Receipt Printer</label>
                <Select
                  value={selectedReceiptPrinter}
                  onValueChange={setSelectedReceiptPrinter}
                >
                  <SelectTrigger className="border-blue-500 bg-gray-800 text-white focus:border-blue-primary focus:ring-blue-primary/20">
                    <SelectValue placeholder="Select receipt printer" />
                  </SelectTrigger>
                  <SelectContent className="bg-gray-400 border-amber-500">
                    {printers.filter(p => p.type === 'thermal').map((printer) => (
                      <SelectItem key={printer.id} value={printer.id}>
                        <div className="flex items-center gap-2">
                          <Printer className="w-4 h-4" />
                          <span>{printer.name}</span>
                          {printer.statusInfo?.online ? (
                            <Badge variant="default" className="text-xs ml-auto">Online</Badge>
                          ) : (
                            <Badge variant="destructive" className="text-xs ml-auto">Offline</Badge>
                          )}
                        </div>
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              
              <div>
                <label className="text-sm font-medium mb-2 block text-gray-400">Invoice Printer (Optional)</label>
                <Select
                  value={selectedInvoicePrinter}
                  onValueChange={setSelectedInvoicePrinter}
                >
                  <SelectTrigger className="border-blue-500 bg-gray-800 text-white focus:border-blue-primary focus:ring-blue-primary/20">
                    <SelectValue placeholder="Select invoice printer" />
                  </SelectTrigger>
                  <SelectContent className="bg-gray-400 border-amber-500">
                    <SelectItem value="none">No invoice printing</SelectItem>
                    {printers.filter(p => p.type === 'inkjet').map((printer) => (
                      <SelectItem key={printer.id} value={printer.id}>
                        <div className="flex items-center gap-2">
                          <Printer className="w-4 h-4" />
                          <span>{printer.name}</span>
                          {printer.statusInfo?.online ? (
                            <Badge variant="default" className="text-xs ml-auto">Online</Badge>
                          ) : (
                            <Badge variant="destructive" className="text-xs ml-auto">Offline</Badge>
                          )}
                        </div>
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>

            {/* Order Summary */}
            <div className="bg-gray-800 rounded-lg p-4 space-y-2 border border-blue-500">
              <div className="flex justify-between text-sm">
                <span className="text-gray-300">Items</span>
                <span className="font-medium text-gray-300">{cart.reduce((sum, item) => sum + item.quantity, 0)}</span>
              </div>
              <div className="flex justify-between text-sm">
                <span className="text-gray-300">Subtotal</span>
                <span className="font-medium text-gray-300">{formatCurrency(subtotal)}</span>
              </div>
              <div className="flex justify-between text-sm">
                <span className="text-gray-300">Tax</span>
                <span className="font-medium text-gray-300">{formatCurrency(gst)}</span>
              </div>
              <Separator className="border-blue-500" />
              <div className="flex justify-between font-bold text-gray-300">
                <span>Total</span>
                <span>{formatCurrency(total)}</span>
              </div>
            </div>
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => setCheckoutOpen(false)} className="border-blue-500 text-gray-300">
              Cancel
            </Button>
            <Button
              onClick={handleCheckout}
              disabled={
                (paymentMethod === 'cash' && (!tenderAmount || parseFloat(tenderAmount) < total)) ||
                ((paymentMethod === 'card' || paymentMethod === 'digital') && (!selectedPaymentProvider || !selectedPaymentTerminal))
              }
              className="gap-2 bg-amber-600 hover:bg-blue-accent text-white"
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
      
      {/* Hold Order Dialog */}
      <Dialog open={holdOrderDialogOpen} onOpenChange={setHoldOrderDialogOpen}>
        <DialogContent className="sm:max-w-md bg-gray-900 border-blue-500">
          <DialogHeader>
            <DialogTitle className="text-gray-400">Hold Current Order</DialogTitle>
            <DialogDescription>
              Save this cart for later processing. Total: <span className="text-gray-400 font-semibold">{formatCurrency(total)}</span>
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4 py-4">
            <div>
              <label className="text-sm font-medium mb-2 block text-gray-400">Table Number (Optional)</label>
              <Input
                value={tableNumber}
                onChange={(e) => setTableNumber(e.target.value)}
                placeholder="Enter table number"
                className="border-blue-500 bg-gray-800 text-white placeholder-gray-400 focus:border-blue-primary"
              />
            </div>
            
            <div>
              <label className="text-sm font-medium mb-2 block text-gray-400">Order Name (Optional)</label>
              <Input
                value={orderName}
                onChange={(e) => setOrderName(e.target.value)}
                placeholder="Enter order name"
                className="border-blue-500 bg-gray-800 text-white placeholder-gray-400 focus:border-blue-primary"
              />
            </div>
            
            <div>
              <label className="text-sm font-medium mb-2 block text-gray-400">Notes (Optional)</label>
              <Input
                value={orderNotes}
                onChange={(e) => setOrderNotes(e.target.value)}
                placeholder="Enter any notes"
                className="border-blue-500 bg-gray-800 text-white placeholder-gray-400 focus:border-blue-primary"
              />
            </div>
            
            {/* Order Summary */}
            <div className="bg-gray-800/50 rounded-lg p-4 space-y-2 border border-blue-500">
              <div className="flex justify-between text-sm">
                <span className="text-gray-300">Items</span>
                <span className="font-medium">{cart.reduce((sum, item) => sum + item.quantity, 0)}</span>
              </div>
              <div className="flex justify-between text-sm">
                <span className="text-gray-300">Subtotal</span>
                <span className="font-medium">{formatCurrency(subtotal)}</span>
              </div>
              <div className="flex justify-between text-sm">
                <span className="text-gray-300">Tax</span>
                <span className="font-medium">{formatCurrency(gst)}</span>
              </div>
              <Separator className="border-blue-500" />
              <div className="flex justify-between font-bold text-gray-400">
                <span>Total</span>
                <span>{formatCurrency(total)}</span>
              </div>
            </div>
          </div>

          <DialogFooter>
            <Button 
              variant="outline" 
              onClick={() => setHoldOrderDialogOpen(false)}
              className="border-blue-500"
              disabled={holdOrderLoading}
            >
              Cancel
            </Button>
            <Button
              onClick={holdCurrentOrder}
              disabled={holdOrderLoading}
              className="gap-2 bg-orange-600 hover:bg-orange-700 text-white"
            >
              {holdOrderLoading ? (
                <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white" />
              ) : (
                <Pause className="w-4 h-4" />
              )}
              Hold Order
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
      
      {/* Held Orders Panel */}
      <HeldOrdersPanel
        isOpen={heldOrdersPanelOpen}
        onClose={() => setHeldOrdersPanelOpen(false)}
        onRetrieveOrder={retrieveHeldOrder}
        storeId={store?.id || ''}
      />
        </TabsContent>

        <TabsContent value="queue" className="space-y-4">
          <OrderQueueTab
            storeId={store?.id || ''}
            onRetrieveOrder={(order) => {
              retrieveHeldOrder(order)
              // Switch back to POS tab after retrieving
              const posTab = document.querySelector('[value="pos"]') as HTMLButtonElement
              posTab?.click()
            }}
            onOrderUpdate={(order) => {
              // Refresh held orders count
              loadHeldOrdersCount()
            }}
          />
        </TabsContent>
      </Tabs>
    </div>
  )
}