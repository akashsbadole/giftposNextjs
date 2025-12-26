'use client'

import { useState, useEffect } from 'react'
import { useAuth, UserButton } from '@clerk/nextjs'
import { useRouter } from 'next/navigation'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { ShoppingCart, Package, Users, BarChart3, Settings, Store, LogOut, Shield, Users2 } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Card, CardContent } from '@/components/ui/card'
import { useToast } from '@/hooks/use-toast'
import POSInterface from '@/components/pos/POSInterface'
import ProductsManagement from '@/components/pos/ProductsManagement'
import CustomersManagement from '@/components/pos/CustomersManagement'
import EmployeesManagement from '@/components/pos/EmployeesManagement'
import SalesReport from '@/components/pos/SalesReport'
import SettingsPanel from '@/components/pos/SettingsPanel'

export default function Home() {
  const { userId, isLoaded } = useAuth()
  const router = useRouter()
  const { toast } = useToast()
  const [activeTab, setActiveTab] = useState('pos')
  const [employee, setEmployee] = useState<any>(null)
  const [loading, setLoading] = useState(false)

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
        if (response.status === 401) {
          // Unauthorized - redirect to sign-in page for security
          router.push('/sign-in')
          return
        } else if (response.status === 403) {
          // Access denied - redirect to sign-in page for security
          router.push('/sign-in')
          return
        } else if (response.status === 400 && error.error === 'Maximum number of employees reached') {
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
      <div className="min-h-screen flex items-center justify-center bg-black">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary mx-auto mb-4"></div>
          <p className="text-muted-foreground">Loading...</p>
        </div>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-[#384077]">
      {/* Header: Professional Blue Theme */}
      <header className="border-b bg-linear-to-r from-blue-primary to-blue-secondary backdrop-blur-sm sticky top-0 z-50 shadow-lg">
        <div className="container mx-auto px-4 py-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 bg-primary rounded-lg flex items-center justify-center">
                <Store className="w-6 h-6 text-primary-foreground" />
              </div>
              <div className="text-white drop-shadow-sm">
                <h1 className="text-xl font-bold text-white">GiftPOS</h1>
                <p className="text-sm text-blue-light">Point of Sale System</p>
              </div>
            </div>

            <div className="flex items-center gap-3">
              {/* Employee Info Badge */}
              {employee && (
                <div className="hidden sm:flex items-center gap-2 px-3 py-1.5 bg-white/20 rounded-full border border-white/30 backdrop-blur-sm">
                  <Shield className="w-4 h-4 text-white" />
                  <div className="text-xs">
                    <span className="font-medium text-white">{employee.name}</span>
                    <span className="text-blue-light ml-1">
                      ({employee.role})
                    </span>
                  </div>
                </div>
              )}

              {/* User Actions */}
              <div className="flex items-center gap-2">
                <Button variant="ghost" size="icon" onClick={signOut} className="text-white hover:text-blue-light hover:bg-white/20">
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
        <div className="bg-linear-to-r from-blue-accent/20 to-blue-secondary/20 border-b border-blue-accent/30 backdrop-blur-sm">
          <div className="container mx-auto px-4 py-2">
            <div className="flex items-center justify-center gap-2 text-sm text-white">
              <Shield className="w-4 h-4" />
              <span className="font-medium">
                {employee.role === 'admin' ? 'Admin Access' : `${employee.role} Access`}
              </span>
              <span className="text-blue-light">
                - Limited to {3} employees maximum
              </span>
            </div>
          </div>
        </div>
      )}

      {/* Main Content */}
      <main className="container mx-auto px-4 py-6 flex-1">
        <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full">
          <TabsList className="w-full mb-6 overflow-x-auto bg-gray-800/50 backdrop-blur-sm border border-blue-border rounded-xl p-1">
            <TabsTrigger value="pos" className="min-w-20 gap-2 data-[state=active]:bg-amber-600 data-[state=active]:text-white data-[state=active]:shadow-sm rounded-lg transition-all text-gray-600">
              <ShoppingCart className="w-4 h-4 shrink-0" />
              <span>POS</span>
            </TabsTrigger>
            <TabsTrigger value="products" className="min-w-20 gap-2 data-[state=active]:bg-amber-600 data-[state=active]:text-white data-[state=active]:shadow-sm rounded-lg transition-all text-gray-600">
              <Package className="w-4 h-4 shrink-0" />
              <span>Products</span>
            </TabsTrigger>
            <TabsTrigger value="customers" className="min-w-20 gap-2 data-[state=active]:bg-amber-600 data-[state=active]:text-white data-[state=active]:shadow-sm rounded-lg transition-all text-gray-600">
              <Users className="w-4 h-4 shrink-0" />
              <span>Customers</span>
            </TabsTrigger>
            {(employee?.role === 'admin' || employee?.role === 'manager') && (
              <TabsTrigger value="employees" className="min-w-20 gap-2 data-[state=active]:bg-amber-600 data-[state=active]:text-white data-[state=active]:shadow-sm rounded-lg transition-all text-gray-600">
                <Users2 className="w-4 h-4 shrink-0" />
                <span>Employees</span>
              </TabsTrigger>
            )}
            <TabsTrigger value="reports" className="min-w-20 gap-2 data-[state=active]:bg-amber-600 data-[state=active]:text-white data-[state=active]:shadow-sm rounded-lg transition-all text-gray-600">
              <BarChart3 className="w-4 h-4 shrink-0" />
              <span>Reports</span>
            </TabsTrigger>
            <TabsTrigger value="settings" className="min-w-20 gap-2 data-[state=active]:bg-amber-600 data-[state=active]:text-white data-[state=active]:shadow-sm rounded-lg transition-all text-gray-600">
              <Settings className="w-4 h-4 shrink-0" />
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

          {(employee?.role === 'admin' || employee?.role === 'manager') && (
            <TabsContent value="employees" className="mt-0">
              <EmployeesManagement />
            </TabsContent>
          )}

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