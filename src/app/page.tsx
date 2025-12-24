'use client'

import { useState, useEffect } from 'react'
import { useAuth, UserButton } from '@clerk/nextjs'
import { useRouter } from 'next/navigation'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { ShoppingCart, Package, Users, BarChart3, Settings, Store, LogOut, Shield } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Card, CardContent } from '@/components/ui/card'
import { useToast } from '@/hooks/use-toast'
import POSInterface from '@/components/pos/POSInterface'
import ProductsManagement from '@/components/pos/ProductsManagement'
import CustomersManagement from '@/components/pos/CustomersManagement'
import SalesReport from '@/components/pos/SalesReport'
import SettingsPanel from '@/components/pos/SettingsPanel'

export default function Home() {
  const { userId, isLoaded } = useAuth()
  const router = useRouter()
  const { toast } = useToast()
  const [activeTab, setActiveTab] = useState('pos')
  const [employee, setEmployee] = useState<any>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    if (isLoaded && !userId) {
      router.push('/sign-in')
      return
    }

    if (userId) {
      syncUser()
    }
  }, [userId, isLoaded, router])

  const syncUser = async () => {
    try {
      const response = await fetch('/api/auth/sync-user')
      if (response.ok) {
        const empData = await response.json()
        setEmployee(empData)
      } else {
        const error = await response.json()
        if (response.status === 400 && error.error === 'Maximum number of employees reached') {
          toast({
            title: 'Access Denied',
            description: 'Maximum number of employees (3) has been reached. Contact admin.',
            variant: 'destructive',
          })
          await signOut()
        }
      }
    } catch (error) {
      console.error('Error syncing user:', error)
    } finally {
      setLoading(false)
    }
  }

  const signOut = async () => {
    router.push('/sign-in')
  }

  if (!isLoaded || loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-slate-50 to-slate-100 dark:from-slate-950 dark:to-slate-900">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary mx-auto mb-4"></div>
          <p className="text-muted-foreground">Loading...</p>
        </div>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 to-slate-100 dark:from-slate-950 dark:to-slate-900">
      {/* Header */}
      <header className="border-b bg-white/80 dark:bg-slate-950/80 backdrop-blur-sm sticky top-0 z-50">
        <div className="container mx-auto px-4 py-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 bg-primary rounded-lg flex items-center justify-center">
                <Store className="w-6 h-6 text-primary-foreground" />
              </div>
              <div>
                <h1 className="text-xl font-bold">Retail POS</h1>
                <p className="text-sm text-muted-foreground">Point of Sale System</p>
              </div>
            </div>

            <div className="flex items-center gap-3">
              {/* Employee Info Badge */}
              {employee && (
                <div className="hidden sm:flex items-center gap-2 px-3 py-1.5 bg-primary/10 rounded-full">
                  <Shield className="w-4 h-4 text-primary" />
                  <div className="text-xs">
                    <span className="font-medium">{employee.name}</span>
                    <span className="text-muted-foreground ml-1">
                      ({employee.role})
                    </span>
                  </div>
                </div>
              )}

              {/* User Actions */}
              <div className="flex items-center gap-2">
                <Button variant="ghost" size="icon" onClick={signOut}>
                  <LogOut className="w-5 h-5" />
                </Button>
                <UserButton afterSignOutUrl="/sign-in" />
              </div>
            </div>
          </div>
        </div>
      </header>

      {/* Employee Access Alert */}
      {employee && (
        <div className="bg-amber-50 dark:bg-amber-950/20 border-b border-amber-200 dark:border-amber-800">
          <div className="container mx-auto px-4 py-2">
            <div className="flex items-center justify-center gap-2 text-sm text-amber-800 dark:text-amber-200">
              <Shield className="w-4 h-4" />
              <span>
                {employee.role === 'admin' ? 'Admin Access' : `${employee.role} Access`}
              </span>
              <span className="text-muted-foreground">
                - Limited to {3} employees maximum
              </span>
            </div>
          </div>
        </div>
      )}

      {/* Main Content */}
      <main className="container mx-auto px-4 py-6">
        <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full">
          <TabsList className="w-full mb-6 overflow-x-auto">
            <TabsTrigger value="pos" className="min-w-[80px] gap-2">
              <ShoppingCart className="w-4 h-4 flex-shrink-0" />
              <span>POS</span>
            </TabsTrigger>
            <TabsTrigger value="products" className="min-w-[80px] gap-2">
              <Package className="w-4 h-4 flex-shrink-0" />
              <span>Products</span>
            </TabsTrigger>
            <TabsTrigger value="customers" className="min-w-[80px] gap-2">
              <Users className="w-4 h-4 flex-shrink-0" />
              <span>Customers</span>
            </TabsTrigger>
            <TabsTrigger value="reports" className="min-w-[80px] gap-2">
              <BarChart3 className="w-4 h-4 flex-shrink-0" />
              <span>Reports</span>
            </TabsTrigger>
            <TabsTrigger value="settings" className="min-w-[80px] gap-2">
              <Settings className="w-4 h-4 flex-shrink-0" />
              <span>Settings</span>
            </TabsTrigger>
          </TabsList>

          <TabsContent value="pos" className="mt-0">
            <POSInterface />
          </TabsContent>

          <TabsContent value="products" className="mt-0">
            <ProductsManagement />
          </TabsContent>

          <TabsContent value="customers" className="mt-0">
            <CustomersManagement />
          </TabsContent>

          <TabsContent value="reports" className="mt-0">
            <SalesReport />
          </TabsContent>

          <TabsContent value="settings" className="mt-0">
            <SettingsPanel employee={employee} />
          </TabsContent>
        </Tabs>
      </main>
    </div>
  )
}
