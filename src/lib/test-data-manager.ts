// Test Data Management and Setup System
// Comprehensive test data generation, setup, and cleanup utilities

import { OrderTestDataGenerator } from './order-management-test'

// Test Data Configuration
export interface TestDataConfig {
  storeCount: number
  userCount: number
  productCount: number
  customerCount: number
  orderCount: number
  enableRelationships: boolean
  generateHistoricalData: boolean
  historicalDays: number
}

// Test Data Models
export interface TestStore {
  id: string
  name: string
  address: string
  phone: string
  settings: Record<string, any>
  createdAt: Date
}

export interface TestUser {
  id: string
  name: string
  email: string
  role: 'admin' | 'manager' | 'cashier' | 'collaborator'
  permissions: string[]
  storeId: string
  isActive: boolean
  createdAt: Date
}

export interface TestProduct {
  id: string
  name: string
  description: string
  price: number
  category: string
  stock: number
  isActive: boolean
  storeId: string
  createdAt: Date
}

export interface TestCustomer {
  id: string
  name: string
  email?: string
  phone?: string
  address?: string
  preferences?: Record<string, any>
  totalOrders: number
  totalSpent: number
  storeId: string
  createdAt: Date
}

export interface TestOrder {
  id: string
  orderNumber: string
  customerId?: string
  employeeId?: string
  items: TestOrderItem[]
  subtotal: number
  gst: number
  discount: number
  total: number
  status: 'new' | 'held' | 'recalled' | 'editing' | 'processing' | 'completed' | 'cancelled' | 'expired'
  priority: number
  tableNumber?: string
  notes?: string
  storeId: string
  createdAt: Date
  updatedAt: Date
  metadata?: Record<string, any>
}

export interface TestOrderItem {
  productId: string
  name: string
  price: number
  quantity: number
  subtotal: number
  discount?: number
  tax?: number
}

// Test Data Manager
export class TestDataManager {
  private static config: TestDataConfig = {
    storeCount: 3,
    userCount: 20,
    productCount: 100,
    customerCount: 50,
    orderCount: 200,
    enableRelationships: true,
    generateHistoricalData: true,
    historicalDays: 30
  }

  private static stores: TestStore[] = []
  private static users: TestUser[] = []
  private static products: TestProduct[] = []
  private static customers: TestCustomer[] = []
  private static orders: TestOrder[] = []

  static configure(config: Partial<TestDataConfig>): void {
    this.config = { ...this.config, ...config }
  }

  // ========================================
  // DATA GENERATION
  // ========================================

  static async generateTestData(config?: Partial<TestDataConfig>): Promise<void> {
    if (config) {
      this.configure(config)
    }

    console.log('🔧 Generating comprehensive test data...')

    // Generate stores
    this.stores = await this.generateStores(this.config.storeCount)
    console.log(`✅ Generated ${this.stores.length} test stores`)

    // Generate users
    this.users = await this.generateUsers(this.config.userCount)
    console.log(`✅ Generated ${this.users.length} test users`)

    // Generate products
    this.products = await this.generateProducts(this.config.productCount)
    console.log(`✅ Generated ${this.products.length} test products`)

    // Generate customers
    this.customers = await this.generateCustomers(this.config.customerCount)
    console.log(`✅ Generated ${this.customers.length} test customers`)

    // Generate orders
    this.orders = await this.generateOrders(this.config.orderCount)
    console.log(`✅ Generated ${this.orders.length} test orders`)

    // Establish relationships if enabled
    if (this.config.enableRelationships) {
      await this.establishRelationships()
      console.log('✅ Established data relationships')
    }

    console.log('🎉 Test data generation completed')
  }

  private static async generateStores(count: number): Promise<TestStore[]> {
    const stores: TestStore[] = []
    const storeNames = [
      'Central Plaza Store', 'Mall Outlet Store', 'Downtown Branch',
      'Airport Store', 'Suburban Mall', 'City Center Store'
    ]

    for (let i = 0; i < count; i++) {
      stores.push({
        id: `store-${i + 1}`,
        name: storeNames[i] || `Test Store ${i + 1}`,
        address: `${100 + i} Test Street, Test City, TC ${10000 + i}`,
        phone: `+1-555-${1000 + i}`,
        settings: {
          currency: 'USD',
          timezone: 'America/New_York',
          taxRate: 0.08,
          holdDuration: 240,
          autoCleanup: true,
          collaborationEnabled: true
        },
        createdAt: new Date(Date.now() - Math.random() * 365 * 24 * 60 * 60 * 1000)
      })
    }

    return stores
  }

  private static async generateUsers(count: number): Promise<TestUser[]> {
    const users: TestUser[] = []
    const roles: TestUser['role'][] = ['admin', 'manager', 'cashier', 'collaborator']
    const firstNames = ['John', 'Jane', 'Mike', 'Sarah', 'David', 'Lisa', 'Chris', 'Emma', 'Tom', 'Anna']
    const lastNames = ['Smith', 'Johnson', 'Williams', 'Brown', 'Jones', 'Garcia', 'Miller', 'Davis', 'Rodriguez', 'Martinez']

    for (let i = 0; i < count; i++) {
      const firstName = firstNames[i % firstNames.length]
      const lastName = lastNames[i % lastNames.length]
      const role = roles[i % roles.length]
      const store = this.stores[i % this.stores.length]

      users.push({
        id: `user-${i + 1}`,
        name: `${firstName} ${lastName}`,
        email: `${firstName.toLowerCase()}.${lastName.toLowerCase()}${i > 9 ? i : ''}@test.com`,
        role,
        permissions: this.getRolePermissions(role),
        storeId: store.id,
        isActive: Math.random() > 0.1, // 90% active
        createdAt: new Date(Date.now() - Math.random() * 180 * 24 * 60 * 60 * 1000) // Within 6 months
      })
    }

    return users
  }

  private static async generateProducts(count: number): Promise<TestProduct[]> {
    const products: TestProduct[] = []
    const categories = ['Electronics', 'Clothing', 'Books', 'Food', 'Beverages', 'Home & Garden', 'Sports', 'Toys']
    const productNames = [
      'Wireless Headphones', 'Cotton T-Shirt', 'Programming Book', 'Organic Coffee',
      'Smartphone Case', 'Yoga Mat', 'LED Light Bulb', 'Coffee Mug',
      'Bluetooth Speaker', 'Denim Jeans', 'Notebook', 'Green Tea',
      'Phone Charger', 'Running Shoes', 'Water Bottle', 'Laptop Stand'
    ]

    for (let i = 0; i < count; i++) {
      const category = categories[i % categories.length]
      const store = this.stores[i % this.stores.length]
      const baseName = productNames[i % productNames.length]
      
      const price = Math.round((Math.random() * 200 + 10) * 100) / 100 // $10-$210
      const stock = Math.floor(Math.random() * 500) + 1

      products.push({
        id: `product-${i + 1}`,
        name: `${baseName} ${i > 15 ? `(${i - 15})` : ''}`,
        description: `High-quality ${baseName.toLowerCase()} for everyday use`,
        price,
        category,
        stock,
        isActive: Math.random() > 0.05, // 95% active
        storeId: store.id,
        createdAt: new Date(Date.now() - Math.random() * 365 * 24 * 60 * 60 * 1000)
      })
    }

    return products
  }

  private static async generateCustomers(count: number): Promise<TestCustomer[]> {
    const customers: TestCustomer[] = []
    const firstNames = ['Alice', 'Bob', 'Carol', 'Dave', 'Eve', 'Frank', 'Grace', 'Henry', 'Ivy', 'Jack']
    const lastNames = ['Anderson', 'Brown', 'Clark', 'Davis', 'Evans', 'Fisher', 'Green', 'Harris', 'Johnson', 'King']

    for (let i = 0; i < count; i++) {
      const firstName = firstNames[i % firstNames.length]
      const lastName = lastNames[i % lastNames.length]
      const store = this.stores[i % this.stores.length]
      
      const totalOrders = Math.floor(Math.random() * 50) + 1
      const totalSpent = Math.round((Math.random() * 2000 + 100) * 100) / 100

      customers.push({
        id: `customer-${i + 1}`,
        name: `${firstName} ${lastName}`,
        email: i % 3 === 0 ? `${firstName.toLowerCase()}.${lastName.toLowerCase()}@email.com` : undefined,
        phone: i % 4 === 0 ? `+1-555-${1000 + i}` : undefined,
        address: i % 5 === 0 ? `${i + 1} Customer Ave, Test City, TC ${10000 + i}` : undefined,
        preferences: {
          favoriteCategory: ['Electronics', 'Clothing', 'Books'][i % 3],
          communicationMethod: i % 2 === 0 ? 'email' : 'phone'
        },
        totalOrders,
        totalSpent,
        storeId: store.id,
        createdAt: new Date(Date.now() - Math.random() * 365 * 24 * 60 * 60 * 1000)
      })
    }

    return customers
  }

  private static async generateOrders(count: number): Promise<TestOrder[]> {
    const orders: TestOrder[] = []
    const statuses: TestOrder['status'][] = ['new', 'held', 'recalled', 'editing', 'processing', 'completed', 'cancelled', 'expired']
    
    for (let i = 0; i < count; i++) {
      const store = this.stores[i % this.stores.length]
      const customer = this.customers[i % this.customers.length]
      const employee = this.users.find(u => u.storeId === store.id && u.role === 'cashier')
      
      // Generate items for the order
      const itemCount = Math.floor(Math.random() * 5) + 1 // 1-5 items
      const items: TestOrderItem[] = []
      let subtotal = 0

      for (let j = 0; j < itemCount; j++) {
        const product = this.products[Math.floor(Math.random() * this.products.length)]
        const quantity = Math.floor(Math.random() * 3) + 1
        
        const itemSubtotal = product.price * quantity
        items.push({
          productId: product.id,
          name: product.name,
          price: product.price,
          quantity,
          subtotal: itemSubtotal
        })
        
        subtotal += itemSubtotal
      }

      const gst = subtotal * 0.08 // 8% GST
      const discount = Math.random() > 0.8 ? subtotal * 0.1 : 0 // 20% chance of 10% discount
      const total = subtotal + gst - discount

      // Generate creation date based on historical data setting
      const createdAt = this.config.generateHistoricalData
        ? new Date(Date.now() - Math.random() * this.config.historicalDays * 24 * 60 * 60 * 1000)
        : new Date()

      orders.push({
        id: `order-${i + 1}`,
        orderNumber: `ORD-${String(i + 1).padStart(6, '0')}`,
        customerId: customer.id,
        employeeId: employee?.id,
        items,
        subtotal,
        gst,
        discount,
        total,
        status: statuses[Math.floor(Math.random() * statuses.length)],
        priority: Math.floor(Math.random() * 5),
        tableNumber: Math.random() > 0.7 ? `T${Math.floor(Math.random() * 20) + 1}` : undefined,
        notes: Math.random() > 0.8 ? 'Special instructions for this order' : undefined,
        storeId: store.id,
        createdAt,
        updatedAt: new Date(createdAt.getTime() + Math.random() * 24 * 60 * 60 * 1000),
        metadata: {
          source: 'test_data',
          generationVersion: '1.0'
        }
      })
    }

    return orders
  }

  private static async establishRelationships(): Promise<void> {
    // This would establish proper relationships in a real database
    // For testing purposes, we ensure data consistency
    
    // Ensure all users have valid store references
    this.users.forEach(user => {
      const storeExists = this.stores.find(s => s.id === user.storeId)
      if (!storeExists) {
        user.storeId = this.stores[0].id
      }
    })

    // Ensure all products have valid store references
    this.products.forEach(product => {
      const storeExists = this.stores.find(s => s.id === product.storeId)
      if (!storeExists) {
        product.storeId = this.stores[0].id
      }
    })

    // Ensure all customers have valid store references
    this.customers.forEach(customer => {
      const storeExists = this.stores.find(s => s.id === customer.storeId)
      if (!storeExists) {
        customer.storeId = this.stores[0].id
      }
    })

    // Ensure all orders have valid references
    this.orders.forEach(order => {
      // Validate store reference
      const storeExists = this.stores.find(s => s.id === order.storeId)
      if (!storeExists) {
        order.storeId = this.stores[0].id
      }

      // Validate customer reference
      if (order.customerId) {
        const customerExists = this.customers.find(c => c.id === order.customerId)
        if (!customerExists) {
          order.customerId = undefined
        }
      }

      // Validate employee reference
      if (order.employeeId) {
        const employeeExists = this.users.find(u => u.id === order.employeeId)
        if (!employeeExists) {
          order.employeeId = undefined
        }
      }

      // Validate product references in items
      order.items.forEach(item => {
        const productExists = this.products.find(p => p.id === item.productId)
        if (!productExists) {
          item.productId = this.products[0].id
          item.name = this.products[0].name
          item.price = this.products[0].price
        }
      })
    })
  }

  private static getRolePermissions(role: TestUser['role']): string[] {
    const permissions: Record<TestUser['role'], string[]> = {
      admin: ['*'], // All permissions
      manager: [
        'orders.read', 'orders.write', 'orders.delete',
        'products.read', 'products.write',
        'customers.read', 'customers.write',
        'users.read', 'reports.read',
        'settings.write', 'collaboration.manage'
      ],
      cashier: [
        'orders.read', 'orders.write',
        'products.read',
        'customers.read',
        'collaboration.join'
      ],
      collaborator: [
        'orders.read',
        'collaboration.join', 'collaboration.edit'
      ]
    }

    return permissions[role]
  }

  // ========================================
  // DATA ACCESS METHODS
  // ========================================

  static getStores(): TestStore[] {
    return [...this.stores]
  }

  static getUsers(): TestUser[] {
    return [...this.users]
  }

  static getProducts(): TestProduct[] {
    return [...this.products]
  }

  static getCustomers(): TestCustomer[] {
    return [...this.customers]
  }

  static getOrders(): TestOrder[] {
    return [...this.orders]
  }

  static getStoreById(id: string): TestStore | undefined {
    return this.stores.find(store => store.id === id)
  }

  static getUserById(id: string): TestUser | undefined {
    return this.users.find(user => user.id === id)
  }

  static getProductById(id: string): TestProduct | undefined {
    return this.products.find(product => product.id === id)
  }

  static getCustomerById(id: string): TestCustomer | undefined {
    return this.customers.find(customer => customer.id === id)
  }

  static getOrderById(id: string): TestOrder | undefined {
    return this.orders.find(order => order.id === id)
  }

  static getOrdersByStore(storeId: string): TestOrder[] {
    return this.orders.filter(order => order.storeId === storeId)
  }

  static getOrdersByStatus(status: TestOrder['status']): TestOrder[] {
    return this.orders.filter(order => order.status === status)
  }

  static getOrdersByCustomer(customerId: string): TestOrder[] {
    return this.orders.filter(order => order.customerId === customerId)
  }

  static getProductsByCategory(category: string): TestProduct[] {
    return this.products.filter(product => product.category === category)
  }

  // ========================================
  // DATA MODIFICATION FOR TESTS
  // ========================================

  static createTestOrder(overrides: Partial<TestOrder> = {}): TestOrder {
    const store = this.stores[0]
    const customer = this.customers[0]
    const employee = this.users.find(u => u.storeId === store.id && u.role === 'cashier')

    const order: TestOrder = {
      id: `test-order-${Date.now()}`,
      orderNumber: `TEST-${Date.now()}`,
      customerId: customer.id,
      employeeId: employee?.id,
      items: [{
        productId: this.products[0].id,
        name: this.products[0].name,
        price: this.products[0].price,
        quantity: 1,
        subtotal: this.products[0].price
      }],
      subtotal: this.products[0].price,
      gst: this.products[0].price * 0.08,
      discount: 0,
      total: this.products[0].price * 1.08,
      status: 'new',
      priority: 0,
      storeId: store.id,
      createdAt: new Date(),
      updatedAt: new Date(),
      ...overrides
    }

    return order
  }

  static createTestUser(overrides: Partial<TestUser> = {}): TestUser {
    const store = this.stores[0]
    
    const user: TestUser = {
      id: `test-user-${Date.now()}`,
      name: 'Test User',
      email: 'test@example.com',
      role: 'cashier',
      permissions: ['orders.read', 'orders.write'],
      storeId: store.id,
      isActive: true,
      createdAt: new Date(),
      ...overrides
    }

    return user
  }

  static createTestProduct(overrides: Partial<TestProduct> = {}): TestProduct {
    const store = this.stores[0]
    
    const product: TestProduct = {
      id: `test-product-${Date.now()}`,
      name: 'Test Product',
      description: 'A product for testing',
      price: 100,
      category: 'Test Category',
      stock: 100,
      isActive: true,
      storeId: store.id,
      createdAt: new Date(),
      ...overrides
    }

    return product
  }

  // ========================================
  // DATA CLEANUP AND RESET
  // ========================================

  static async clearAllData(): Promise<void> {
    console.log('🧹 Clearing all test data...')
    
    this.stores = []
    this.users = []
    this.products = []
    this.customers = []
    this.orders = []
    
    console.log('✅ All test data cleared')
  }

  static async resetToDefaults(): Promise<void> {
    await this.clearAllData()
    await this.generateTestData()
  }

  // ========================================
  // DATA VALIDATION
  // ========================================

  static validateTestData(): { isValid: boolean; errors: string[] } {
    const errors: string[] = []

    // Validate stores
    if (this.stores.length === 0) {
      errors.push('No stores found')
    }

    // Validate users
    if (this.users.length === 0) {
      errors.push('No users found')
    } else {
      this.users.forEach(user => {
        if (!this.stores.find(s => s.id === user.storeId)) {
          errors.push(`User ${user.id} has invalid store reference`)
        }
      })
    }

    // Validate products
    if (this.products.length === 0) {
      errors.push('No products found')
    } else {
      this.products.forEach(product => {
        if (!this.stores.find(s => s.id === product.storeId)) {
          errors.push(`Product ${product.id} has invalid store reference`)
        }
      })
    }

    // Validate customers
    if (this.customers.length === 0) {
      errors.push('No customers found')
    } else {
      this.customers.forEach(customer => {
        if (!this.stores.find(s => s.id === customer.storeId)) {
          errors.push(`Customer ${customer.id} has invalid store reference`)
        }
      })
    }

    // Validate orders
    if (this.orders.length === 0) {
      errors.push('No orders found')
    } else {
      this.orders.forEach(order => {
        if (!this.stores.find(s => s.id === order.storeId)) {
          errors.push(`Order ${order.id} has invalid store reference`)
        }
        
        if (order.customerId && !this.customers.find(c => c.id === order.customerId)) {
          errors.push(`Order ${order.id} has invalid customer reference`)
        }
        
        if (order.employeeId && !this.users.find(u => u.id === order.employeeId)) {
          errors.push(`Order ${order.id} has invalid employee reference`)
        }
      })
    }

    return {
      isValid: errors.length === 0,
      errors
    }
  }

  // ========================================
  // DATA EXPORT/IMPORT
  // ========================================

  static exportTestData(): string {
    return JSON.stringify({
      stores: this.stores,
      users: this.users,
      products: this.products,
      customers: this.customers,
      orders: this.orders,
      exportedAt: new Date().toISOString(),
      version: '1.0'
    }, null, 2)
  }

  static async importTestData(jsonData: string): Promise<void> {
    try {
      const data = JSON.parse(jsonData)
      
      if (data.stores) this.stores = data.stores
      if (data.users) this.users = data.users
      if (data.products) this.products = data.products
      if (data.customers) this.customers = data.customers
      if (data.orders) this.orders = data.orders
      
      console.log('✅ Test data imported successfully')
    } catch (error) {
      throw new Error(`Failed to import test data: ${error instanceof Error ? error.message : 'Unknown error'}`)
    }
  }

  // ========================================
  // PERFORMANCE OPTIMIZATION
  // ========================================

  static async optimizeTestData(): Promise<void> {
    console.log('⚡ Optimizing test data...')
    
    // Sort data for better cache performance
    this.stores.sort((a, b) => a.id.localeCompare(b.id))
    this.users.sort((a, b) => a.id.localeCompare(b.id))
    this.products.sort((a, b) => a.id.localeCompare(b.id))
    this.customers.sort((a, b) => a.id.localeCompare(b.id))
    this.orders.sort((a, b) => a.id.localeCompare(b.id))
    
    // Create indexes for common queries
    const indexes = new Map()
    
    this.orders.forEach(order => {
      const key = `${order.storeId}-${order.status}`
      if (!indexes.has(key)) {
        indexes.set(key, [])
      }
      indexes.get(key).push(order)
    })
    
    console.log(`✅ Test data optimized with ${indexes.size} indexes`)
  }
}

// Test Data Scenarios
export class TestDataScenarios {
  // High-volume scenario for performance testing
  static async generateHighVolumeScenario(): Promise<void> {
    const config: TestDataConfig = {
      storeCount: 10,
      userCount: 100,
      productCount: 1000,
      customerCount: 500,
      orderCount: 5000,
      enableRelationships: true,
      generateHistoricalData: true,
      historicalDays: 90
    }
    
    await TestDataManager.generateTestData(config)
  }

  // Collaboration testing scenario
  static async generateCollaborationScenario(): Promise<void> {
    const config: TestDataConfig = {
      storeCount: 1,
      userCount: 20,
      productCount: 50,
      customerCount: 25,
      orderCount: 100,
      enableRelationships: true,
      generateHistoricalData: false,
      historicalDays: 1
    }
    
    await TestDataManager.generateTestData(config)
    
    // Add some active collaboration sessions
    const orders = TestDataManager.getOrders().slice(0, 10)
    const users = TestDataManager.getUsers()
    
    orders.forEach((order, index) => {
      order.status = 'held'
      order.metadata = {
        ...order.metadata,
        activeCollaborators: users.slice(index, index + 3).map(u => u.id)
      }
    })
  }

  // Error testing scenario
  static async generateErrorTestingScenario(): Promise<void> {
    const config: TestDataConfig = {
      storeCount: 2,
      userCount: 10,
      productCount: 20,
      customerCount: 15,
      orderCount: 50,
      enableRelationships: true,
      generateHistoricalData: false,
      historicalDays: 1
    }
    
    await TestDataManager.generateTestData(config)
    
    // Add some problematic data for error testing
    const orders = TestDataManager.getOrders()
    
    // Add orders with invalid references
    orders[0].customerId = 'invalid-customer-id'
    orders[1].employeeId = 'invalid-user-id'
    orders[2].items[0].productId = 'invalid-product-id'
    
    // Add orders with invalid data
    orders[3].total = -100
    orders[4].subtotal = 0
    orders[5].status = 'invalid-status' as any
  }
}

// Export for easy use
export default TestDataManager

// Make available globally
if (typeof window !== 'undefined') {
  (window as any).TestDataManager = TestDataManager
  (window as any).TestDataScenarios = TestDataScenarios
}