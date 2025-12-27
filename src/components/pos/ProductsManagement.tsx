'use client'

import { useState, useEffect, useCallback } from 'react'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Button } from '@/components/ui/button'
import { ScrollArea } from '@/components/ui/scroll-area'
import { Badge } from '@/components/ui/badge'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
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
import { Textarea } from '@/components/ui/textarea'
import { Label } from '@/components/ui/label'
import { useToast } from '@/hooks/use-toast'
import { useSettings } from '@/lib/settings-context'
import { useBarcodeScanner, type ScanResult } from '@/hooks/use-barcode-scanner'
import { Search, Plus, Edit, Trash2, Package, AlertCircle, Store, Camera, CameraOff, Scan, Zap, Download, Upload, CheckCircle, XCircle } from 'lucide-react'

interface Product {
  id: string
  name: string
  sku: string
  barcode?: string
  description?: string
  price: number
  cost: number
  stock: number
  minStock: number
  categoryId: string
  category: {
    id: string
    name: string
  }
  isActive: boolean
}

interface Category {
  id: string
  name: string
}

export default function ProductsManagement() {
  const { toast } = useToast()
  const { store, formatCurrency } = useSettings()
  const [products, setProducts] = useState<Product[]>([])
  const [categories, setCategories] = useState<Category[]>([])
  const [searchTerm, setSearchTerm] = useState('')
  const [loading, setLoading] = useState(true)
  const [dialogOpen, setDialogOpen] = useState(false)
  const [editingProduct, setEditingProduct] = useState<Product | null>(null)
  const [importDialogOpen, setImportDialogOpen] = useState(false)
  const [barcodeDialogOpen, setBarcodeDialogOpen] = useState(false)
  const [barcodeValidation, setBarcodeValidation] = useState<{isValid: boolean, format?: string, error?: string} | null>(null)
  
  // Barcode scanning state
  const [lastScan, setLastScan] = useState<ScanResult | null>(null)
  const [formData, setFormData] = useState({
    name: '',
    sku: '',
    barcode: '',
    description: '',
    price: '',
    cost: '',
    stock: '',
    minStock: '',
    categoryId: '',
    isActive: true,
  })

  useEffect(() => {
    loadData()
  }, [])

  const loadData = async () => {
    try {
      // First, sync the user to create employee record
      const syncRes = await fetch('/api/auth/sync-user')
      if (!syncRes.ok) {
        console.error('Failed to sync user:', await syncRes.text())
        return
      }

      const [productsRes, categoriesRes] = await Promise.all([
        fetch('/api/pos/products'),
        fetch('/api/pos/categories'),
      ])

      if (productsRes.ok) {
        const data = await productsRes.json()
        setProducts(data)
      }

      if (categoriesRes.ok) {
        const data = await categoriesRes.json()
        setCategories(data)
      }
    } catch (error) {
      console.error('Error loading data:', error)
    } finally {
      setLoading(false)
    }
  }

  const filteredProducts = products.filter(
    (product) =>
      product.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
      product.sku.toLowerCase().includes(searchTerm.toLowerCase()) ||
      product.barcode?.toLowerCase().includes(searchTerm.toLowerCase())
  )

  // Validate barcode format
  const validateBarcode = useCallback((barcode: string) => {
    if (!barcode.trim()) {
      setBarcodeValidation(null)
      return
    }
    
    const formats = {
      ean13: /^\d{13}$/,
      ean8: /^\d{8}$/,
      upcA: /^\d{12}$/,
      upcE: /^\d{8}$/,
      code128: /^[\x00-\x7F]+$/,
      code39: /^[0-9A-Z\-\.\$\/\+\%\*\s]+$/,
      itf14: /^\d{14}$/,
      codabar: /^[0-9\-\$\:\.\/\+ABCD]+$/,
    }
    
    for (const [formatName, pattern] of Object.entries(formats)) {
      if (pattern.test(barcode.trim())) {
        setBarcodeValidation({ isValid: true, format: formatName.toUpperCase() })
        return
      }
    }
    
    setBarcodeValidation({ isValid: false, error: 'Invalid barcode format' })
  }, [])

  const handleBarcodeScan = useCallback(async (result: ScanResult) => {
    setLastScan(result)
    setFormData(prev => ({ ...prev, barcode: result.code }))
    
    // Check if barcode already exists
    try {
      const response = await fetch(`/api/pos/barcode?barcode=${encodeURIComponent(result.code)}`)
      if (response.ok) {
        const existingProduct = await response.json()
        if (!editingProduct || existingProduct.id !== editingProduct.id) {
          toast({
            title: 'Barcode Already Exists',
            description: `This barcode is already used by: ${existingProduct.name}`,
            variant: 'destructive',
          })
        }
      }
    } catch (error) {
      console.error('Barcode validation error:', error)
    }
  }, [editingProduct, toast])

  const {
    isScanning,
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
    visualFeedback: false
  })

  const handleAdd = () => {
    setEditingProduct(null)
    setFormData({
      name: '',
      sku: '',
      barcode: '',
      description: '',
      price: '',
      cost: '',
      stock: '0',
      minStock: '0',
      categoryId: '',
      isActive: true,
    })
    setBarcodeValidation(null)
    setLastScan(null)
    setDialogOpen(true)
    startScan()
  }

  const handleEdit = (product: Product) => {
    setEditingProduct(product)
    setFormData({
      name: product.name,
      sku: product.sku,
      barcode: product.barcode || '',
      description: product.description || '',
      price: product.price.toString(),
      cost: product.cost.toString(),
      stock: product.stock.toString(),
      minStock: product.minStock.toString(),
      categoryId: product.categoryId,
      isActive: product.isActive,
    })
    validateBarcode(product.barcode || '')
    setLastScan(null)
    setDialogOpen(true)
    startScan()
  }

  const handleSubmit = async () => {
    try {
      const url = editingProduct
        ? `/api/pos/products/${editingProduct.id}`
        : '/api/pos/products'

      const response = await fetch(url, {
        method: editingProduct ? 'PUT' : 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          ...formData,
          price: parseFloat(formData.price),
          cost: parseFloat(formData.cost),
          stock: parseInt(formData.stock),
          minStock: parseInt(formData.minStock),
        } as any),
      })

      if (response.ok) {
        toast({
          title: editingProduct ? 'Product updated' : 'Product created',
          description: `${formData.name} has been ${editingProduct ? 'updated' : 'added'}`,
        })
        setDialogOpen(false)
        loadData()
      } else {
        throw new Error('Failed to save product')
      }
    } catch (error) {
      toast({
        title: 'Error',
        description: 'Failed to save product',
        variant: 'destructive',
      })
    }
  }

  const handleDelete = async (id: string) => {
    if (!confirm('Are you sure you want to delete this product?')) return

    try {
      const response = await fetch(`/api/pos/products/${id}`, {
        method: 'DELETE',
      })

      if (response.ok) {
        toast({
          title: 'Product deleted',
          description: 'Product has been removed',
        })
        loadData()
      }
    } catch (error) {
      toast({
        title: 'Error',
        description: 'Failed to delete product',
        variant: 'destructive',
      })
    }
  }

  // Export products to CSV
  const handleExportCSV = () => {
    const headers = ['Name', 'SKU', 'Barcode', 'Price', 'Cost', 'Stock', 'Min Stock', 'Category', 'Description', 'Status']
    const csvContent = [
      headers.join(','),
      ...products.map(product => [
        `"${product.name}"`,
        product.sku,
        product.barcode || '',
        product.price,
        product.cost,
        product.stock,
        product.minStock,
        `"${product.category.name}"`,
        `"${product.description || ''}"`,
        product.isActive ? 'Active' : 'Inactive'
      ].join(','))
    ].join('\n')

    const blob = new Blob([csvContent], { type: 'text/csv' })
    const url = URL.createObjectURL(blob)
    const link = document.createElement('a')
    link.href = url
    link.download = `products_${new Date().toISOString().split('T')[0]}.csv`
    document.body.appendChild(link)
    link.click()
    document.body.removeChild(link)
    URL.revokeObjectURL(url)
    
    toast({
      title: 'Export successful',
      description: 'Products exported to CSV',
    })
  }

  // Enhanced CSV parsing function
  const parseCSVLine = (line: string): string[] => {
    const result: string[] = []
    let current = ''
    let inQuotes = false
    let i = 0
    
    while (i < line.length) {
      const char = line[i]
      const nextChar = line[i + 1]
      
      if (char === '"') {
        if (inQuotes && nextChar === '"') {
          // Escaped quote
          current += '"'
          i += 2
          continue
        } else {
          // Toggle quote state
          inQuotes = !inQuotes
          i++
          continue
        }
      }
      
      if (char === ',' && !inQuotes) {
        result.push(current.trim())
        current = ''
        i++
        continue
      }
      
      current += char
      i++
    }
    
    result.push(current.trim())
    return result
  }

  // Auto-create category if it doesn't exist
  const getOrCreateCategory = async (categoryName: string): Promise<string | null> => {
    if (!categoryName.trim()) return null
    
    // First, try to find existing category
    let category = categories.find(c => 
      c.name.toLowerCase() === categoryName.toLowerCase()
    )
    
    if (category) {
      return category.id
    }
    
    // If not found, create it
    try {
      const slug = categoryName.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/(^-|-$)/g, '')
      const response = await fetch('/api/pos/categories', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: categoryName,
          slug: slug,
          color: '#3b82f6'
        })
      })
      
      if (response.ok) {
        const newCategory = await response.json()
        // Update local categories state
        setCategories(prev => [...prev, newCategory])
        return newCategory.id
      } else {
        console.error('Failed to create category:', await response.text())
        return null
      }
    } catch (error) {
      console.error('Error creating category:', error)
      return null
    }
  }

  // Import products from CSV with enhanced parsing
  const handleImportCSV = async (file: File) => {
    try {
      const text = await file.text()
      const lines = text.split('\n').filter(line => line.trim())
      
      if (lines.length === 0) {
        toast({
          title: 'Import Error',
          description: 'CSV file is empty',
          variant: 'destructive'
        })
        return
      }
      
      // Parse headers with enhanced CSV handling
      const headers = parseCSVLine(lines[0]).map(h => h.toLowerCase().replace(/[^a-z0-9]/g, ''))
      
      // Validate required headers
      const requiredHeaders = ['name', 'sku', 'price']
      const missingHeaders = requiredHeaders.filter(h => !headers.includes(h))
      
      if (missingHeaders.length > 0) {
        toast({
          title: 'Import Error',
          description: `Missing required columns: ${missingHeaders.join(', ')}`,
          variant: 'destructive'
        })
        return
      }
      
      const results = { 
        success: 0, 
        errors: 0, 
        createdCategories: 0,
        errorMessages: [] as string[] 
      }
      
      // Process each line
      for (let i = 1; i < lines.length; i++) {
        const values = parseCSVLine(lines[i])
        
        if (values.length === 1 && !values[0]) continue // Skip empty lines
        if (values.length < headers.length) {
          results.errors++
          results.errorMessages.push(`Row ${i + 1}: Insufficient columns (expected ${headers.length}, got ${values.length})`)
          continue
        }
        
        const productData: any = {}
        headers.forEach((header, index) => {
          productData[header] = values[index] || ''
        })
        
        try {
          // Validate required fields
          if (!productData.name?.trim() || !productData.sku?.trim() || !productData.price) {
            results.errors++
            results.errorMessages.push(`Row ${i + 1}: Missing required fields (Name, SKU, Price)`)
            continue
          }
          
          // Get or create category
          const categoryId = await getOrCreateCategory(productData.category || 'Uncategorized')
          if (!categoryId) {
            results.errors++
            results.errorMessages.push(`Row ${i + 1}: Failed to get or create category "${productData.category || 'Uncategorized'}"`)
            continue
          }
          
          // Validate numeric fields
          const price = parseFloat(productData.price)
          const cost = parseFloat(productData.cost) || 0
          const stock = parseInt(productData.stock) || 0
          const minStock = parseInt(productData.minstock) || 0
          
          if (isNaN(price) || price < 0) {
            results.errors++
            results.errorMessages.push(`Row ${i + 1}: Invalid price value "${productData.price}"`)
            continue
          }
          
          if (isNaN(cost) || cost < 0) {
            results.errors++
            results.errorMessages.push(`Row ${i + 1}: Invalid cost value "${productData.cost}"`)
            continue
          }
          
          if (isNaN(stock) || stock < 0) {
            results.errors++
            results.errorMessages.push(`Row ${i + 1}: Invalid stock value "${productData.stock}"`)
            continue
          }
          
          if (isNaN(minStock) || minStock < 0) {
            results.errors++
            results.errorMessages.push(`Row ${i + 1}: Invalid min stock value "${productData.minstock}"`)
            continue
          }
          
          const response = await fetch('/api/pos/products', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              name: productData.name.trim(),
              sku: productData.sku.trim(),
              barcode: productData.barcode?.trim() || null,
              price: price,
              cost: cost,
              stock: stock,
              minStock: minStock,
              categoryId: categoryId,
              description: productData.description?.trim() || null,
              isActive: productData.status?.toLowerCase() !== 'inactive'
            })
          })
          
          if (response.ok) {
            results.success++
          } else {
            const error = await response.text()
            results.errors++
            results.errorMessages.push(`Row ${i + 1}: ${error}`)
          }
        } catch (error) {
          results.errors++
          results.errorMessages.push(`Row ${i + 1}: ${error}`)
        }
      }
      
      // Show detailed results
      const description = `${results.success} products imported successfully`
      const errorDetails = results.errors > 0 ? `, ${results.errors} errors` : ''
      const categoryDetails = results.createdCategories > 0 ? `, ${results.createdCategories} categories created` : ''
      
      toast({
        title: 'Import completed',
        description: description + errorDetails + categoryDetails,
        variant: results.errors > 0 ? 'destructive' : 'default'
      })
      
      // Log detailed errors for debugging
      if (results.errorMessages.length > 0) {
        console.group('Import Errors')
        results.errorMessages.forEach((error, index) => {
          console.error(`Error ${index + 1}:`, error)
        })
        console.groupEnd()
      }
      
      setImportDialogOpen(false)
      
      // Reload data to show imported products
      await loadData()
      
    } catch (error) {
      console.error('Import process failed:', error)
      toast({
        title: 'Import Failed',
        description: 'Failed to process CSV file. Please check the file format.',
        variant: 'destructive'
      })
    }
  }

  const lowStockProducts = products.filter((p) => 
    p.stock <= (p.minStock || store?.globalMinStock || 5)
  )

  if (loading) {
    return (
      <div className="flex items-center justify-center h-150">
        <div className="text-center bg-gray-900 rounded-xl p-8 shadow-lg border border-blue-500">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-primary mx-auto mb-4"></div>
          <p className="text-gray-300 font-medium">Loading products...</p>
        </div>
      </div>
    )
  }

  return (
    <div className="space-y-6">
      {/* Store Header */}
      {store && (
        <Card className="bg-linear-to-r from-gray-900 to-blue-900/20 border-blue-500 shadow-md">
          <CardContent className="p-4">
            <div className="flex items-center gap-2">
              <Store className="w-5 h-5 text-gray-500" />
              <div>
                <h2 className="font-semibold text-gray-500">{store.name} - Inventory Management</h2>
                {store.address && <p className="text-sm text-gray-300">{store.address}</p>}
              </div>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Low Stock Alert */}
      {lowStockProducts.length > 0 && (
        <Card className="border-blue-accent/30 bg-linear-to-r from-blue-accent/10 to-blue-secondary/10">
          <CardContent className="p-4">
            <div className="flex items-center gap-2 text-blue-accent">
              <AlertCircle className="w-5 h-5" />
              <span className="font-medium">
                {lowStockProducts.length} product(s) are low on stock
              </span>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Products List */}
      <Card className="bg-gray-900 border-blue-500 shadow-md">
        <CardHeader className="bg-linear-to-r from-blue-primary/10 to-blue-accent/10">
          <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
            <div>
              <CardTitle className="text-gray-500">Products</CardTitle>
              <CardDescription>
                Manage your product inventory ({products.length} total)
              </CardDescription>
            </div>
            <div className="flex gap-2">
              <Button onClick={handleAdd} className="bg-amber-600 hover:bg-blue-accent text-white shadow-lg">
                <Plus className="w-4 h-4 mr-2" />
                Add Product
              </Button>
              <Button 
                variant="outline" 
                onClick={() => setImportDialogOpen(true)}
                className="border-blue-500 text-gray-500 hover:bg-amber-600"
              >
                <Upload className="w-4 h-4 mr-2" />
                Import CSV
              </Button>
              <Button 
                variant="outline" 
                onClick={handleExportCSV}
                className="border-blue-500 text-gray-500 hover:bg-amber-600"
              >
                <Download className="w-4 h-4 mr-2" />
                Export CSV
              </Button>
            </div>
          </div>
        </CardHeader>
        <CardContent>
          <div className="flex gap-4 mb-4">
            <div className="relative flex-1">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-500" />
              <Input
                placeholder="Search products, SKU, or barcode..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="pl-10 border-blue-500 bg-gray-800 text-white placeholder-gray-400 focus:border-blue-primary focus:ring-blue-primary/20"
              />
            </div>
          </div>

          <ScrollArea className="h-[calc(100vh-350px)]">
            <div className="grid gap-4">
              {filteredProducts.length === 0 ? (
                <div className="text-center py-12 text-gray-400 ">
                  <Package className="w-12 h-12 mx-auto mb-4 text-gray-500/50" />
                  <p>No products found</p>
                </div>
              ) : (
                filteredProducts.map((product) => (
                  <Card key={product.id} className="hover:shadow-lg transition-all bg-gray-800 border-blue-500 hover:border-blue-primary/50">
                    <CardContent className="p-4">
                      <div className="flex items-start justify-between gap-4">
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-2 mb-1">
                            <h3 className="font-semibold truncate text-gray-500">{product.name}</h3>
                            {!product.isActive && (
                              <Badge variant="secondary" className="text-xs bg-gray-600 text-gray-300">
                                Inactive
                              </Badge>
                            )}
                          </div>
                          <div className="flex flex-wrap gap-2 text-sm text-gray-400 ">
                            <span>SKU: {product.sku}</span>
                            {product.barcode && <span>• Barcode: {product.barcode}</span>}
                          </div>
                          <div className="flex flex-wrap gap-4 mt-2 text-sm">
                            <Badge variant="outline" className="border-blue-primary/30 bg-amber-600 text-gray-500">{product.category.name}</Badge>
                            <span className="font-medium text-gray-500">{formatCurrency(product.price)}</span>
                          </div>
                        </div>
                        <div className="flex items-center gap-2">
                          <Badge
                            variant={product.stock <= (product.minStock || store?.globalMinStock || 5) ? 'destructive' : 'secondary'}
                          >
                            Stock: {product.stock}
                          </Badge>
                          <Button
                            variant="ghost"
                            size="icon"
                            onClick={() => handleEdit(product)}
                            className="text-gray-500 hover:text-white hover:bg-amber-600"
                          >
                            <Edit className="w-4 h-4" />
                          </Button>
                          <Button
                            variant="ghost"
                            size="icon"
                            onClick={() => handleDelete(product.id)}
                            className="text-gray-400 hover:text-white hover:bg-destructive"
                          >
                            <Trash2 className="w-4 h-4" />
                          </Button>
                        </div>
                      </div>
                    </CardContent>
                  </Card>
                ))
              )}
            </div>
          </ScrollArea>
        </CardContent>
      </Card>

      {/* Add/Edit Dialog */}
      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent className="sm:max-w-lg bg-gray-900 border-blue-500">
          <DialogHeader>
            <DialogTitle className="text-gray-500">
              {editingProduct ? 'Edit Product' : 'Add New Product'}
            </DialogTitle>
            <DialogDescription>
              {editingProduct ? 'Update product information' : 'Add a new product to inventory'}
            </DialogDescription>
          </DialogHeader>

          <div className="grid gap-4 py-4">
            <div className="grid gap-2">
              <Label htmlFor="name" className="text-gray-500">Product Name *</Label>
              <Input
                id="name"
                value={formData.name}
                onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                className="border-blue-500 bg-gray-800 text-white placeholder-gray-400 focus:border-blue-primary focus:ring-blue-primary/20"
              />
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div className="grid gap-2">
                <Label htmlFor="sku" className="text-gray-500">SKU *</Label>
                <Input
                  id="sku"
                  value={formData.sku}
                  onChange={(e) => setFormData({ ...formData, sku: e.target.value })}
                  className="border-blue-500 bg-gray-800 text-white placeholder-gray-400 focus:border-blue-primary focus:ring-blue-primary/20"
                />
              </div>
              <div className="grid gap-2">
                <Label htmlFor="barcode" className="text-gray-500">Barcode</Label>
                <div className="space-y-2">
                  <div className="flex gap-2">
                    <Input
                      id="barcode"
                      value={formData.barcode}
                      onChange={(e) => {
                        setFormData({ ...formData, barcode: e.target.value })
                        validateBarcode(e.target.value)
                      }}
                      onKeyDown={(e) => {
                        if (e.key === 'Enter') {
                          const code = e.currentTarget.value.trim()
                          if (code) {
                            manualInput(code)
                          }
                        }
                      }}
                      placeholder="Scan or enter barcode..."
                      className="border-blue-500 bg-gray-800 text-white placeholder-gray-400 focus:border-blue-primary focus:ring-blue-primary/20"
                    />
                    <Button
                      type="button"
                      variant="outline"
                      size="sm"
                      onClick={toggleCamera}
                      className={`border-blue-500 hover:bg-amber-600 ${
                        isCameraActive ? 'text-red-400 border-red-400/50' : 'text-gray-500'
                      }`}
                      title={isCameraActive ? 'Stop camera scanning' : 'Start camera scanning'}
                    >
                      {isCameraActive ? <CameraOff className="w-4 h-4" /> : <Camera className="w-4 h-4" />}
                    </Button>
                  </div>
                  
                  {/* Barcode Validation Feedback */}
                  {barcodeValidation && (
                    <div className={`flex items-center gap-2 text-sm ${
                      barcodeValidation.isValid ? 'text-green-400' : 'text-red-400'
                    }`}>
                      {barcodeValidation.isValid ? (
                        <CheckCircle className="w-4 h-4" />
                      ) : (
                        <XCircle className="w-4 h-4" />
                      )}
                      {barcodeValidation.isValid ? (
                        <span>Valid {barcodeValidation.format} format</span>
                      ) : (
                        <span>{barcodeValidation.error}</span>
                      )}
                    </div>
                  )}
                  
                  {/* Last Scan Display */}
                  {lastScan && (
                    <div className="flex items-center gap-2 text-sm text-gray-500">
                      <Zap className="w-4 h-4" />
                      <span>Last scan: {lastScan.code}</span>
                      {lastScan.format && (
                        <Badge variant="outline" className="text-xs px-1 py-0">
                          {lastScan.format}
                        </Badge>
                      )}
                    </div>
                  )}
                  
                  {/* Scanner Status */}
                  <div className="flex items-center gap-2 text-xs text-gray-400 ">
                    <div className={`w-2 h-2 rounded-full ${
                      isScanning ? 'bg-green-400 animate-pulse' : 'bg-gray-500'
                    }`} />
                    <span>{isScanning ? 'Scanner Active' : 'Scanner Inactive'}</span>
                    {scannerError && <span className="text-red-400">Error: {scannerError}</span>}
                  </div>
                </div>
              </div>
            </div>

            <div className="grid gap-2">
              <Label htmlFor="category" className="text-gray-500">Category *</Label>
              <Select
                value={formData.categoryId}
                onValueChange={(value) => setFormData({ ...formData, categoryId: value })}
              >
                <SelectTrigger id="category" className="border-blue-500 bg-gray-800 text-white focus:border-blue-primary focus:ring-blue-primary/20">
                  <SelectValue placeholder="Select category" />
                </SelectTrigger>
                <SelectContent className="bg-gray-400 border-amber-500">
                  {categories.map((category) => (
                    <SelectItem key={category.id} value={category.id}>
                      {category.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div className="grid gap-2">
                <Label htmlFor="price" className="text-gray-500">Price *</Label>
                <Input
                  id="price"
                  type="number"
                  step="0.01"
                  value={formData.price}
                  onChange={(e) => setFormData({ ...formData, price: e.target.value })}
                  className="border-blue-500 bg-gray-800 text-white placeholder-gray-400 focus:border-blue-primary focus:ring-blue-primary/20"
                />
              </div>
              <div className="grid gap-2">
                <Label htmlFor="cost" className="text-gray-500">Cost</Label>
                <Input
                  id="cost"
                  type="number"
                  step="0.01"
                  value={formData.cost}
                  onChange={(e) => setFormData({ ...formData, cost: e.target.value })}
                  className="border-blue-500 bg-gray-800 text-white placeholder-gray-400 focus:border-blue-primary focus:ring-blue-primary/20"
                />
              </div>
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div className="grid gap-2">
                <Label htmlFor="stock" className="text-gray-500">Stock *</Label>
                <Input
                  id="stock"
                  type="number"
                  value={formData.stock}
                  onChange={(e) => setFormData({ ...formData, stock: e.target.value })}
                  className="border-blue-500 bg-gray-800 text-white placeholder-gray-400 focus:border-blue-primary focus:ring-blue-primary/20"
                />
              </div>
              <div className="grid gap-2">
                <Label htmlFor="minStock" className="text-gray-500">Min Stock Alert</Label>
                <Input
                  id="minStock"
                  type="number"
                  value={formData.minStock}
                  onChange={(e) => setFormData({ ...formData, minStock: e.target.value })}
                  className="border-blue-500 bg-gray-800 text-white placeholder-gray-400 focus:border-blue-primary focus:ring-blue-primary/20"
                />
              </div>
            </div>

            <div className="grid gap-2">
              <Label htmlFor="description" className="text-gray-500">Description</Label>
              <Textarea
                id="description"
                value={formData.description}
                onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                rows={3}
                className="border-blue-500 bg-gray-800 text-white placeholder-gray-400 focus:border-blue-primary focus:ring-blue-primary/20"
              />
            </div>
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => setDialogOpen(false)} className="border-blue-500">
              Cancel
            </Button>
            <Button onClick={handleSubmit} className="bg-amber-600 hover:bg-blue-accent text-white">
              {editingProduct ? 'Update' : 'Create'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Import CSV Dialog */}
      <Dialog open={importDialogOpen} onOpenChange={setImportDialogOpen}>
        <DialogContent className="sm:max-w-lg bg-gray-900 border-blue-500">
          <DialogHeader>
            <DialogTitle className="text-gray-500">Import Products from CSV</DialogTitle>
            <DialogDescription>
              Upload a CSV file with product data. Expected columns: Name, SKU, Barcode, Price, Cost, Stock, Min Stock, Category, Description, Status
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4 py-4">
            <div className="border-2 border-dashed border-blue-500 rounded-lg p-6 text-center">
              <Upload className="w-12 h-12 mx-auto mb-4 text-gray-500/50" />
              <p className="text-gray-500/70 mb-2">Click to upload CSV file</p>
              <input
                type="file"
                accept=".csv"
                onChange={(e) => {
                  const file = e.target.files?.[0]
                  if (file) handleImportCSV(file)
                }}
                className="hidden"
                id="csv-upload"
              />
              <Button 
                variant="outline" 
                onClick={() => document.getElementById('csv-upload')?.click()}
                className="border-blue-500 text-gray-500 hover:bg-amber-600"
              >
                Select CSV File
              </Button>
            </div>
            
            <div className="text-xs text-gray-400 ">
              <p className="font-medium mb-1">CSV Format:</p>
              <p>Name, SKU, Barcode, Price, Cost, Stock, Min Stock, Category, Description, Status</p>
            </div>
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => setImportDialogOpen(false)} className="border-blue-500">
              Cancel
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}