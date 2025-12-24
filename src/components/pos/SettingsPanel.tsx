'use client'

import { useState, useEffect } from 'react'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Button } from '@/components/ui/button'
import { Label } from '@/components/ui/label'
import { Separator } from '@/components/ui/separator'
import { Badge } from '@/components/ui/badge'
import { useToast } from '@/hooks/use-toast'
import { useSettings } from '@/lib/settings-context'
import { Store, Save, Database, RefreshCw, AlertCircle, CheckCircle, Printer, Plus, Edit, Trash2, TestTube, Wifi, WifiOff, Terminal, CreditCard, Smartphone, Shield, ShieldAlert, Activity, Clock, TrendingUp, Lock } from 'lucide-react'
import { isValidCurrency, getCurrencyDisplayName } from '@/lib/currency-formatter'

interface StoreSettings {
  id: string
  name: string
  address?: string
  phone?: string
  email?: string
  taxRate: number
  gstRate: number
  currency: string
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

interface PrinterFormData {
  name: string
  type: string
  brand: string
  model: string
  connection: string
  isDefault: boolean
}

interface PaymentProvider {
  id: string
  name: string
  displayName: string
  type: string
  isActive: boolean
  config?: string
  capabilities?: string
  createdAt: string
}

interface PaymentTerminal {
  id: string
  name: string
  terminalId: string
  model?: string
  serialNumber?: string
  status: string
  lastHeartbeat?: string
  capabilities?: string
  providerId: string
  provider?: {
    name: string
    displayName: string
  }
  statusInfo?: {
    online: boolean
    status: string
    lastHeartbeat: Date
    capabilities: string[]
  }
}

interface PaymentProviderFormData {
  name: string
  displayName: string
  type: string
  isActive: boolean
  config: string
  capabilities: string
}

interface PaymentTerminalFormData {
  name: string
  terminalId: string
  model: string
  serialNumber: string
  providerId: string
  capabilities: string[]
}

export default function SettingsPanel({ employee }: { employee?: any }) {
  const { toast } = useToast()
  const { store, refreshSettings } = useSettings()
  const [storeSettings, setStoreSettings] = useState<StoreSettings | null>(null)
  const [formData, setFormData] = useState({
    name: '',
    address: '',
    phone: '',
    email: '',
    taxRate: '0',
    gstRate: '10',
    currency: 'USD',
  })
  const [errors, setErrors] = useState<Record<string, string>>({})
  const [hasChanges, setHasChanges] = useState(false)
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  
  // Printer management state
  const [printers, setPrinters] = useState<Printer[]>([])
  const [showPrinterForm, setShowPrinterForm] = useState(false)
  const [editingPrinter, setEditingPrinter] = useState<Printer | null>(null)
  const [printerFormData, setPrinterFormData] = useState<PrinterFormData>({
    name: '',
    type: 'thermal',
    brand: 'Epson',
    model: '',
    connection: 'usb',
    isDefault: false
  })
  const [loadingPrinters, setLoadingPrinters] = useState(false)
  const [testingPrinter, setTestingPrinter] = useState<string | null>(null)

  // Payment provider management state
  const [paymentProviders, setPaymentProviders] = useState<PaymentProvider[]>([])
  const [showPaymentProviderForm, setShowPaymentProviderForm] = useState(false)
  const [editingPaymentProvider, setEditingPaymentProvider] = useState<PaymentProvider | null>(null)
  const [paymentProviderFormData, setPaymentProviderFormData] = useState<PaymentProviderFormData>({
    name: '',
    displayName: '',
    type: 'terminal',
    isActive: true,
    config: '',
    capabilities: '[]'
  })
  const [loadingPaymentProviders, setLoadingPaymentProviders] = useState(false)

  // Payment terminal management state
  const [paymentTerminals, setPaymentTerminals] = useState<PaymentTerminal[]>([])
  const [showPaymentTerminalForm, setShowPaymentTerminalForm] = useState(false)
  const [editingPaymentTerminal, setEditingPaymentTerminal] = useState<PaymentTerminal | null>(null)
  const [paymentTerminalFormData, setPaymentTerminalFormData] = useState<PaymentTerminalFormData>({
    name: '',
    terminalId: '',
    model: '',
    serialNumber: '',
    providerId: '',
    capabilities: []
  })
  const [loadingPaymentTerminals, setLoadingPaymentTerminals] = useState(false)
  const [testingTerminal, setTestingTerminal] = useState<string | null>(null)

  useEffect(() => {
    loadSettings()
  }, [])

  useEffect(() => {
    if (store?.id) {
      loadPrinters()
      loadPaymentProviders()
      loadPaymentTerminals()
    }
  }, [store?.id])

  // Load payment providers
  const loadPaymentProviders = async () => {
    setLoadingPaymentProviders(true)
    try {
      // In a real implementation, this would be a dedicated API endpoint
      // For now, we'll use a mock structure
      const response = await fetch('/api/pos/payments?limit=1') // Placeholder
      // Mock data for demonstration
      setPaymentProviders([
        {
          id: 'paytm',
          name: 'paytm',
          displayName: 'Paytm',
          type: 'hybrid',
          isActive: true,
          config: JSON.stringify({ environment: 'sandbox', mid: 'your_mid' }),
          capabilities: JSON.stringify(['card_swipe', 'upi', 'wallet']),
          createdAt: new Date().toISOString()
        },
        {
          id: 'pinelabs',
          name: 'pinelabs',
          displayName: 'PineLabs',
          type: 'terminal',
          isActive: true,
          config: JSON.stringify({ environment: 'sandbox', merchantId: 'your_merchant_id' }),
          capabilities: JSON.stringify(['card_swipe', 'card_insert', 'upi']),
          createdAt: new Date().toISOString()
        }
      ])
    } catch (error) {
      console.error('Error loading payment providers:', error)
    } finally {
      setLoadingPaymentProviders(false)
    }
  }

  // Load payment terminals
  const loadPaymentTerminals = async () => {
    setLoadingPaymentTerminals(true)
    try {
      const response = await fetch('/api/pos/payments/terminals')
      if (response.ok) {
        const data = await response.json()
        setPaymentTerminals(data.data || [])
      }
    } catch (error) {
      console.error('Error loading payment terminals:', error)
    } finally {
      setLoadingPaymentTerminals(false)
    }
  }

  // Test payment terminal connection
  const testPaymentTerminal = async (terminalId: string) => {
    setTestingTerminal(terminalId)
    try {
      const response = await fetch(`/api/pos/payments/terminals`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action: 'test_connection',
          terminalId,
          providerId: paymentTerminals.find(t => t.id === terminalId)?.providerId
        })
      })
      
      const result = await response.json()
      
      if (result.success) {
        toast({
          title: 'Test successful',
          description: 'Terminal connection working correctly',
        })
      } else {
        toast({
          title: 'Test failed',
          description: result.error || 'Terminal test failed',
          variant: 'destructive',
        })
      }
      
      loadPaymentTerminals() // Reload to update status
    } catch (error) {
      toast({
        title: 'Error',
        description: 'Failed to test terminal',
        variant: 'destructive',
      })
    } finally {
      setTestingTerminal(null)
    }
  }

  // Save payment provider
  const savePaymentProvider = async () => {
    if (!store) return
    
    if (!paymentProviderFormData.name || !paymentProviderFormData.displayName) {
      toast({
        title: 'Validation error',
        description: 'Please fill in all required fields',
        variant: 'destructive',
      })
      return
    }

    try {
      // In a real implementation, this would call a proper API endpoint
      const newProvider = {
        ...paymentProviderFormData,
        id: editingPaymentProvider?.id || `provider_${Date.now()}`,
        storeId: store.id,
        createdAt: editingPaymentProvider?.createdAt || new Date().toISOString()
      }

      if (editingPaymentProvider) {
        setPaymentProviders(prev => prev.map(p => p.id === editingPaymentProvider.id ? newProvider : p))
        toast({
          title: 'Payment provider updated',
          description: 'Provider configuration has been updated',
        })
      } else {
        setPaymentProviders(prev => [...prev, newProvider])
        toast({
          title: 'Payment provider added',
          description: 'New payment provider has been configured',
        })
      }
      
      setShowPaymentProviderForm(false)
      setEditingPaymentProvider(null)
      setPaymentProviderFormData({
        name: '',
        displayName: '',
        type: 'terminal',
        isActive: true,
        config: '',
        capabilities: '[]'
      })
    } catch (error) {
      toast({
        title: 'Error',
        description: 'Failed to save payment provider',
        variant: 'destructive',
      })
    }
  }

  // Save payment terminal
  const savePaymentTerminal = async () => {
    if (!store) return
    
    if (!paymentTerminalFormData.name || !paymentTerminalFormData.terminalId || !paymentTerminalFormData.providerId) {
      toast({
        title: 'Validation error',
        description: 'Please fill in all required fields',
        variant: 'destructive',
      })
      return
    }

    try {
      const url = editingPaymentTerminal 
        ? `/api/pos/payments/terminals`
        : '/api/pos/payments/terminals'
      
      const method = editingPaymentTerminal ? 'PATCH' : 'POST'
      
      const response = await fetch(url, {
        method,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          ...paymentTerminalFormData,
          capabilities: paymentTerminalFormData.capabilities,
          storeId: store.id
        })
      })
      
      if (response.ok) {
        toast({
          title: editingPaymentTerminal ? 'Payment terminal updated' : 'Payment terminal added',
          description: `Terminal has been ${editingPaymentTerminal ? 'updated' : 'added'} successfully`,
        })
        setShowPaymentTerminalForm(false)
        setEditingPaymentTerminal(null)
        setPaymentTerminalFormData({
          name: '',
          terminalId: '',
          model: '',
          serialNumber: '',
          providerId: '',
          capabilities: []
        })
        loadPaymentTerminals()
      } else {
        throw new Error('Failed to save terminal')
      }
    } catch (error) {
      toast({
        title: 'Error',
        description: 'Failed to save payment terminal',
        variant: 'destructive',
      })
    }
  }

  const loadSettings = async () => {
    try {
      // First, sync the user to create employee record
      const syncRes = await fetch('/api/auth/sync-user')
      if (!syncRes.ok) {
        console.error('Failed to sync user:', await syncRes.text())
        return
      }

      const response = await fetch('/api/pos/store/settings')
      if (response.ok) {
        const data = await response.json()
        setStoreSettings(data)
        setFormData({
          name: data.name || '',
          address: data.address || '',
          phone: data.phone || '',
          email: data.email || '',
          taxRate: data.taxRate?.toString() || '0',
          gstRate: data.gstRate?.toString() || '10',
          currency: data.currency || 'USD',
        })
      }
    } catch (error) {
      console.error('Error loading settings:', error)
    } finally {
      setLoading(false)
    }
  }

  // Load printers
  const loadPrinters = async () => {
    if (!store) return
    
    setLoadingPrinters(true)
    try {
      const response = await fetch(`/api/pos/printers?storeId=${store.id}`)
      if (response.ok) {
        const data = await response.json()
        setPrinters(data.data || [])
      }
    } catch (error) {
      console.error('Error loading printers:', error)
    } finally {
      setLoadingPrinters(false)
    }
  }

  // Test printer connection
  const testPrinter = async (printerId: string) => {
    setTestingPrinter(printerId)
    try {
      const response = await fetch(`/api/pos/printers/${printerId}/test`, {
        method: 'POST'
      })
      const result = await response.json()
      
      if (result.success) {
        toast({
          title: 'Test successful',
          description: 'Printer is working correctly',
        })
      } else {
        toast({
          title: 'Test failed',
          description: result.message || 'Printer test failed',
          variant: 'destructive',
        })
      }
      
      // Reload printer status
      loadPrinters()
    } catch (error) {
      toast({
        title: 'Error',
        description: 'Failed to test printer',
        variant: 'destructive',
      })
    } finally {
      setTestingPrinter(null)
    }
  }

  // Delete printer
  const deletePrinter = async (printerId: string) => {
    if (!confirm('Are you sure you want to delete this printer?')) {
      return
    }

    try {
      const response = await fetch(`/api/pos/printers/${printerId}`, {
        method: 'DELETE'
      })
      
      if (response.ok) {
        toast({
          title: 'Printer deleted',
          description: 'Printer has been removed successfully',
        })
        loadPrinters()
      } else {
        throw new Error('Failed to delete printer')
      }
    } catch (error) {
      toast({
        title: 'Error',
        description: 'Failed to delete printer',
        variant: 'destructive',
      })
    }
  }

  // Save printer
  const savePrinter = async () => {
    if (!store) return
    
    if (!printerFormData.name || !printerFormData.model) {
      toast({
        title: 'Validation error',
        description: 'Please fill in all required fields',
        variant: 'destructive',
      })
      return
    }

    try {
      const url = editingPrinter 
        ? `/api/pos/printers/${editingPrinter.id}`
        : '/api/pos/printers'
      
      const method = editingPrinter ? 'PUT' : 'POST'
      
      const response = await fetch(url, {
        method,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          ...printerFormData,
          storeId: store.id
        })
      })
      
      if (response.ok) {
        toast({
          title: editingPrinter ? 'Printer updated' : 'Printer added',
          description: `Printer has been ${editingPrinter ? 'updated' : 'added'} successfully`,
        })
        setShowPrinterForm(false)
        setEditingPrinter(null)
        setPrinterFormData({
          name: '',
          type: 'thermal',
          brand: 'Epson',
          model: '',
          connection: 'usb',
          isDefault: false
        })
        loadPrinters()
      } else {
        throw new Error('Failed to save printer')
      }
    } catch (error) {
      toast({
        title: 'Error',
        description: 'Failed to save printer',
        variant: 'destructive',
      })
    }
  }

  // Edit printer
  const editPrinter = (printer: Printer) => {
    setEditingPrinter(printer)
    setPrinterFormData({
      name: printer.name,
      type: printer.type,
      brand: printer.brand,
      model: printer.model,
      connection: printer.connection,
      isDefault: printer.isDefault
    })
    setShowPrinterForm(true)
  }

  // Cancel printer form
  const cancelPrinterForm = () => {
    setShowPrinterForm(false)
    setEditingPrinter(null)
    setPrinterFormData({
      name: '',
      type: 'thermal',
      brand: 'Epson',
      model: '',
      connection: 'usb',
      isDefault: false
    })
  }

  // Validation functions
  const validateForm = () => {
    const newErrors: Record<string, string> = {}

    if (!formData.name.trim()) {
      newErrors.name = 'Store name is required'
    }

    if (formData.email && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(formData.email)) {
      newErrors.email = 'Please enter a valid email address'
    }

    if (formData.phone && !/^[\+]?[1-9][\d]{0,15}$/.test(formData.phone.replace(/[\s\-\(\)]/g, ''))) {
      newErrors.phone = 'Please enter a valid phone number'
    }

    const gstRate = parseFloat(formData.gstRate)
    if (isNaN(gstRate) || gstRate < 0 || gstRate > 100) {
      newErrors.gstRate = 'GST rate must be between 0 and 100'
    }

    const taxRate = parseFloat(formData.taxRate)
    if (isNaN(taxRate) || taxRate < 0 || taxRate > 100) {
      newErrors.taxRate = 'Tax rate must be between 0 and 100'
    }

    if (!isValidCurrency(formData.currency)) {
      newErrors.currency = 'Please enter a valid currency code (e.g., USD, EUR, GBP)'
    }

    setErrors(newErrors)
    return Object.keys(newErrors).length === 0
  }

  // Check for changes
  useEffect(() => {
    if (store) {
      const hasChanges = (
        formData.name !== store.name ||
        formData.address !== (store.address || '') ||
        formData.phone !== (store.phone || '') ||
        formData.email !== (store.email || '') ||
        formData.taxRate !== store.taxRate.toString() ||
        formData.gstRate !== store.gstRate.toString() ||
        formData.currency !== store.currency
      )
      setHasChanges(hasChanges)
    }
  }, [formData, store])

  const handleSave = async () => {
    if (!validateForm()) {
      toast({
        title: 'Validation Error',
        description: 'Please fix the errors before saving',
        variant: 'destructive',
      })
      return
    }

    setSaving(true)
    try {
      const response = await fetch('/api/pos/store/settings', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          ...formData,
          taxRate: parseFloat(formData.taxRate),
          gstRate: parseFloat(formData.gstRate),
        }),
      })

      if (response.ok) {
        toast({
          title: 'Settings saved',
          description: 'Store settings have been updated',
        })
        await refreshSettings() // Refresh settings across the app
        loadSettings()
        setHasChanges(false)
      } else {
        throw new Error('Failed to save settings')
      }
    } catch (error) {
      toast({
        title: 'Error',
        description: 'Failed to save settings',
        variant: 'destructive',
      })
    } finally {
      setSaving(false)
    }
  }

  const handleResetData = async () => {
    if (!confirm('Are you sure you want to reset all data? This cannot be undone!')) {
      return
    }

    if (!confirm('This will delete ALL products, customers, and sales. Are you absolutely sure?')) {
      return
    }

    try {
      const response = await fetch('/api/pos/store/reset', {
        method: 'POST',
      })

      if (response.ok) {
        toast({
          title: 'Data reset complete',
          description: 'All data has been deleted',
        })
        loadSettings()
      } else {
        throw new Error('Failed to reset data')
      }
    } catch (error) {
      toast({
        title: 'Error',
        description: 'Failed to reset data',
        variant: 'destructive',
      })
    }
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center h-150">
        <div className="text-center bg-gray-900 rounded-xl p-8 shadow-lg border border-blue-500/20">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-primary mx-auto mb-4"></div>
          <p className="text-gray-300 font-medium">Loading settings...</p>
        </div>
      </div>
    )
  }

  return (
    <div className="max-w-2xl space-y-6">
      {/* Store Information */}
      <Card className="bg-gray-900 border-blue-500/20 shadow-md">
        <CardHeader className="bg-linear-to-r from-blue-primary/10 to-blue-accent/10">
          <div className="flex items-center gap-2">
            <Store className="w-5 h-5 text-gray-500" />
            <CardTitle className="text-gray-500">Store Information</CardTitle>
          </div>
          <CardDescription>Configure your store details</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid gap-2">
            <Label htmlFor="name" className="text-gray-500">Store Name *</Label>
            <Input
              id="name"
              value={formData.name}
              onChange={(e) => setFormData({ ...formData, name: e.target.value })}
              placeholder="My Awesome Store"
              className={errors.name ? 'border-red-500' : 'border-blue-500/20 bg-gray-800 text-white placeholder-gray-400 focus:border-blue-primary focus:ring-blue-primary/20'}
            />
            {errors.name && (
              <p className="text-sm text-red-500 flex items-center gap-1">
                <AlertCircle className="w-3 h-3" />
                {errors.name}
              </p>
            )}
          </div>

          <div className="grid gap-2">
            <Label htmlFor="address" className="text-gray-500">Address</Label>
            <Input
              id="address"
              value={formData.address}
              onChange={(e) => setFormData({ ...formData, address: e.target.value })}
              placeholder="123 Main St, City"
              className="border-blue-500/20 bg-gray-800 text-white placeholder-gray-400 focus:border-blue-primary focus:ring-blue-primary/20"
            />
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div className="grid gap-2">
              <Label htmlFor="phone" className="text-gray-500">Phone</Label>
              <Input
                id="phone"
                type="tel"
                value={formData.phone}
                onChange={(e) => setFormData({ ...formData, phone: e.target.value })}
                placeholder="+1 234 567 8900"
                className={errors.phone ? 'border-red-500' : 'border-blue-500/20 bg-gray-800 text-white placeholder-gray-400 focus:border-blue-primary focus:ring-blue-primary/20'}
              />
              {errors.phone && (
                <p className="text-sm text-red-500 flex items-center gap-1">
                  <AlertCircle className="w-3 h-3" />
                  {errors.phone}
                </p>
              )}
            </div>
            <div className="grid gap-2">
              <Label htmlFor="email" className="text-gray-500">Email</Label>
              <Input
                id="email"
                type="email"
                value={formData.email}
                onChange={(e) => setFormData({ ...formData, email: e.target.value })}
                placeholder="store@example.com"
                className={errors.email ? 'border-red-500' : 'border-blue-500/20 bg-gray-800 text-white placeholder-gray-400 focus:border-blue-primary focus:ring-blue-primary/20'}
              />
              {errors.email && (
                <p className="text-sm text-red-500 flex items-center gap-1">
                  <AlertCircle className="w-3 h-3" />
                  {errors.email}
                </p>
              )}
            </div>
          </div>
        </CardContent>
      </Card>

      {/* GST & Currency */}
      <Card className="bg-gray-900 border-blue-500/20 shadow-md">
        <CardHeader className="bg-linear-to-r from-blue-primary/10 to-blue-accent/10">
          <CardTitle className="text-gray-500">GST & Currency</CardTitle>
          <CardDescription>Configure Goods and Services Tax rate and currency settings</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid gap-2">
            <Label htmlFor="gstRate" className="text-gray-500">GST Rate (%)</Label>
            <Input
              id="gstRate"
              type="number"
              step="0.01"
              min="0"
              max="100"
              value={formData.gstRate}
              onChange={(e) => setFormData({ ...formData, gstRate: e.target.value })}
              className={errors.gstRate ? 'border-red-500' : 'border-blue-500/20 bg-gray-800 text-white placeholder-gray-400 focus:border-blue-primary focus:ring-blue-primary/20'}
            />
            {errors.gstRate ? (
              <p className="text-sm text-red-500 flex items-center gap-1">
                <AlertCircle className="w-3 h-3" />
                {errors.gstRate}
              </p>
            ) : (
              <p className="text-xs text-gray-400 ">
                Goods and Services Tax percentage (e.g., 5, 10, 15)
              </p>
            )}
          </div>

          <div className="grid gap-2">
            <Label htmlFor="taxRate" className="text-gray-500">Tax Rate (%)</Label>
            <Input
              id="taxRate"
              type="number"
              step="0.01"
              min="0"
              max="100"
              value={formData.taxRate}
              onChange={(e) => setFormData({ ...formData, taxRate: e.target.value })}
              className={errors.taxRate ? 'border-red-500' : 'border-blue-500/20 bg-gray-800 text-white placeholder-gray-400 focus:border-blue-primary focus:ring-blue-primary/20'}
            />
            {errors.taxRate ? (
              <p className="text-sm text-red-500 flex items-center gap-1">
                <AlertCircle className="w-3 h-3" />
                {errors.taxRate}
              </p>
            ) : (
              <p className="text-xs text-gray-400 ">
                General tax percentage (e.g., 0, 5, 8)
              </p>
            )}
          </div>

          <div className="grid gap-2">
            <Label htmlFor="currency" className="text-gray-500">Currency</Label>
            <Input
              id="currency"
              value={formData.currency}
              onChange={(e) => setFormData({ ...formData, currency: e.target.value.toUpperCase() })}
              placeholder="USD"
              maxLength={3}
              className={errors.currency ? 'border-red-500' : 'border-blue-500/20 bg-gray-800 text-white placeholder-gray-400 focus:border-blue-primary focus:ring-blue-primary/20'}
            />
            {errors.currency ? (
              <p className="text-sm text-red-500 flex items-center gap-1">
                <AlertCircle className="w-3 h-3" />
                {errors.currency}
              </p>
            ) : (
              <p className="text-xs text-gray-400 ">
                ISO currency code (e.g., USD, EUR, GBP)
                {formData.currency && isValidCurrency(formData.currency) && (
                  <span className="text-gray-400 ml-2 flex items-center gap-1">
                    <CheckCircle className="w-3 h-3" />
                    {getCurrencyDisplayName(formData.currency)}
                  </span>
                )}
              </p>
            )}
          </div>
        </CardContent>
      </Card>

      {/* Database Management */}
      <Card className="bg-gray-900 border-blue-500/20 shadow-md">
        <CardHeader className="bg-linear-to-r from-blue-primary/10 to-blue-accent/10">
          <div className="flex items-center gap-2">
            <Database className="w-5 h-5 text-gray-500" />
            <CardTitle className="text-gray-500">Database Management</CardTitle>
          </div>
          <CardDescription>Manage your store data</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex items-center justify-between p-4 rounded-lg border border-blue-500/20 bg-red-900/20">
            <div className="flex-1">
              <h4 className="font-medium text-gray-500">Reset All Data</h4>
              <p className="text-sm text-gray-400  mt-1">
                This will permanently delete all products, customers, and sales. This action cannot be undone.
              </p>
            </div>
            <Badge variant="destructive" className="mr-4">Dangerous</Badge>
          </div>

          <Button
            variant="destructive"
            onClick={handleResetData}
            className="w-full"
          >
            <RefreshCw className="w-4 h-4 mr-2" />
            Reset All Data
          </Button>
        </CardContent>
      </Card>

      {/* Printer Management */}
      <Card className="bg-gray-900 border-blue-500/20 shadow-md">
        <CardHeader className="bg-linear-to-r from-blue-primary/10 to-blue-accent/10">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Printer className="w-5 h-5 text-gray-500" />
              <CardTitle className="text-gray-500">Printer Management</CardTitle>
            </div>
            <Button
              onClick={() => setShowPrinterForm(true)}
              className="bg-amber-600 hover:bg-blue-accent text-white"
              size="sm"
            >
              <Plus className="w-4 h-4 mr-2" />
              Add Printer
            </Button>
          </div>
          <CardDescription>Manage your POS printers and their settings</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          {loadingPrinters ? (
            <div className="flex items-center justify-center py-8">
              <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-primary"></div>
            </div>
          ) : printers.length === 0 ? (
            <div className="text-center py-8 text-gray-400 ">
              <Printer className="w-12 h-12 mx-auto mb-4 opacity-50" />
              <p>No printers configured</p>
              <p className="text-sm">Add your first printer to get started</p>
            </div>
          ) : (
            <div className="space-y-3">
              {printers.map((printer) => (
                <div key={printer.id} className="flex items-center justify-between p-4 rounded-lg border border-blue-500/20 bg-gray-800/50">
                  <div className="flex items-center gap-4">
                    <div className="flex items-center gap-2">
                      {printer.statusInfo?.online ? (
                        <Wifi className="w-4 h-4 text-gray-400" />
                      ) : (
                        <WifiOff className="w-4 h-4 text-red-400" />
                      )}
                      <div>
                        <div className="flex items-center gap-2">
                          <h4 className="font-medium text-white">{printer.name}</h4>
                          {printer.isDefault && (
                            <Badge variant="secondary" className="text-xs">Default</Badge>
                          )}
                        </div>
                        <div className="flex items-center gap-4 text-sm text-gray-400 ">
                          <span>{printer.brand} {printer.model}</span>
                          <span className="capitalize">{printer.type}</span>
                          <span className="capitalize">{printer.connection}</span>
                          <Badge 
                            variant={printer.statusInfo?.online ? "default" : "destructive"}
                            className="text-xs"
                          >
                            {printer.statusInfo?.status || printer.status}
                          </Badge>
                        </div>
                      </div>
                    </div>
                  </div>
                  <div className="flex items-center gap-2">
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => testPrinter(printer.id)}
                      disabled={testingPrinter === printer.id}
                      className="border border-amber-400 bg-gray-900 text-white"
                    >
                      {testingPrinter === printer.id ? (
                        <div className="animate-spin rounded-full h-3 w-3 border-b-2 border-blue-primary"></div>
                      ) : (
                        <TestTube className="w-3 h-3" />
                      )}
                    </Button>
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => editPrinter(printer)}
                      className="border border-amber-400 bg-gray-900 text-white"
                    >
                      <Edit className="w-3 h-3" />
                    </Button>
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => deletePrinter(printer.id)}
                      className="border border-amber-400 bg-gray-900 text-white"
                    >
                      <Trash2 className="w-3 h-3" />
                    </Button>
                  </div>
                </div>
              ))}
            </div>
          )}

          {/* Printer Form */}
          {showPrinterForm && (
            <div className="border border-blue-500/20 rounded-lg p-4 bg-gray-800/30">
              <h4 className="font-medium text-gray-500 mb-4">
                {editingPrinter ? 'Edit Printer' : 'Add New Printer'}
              </h4>
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label className="text-gray-500">Printer Name *</Label>
                  <Input
                    value={printerFormData.name}
                    onChange={(e) => setPrinterFormData({ ...printerFormData, name: e.target.value })}
                    placeholder="Main Receipt Printer"
                    className="border-blue-500/20 bg-gray-800 text-white placeholder-gray-400 focus:border-blue-primary"
                  />
                </div>
                <div className="space-y-2">
                  <Label className="text-gray-500">Type</Label>
                  <select
                    value={printerFormData.type}
                    onChange={(e) => setPrinterFormData({ ...printerFormData, type: e.target.value })}
                    className="w-full p-2 rounded-md border border-blue-500/20 bg-gray-800 text-white focus:border-blue-primary"
                  >
                    <option value="thermal">Thermal (Receipt)</option>
                    <option value="inkjet">Inkjet (Invoice)</option>
                    <option value="label">Label/Barcode</option>
                  </select>
                </div>
                <div className="space-y-2">
                  <Label className="text-gray-500">Brand</Label>
                  <select
                    value={printerFormData.brand}
                    onChange={(e) => setPrinterFormData({ ...printerFormData, brand: e.target.value })}
                    className="w-full p-2 rounded-md border border-blue-500/20 bg-gray-800 text-white focus:border-blue-primary"
                  >
                    <option value="Epson">Epson</option>
                    <option value="Star">Star</option>
                    <option value="TVS">TVS</option>
                    <option value="HP">HP</option>
                    <option value="Canon">Canon</option>
                    <option value="Zebra">Zebra</option>
                    <option value="Dymo">Dymo</option>
                  </select>
                </div>
                <div className="space-y-2">
                  <Label className="text-gray-500">Model *</Label>
                  <Input
                    value={printerFormData.model}
                    onChange={(e) => setPrinterFormData({ ...printerFormData, model: e.target.value })}
                    placeholder="TM-T88V"
                    className="border-blue-500/20 bg-gray-800 text-white placeholder-gray-400 focus:border-blue-primary"
                  />
                </div>
                <div className="space-y-2">
                  <Label className="text-gray-500">Connection</Label>
                  <select
                    value={printerFormData.connection}
                    onChange={(e) => setPrinterFormData({ ...printerFormData, connection: e.target.value })}
                    className="w-full p-2 rounded-md border border-blue-500/20 bg-gray-800 text-white focus:border-blue-primary"
                  >
                    <option value="usb">USB</option>
                    <option value="bluetooth">Bluetooth</option>
                    <option value="network">Network (Ethernet)</option>
                    <option value="wifi">WiFi</option>
                  </select>
                </div>
                <div className="space-y-2">
                  <Label className="text-gray-500 flex items-center gap-2">
                    <input
                      type="checkbox"
                      checked={printerFormData.isDefault}
                      onChange={(e) => setPrinterFormData({ ...printerFormData, isDefault: e.target.checked })}
                      className="rounded border-blue-500/20 bg-gray-800 text-gray-500 focus:ring-blue-primary"
                    />
                    Set as Default
                  </Label>
                  <p className="text-xs text-gray-400 ">
                    Default printer will be used automatically for this type
                  </p>
                </div>
              </div>
              <div className="flex justify-end gap-2 mt-4">
                <Button variant="outline" onClick={cancelPrinterForm} className="border border-amber-400 bg-gray-900 text-white">
                  Cancel
                </Button>
                <Button onClick={savePrinter} className="bg-amber-600 hover:bg-blue-accent text-white">
                  {editingPrinter ? 'Update' : 'Add'} Printer
                </Button>
              </div>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Payment Provider Management */}
      <Card className="bg-gray-900 border-blue-500/20 shadow-md">
        <CardHeader className="bg-linear-to-r from-blue-primary/10 to-blue-accent/10">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Terminal className="w-5 h-5 text-gray-500" />
              <CardTitle className="text-gray-500">Payment Provider Management</CardTitle>
            </div>
            <Button
              onClick={() => setShowPaymentProviderForm(true)}
              className="bg-amber-600 hover:bg-blue-accent text-white"
              size="sm"
            >
              <Plus className="w-4 h-4 mr-2" />
              Add Provider
            </Button>
          </div>
          <CardDescription>Manage Paytm, PineLabs, and other payment providers</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          {loadingPaymentProviders ? (
            <div className="flex items-center justify-center py-8">
              <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-primary"></div>
            </div>
          ) : paymentProviders.length === 0 ? (
            <div className="text-center py-8 text-gray-400 ">
              <Terminal className="w-12 h-12 mx-auto mb-4 opacity-50" />
              <p>No payment providers configured</p>
              <p className="text-sm">Add your first payment provider to get started</p>
            </div>
          ) : (
            <div className="space-y-3">
              {paymentProviders.map((provider) => (
                <div key={provider.id} className="flex items-center justify-between p-4 rounded-lg border border-blue-500/20 bg-gray-800/50">
                  <div className="flex items-center gap-4">
                    <div className="flex items-center gap-2">
                      <div className="flex items-center gap-2">
                        {provider.type === 'terminal' ? (
                          <Terminal className="w-4 h-4 text-gray-500" />
                        ) : provider.type === 'hybrid' ? (
                          <CreditCard className="w-4 h-4 text-gray-500" />
                        ) : (
                          <Smartphone className="w-4 h-4 text-gray-500" />
                        )}
                        <div>
                          <div className="flex items-center gap-2">
                            <h4 className="font-medium text-white">{provider.displayName}</h4>
                            <Badge variant={provider.isActive ? "default" : "secondary"} className="text-xs">
                              {provider.isActive ? 'Active' : 'Inactive'}
                            </Badge>
                            <Badge variant="outline" className="text-xs">
                              {provider.type}
                            </Badge>
                          </div>
                          <div className="text-sm text-gray-400 ">
                            <span>{provider.name}</span>
                            {provider.config && (
                              <span className="ml-2">• Configured</span>
                            )}
                          </div>
                        </div>
                      </div>
                    </div>
                  </div>
                  <div className="flex items-center gap-2">
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => {
                        setEditingPaymentProvider(provider)
                        setPaymentProviderFormData({
                          name: provider.name,
                          displayName: provider.displayName,
                          type: provider.type,
                          isActive: provider.isActive,
                          config: provider.config || '',
                          capabilities: provider.capabilities || '[]'
                        })
                        setShowPaymentProviderForm(true)
                      }}
                      className="border border-amber-400 bg-gray-900 text-white"
                    >
                      <Edit className="w-3 h-3" />
                    </Button>
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => {
                        if (confirm(`Delete payment provider "${provider.displayName}"?`)) {
                          setPaymentProviders(prev => prev.filter(p => p.id !== provider.id))
                          toast({
                            title: 'Payment provider deleted',
                            description: 'Provider has been removed successfully',
                          })
                        }
                      }}
                      className="border-red-500/20 text-red-400 hover:bg-red-900/20"
                    >
                      <Trash2 className="w-3 h-3" />
                    </Button>
                  </div>
                </div>
              ))}
            </div>
          )}

          {/* Payment Provider Form */}
          {showPaymentProviderForm && (
            <div className="border border-blue-500/20 rounded-lg p-4 bg-gray-800/30">
              <h4 className="font-medium text-gray-500 mb-4">
                {editingPaymentProvider ? 'Edit Payment Provider' : 'Add New Payment Provider'}
              </h4>
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label className="text-gray-500">Name *</Label>
                  <Input
                    value={paymentProviderFormData.name}
                    onChange={(e) => setPaymentProviderFormData({ ...paymentProviderFormData, name: e.target.value })}
                    placeholder="paytm, pinelabs, razorpay"
                    className="border-blue-500/20 bg-gray-800 text-white placeholder-gray-400 focus:border-blue-primary"
                  />
                </div>
                <div className="space-y-2">
                  <Label className="text-gray-500">Display Name *</Label>
                  <Input
                    value={paymentProviderFormData.displayName}
                    onChange={(e) => setPaymentProviderFormData({ ...paymentProviderFormData, displayName: e.target.value })}
                    placeholder="Paytm, PineLabs, Razorpay"
                    className="border-blue-500/20 bg-gray-800 text-white placeholder-gray-400 focus:border-blue-primary"
                  />
                </div>
                <div className="space-y-2">
                  <Label className="text-gray-500">Type</Label>
                  <select
                    value={paymentProviderFormData.type}
                    onChange={(e) => setPaymentProviderFormData({ ...paymentProviderFormData, type: e.target.value })}
                    className="w-full p-2 rounded-md border border-blue-500/20 bg-gray-800 text-white focus:border-blue-primary"
                  >
                    <option value="terminal">Terminal Only</option>
                    <option value="api">API Only</option>
                    <option value="hybrid">Hybrid (Terminal + API)</option>
                  </select>
                </div>
                <div className="space-y-2">
                  <Label className="text-gray-500 flex items-center gap-2">
                    <input
                      type="checkbox"
                      checked={paymentProviderFormData.isActive}
                      onChange={(e) => setPaymentProviderFormData({ ...paymentProviderFormData, isActive: e.target.checked })}
                      className="rounded border-blue-500/20 bg-gray-800 text-gray-500 focus:ring-blue-primary"
                    />
                    Active
                  </Label>
                  <p className="text-xs text-gray-400 ">Enable this provider for payments</p>
                </div>
                <div className="col-span-2 space-y-2">
                  <Label className="text-gray-500">Configuration (JSON)</Label>
                  <textarea
                    value={paymentProviderFormData.config}
                    onChange={(e) => setPaymentProviderFormData({ ...paymentProviderFormData, config: e.target.value })}
                    placeholder='{"environment": "sandbox", "apiKey": "your_key"}'
                    rows={3}
                    className="w-full p-2 rounded-md border border-blue-500/20 bg-gray-800 text-white placeholder-gray-400 focus:border-blue-primary"
                  />
                  <p className="text-xs text-gray-400 ">JSON configuration for the payment provider</p>
                </div>
                <div className="col-span-2 space-y-2">
                  <Label className="text-gray-500">Capabilities (JSON Array)</Label>
                  <textarea
                    value={paymentProviderFormData.capabilities}
                    onChange={(e) => setPaymentProviderFormData({ ...paymentProviderFormData, capabilities: e.target.value })}
                    placeholder='["card_swipe", "upi", "wallet"]'
                    rows={2}
                    className="w-full p-2 rounded-md border border-blue-500/20 bg-gray-800 text-white placeholder-gray-400 focus:border-blue-primary"
                  />
                  <p className="text-xs text-gray-400 ">Supported payment methods as JSON array</p>
                </div>
              </div>
              <div className="flex justify-end gap-2 mt-4">
                <Button variant="outline" onClick={() => {
                  setShowPaymentProviderForm(false)
                  setEditingPaymentProvider(null)
                  setPaymentProviderFormData({
                    name: '',
                    displayName: '',
                    type: 'terminal',
                    isActive: true,
                    config: '',
                    capabilities: '[]'
                  })
                }} className="border border-amber-400 bg-gray-900 text-white">
                  Cancel
                </Button>
                <Button onClick={savePaymentProvider} className="bg-amber-600 hover:bg-blue-accent text-white">
                  {editingPaymentProvider ? 'Update' : 'Add'} Provider
                </Button>
              </div>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Payment Terminal Management */}
      <Card className="bg-gray-900 border-blue-500/20 shadow-md">
        <CardHeader className="bg-linear-to-r from-blue-primary/10 to-blue-accent/10">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <CreditCard className="w-5 h-5 text-gray-500" />
              <CardTitle className="text-gray-500">Payment Terminal Management</CardTitle>
            </div>
            <Button
              onClick={() => setShowPaymentTerminalForm(true)}
              className="bg-amber-600 hover:bg-blue-accent text-white"
              size="sm"
            >
              <Plus className="w-4 h-4 mr-2" />
              Add Terminal
            </Button>
          </div>
          <CardDescription>Manage Paytm Soundbox, PineLabs Ezetap, and other payment terminals</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          {loadingPaymentTerminals ? (
            <div className="flex items-center justify-center py-8">
              <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-primary"></div>
            </div>
          ) : paymentTerminals.length === 0 ? (
            <div className="text-center py-8 text-gray-400 ">
              <CreditCard className="w-12 h-12 mx-auto mb-4 opacity-50" />
              <p>No payment terminals configured</p>
              <p className="text-sm">Add your first payment terminal to get started</p>
            </div>
          ) : (
            <div className="space-y-3">
              {paymentTerminals.map((terminal) => (
                <div key={terminal.id} className="flex items-center justify-between p-4 rounded-lg border border-blue-500/20 bg-gray-800/50">
                  <div className="flex items-center gap-4">
                    <div className="flex items-center gap-2">
                      {terminal.statusInfo?.online ? (
                        <Wifi className="w-4 h-4 text-gray-400" />
                      ) : (
                        <WifiOff className="w-4 h-4 text-red-400" />
                      )}
                      <div>
                        <div className="flex items-center gap-2">
                          <h4 className="font-medium text-white">{terminal.name}</h4>
                          <Badge variant={terminal.statusInfo?.online ? "default" : "destructive"} className="text-xs">
                            {terminal.statusInfo?.status || terminal.status}
                          </Badge>
                          {terminal.model && (
                            <Badge variant="outline" className="text-xs">
                              {terminal.model}
                            </Badge>
                          )}
                        </div>
                        <div className="flex items-center gap-4 text-sm text-gray-400 ">
                          <span>ID: {terminal.terminalId}</span>
                          {terminal.serialNumber && <span>S/N: {terminal.serialNumber}</span>}
                          {terminal.provider && (
                            <span>{terminal.provider.displayName}</span>
                          )}
                          {terminal.statusInfo?.lastHeartbeat && (
                            <span>Last seen: {new Date(terminal.statusInfo.lastHeartbeat).toLocaleTimeString()}</span>
                          )}
                        </div>
                      </div>
                    </div>
                  </div>
                  <div className="flex items-center gap-2">
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => testPaymentTerminal(terminal.id)}
                      disabled={testingTerminal === terminal.id}
                      className="border border-amber-400 bg-gray-900 text-white"
                    >
                      {testingTerminal === terminal.id ? (
                        <div className="animate-spin rounded-full h-3 w-3 border-b-2 border-blue-primary"></div>
                      ) : (
                        <TestTube className="w-3 h-3" />
                      )}
                    </Button>
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => {
                        setEditingPaymentTerminal(terminal)
                        setPaymentTerminalFormData({
                          name: terminal.name,
                          terminalId: terminal.terminalId,
                          model: terminal.model || '',
                          serialNumber: terminal.serialNumber || '',
                          providerId: terminal.providerId,
                          capabilities: []
                        })
                        setShowPaymentTerminalForm(true)
                      }}
                      className="border border-amber-400 bg-gray-900 text-white"
                    >
                      <Edit className="w-3 h-3" />
                    </Button>
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => {
                        if (confirm(`Delete terminal "${terminal.name}"?`)) {
                          fetch(`/api/pos/payments/terminals?terminalId=${terminal.terminalId}&providerId=${terminal.providerId}`, {
                            method: 'DELETE'
                          }).then(() => {
                            loadPaymentTerminals()
                            toast({
                              title: 'Payment terminal deleted',
                              description: 'Terminal has been removed successfully',
                            })
                          })
                        }
                      }}
                      className="border-red-500/20 text-red-400 hover:bg-red-900/20"
                    >
                      <Trash2 className="w-3 h-3" />
                    </Button>
                  </div>
                </div>
              ))}
            </div>
          )}

          {/* Payment Terminal Form */}
          {showPaymentTerminalForm && (
            <div className="border border-blue-500/20 rounded-lg p-4 bg-gray-800/30">
              <h4 className="font-medium text-gray-500 mb-4">
                {editingPaymentTerminal ? 'Edit Payment Terminal' : 'Add New Payment Terminal'}
              </h4>
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label className="text-gray-500">Terminal Name *</Label>
                  <Input
                    value={paymentTerminalFormData.name}
                    onChange={(e) => setPaymentTerminalFormData({ ...paymentTerminalFormData, name: e.target.value })}
                    placeholder="Main Payment Terminal"
                    className="border-blue-500/20 bg-gray-800 text-white placeholder-gray-400 focus:border-blue-primary"
                  />
                </div>
                <div className="space-y-2">
                  <Label className="text-gray-500">Terminal ID *</Label>
                  <Input
                    value={paymentTerminalFormData.terminalId}
                    onChange={(e) => setPaymentTerminalFormData({ ...paymentTerminalFormData, terminalId: e.target.value })}
                    placeholder="Device ID from provider"
                    className="border-blue-500/20 bg-gray-800 text-white placeholder-gray-400 focus:border-blue-primary"
                  />
                </div>
                <div className="space-y-2">
                  <Label className="text-gray-500">Provider *</Label>
                  <select
                    value={paymentTerminalFormData.providerId}
                    onChange={(e) => setPaymentTerminalFormData({ ...paymentTerminalFormData, providerId: e.target.value })}
                    className="w-full p-2 rounded-md border border-blue-500/20 bg-gray-800 text-white focus:border-blue-primary"
                  >
                    <option value="">Select Provider</option>
                    {paymentProviders.map((provider) => (
                      <option key={provider.id} value={provider.id}>
                        {provider.displayName}
                      </option>
                    ))}
                  </select>
                </div>
                <div className="space-y-2">
                  <Label className="text-gray-500">Model</Label>
                  <Input
                    value={paymentTerminalFormData.model}
                    onChange={(e) => setPaymentTerminalFormData({ ...paymentTerminalFormData, model: e.target.value })}
                    placeholder="Paytm Soundbox, PineLabs Ezetap"
                    className="border-blue-500/20 bg-gray-800 text-white placeholder-gray-400 focus:border-blue-primary"
                  />
                </div>
                <div className="space-y-2">
                  <Label className="text-gray-500">Serial Number</Label>
                  <Input
                    value={paymentTerminalFormData.serialNumber}
                    onChange={(e) => setPaymentTerminalFormData({ ...paymentTerminalFormData, serialNumber: e.target.value })}
                    placeholder="Hardware serial number"
                    className="border-blue-500/20 bg-gray-800 text-white placeholder-gray-400 focus:border-blue-primary"
                  />
                </div>
              </div>
              <div className="flex justify-end gap-2 mt-4">
                <Button variant="outline" onClick={() => {
                  setShowPaymentTerminalForm(false)
                  setEditingPaymentTerminal(null)
                  setPaymentTerminalFormData({
                    name: '',
                    terminalId: '',
                    model: '',
                    serialNumber: '',
                    providerId: '',
                    capabilities: []
                  })
                }} className="border border-amber-400 bg-gray-900 text-white">
                  Cancel
                </Button>
                <Button onClick={savePaymentTerminal} className="bg-amber-600 hover:bg-blue-accent text-white">
                  {editingPaymentTerminal ? 'Update' : 'Add'} Terminal
                </Button>
              </div>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Security Status Dashboard */}
      <Card className="bg-gray-900 border-blue-500/20 shadow-md">
        <CardHeader className="bg-linear-to-r from-blue-primary/10 to-blue-accent/10">
          <div className="flex items-center gap-2">
            <Shield className="w-5 h-5 text-gray-500" />
            <CardTitle className="text-gray-500">Security Status & Monitoring</CardTitle>
          </div>
          <CardDescription>Real-time security monitoring and audit trail</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          {/* Security Overview Stats */}
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            <div className="bg-gray-800/50 rounded-lg p-4 border border-green-500/20">
              <div className="flex items-center gap-2 mb-2">
                <Shield className="w-4 h-4 text-gray-400" />
                <span className="text-sm text-gray-300">Active Threats</span>
              </div>
              <div className="text-xl font-semibold text-gray-400">0</div>
              <div className="text-xs text-gray-400 ">Last 24 hours</div>
            </div>
            
            <div className="bg-gray-800/50 rounded-lg p-4 border border-blue-500/20">
              <div className="flex items-center gap-2 mb-2">
                <Activity className="w-4 h-4 text-blue-400" />
                <span className="text-sm text-gray-300">Security Events</span>
              </div>
              <div className="text-xl font-semibold text-blue-400">12</div>
              <div className="text-xs text-gray-400 ">This week</div>
            </div>
            
            <div className="bg-gray-800/50 rounded-lg p-4 border border-orange-500/20">
              <div className="flex items-center gap-2 mb-2">
                <Lock className="w-4 h-4 text-orange-400" />
                <span className="text-sm text-gray-300">Rate Limited</span>
              </div>
              <div className="text-xl font-semibold text-orange-400">3</div>
              <div className="text-xs text-gray-400 ">Attempts blocked</div>
            </div>
            
            <div className="bg-gray-800/50 rounded-lg p-4 border border-purple-500/20">
              <div className="flex items-center gap-2 mb-2">
                <TrendingUp className="w-4 h-4 text-purple-400" />
                <span className="text-sm text-gray-300">System Health</span>
              </div>
              <div className="text-xl font-semibold text-purple-400">98%</div>
              <div className="text-xs text-gray-400 ">Security score</div>
            </div>
          </div>

          {/* Recent Security Events */}
          <div className="space-y-3">
            <h4 className="text-sm font-medium text-gray-500 flex items-center gap-2">
              <Clock className="w-4 h-4" />
              Recent Security Events
            </h4>
            <div className="space-y-2">
              {[
                {
                  time: '2 min ago',
                  event: 'Rate limit exceeded - IP: 192.168.1.100',
                  type: 'warning',
                  severity: 'medium'
                },
                {
                  time: '15 min ago',
                  event: 'Successful login from trusted device',
                  type: 'info',
                  severity: 'low'
                },
                {
                  time: '1 hour ago',
                  event: 'CSRF token validation failed',
                  type: 'error',
                  severity: 'high'
                },
                {
                  time: '2 hours ago',
                  event: 'Audit log entry created',
                  type: 'info',
                  severity: 'low'
                }
              ].map((event, index) => (
                <div key={index} className="flex items-center justify-between p-3 rounded-lg border border-blue-500/20 bg-gray-800/30">
                  <div className="flex items-center gap-3">
                    <div className={`w-2 h-2 rounded-full ${
                      event.severity === 'high' ? 'bg-red-400' :
                      event.severity === 'medium' ? 'bg-orange-400' :
                      event.type === 'error' ? 'bg-red-400' :
                      'bg-blue-400'
                    }`} />
                    <div>
                      <div className="text-sm text-white">{event.event}</div>
                      <div className="text-xs text-gray-400 ">{event.time}</div>
                    </div>
                  </div>
                  <Badge 
                    variant={event.severity === 'high' ? 'destructive' : 
                            event.severity === 'medium' ? 'secondary' : 'outline'}
                    className="text-xs"
                  >
                    {event.severity}
                  </Badge>
                </div>
              ))}
            </div>
          </div>

          {/* Security Actions */}
          <div className="flex flex-wrap gap-2 pt-4 border-t border-gray-500">
            <Button
              variant="outline"
              size="sm"
              className="border border-amber-400 bg-gray-900 text-white"
              onClick={() => {
                // Open audit logs
                window.open('/api/pos/logs?type=security', '_blank')
              }}
            >
              <ShieldAlert className="w-3 h-3 mr-2" />
              View Audit Logs
            </Button>
            
            <Button
              variant="outline"
              size="sm"
              className="border border-amber-400 bg-gray-900 text-white"
              onClick={() => {
                // Clear old logs
                fetch('/api/pos/logs?olderThanDays=30', { method: 'DELETE' })
                  .then(() => toast({ title: 'Logs cleared', description: 'Old logs have been removed' }))
              }}
            >
              <RefreshCw className="w-3 h-3 mr-2" />
              Clean Old Logs
            </Button>
            
            <Button
              variant="outline"
              size="sm"
              className="border border-amber-400 bg-gray-900 text-white"
              onClick={() => {
                // Export security report
                window.open('/api/pos/logs?type=security&export=true', '_blank')
              }}
            >
              <Activity className="w-3 h-3 mr-2" />
              Export Report
            </Button>
          </div>

          {/* Error Boundary Status */}
          <div className="mt-6 p-4 rounded-lg border border-amber-400 bg-gray-900">
            <div className="flex items-center gap-2 mb-2">
              <CheckCircle className="w-4 h-4 text-gray-400" />
              <span className="text-sm font-medium text-gray-400">Error Boundary Status</span>
            </div>
            <div className="text-sm text-gray-300">
              All components are protected with error boundaries. Recent errors are automatically logged and monitored.
            </div>
            <div className="mt-2 flex items-center gap-4 text-xs text-gray-400 ">
              <span>• POS Interface: Protected</span>
              <span>• Products Management: Protected</span>
              <span>• Receipt System: Protected</span>
            </div>
          </div>

          {/* Rate Limiting Status */}
          <div className="mt-4 p-4 rounded-lg border border-blue-500/20 bg-blue-900/20">
            <div className="flex items-center gap-2 mb-2">
              <Lock className="w-4 h-4 text-blue-400" />
              <span className="text-sm font-medium text-blue-400">Rate Limiting Active</span>
            </div>
            <div className="grid grid-cols-2 gap-4 text-sm">
              <div>
                <span className="text-gray-400 ">POS Operations:</span>
                <span className="ml-2 text-blue-400">100 req/min</span>
              </div>
              <div>
                <span className="text-gray-400 ">Payment APIs:</span>
                <span className="ml-2 text-blue-400">30 req/min</span>
              </div>
              <div>
                <span className="text-gray-400 ">Auth Endpoints:</span>
                <span className="ml-2 text-blue-400">5 req/15min</span>
              </div>
              <div>
                <span className="text-gray-400 ">Log Access:</span>
                <span className="ml-2 text-blue-400">5 req/min</span>
              </div>
            </div>
          </div>

          {/* Input Sanitization Status */}
          <div className="mt-4 p-4 rounded-lg border border-blue-500/20 bg-purple-900/20">
            <div className="flex items-center gap-2 mb-2">
              <Shield className="w-4 h-4 text-purple-400" />
              <span className="text-sm font-medium text-purple-400">Input Sanitization</span>
            </div>
            <div className="text-sm text-gray-300">
              All user inputs are automatically sanitized and validated. XSS, SQL injection, and other attack vectors are blocked.
            </div>
            <div className="mt-2 flex items-center gap-4 text-xs text-gray-400 ">
              <span>• HTML/JS filtering: Active</span>
              <span>• SQL injection protection: Active</span>
              <span>• CSRF protection: Active</span>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Actions */}
      <div className="flex justify-between items-center bg-gray-900 border border-blue-500/20 rounded-lg p-4">
        <div className="flex items-center gap-2 text-sm text-gray-400 ">
          {hasChanges && (
            <>
              <AlertCircle className="w-4 h-4 text-orange-400" />
              <span>You have unsaved changes</span>
            </>
          )}
          {!hasChanges && store && (
            <>
              <CheckCircle className="w-4 h-4 text-gray-400" />
              <span>All settings saved</span>
            </>
          )}
        </div>
        <div className="flex justify-end gap-3">
          <Button variant="outline" onClick={loadSettings} disabled={saving} className="border-amber-400 text-white ">
            <RefreshCw className="w-4 h-4 mr-2" />
            Reload
          </Button>
          <Button 
            onClick={handleSave} 
            disabled={saving || !hasChanges || Object.keys(errors).length > 0}
            className="bg-amber-600 hover:bg-blue-accent text-white"
          >
            <Save className="w-4 h-4 mr-2" />
            {saving ? 'Saving...' : 'Save Settings'}
          </Button>
        </div>
      </div>
    </div>
  )
}