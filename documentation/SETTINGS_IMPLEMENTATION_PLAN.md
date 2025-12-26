# Settings Integration Implementation Plan

## Overview
This document provides detailed implementation recommendations for creating a proper settings-to-products-workflow by addressing the data flow gaps identified in the analysis.

## Priority 1: Core Settings Infrastructure

### 1.1 Settings Context Provider
**File:** `src/contexts/SettingsContext.tsx`

```typescript
'use client'

import { createContext, useContext, useEffect, useState } from 'react'

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

interface SettingsContextType {
  store: StoreSettings | null
  loading: boolean
  refreshSettings: () => Promise<void>
  formatCurrency: (amount: number) => string
}

const SettingsContext = createContext<SettingsContextType | undefined>(undefined)

export function SettingsProvider({ children }: { children: React.ReactNode }) {
  const [store, setStore] = useState<StoreSettings | null>(null)
  const [loading, setLoading] = useState(true)

  const refreshSettings = async () => {
    try {
      const response = await fetch('/api/pos/store/settings')
      if (response.ok) {
        const data = await response.json()
        setStore(data)
      }
    } catch (error) {
      console.error('Failed to load settings:', error)
    } finally {
      setLoading(false)
    }
  }

  const formatCurrency = (amount: number): string => {
    if (!store?.currency) return `$${amount.toFixed(2)}`
    
    try {
      return new Intl.NumberFormat('en-US', {
        style: 'currency',
        currency: store.currency,
      }).format(amount)
    } catch (error) {
      // Fallback for invalid currency codes
      return `${store.currency} ${amount.toFixed(2)}`
    }
  }

  useEffect(() => {
    refreshSettings()
  }, [])

  return (
    <SettingsContext.Provider value={{ store, loading, refreshSettings, formatCurrency }}>
      {children}
    </SettingsContext.Provider>
  )
}

export function useSettings() {
  const context = useContext(SettingsContext)
  if (context === undefined) {
    throw new Error('useSettings must be used within a SettingsProvider')
  }
  return context
}
```

### 1.2 Update Layout to Include Settings Provider
**File:** `src/app/layout.tsx`

```typescript
import { SettingsProvider } from '@/contexts/SettingsContext'

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body>
        <SettingsProvider>
          {children}
        </SettingsProvider>
      </body>
    </html>
  )
}
```

## Priority 2: Currency Formatting Integration

### 2.1 Update POSInterface.tsx
**Changes Required:**

1. **Add settings context import:**
```typescript
import { useSettings } from '@/contexts/SettingsContext'
```

2. **Replace store state with settings:**
```typescript
// Remove: const [store, setStore] = useState<any>(null)
// Add: const { store, formatCurrency } = useSettings()
```

3. **Update price displays:**
```typescript
// Old: <span className="text-lg font-bold">${product.price.toFixed(2)}</span>
// New: <span className="text-lg font-bold">{formatCurrency(product.price)}</span>
```

4. **Update cart totals:**
```typescript
// Old: <span className="font-medium">${subtotal.toFixed(2)}</span>
// New: <span className="font-medium">{formatCurrency(subtotal)}</span>

// Old: <span className="font-medium">${gst.toFixed(2)}</span>
// New: <span className="font-medium">{formatCurrency(gst)}</span>

// Old: <span>${total.toFixed(2)}</span>
// New: <span>{formatCurrency(total)}</span>
```

5. **Add store header:**
```typescript
// Add after loading check:
{store && (
  <div className="mb-4 p-4 bg-muted rounded-lg">
    <h1 className="text-xl font-bold">{store.name}</h1>
    {store.address && <p className="text-sm text-muted-foreground">{store.address}</p>}
    {store.phone && <p className="text-sm text-muted-foreground">Tel: {store.phone}</p>}
  </div>
)}
```

### 2.2 Update ProductsManagement.tsx
**Changes Required:**

1. **Add settings context:**
```typescript
import { useSettings } from '@/contexts/SettingsContext'
```

2. **Use settings for formatting:**
```typescript
const { formatCurrency } = useSettings()
```

3. **Update price displays:**
```typescript
// Old: <span className="font-medium text-primary">${product.price.toFixed(2)}</span>
// New: <span className="font-medium text-primary">{formatCurrency(product.price)}</span>
```

4. **Add store header:**
```typescript
const { store } = useSettings()

// Add in return statement before products list:
{store && (
  <div className="mb-4">
    <h2 className="text-lg font-semibold">{store.name} - Inventory</h2>
    {store.address && <p className="text-sm text-muted-foreground">{store.address}</p>}
  </div>
)}
```

### 2.3 Update SalesReport.tsx
**Changes Required:**

1. **Add settings context:**
```typescript
import { useSettings } from '@/contexts/SettingsContext'
```

2. **Update currency formatting:**
```typescript
const { formatCurrency } = useSettings()

// Replace all hardcoded $ formatting:
prefix={formatCurrency(filteredStats.totalRevenue).replace(/[0-9.,]/g, '').trim()}
value={parseFloat(formatCurrency(filteredStats.totalRevenue).replace(/[^0-9.]/g, ''))}

// Or create a helper function:
const parseFormattedCurrency = (formatted: string): number => {
  return parseFloat(formatted.replace(/[^0-9.]/g, '')) || 0
}
```

### 2.4 Update ReceiptDialog.tsx
**Changes Required:**

1. **Add settings context:**
```typescript
import { useSettings } from '@/contexts/SettingsContext'
```

2. **Update currency handling:**
```typescript
const { formatCurrency } = useSettings()

// Replace hardcoded $ in receipt:
<span>{formatCurrency(sale.subtotal)}</span>
<span>GST ({store.gstRate || 10}%): {formatCurrency(sale.gst)}</span>
<span>{formatCurrency(sale.total)}</span>
```

## Priority 3: Enhanced Settings Panel

### 3.1 Add New Settings Categories
**File:** `src/components/pos/SettingsPanel.tsx`

Add new cards for:

1. **Inventory Settings:**
```typescript
<Card>
  <CardHeader>
    <CardTitle>Inventory Alerts</CardTitle>
    <CardDescription>Configure inventory management preferences</CardDescription>
  </CardHeader>
  <CardContent className="space-y-4">
    <div className="grid gap-2">
      <Label htmlFor="globalMinStock">Default Low Stock Threshold</Label>
      <Input
        id="globalMinStock"
        type="number"
        value={formData.globalMinStock}
        onChange={(e) => setFormData({ ...formData, globalMinStock: e.target.value })}
      />
    </div>
    <div className="grid gap-2">
      <Label htmlFor="autoAlert">Auto Alert Notifications</Label>
      <Switch
        checked={formData.autoAlert}
        onCheckedChange={(checked) => setFormData({ ...formData, autoAlert: checked })}
      />
    </div>
  </CardContent>
</Card>
```

2. **Report Settings:**
```typescript
<Card>
  <CardHeader>
    <CardTitle>Report Preferences</CardTitle>
    <CardDescription>Customize report display and defaults</CardDescription>
  </CardHeader>
  <CardContent className="space-y-4">
    <div className="grid gap-2">
      <Label htmlFor="defaultDateRange">Default Date Range</Label>
      <Select value={formData.defaultDateRange} onValueChange={(value) => setFormData({ ...formData, defaultDateRange: value })}>
        <SelectTrigger>
          <SelectValue />
        </SelectTrigger>
        <SelectContent>
          <SelectItem value="today">Today</SelectItem>
          <SelectItem value="week">Last 7 days</SelectItem>
          <SelectItem value="month">Last 30 days</SelectItem>
        </SelectContent>
      </Select>
    </div>
    <div className="grid gap-2">
      <Label htmlFor="showGST">Show GST in Reports</Label>
      <Switch
        checked={formData.showGST}
        onCheckedChange={(checked) => setFormData({ ...formData, showGST: checked })}
      />
    </div>
  </CardContent>
</Card>
```

### 3.2 Update Store API for New Settings
**File:** `src/app/api/pos/store/settings/route.ts`

```typescript
// Update interface to include new settings
interface StoreSettings {
  // ... existing fields
  globalMinStock: number
  autoAlert: boolean
  defaultDateRange: string
  showGST: boolean
}

// Update database schema migration
// Add new fields to Store model in Prisma
```

## Priority 4: Inventory Alert Integration

### 4.1 Update ProductsManagement with Global Settings
**Changes Required:**

1. **Use global settings for alerts:**
```typescript
const { store, refreshSettings } = useSettings()

// Update low stock detection:
const lowStockProducts = products.filter((p) => 
  p.stock <= (p.minStock || store?.globalMinStock || 0)
)

// Update alert threshold in forms:
<Input
  id="minStock"
  type="number"
  value={formData.minStock || store?.globalMinStock || 0}
  onChange={(e) => setFormData({ ...formData, minStock: e.target.value })}
  placeholder={`Default: ${store?.globalMinStock || 0}`}
/>
```

### 4.2 Add Inventory Alerts to POSInterface
**New Feature:**

```typescript
// Add low stock notification in POSInterface
const { store } = useSettings()

// Show low stock warning
const lowStockCount = products.filter(p => 
  p.stock <= (p.minStock || store?.globalMinStock || 0)
).length

{lowStockCount > 0 && (
  <Card className="border-orange-200 bg-orange-50">
    <CardContent className="p-3">
      <div className="flex items-center gap-2 text-orange-600">
        <AlertCircle className="w-4 h-4" />
        <span className="text-sm">
          {lowStockCount} products are running low on stock
        </span>
      </div>
    </CardContent>
  </Card>
)}
```

## Priority 5: Sales Report Integration

### 5.1 Add Store Information to Reports
**Changes Required:**

```typescript
const { store } = useSettings()

// Add store header to SalesReport
{store && (
  <Card>
    <CardContent className="p-6">
      <div className="text-center">
        <h1 className="text-2xl font-bold">{store.name}</h1>
        {store.address && <p className="text-muted-foreground">{store.address}</p>}
        {store.phone && <p className="text-muted-foreground">Tel: {store.phone}</p>}
        {store.email && <p className="text-muted-foreground">{store.email}</p>}
      </div>
    </CardContent>
  </Card>
)}
```

### 5.2 Use Report Settings
```typescript
// Apply default date range
useEffect(() => {
  if (store?.defaultDateRange) {
    setDateFilter(store.defaultDateRange as any)
  }
}, [store?.defaultDateRange])

// Show/hide GST based on settings
{store?.showGST && (
  <div className="flex justify-between text-sm">
    <span>GST ({store.gstRate}%)</span>
    <span>{formatCurrency(gst)}</span>
  </div>
)}
```

## Implementation Sequence

### Phase 1: Core Infrastructure (Week 1)
1. Create SettingsContext provider
2. Update layout to include provider
3. Implement currency formatting service

### Phase 2: Component Updates (Week 2)
1. Update POSInterface with settings integration
2. Update ProductsManagement with currency formatting
3. Update ReceiptDialog with dynamic currency

### Phase 3: Enhanced Features (Week 3)
1. Add new settings categories to SettingsPanel
2. Update API routes for new settings
3. Implement inventory alert integration

### Phase 4: Report Integration (Week 4)
1. Update SalesReport with store information
2. Apply report preferences
3. Add settings-driven report customization

## Testing Strategy

### Unit Tests
- Currency formatting function
- Settings context provider
- Settings validation

### Integration Tests
- Settings persistence across components
- Currency change propagation
- Store information display consistency

### User Acceptance Tests
- Settings changes reflect immediately
- Currency formatting works correctly
- Store branding appears consistently
- Inventory alerts function properly

## Migration Strategy

### Backward Compatibility
- Maintain existing settings format
- Provide default values for new settings
- Graceful handling of missing settings

### Data Migration
- Add new settings fields with defaults
- Migrate existing hardcoded values
- Validate currency codes

### Deployment
- Deploy in phases to minimize disruption
- Test settings functionality thoroughly
- Monitor for issues and roll back if needed

## Success Metrics

1. **Settings Consistency:** All components use the same settings
2. **Currency Formatting:** 100% of price displays use dynamic currency
3. **Store Branding:** Store information appears in all relevant components
4. **User Experience:** Settings changes reflect immediately across the system
5. **Inventory Management:** Global settings work alongside product-specific settings

## Conclusion

This implementation plan addresses all identified data flow gaps and creates a cohesive settings integration across the POS system. The phased approach ensures stable deployment while progressively improving the user experience.