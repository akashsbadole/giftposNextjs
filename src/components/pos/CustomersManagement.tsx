'use client'

import { useState, useEffect } from 'react'
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
import { Label } from '@/components/ui/label'
import { Separator } from '@/components/ui/separator'
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from '@/components/ui/collapsible'
import { useToast } from '@/hooks/use-toast'
import { Search, Plus, Edit, Trash2, User, Mail, Phone, ChevronDown, ChevronUp, Receipt, Calendar } from 'lucide-react'

interface Customer {
  id: string
  name: string
  email?: string
  phone?: string
  address?: string
  points: number
}

interface PurchaseHistory {
  id: string
  invoiceNumber: string
  total: number
  createdAt: string
  items: {
    quantity: number
    product: {
      name: string
    }
  }[]
}

export default function CustomersManagement() {
  const { toast } = useToast()
  const [customers, setCustomers] = useState<Customer[]>([])
  const [searchTerm, setSearchTerm] = useState('')
  const [loading, setLoading] = useState(true)
  const [dialogOpen, setDialogOpen] = useState(false)
  const [editingCustomer, setEditingCustomer] = useState<Customer | null>(null)
  const [formData, setFormData] = useState({
    name: '',
    email: '',
    phone: '',
    address: '',
  })
  const [purchaseHistory, setPurchaseHistory] = useState<Map<string, PurchaseHistory[]>>(new Map())
  const [expandedCustomers, setExpandedCustomers] = useState<Set<string>>(new Set())
  const [loadingHistory, setLoadingHistory] = useState<Set<string>>(new Set())

  useEffect(() => {
    loadCustomers()
  }, [])

  const loadCustomers = async () => {
    try {
      const response = await fetch('/api/pos/customers')
      if (response.ok) {
        const data = await response.json()
        setCustomers(data)
      }
    } catch (error) {
      console.error('Error loading customers:', error)
    } finally {
      setLoading(false)
    }
  }

  const loadPurchaseHistory = async (customerId: string) => {
    if (loadingHistory.has(customerId)) return
    
    setLoadingHistory(prev => new Set([...prev, customerId]))
    
    try {
      const response = await fetch(`/api/pos/customers/${customerId}/purchases`)
      if (response.ok) {
        const data = await response.json()
        setPurchaseHistory(prev => {
          const updated = new Map(prev)
          updated.set(customerId, data)
          return updated
        })
      }
    } catch (error) {
      console.error('Error loading purchase history:', error)
      toast({
        title: 'Error',
        description: 'Failed to load purchase history',
        variant: 'destructive',
      })
    } finally {
      setLoadingHistory(prev => {
        const updated = new Set(prev)
        updated.delete(customerId)
        return updated
      })
    }
  }

  const toggleCustomerExpansion = (customerId: string) => {
    const newExpanded = new Set(expandedCustomers)
    if (newExpanded.has(customerId)) {
      newExpanded.delete(customerId)
    } else {
      newExpanded.add(customerId)
      loadPurchaseHistory(customerId)
    }
    setExpandedCustomers(newExpanded)
  }

  const filteredCustomers = customers.filter(
    (customer) =>
      customer.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
      customer.email?.toLowerCase().includes(searchTerm.toLowerCase()) ||
      customer.phone?.toLowerCase().includes(searchTerm.toLowerCase())
  )

  const handleAdd = () => {
    setEditingCustomer(null)
    setFormData({
      name: '',
      email: '',
      phone: '',
      address: '',
    })
    setDialogOpen(true)
  }

  const handleEdit = (customer: Customer) => {
    setEditingCustomer(customer)
    setFormData({
      name: customer.name,
      email: customer.email || '',
      phone: customer.phone || '',
      address: customer.address || '',
    })
    setDialogOpen(true)
  }

  const handleSubmit = async () => {
    try {
      const url = editingCustomer
        ? `/api/pos/customers/${editingCustomer.id}`
        : '/api/pos/customers'

      const response = await fetch(url, {
        method: editingCustomer ? 'PUT' : 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(formData),
      })

      if (response.ok) {
        toast({
          title: editingCustomer ? 'Customer updated' : 'Customer created',
          description: `${formData.name} has been ${editingCustomer ? 'updated' : 'added'}`,
        })
        setDialogOpen(false)
        loadCustomers()
      } else {
        throw new Error('Failed to save customer')
      }
    } catch (error) {
      toast({
        title: 'Error',
        description: 'Failed to save customer',
        variant: 'destructive',
      })
    }
  }

  const handleDelete = async (id: string) => {
    if (!confirm('Are you sure you want to delete this customer?')) return

    try {
      const response = await fetch(`/api/pos/customers/${id}`, {
        method: 'DELETE',
      })

      if (response.ok) {
        toast({
          title: 'Customer deleted',
          description: 'Customer has been removed',
        })
        loadCustomers()
      }
    } catch (error) {
      toast({
        title: 'Error',
        description: 'Failed to delete customer',
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
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
            <div>
              <CardTitle>Customers</CardTitle>
              <CardDescription>
                Manage your customer database ({customers.length} total)
              </CardDescription>
            </div>
            <Button onClick={handleAdd}>
              <Plus className="w-4 h-4 mr-2" />
              Add Customer
            </Button>
          </div>
        </CardHeader>
        <CardContent>
          <div className="flex gap-4 mb-4">
            <div className="relative flex-1">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
              <Input
                placeholder="Search customers..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="pl-10"
              />
            </div>
          </div>

          <ScrollArea className="h-[calc(100vh-350px)]">
            <div className="grid gap-4">
              {filteredCustomers.length === 0 ? (
                <div className="text-center py-12 text-muted-foreground">
                  <User className="w-12 h-12 mx-auto mb-4 opacity-50" />
                  <p>No customers found</p>
                </div>
              ) : (
                filteredCustomers.map((customer) => {
                  const isExpanded = expandedCustomers.has(customer.id)
                  const isLoadingHistory = loadingHistory.has(customer.id)
                  const customerHistory = purchaseHistory.get(customer.id) || []
                  
                  return (
                    <Card key={customer.id} className="hover:shadow-md transition-shadow">
                      <CardContent className="p-4">
                        <div className="flex items-start justify-between gap-4">
                          <div className="flex-1 min-w-0">
                            <div className="flex items-center gap-2 mb-2">
                              <h3 className="font-semibold">{customer.name}</h3>
                              {customer.points > 0 && (
                                <Badge variant="secondary" className="text-xs">
                                  {customer.points} pts
                                </Badge>
                              )}
                            </div>
                            <div className="space-y-1 text-sm text-muted-foreground">
                              {customer.email && (
                                <div className="flex items-center gap-2">
                                  <Mail className="w-3 h-3" />
                                  <span>{customer.email}</span>
                                </div>
                              )}
                              {customer.phone && (
                                <div className="flex items-center gap-2">
                                  <Phone className="w-3 h-3" />
                                  <span>{customer.phone}</span>
                                </div>
                              )}
                              {customer.address && (
                                <p className="text-xs truncate">{customer.address}</p>
                              )}
                            </div>
                          </div>
                          <div className="flex items-center gap-2">
                            <Button
                              variant="ghost"
                              size="sm"
                              onClick={() => toggleCustomerExpansion(customer.id)}
                              disabled={isLoadingHistory}
                            >
                              {isExpanded ? (
                                <ChevronUp className="w-4 h-4" />
                              ) : (
                                <ChevronDown className="w-4 h-4" />
                              )}
                            </Button>
                            <Button
                              variant="ghost"
                              size="icon"
                              onClick={() => handleEdit(customer)}
                            >
                              <Edit className="w-4 h-4" />
                            </Button>
                            <Button
                              variant="ghost"
                              size="icon"
                              onClick={() => handleDelete(customer.id)}
                              className="text-destructive hover:text-destructive"
                            >
                              <Trash2 className="w-4 h-4" />
                            </Button>
                          </div>
                        </div>
                        
                        {/* Purchase History Section */}
                        {isExpanded && (
                          <Collapsible open={isExpanded}>
                            <CollapsibleContent>
                              <Separator className="my-4" />
                              <div className="space-y-3">
                                <div className="flex items-center gap-2 mb-3">
                                  <Receipt className="w-4 h-4" />
                                  <h4 className="font-medium">Purchase History</h4>
                                  <Badge variant="outline" className="text-xs">
                                    {customerHistory.length} {customerHistory.length === 1 ? 'purchase' : 'purchases'}
                                  </Badge>
                                </div>
                                
                                {isLoadingHistory ? (
                                  <div className="flex items-center justify-center py-4">
                                    <div className="animate-spin rounded-full h-6 w-6 border-b-2 border-primary"></div>
                                  </div>
                                ) : customerHistory.length === 0 ? (
                                  <div className="text-center py-4 text-muted-foreground">
                                    <Receipt className="w-8 h-8 mx-auto mb-2 opacity-50" />
                                    <p className="text-sm">No purchase history</p>
                                  </div>
                                ) : (
                                  <div className="space-y-2 max-h-48 overflow-y-auto">
                                    {customerHistory.map((purchase) => (
                                      <div key={purchase.id} className="flex items-center justify-between p-2 rounded border bg-muted/30">
                                        <div className="flex-1">
                                          <div className="flex items-center gap-2 mb-1">
                                            <Badge variant="outline" className="text-xs">
                                              #{purchase.invoiceNumber}
                                            </Badge>
                                            <div className="flex items-center gap-1 text-xs text-muted-foreground">
                                              <Calendar className="w-3 h-3" />
                                              {new Date(purchase.createdAt).toLocaleDateString()}
                                            </div>
                                          </div>
                                          <p className="text-xs text-muted-foreground">
                                            {purchase.items.length} {purchase.items.length === 1 ? 'item' : 'items'}
                                          </p>
                                        </div>
                                        <div className="text-right">
                                          <p className="font-semibold text-sm">${purchase.total.toFixed(2)}</p>
                                        </div>
                                      </div>
                                    ))}
                                  </div>
                                )}
                              </div>
                            </CollapsibleContent>
                          </Collapsible>
                        )}
                      </CardContent>
                    </Card>
                  )
                })
              )}
            </div>
          </ScrollArea>
        </CardContent>
      </Card>

      {/* Add/Edit Dialog */}
      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent className="sm:max-w-lg">
          <DialogHeader>
            <DialogTitle>
              {editingCustomer ? 'Edit Customer' : 'Add New Customer'}
            </DialogTitle>
            <DialogDescription>
              {editingCustomer ? 'Update customer information' : 'Add a new customer to database'}
            </DialogDescription>
          </DialogHeader>

          <div className="grid gap-4 py-4">
            <div className="grid gap-2">
              <Label htmlFor="name">Name *</Label>
              <Input
                id="name"
                value={formData.name}
                onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                placeholder="John Doe"
              />
            </div>

            <div className="grid gap-2">
              <Label htmlFor="email">Email</Label>
              <Input
                id="email"
                type="email"
                value={formData.email}
                onChange={(e) => setFormData({ ...formData, email: e.target.value })}
                placeholder="john@example.com"
              />
            </div>

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
              <Label htmlFor="address">Address</Label>
              <Input
                id="address"
                value={formData.address}
                onChange={(e) => setFormData({ ...formData, address: e.target.value })}
                placeholder="123 Main St, City"
              />
            </div>
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => setDialogOpen(false)}>
              Cancel
            </Button>
            <Button onClick={handleSubmit}>
              {editingCustomer ? 'Update' : 'Create'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}
