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
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { Switch } from '@/components/ui/switch'
import { useToast } from '@/hooks/use-toast'
import { Search, Plus, Edit, Trash2, User, Mail, Phone, Shield, UserCheck, UserX } from 'lucide-react'

interface Employee {
  id: string
  name: string
  email: string
  phone?: string
  role: 'admin' | 'manager' | 'cashier'
  isActive: boolean
  clerkId?: string
  createdAt: string
}

export default function EmployeesManagement() {
  const { toast } = useToast()
  const [employees, setEmployees] = useState<Employee[]>([])
  const [searchTerm, setSearchTerm] = useState('')
  const [loading, setLoading] = useState(true)
  const [dialogOpen, setDialogOpen] = useState(false)
  const [editingEmployee, setEditingEmployee] = useState<Employee | null>(null)
  const [formData, setFormData] = useState({
    name: '',
    email: '',
    phone: '',
    role: 'cashier' as 'admin' | 'manager' | 'cashier',
    clerkId: '',
  })

  useEffect(() => {
    loadEmployees()
  }, [])

  const loadEmployees = async () => {
    try {
      const response = await fetch('/api/pos/employees')
      if (response.ok) {
        const data = await response.json()
        setEmployees(data)
      }
    } catch (error) {
      console.error('Error loading employees:', error)
      toast({
        title: 'Error',
        description: 'Failed to load employees',
        variant: 'destructive',
      })
    } finally {
      setLoading(false)
    }
  }

  const filteredEmployees = employees.filter(
    (employee) =>
      employee.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
      employee.email.toLowerCase().includes(searchTerm.toLowerCase()) ||
      employee.role.toLowerCase().includes(searchTerm.toLowerCase())
  )

  const handleAdd = () => {
    setEditingEmployee(null)
    setFormData({
      name: '',
      email: '',
      phone: '',
      role: 'cashier',
      clerkId: '',
    })
    setDialogOpen(true)
  }

  const handleEdit = (employee: Employee) => {
    setEditingEmployee(employee)
    setFormData({
      name: employee.name,
      email: employee.email,
      phone: employee.phone || '',
      role: employee.role,
      clerkId: employee.clerkId || '',
    })
    setDialogOpen(true)
  }

  const handleSubmit = async () => {
    try {
      const url = editingEmployee
        ? `/api/pos/employees/${editingEmployee.id}`
        : '/api/pos/employees'

      const response = await fetch(url, {
        method: editingEmployee ? 'PUT' : 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(formData),
      })

      if (response.ok) {
        toast({
          title: editingEmployee ? 'Employee updated' : 'Employee created',
          description: `${formData.name} has been ${editingEmployee ? 'updated' : 'added'}`,
        })
        setDialogOpen(false)
        loadEmployees()
      } else {
        const error = await response.json()
        throw new Error(error.error || 'Failed to save employee')
      }
    } catch (error: any) {
      toast({
        title: 'Error',
        description: error.message || 'Failed to save employee',
        variant: 'destructive',
      })
    }
  }

  const handleDelete = async (id: string, name: string) => {
    if (!confirm(`Are you sure you want to delete ${name}? This action cannot be undone.`)) return

    try {
      const response = await fetch(`/api/pos/employees/${id}`, {
        method: 'DELETE',
      })

      if (response.ok) {
        toast({
          title: 'Employee deleted',
          description: `${name} has been removed`,
        })
        loadEmployees()
      } else {
        const error = await response.json()
        throw new Error(error.error || 'Failed to delete employee')
      }
    } catch (error: any) {
      toast({
        title: 'Error',
        description: error.message || 'Failed to delete employee',
        variant: 'destructive',
      })
    }
  }

  const handleToggleStatus = async (employee: Employee) => {
    try {
      const response = await fetch(`/api/pos/employees/${employee.id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          ...employee,
          isActive: !employee.isActive,
        }),
      })

      if (response.ok) {
        toast({
          title: employee.isActive ? 'Employee deactivated' : 'Employee activated',
          description: `${employee.name} has been ${employee.isActive ? 'deactivated' : 'activated'}`,
        })
        loadEmployees()
      } else {
        const error = await response.json()
        throw new Error(error.error || 'Failed to update employee status')
      }
    } catch (error: any) {
      toast({
        title: 'Error',
        description: error.message || 'Failed to update employee status',
        variant: 'destructive',
      })
    }
  }

  const getRoleIcon = (role: string) => {
    switch (role) {
      case 'admin':
        return <Shield className="w-4 h-4" />
      case 'manager':
        return <UserCheck className="w-4 h-4" />
      case 'cashier':
        return <User className="w-4 h-4" />
      default:
        return <User className="w-4 h-4" />
    }
  }

  const getRoleColor = (role: string) => {
    switch (role) {
      case 'admin':
        return 'destructive'
      case 'manager':
        return 'default'
      case 'cashier':
        return 'secondary'
      default:
        return 'secondary'
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
              <CardTitle>Employees</CardTitle>
              <CardDescription>
                Manage your employee database ({employees.length} total)
              </CardDescription>
            </div>
            <Button onClick={handleAdd}>
              <Plus className="w-4 h-4 mr-2" />
              Add Employee
            </Button>
          </div>
        </CardHeader>
        <CardContent>
          <div className="flex gap-4 mb-4">
            <div className="relative flex-1">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
              <Input
                placeholder="Search employees..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="pl-10"
              />
            </div>
          </div>

          <ScrollArea className="h-[calc(100vh-350px)]">
            <div className="grid gap-4">
              {filteredEmployees.length === 0 ? (
                <div className="text-center py-12 text-muted-foreground">
                  <User className="w-12 h-12 mx-auto mb-4 opacity-50" />
                  <p>No employees found</p>
                </div>
              ) : (
                filteredEmployees.map((employee) => (
                  <Card key={employee.id} className="hover:shadow-md transition-shadow">
                    <CardContent className="p-4">
                      <div className="flex items-start justify-between gap-4">
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-2 mb-2">
                            <h3 className="font-semibold">{employee.name}</h3>
                            <Badge variant={getRoleColor(employee.role)} className="flex items-center gap-1">
                              {getRoleIcon(employee.role)}
                              {employee.role}
                            </Badge>
                            {employee.isActive ? (
                              <Badge variant="outline" className="text-green-600 border-green-600">
                                <UserCheck className="w-3 h-3 mr-1" />
                                Active
                              </Badge>
                            ) : (
                              <Badge variant="outline" className="text-red-600 border-red-600">
                                <UserX className="w-3 h-3 mr-1" />
                                Inactive
                              </Badge>
                            )}
                          </div>
                          <div className="space-y-1 text-sm text-muted-foreground">
                            {employee.email && (
                              <div className="flex items-center gap-2">
                                <Mail className="w-3 h-3" />
                                <span>{employee.email}</span>
                              </div>
                            )}
                            {employee.phone && (
                              <div className="flex items-center gap-2">
                                <Phone className="w-3 h-3" />
                                <span>{employee.phone}</span>
                              </div>
                            )}
                            <p className="text-xs">
                              Added: {new Date(employee.createdAt).toLocaleDateString()}
                            </p>
                          </div>
                        </div>
                        <div className="flex items-center gap-2">
                          <Button
                            variant="outline"
                            size="sm"
                            onClick={() => handleToggleStatus(employee)}
                            className={employee.isActive ? 'text-orange-600' : 'text-green-600'}
                          >
                            {employee.isActive ? <UserX className="w-4 h-4" /> : <UserCheck className="w-4 h-4" />}
                          </Button>
                          <Button
                            variant="ghost"
                            size="icon"
                            onClick={() => handleEdit(employee)}
                          >
                            <Edit className="w-4 h-4" />
                          </Button>
                          <Button
                            variant="ghost"
                            size="icon"
                            onClick={() => handleDelete(employee.id, employee.name)}
                            className="text-destructive hover:text-destructive"
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
        <DialogContent className="sm:max-w-lg">
          <DialogHeader>
            <DialogTitle>
              {editingEmployee ? 'Edit Employee' : 'Add New Employee'}
            </DialogTitle>
            <DialogDescription>
              {editingEmployee ? 'Update employee information' : 'Add a new employee to the system'}
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
              <Label htmlFor="email">Email *</Label>
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
              <Label htmlFor="role">Role *</Label>
              <Select value={formData.role} onValueChange={(value: any) => setFormData({ ...formData, role: value })}>
                <SelectTrigger>
                  <SelectValue placeholder="Select role" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="cashier">Cashier</SelectItem>
                  <SelectItem value="manager">Manager</SelectItem>
                  <SelectItem value="admin">Admin</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div className="grid gap-2">
              <Label htmlFor="clerkId">Clerk ID</Label>
              <Input
                id="clerkId"
                value={formData.clerkId}
                onChange={(e) => setFormData({ ...formData, clerkId: e.target.value })}
                placeholder="Optional - for authentication"
              />
            </div>
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => setDialogOpen(false)}>
              Cancel
            </Button>
            <Button onClick={handleSubmit}>
              {editingEmployee ? 'Update' : 'Create'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}