/**
 * Enhanced Tax Management Interface
 * Provides comprehensive tax configuration, calculation, and reporting capabilities
 */

'use client'

import React, { useState, useEffect } from 'react'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Textarea } from '@/components/ui/textarea'
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog'
import { Alert, AlertDescription } from '@/components/ui/alert'
import { Badge } from '@/components/ui/badge'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'
import { Switch } from '@/components/ui/switch'
import { Calendar } from '@/components/ui/calendar'
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover'
import { 
  Calculator, 
  Settings, 
  FileText, 
  MapPin, 
  Percent, 
  Plus, 
  Edit, 
  Trash2, 
  Download, 
  Upload,
  AlertCircle,
  CheckCircle,
  TrendingUp,
  BarChart3
} from 'lucide-react'
import { format } from 'date-fns'

interface TaxType {
  id: string
  code: string
  name: string
  description?: string
  isActive: boolean
}

interface TaxRegion {
  id: string
  code: string
  name: string
  type: 'state' | 'union_territory' | 'country' | 'international'
  gstStateCode?: string
  isActive: boolean
}

interface TaxRate {
  id: string
  taxTypeId: string
  taxType: TaxType
  regionId: string
  region: TaxRegion
  rate: number
  effectiveFrom: string
  effectiveTo?: string
  isActive: boolean
}

interface TaxRule {
  id: string
  name: string
  description?: string
  ruleType: 'exemption' | 'holiday' | 'special_scheme' | 'customer_based'
  conditions: any
  taxRateId?: string
  discountPercentage?: number
  effectiveFrom: string
  effectiveTo?: string
  isActive: boolean
  priority: number
}

interface TaxCalculationResult {
  items: Array<{
    productId: string
    taxBreakdown: Array<{
      taxTypeCode: string
      taxTypeName: string
      baseAmount: number
      taxPercentage: number
      taxAmount: number
    }>
    subtotal: number
    totalTax: number
    finalTotal: number
  }>
  sale: {
    subtotal: number
    totalTax: number
    totalTaxBreakdown: Array<{
      taxTypeCode: string
      taxTypeName: string
      baseAmount: number
      taxAmount: number
    }>
    grandTotal: number
  }
}

export default function TaxManagement() {
  // State management
  const [activeTab, setActiveTab] = useState('overview')
  const [taxTypes, setTaxTypes] = useState<TaxType[]>([])
  const [taxRegions, setTaxRegions] = useState<TaxRegion[]>([])
  const [taxRates, setTaxRates] = useState<TaxRate[]>([])
  const [taxRules, setTaxRules] = useState<TaxRule[]>([])
  const [isLoading, setIsLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [success, setSuccess] = useState<string | null>(null)

  // Modal states
  const [showTaxTypeModal, setShowTaxTypeModal] = useState(false)
  const [showTaxRegionModal, setShowTaxRegionModal] = useState(false)
  const [showTaxRateModal, setShowTaxRateModal] = useState(false)
  const [showTaxRuleModal, setShowTaxRuleModal] = useState(false)
  const [showCalculationModal, setShowCalculationModal] = useState(false)
  const [showReportModal, setShowReportModal] = useState(false)

  // Form states
  const [editingTaxType, setEditingTaxType] = useState<TaxType | null>(null)
  const [editingTaxRegion, setEditingTaxRegion] = useState<TaxRegion | null>(null)
  const [editingTaxRate, setEditingTaxRate] = useState<TaxRate | null>(null)
  const [editingTaxRule, setEditingTaxRule] = useState<TaxRule | null>(null)

  // Calculation states
  const [calculationInput, setCalculationInput] = useState({
    items: [{ productId: '', quantity: 1, unitPrice: 0, totalPrice: 0, categoryId: '' }],
    customerRegion: 'MH',
    storeRegion: 'MH',
    isInterState: false,
    isExport: false
  })
  const [calculationResult, setCalculationResult] = useState<TaxCalculationResult | null>(null)

  // Report states
  const [reportConfig, setReportConfig] = useState({
    reportType: 'GSTR1',
    reportPeriod: '2024-12',
    format: 'json'
  })

  // Load initial data
  useEffect(() => {
    loadTaxConfiguration()
  }, [])

  const loadTaxConfiguration = async () => {
    setIsLoading(true)
    setError(null)
    
    try {
      const [typesRes, regionsRes, ratesRes, rulesRes] = await Promise.all([
        fetch('/api/pos/tax/config?type=types'),
        fetch('/api/pos/tax/config?type=regions'),
        fetch('/api/pos/tax/config?type=rates'),
        fetch('/api/pos/tax/config?type=rules')
      ])

      if (!typesRes.ok || !regionsRes.ok || !ratesRes.ok || !rulesRes.ok) {
        throw new Error('Failed to load tax configuration')
      }

      const [typesData, regionsData, ratesData, rulesData] = await Promise.all([
        typesRes.json(),
        regionsRes.json(),
        ratesRes.json(),
        rulesRes.json()
      ])

      setTaxTypes(typesData.data || [])
      setTaxRegions(regionsData.data || [])
      setTaxRates(ratesData.data || [])
      setTaxRules(rulesData.data || [])

    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load data')
    } finally {
      setIsLoading(false)
    }
  }

  const handleTaxCalculation = async () => {
    setIsLoading(true)
    setError(null)
    
    try {
      const response = await fetch('/api/pos/tax/calculate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          items: calculationInput.items,
          customerRegion: calculationInput.customerRegion,
          storeRegion: calculationInput.storeRegion,
          isInterState: calculationInput.isInterState,
          isExport: calculationInput.isExport
        })
      })

      if (!response.ok) {
        throw new Error('Tax calculation failed')
      }

      const result = await response.json()
      setCalculationResult(result.data)
      setSuccess('Tax calculation completed successfully')

    } catch (err) {
      setError(err instanceof Error ? err.message : 'Tax calculation failed')
    } finally {
      setIsLoading(false)
    }
  }

  const generateReport = async () => {
    setIsLoading(true)
    setError(null)
    
    try {
      const response = await fetch('/api/pos/tax/reports', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(reportConfig)
      })

      if (!response.ok) {
        throw new Error('Report generation failed')
      }

      const result = await response.json()
      
      if (reportConfig.format === 'json') {
        // Download JSON file
        const blob = new Blob([JSON.stringify(result, null, 2)], { type: 'application/json' })
        const url = URL.createObjectURL(blob)
        const a = document.createElement('a')
        a.href = url
        a.download = `${reportConfig.reportType}_${reportConfig.reportPeriod}.json`
        a.click()
        URL.revokeObjectURL(url)
      }

      setSuccess('Report generated successfully')

    } catch (err) {
      setError(err instanceof Error ? err.message : 'Report generation failed')
    } finally {
      setIsLoading(false)
    }
  }

  const addTaxItem = () => {
    setCalculationInput(prev => ({
      ...prev,
      items: [...prev.items, { productId: '', quantity: 1, unitPrice: 0, totalPrice: 0, categoryId: '' }]
    }))
  }

  const updateTaxItem = (index: number, field: string, value: any) => {
    setCalculationInput(prev => ({
      ...prev,
      items: prev.items.map((item, i) => 
        i === index ? { ...item, [field]: value } : item
      )
    }))
  }

  const removeTaxItem = (index: number) => {
    setCalculationInput(prev => ({
      ...prev,
      items: prev.items.filter((_, i) => i !== index)
    }))
  }

  return (
    <div className="container mx-auto p-6 space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold">Enhanced Tax Management</h1>
          <p className="text-muted-foreground mt-2">
            Comprehensive multi-tax support with regional variations and compliance reporting
          </p>
        </div>
        <div className="flex gap-2">
          <Button onClick={() => setShowCalculationModal(true)} variant="outline">
            <Calculator className="w-4 h-4 mr-2" />
            Calculate Tax
          </Button>
          <Button onClick={() => setShowReportModal(true)} variant="outline">
            <FileText className="w-4 h-4 mr-2" />
            Generate Report
          </Button>
        </div>
      </div>

      {/* Status Messages */}
      {error && (
        <Alert variant="destructive">
          <AlertCircle className="h-4 w-4" />
          <AlertDescription>{error}</AlertDescription>
        </Alert>
      )}
      
      {success && (
        <Alert>
          <CheckCircle className="h-4 w-4" />
          <AlertDescription>{success}</AlertDescription>
        </Alert>
      )}

      {/* Main Content Tabs */}
      <Tabs value={activeTab} onValueChange={setActiveTab} className="space-y-6">
        <TabsList className="grid w-full grid-cols-6">
          <TabsTrigger value="overview">Overview</TabsTrigger>
          <TabsTrigger value="types">Tax Types</TabsTrigger>
          <TabsTrigger value="regions">Regions</TabsTrigger>
          <TabsTrigger value="rates">Rates</TabsTrigger>
          <TabsTrigger value="rules">Rules</TabsTrigger>
          <TabsTrigger value="reports">Reports</TabsTrigger>
        </TabsList>

        {/* Overview Tab */}
        <TabsContent value="overview" className="space-y-6">
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
            <Card>
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <CardTitle className="text-sm font-medium">Tax Types</CardTitle>
                <Percent className="h-4 w-4 text-muted-foreground" />
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold">{taxTypes.length}</div>
                <p className="text-xs text-muted-foreground">
                  {taxTypes.filter(t => t.isActive).length} active
                </p>
              </CardContent>
            </Card>
            
            <Card>
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <CardTitle className="text-sm font-medium">Regions</CardTitle>
                <MapPin className="h-4 w-4 text-muted-foreground" />
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold">{taxRegions.length}</div>
                <p className="text-xs text-muted-foreground">
                  {taxRegions.filter(r => r.isActive).length} active
                </p>
              </CardContent>
            </Card>
            
            <Card>
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <CardTitle className="text-sm font-medium">Tax Rates</CardTitle>
                <TrendingUp className="h-4 w-4 text-muted-foreground" />
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold">{taxRates.length}</div>
                <p className="text-xs text-muted-foreground">
                  {taxRates.filter(r => r.isActive).length} active
                </p>
              </CardContent>
            </Card>
            
            <Card>
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <CardTitle className="text-sm font-medium">Tax Rules</CardTitle>
                <Settings className="h-4 w-4 text-muted-foreground" />
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold">{taxRules.length}</div>
                <p className="text-xs text-muted-foreground">
                  {taxRules.filter(r => r.isActive).length} active
                </p>
              </CardContent>
            </Card>
          </div>

          {/* Quick Actions */}
          <Card>
            <CardHeader>
              <CardTitle>Quick Actions</CardTitle>
              <CardDescription>Common tax management tasks</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <Button onClick={() => setShowCalculationModal(true)} className="h-20 flex flex-col">
                  <Calculator className="w-6 h-6 mb-2" />
                  Tax Calculator
                </Button>
                <Button onClick={() => setShowReportModal(true)} className="h-20 flex flex-col">
                  <FileText className="w-6 h-6 mb-2" />
                  Generate Reports
                </Button>
                <Button onClick={loadTaxConfiguration} className="h-20 flex flex-col">
                  <BarChart3 className="w-6 h-6 mb-2" />
                  Refresh Data
                </Button>
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        {/* Tax Types Tab */}
        <TabsContent value="types" className="space-y-6">
          <Card>
            <CardHeader>
              <div className="flex items-center justify-between">
                <div>
                  <CardTitle>Tax Types Configuration</CardTitle>
                  <CardDescription>Manage GST, CGST, SGST, IGST, CESS and other tax types</CardDescription>
                </div>
                <Button onClick={() => setShowTaxTypeModal(true)}>
                  <Plus className="w-4 h-4 mr-2" />
                  Add Tax Type
                </Button>
              </div>
            </CardHeader>
            <CardContent>
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Code</TableHead>
                    <TableHead>Name</TableHead>
                    <TableHead>Description</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead>Actions</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {taxTypes.map((taxType) => (
                    <TableRow key={taxType.id}>
                      <TableCell className="font-mono">{taxType.code}</TableCell>
                      <TableCell>{taxType.name}</TableCell>
                      <TableCell>{taxType.description}</TableCell>
                      <TableCell>
                        <Badge variant={taxType.isActive ? 'default' : 'secondary'}>
                          {taxType.isActive ? 'Active' : 'Inactive'}
                        </Badge>
                      </TableCell>
                      <TableCell>
                        <div className="flex gap-2">
                          <Button
                            size="sm"
                            variant="outline"
                            onClick={() => {
                              setEditingTaxType(taxType)
                              setShowTaxTypeModal(true)
                            }}
                          >
                            <Edit className="w-4 h-4" />
                          </Button>
                          <Button size="sm" variant="outline">
                            <Trash2 className="w-4 h-4" />
                          </Button>
                        </div>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </CardContent>
          </Card>
        </TabsContent>

        {/* Tax Regions Tab */}
        <TabsContent value="regions" className="space-y-6">
          <Card>
            <CardHeader>
              <div className="flex items-center justify-between">
                <div>
                  <CardTitle>Tax Regions Configuration</CardTitle>
                  <CardDescription>Manage states, union territories, and countries</CardDescription>
                </div>
                <Button onClick={() => setShowTaxRegionModal(true)}>
                  <Plus className="w-4 h-4 mr-2" />
                  Add Region
                </Button>
              </div>
            </CardHeader>
            <CardContent>
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Code</TableHead>
                    <TableHead>Name</TableHead>
                    <TableHead>Type</TableHead>
                    <TableHead>GST State Code</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead>Actions</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {taxRegions.map((region) => (
                    <TableRow key={region.id}>
                      <TableCell className="font-mono">{region.code}</TableCell>
                      <TableCell>{region.name}</TableCell>
                      <TableCell>
                        <Badge variant="outline">{region.type.replace('_', ' ')}</Badge>
                      </TableCell>
                      <TableCell>{region.gstStateCode || '-'}</TableCell>
                      <TableCell>
                        <Badge variant={region.isActive ? 'default' : 'secondary'}>
                          {region.isActive ? 'Active' : 'Inactive'}
                        </Badge>
                      </TableCell>
                      <TableCell>
                        <div className="flex gap-2">
                          <Button
                            size="sm"
                            variant="outline"
                            onClick={() => {
                              setEditingTaxRegion(region)
                              setShowTaxRegionModal(true)
                            }}
                          >
                            <Edit className="w-4 h-4" />
                          </Button>
                          <Button size="sm" variant="outline">
                            <Trash2 className="w-4 h-4" />
                          </Button>
                        </div>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </CardContent>
          </Card>
        </TabsContent>

        {/* Tax Rates Tab */}
        <TabsContent value="rates" className="space-y-6">
          <Card>
            <CardHeader>
              <div className="flex items-center justify-between">
                <div>
                  <CardTitle>Tax Rates Configuration</CardTitle>
                  <CardDescription>Configure tax rates by region and effective dates</CardDescription>
                </div>
                <Button onClick={() => setShowTaxRateModal(true)}>
                  <Plus className="w-4 h-4 mr-2" />
                  Add Tax Rate
                </Button>
              </div>
            </CardHeader>
            <CardContent>
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Tax Type</TableHead>
                    <TableHead>Region</TableHead>
                    <TableHead>Rate (%)</TableHead>
                    <TableHead>Effective From</TableHead>
                    <TableHead>Effective To</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead>Actions</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {taxRates.map((taxRate) => (
                    <TableRow key={taxRate.id}>
                      <TableCell>{taxRate.taxType.name}</TableCell>
                      <TableCell>{taxRate.region.name}</TableCell>
                      <TableCell>{taxRate.rate}%</TableCell>
                      <TableCell>{format(new Date(taxRate.effectiveFrom), 'MMM dd, yyyy')}</TableCell>
                      <TableCell>{taxRate.effectiveTo ? format(new Date(taxRate.effectiveTo), 'MMM dd, yyyy') : '-'}</TableCell>
                      <TableCell>
                        <Badge variant={taxRate.isActive ? 'default' : 'secondary'}>
                          {taxRate.isActive ? 'Active' : 'Inactive'}
                        </Badge>
                      </TableCell>
                      <TableCell>
                        <div className="flex gap-2">
                          <Button
                            size="sm"
                            variant="outline"
                            onClick={() => {
                              setEditingTaxRate(taxRate)
                              setShowTaxRateModal(true)
                            }}
                          >
                            <Edit className="w-4 h-4" />
                          </Button>
                          <Button size="sm" variant="outline">
                            <Trash2 className="w-4 h-4" />
                          </Button>
                        </div>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </CardContent>
          </Card>
        </TabsContent>

        {/* Tax Rules Tab */}
        <TabsContent value="rules" className="space-y-6">
          <Card>
            <CardHeader>
              <div className="flex items-center justify-between">
                <div>
                  <CardTitle>Tax Rules Configuration</CardTitle>
                  <CardDescription>Manage exemptions, holidays, and special schemes</CardDescription>
                </div>
                <Button onClick={() => setShowTaxRuleModal(true)}>
                  <Plus className="w-4 h-4 mr-2" />
                  Add Tax Rule
                </Button>
              </div>
            </CardHeader>
            <CardContent>
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Name</TableHead>
                    <TableHead>Type</TableHead>
                    <TableHead>Discount %</TableHead>
                    <TableHead>Effective Period</TableHead>
                    <TableHead>Priority</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead>Actions</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {taxRules.map((rule) => (
                    <TableRow key={rule.id}>
                      <TableCell>{rule.name}</TableCell>
                      <TableCell>
                        <Badge variant="outline">{rule.ruleType.replace('_', ' ')}</Badge>
                      </TableCell>
                      <TableCell>{rule.discountPercentage || '-'}</TableCell>
                      <TableCell>
                        {format(new Date(rule.effectiveFrom), 'MMM dd')} - {rule.effectiveTo ? format(new Date(rule.effectiveTo), 'MMM dd, yyyy') : 'Ongoing'}
                      </TableCell>
                      <TableCell>{rule.priority}</TableCell>
                      <TableCell>
                        <Badge variant={rule.isActive ? 'default' : 'secondary'}>
                          {rule.isActive ? 'Active' : 'Inactive'}
                        </Badge>
                      </TableCell>
                      <TableCell>
                        <div className="flex gap-2">
                          <Button
                            size="sm"
                            variant="outline"
                            onClick={() => {
                              setEditingTaxRule(rule)
                              setShowTaxRuleModal(true)
                            }}
                          >
                            <Edit className="w-4 h-4" />
                          </Button>
                          <Button size="sm" variant="outline">
                            <Trash2 className="w-4 h-4" />
                          </Button>
                        </div>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </CardContent>
          </Card>
        </TabsContent>

        {/* Reports Tab */}
        <TabsContent value="reports" className="space-y-6">
          <Card>
            <CardHeader>
              <CardTitle>Tax Reports</CardTitle>
              <CardDescription>Generate compliance reports and tax summaries</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="space-y-4">
                <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                  <Button onClick={() => generateReport()} variant="outline" className="h-20 flex flex-col">
                    <FileText className="w-6 h-6 mb-2" />
                    GSTR-1 Report
                  </Button>
                  <Button onClick={() => generateReport()} variant="outline" className="h-20 flex flex-col">
                    <FileText className="w-6 h-6 mb-2" />
                    GSTR-3B Report
                  </Button>
                  <Button onClick={() => generateReport()} variant="outline" className="h-20 flex flex-col">
                    <BarChart3 className="w-6 h-6 mb-2" />
                    Tax Summary
                  </Button>
                </div>
              </div>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>

      {/* Tax Calculation Modal */}
      <Dialog open={showCalculationModal} onOpenChange={setShowCalculationModal}>
        <DialogContent className="max-w-4xl">
          <DialogHeader>
            <DialogTitle>Tax Calculator</DialogTitle>
            <DialogDescription>Calculate taxes with multiple rates and regional variations</DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            {/* Transaction Configuration */}
            <div className="grid grid-cols-2 gap-4">
              <div>
                <Label>Customer Region</Label>
                <Select value={calculationInput.customerRegion} onValueChange={(value) => 
                  setCalculationInput(prev => ({ ...prev, customerRegion: value }))
                }>
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  {taxRegions.map(region => (
                    <SelectItem key={region.id} value={region.code}>
                      {region.name} ({region.code})
                    </SelectItem>
                  ))}
                </Select>
              </div>
              <div>
                <Label>Store Region</Label>
                <Select value={calculationInput.storeRegion} onValueChange={(value) => 
                  setCalculationInput(prev => ({ ...prev, storeRegion: value }))
                }>
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  {taxRegions.map(region => (
                    <SelectItem key={region.id} value={region.code}>
                      {region.name} ({region.code})
                    </SelectItem>
                  ))}
                </Select>
              </div>
            </div>

            <div className="flex gap-4">
              <div className="flex items-center space-x-2">
                <Switch
                  checked={calculationInput.isInterState}
                  onCheckedChange={(checked) => 
                    setCalculationInput(prev => ({ ...prev, isInterState: checked }))
                  }
                />
                <Label>Inter-State Transaction</Label>
              </div>
              <div className="flex items-center space-x-2">
                <Switch
                  checked={calculationInput.isExport}
                  onCheckedChange={(checked) => 
                    setCalculationInput(prev => ({ ...prev, isExport: checked }))
                  }
                />
                <Label>Export Transaction</Label>
              </div>
            </div>

            {/* Items */}
            <div className="space-y-2">
              <div className="flex justify-between items-center">
                <Label>Line Items</Label>
                <Button size="sm" onClick={addTaxItem}>
                  <Plus className="w-4 h-4 mr-2" />
                  Add Item
                </Button>
              </div>
              {calculationInput.items.map((item, index) => (
                <div key={index} className="grid grid-cols-5 gap-2 items-end">
                  <div>
                    <Label>Product ID</Label>
                    <Input
                      value={item.productId}
                      onChange={(e) => updateTaxItem(index, 'productId', e.target.value)}
                    />
                  </div>
                  <div>
                    <Label>Quantity</Label>
                    <Input
                      type="number"
                      value={item.quantity}
                      onChange={(e) => updateTaxItem(index, 'quantity', parseInt(e.target.value) || 0)}
                    />
                  </div>
                  <div>
                    <Label>Unit Price</Label>
                    <Input
                      type="number"
                      value={item.unitPrice}
                      onChange={(e) => updateTaxItem(index, 'unitPrice', parseFloat(e.target.value) || 0)}
                    />
                  </div>
                  <div>
                    <Label>Total Price</Label>
                    <Input
                      type="number"
                      value={item.totalPrice}
                      onChange={(e) => updateTaxItem(index, 'totalPrice', parseFloat(e.target.value) || 0)}
                    />
                  </div>
                  <div className="flex gap-2">
                    <Button size="sm" variant="outline" onClick={() => removeTaxItem(index)}>
                      <Trash2 className="w-4 h-4" />
                    </Button>
                  </div>
                </div>
              ))}
            </div>

            <Button onClick={handleTaxCalculation} className="w-full" disabled={isLoading}>
              {isLoading ? 'Calculating...' : 'Calculate Tax'}
            </Button>

            {/* Calculation Results */}
            {calculationResult && (
              <div className="space-y-4">
                <h3 className="text-lg font-semibold">Calculation Results</h3>
                <div className="grid grid-cols-3 gap-4">
                  <Card>
                    <CardContent className="p-4">
                      <div className="text-sm text-muted-foreground">Subtotal</div>
                      <div className="text-2xl font-bold">₹{calculationResult.sale.subtotal.toFixed(2)}</div>
                    </CardContent>
                  </Card>
                  <Card>
                    <CardContent className="p-4">
                      <div className="text-sm text-muted-foreground">Total Tax</div>
                      <div className="text-2xl font-bold">₹{calculationResult.sale.totalTax.toFixed(2)}</div>
                    </CardContent>
                  </Card>
                  <Card>
                    <CardContent className="p-4">
                      <div className="text-sm text-muted-foreground">Grand Total</div>
                      <div className="text-2xl font-bold">₹{calculationResult.sale.grandTotal.toFixed(2)}</div>
                    </CardContent>
                  </Card>
                </div>
              </div>
            )}
          </div>
        </DialogContent>
      </Dialog>

      {/* Report Generation Modal */}
      <Dialog open={showReportModal} onOpenChange={setShowReportModal}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Generate Tax Report</DialogTitle>
            <DialogDescription>Create compliance reports for GST filing</DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <div>
              <Label>Report Type</Label>
              <Select value={reportConfig.reportType} onValueChange={(value) => 
                setReportConfig(prev => ({ ...prev, reportType: value }))
              }>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectItem value="GSTR1">GSTR-1 (Outward Supplies)</SelectItem>
                <SelectItem value="GSTR3B">GSTR-3B (Summary)</SelectItem>
                <SelectItem value="monthly_summary">Monthly Summary</SelectItem>
                <SelectItem value="annual_summary">Annual Summary</SelectItem>
                <SelectItem value="tax_liability">Tax Liability</SelectItem>
              </Select>
            </div>
            <div>
              <Label>Report Period</Label>
              <Input
                value={reportConfig.reportPeriod}
                onChange={(e) => setReportConfig(prev => ({ ...prev, reportPeriod: e.target.value }))}
                placeholder="YYYY-MM or YYYY"
              />
            </div>
            <div>
              <Label>Format</Label>
              <Select value={reportConfig.format} onValueChange={(value) => 
                setReportConfig(prev => ({ ...prev, format: value }))
              }>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectItem value="json">JSON</SelectItem>
                <SelectItem value="csv">CSV</SelectItem>
              </Select>
            </div>
            <Button onClick={generateReport} className="w-full" disabled={isLoading}>
              {isLoading ? 'Generating...' : 'Generate Report'}
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  )
}