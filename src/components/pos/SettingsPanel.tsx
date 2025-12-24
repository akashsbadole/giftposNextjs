'use client'

import { useState, useEffect } from 'react'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Button } from '@/components/ui/button'
import { Label } from '@/components/ui/label'
import { Separator } from '@/components/ui/separator'
import { Badge } from '@/components/ui/badge'
import { useToast } from '@/hooks/use-toast'
import { Store, Save, Database, RefreshCw } from 'lucide-react'

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

export default function SettingsPanel({ employee }: { employee?: any }) {
  const { toast } = useToast()
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
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)

  useEffect(() => {
    loadSettings()
  }, [])

  const loadSettings = async () => {
    try {
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

  const handleSave = async () => {
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
        loadSettings()
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
      <div className="flex items-center justify-center h-[600px]">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary"></div>
      </div>
    )
  }

  return (
    <div className="max-w-2xl space-y-6">
      {/* Store Information */}
      <Card>
        <CardHeader>
          <div className="flex items-center gap-2">
            <Store className="w-5 h-5" />
            <CardTitle>Store Information</CardTitle>
          </div>
          <CardDescription>Configure your store details</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid gap-2">
            <Label htmlFor="name">Store Name *</Label>
            <Input
              id="name"
              value={formData.name}
              onChange={(e) => setFormData({ ...formData, name: e.target.value })}
              placeholder="My Awesome Store"
            />
          </div>

          <div className="grid gap-2">
            <Label htmlFor="address">Address</Label>
            <Input
              id="address"
              value={formData.address}
              onChange={(e) => setFormData({ ...formData, address: e.target.value })}
              placeholder="123 Main St, City"
            />
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div className="grid gap-2">
              <Label htmlFor="phone">Phone</Label>
              <Input
                id="phone"
                type="tel"
                value={formData.phone}
                onChange={(e) => setFormData({ ...formData, phone: e.target.value })}
                placeholder="+1 234 567 8900"
              />
            </div>
            <div className="grid gap-2">
              <Label htmlFor="email">Email</Label>
              <Input
                id="email"
                type="email"
                value={formData.email}
                onChange={(e) => setFormData({ ...formData, email: e.target.value })}
                placeholder="store@example.com"
              />
            </div>
          </div>
        </CardContent>
      </Card>

      {/* GST & Currency */}
      <Card>
        <CardHeader>
          <CardTitle>GST & Currency</CardTitle>
          <CardDescription>Configure Goods and Services Tax rate and currency settings</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid gap-2">
            <Label htmlFor="gstRate">GST Rate (%)</Label>
            <Input
              id="gstRate"
              type="number"
              step="0.01"
              min="0"
              max="100"
              value={formData.gstRate}
              onChange={(e) => setFormData({ ...formData, gstRate: e.target.value })}
            />
            <p className="text-xs text-muted-foreground">
              Goods and Services Tax percentage (e.g., 5, 10, 15)
            </p>
          </div>

          <div className="grid gap-2">
            <Label htmlFor="currency">Currency</Label>
            <Input
              id="currency"
              value={formData.currency}
              onChange={(e) => setFormData({ ...formData, currency: e.target.value.toUpperCase() })}
              placeholder="USD"
              maxLength={3}
            />
            <p className="text-xs text-muted-foreground">
              ISO currency code (e.g., USD, EUR, GBP)
            </p>
          </div>
        </CardContent>
      </Card>

      {/* Database Management */}
      <Card>
        <CardHeader>
          <div className="flex items-center gap-2">
            <Database className="w-5 h-5" />
            <CardTitle>Database Management</CardTitle>
          </div>
          <CardDescription>Manage your store data</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex items-center justify-between p-4 rounded-lg border">
            <div className="flex-1">
              <h4 className="font-medium">Reset All Data</h4>
              <p className="text-sm text-muted-foreground mt-1">
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

      {/* Actions */}
      <div className="flex justify-end gap-3">
        <Button variant="outline" onClick={loadSettings}>
          <RefreshCw className="w-4 h-4 mr-2" />
          Reload
        </Button>
        <Button onClick={handleSave} disabled={saving}>
          <Save className="w-4 h-4 mr-2" />
          {saving ? 'Saving...' : 'Save Settings'}
        </Button>
      </div>
    </div>
  )
}
