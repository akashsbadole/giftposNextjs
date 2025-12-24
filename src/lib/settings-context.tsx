'use client'

import { createContext, useContext, useEffect, useState, ReactNode } from 'react'

interface StoreSettings {
  id: string
  name: string
  address?: string
  phone?: string
  email?: string
  taxRate: number
  gstRate: number
  currency: string
  globalMinStock?: number
  autoAlert?: boolean
  defaultDateRange?: string
  showGST?: boolean
}

interface SettingsContextType {
  store: StoreSettings | null
  loading: boolean
  refreshSettings: () => Promise<void>
  formatCurrency: (amount: number) => string
  error: string | null
}

const SettingsContext = createContext<SettingsContextType | undefined>(undefined)

export function SettingsProvider({ children }: { children: ReactNode }) {
  const [store, setStore] = useState<StoreSettings | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  const refreshSettings = async () => {
    try {
      setError(null)
      
      // First, sync the user to create employee record if needed
      const syncRes = await fetch('/api/auth/sync-user')
      if (!syncRes.ok) {
        console.error('Failed to sync user:', await syncRes.text())
        // Continue anyway, settings might still work
      }

      const response = await fetch('/api/pos/store/settings')
      if (!response.ok) {
        throw new Error(`Failed to fetch settings: ${response.status}`)
      }
      
      const data = await response.json()
      setStore(data)
    } catch (error) {
      console.error('Failed to load settings:', error)
      setError(error instanceof Error ? error.message : 'Failed to load settings')
      
      // Set default settings as fallback
      setStore({
        id: 'default',
        name: 'Retail Store',
        taxRate: 0,
        gstRate: 10,
        currency: 'USD',
        globalMinStock: 5,
        autoAlert: true,
        defaultDateRange: 'week',
        showGST: true
      })
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
      console.warn(`Invalid currency code: ${store.currency}, falling back to USD format`)
      return `$${amount.toFixed(2)}`
    }
  }

  useEffect(() => {
    refreshSettings()
  }, [])

  return (
    <SettingsContext.Provider value={{ store, loading, refreshSettings, formatCurrency, error }}>
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