import { NextResponse } from 'next/server'
import { db } from '@/lib/db'

// Initialize database with sample data
export async function POST() {
  try {
    console.log('🌱 Initializing database...')

    // Create store
    const store = await db.store.upsert({
      where: { id: 'default' },
      update: {},
      create: {
        id: 'default',
        name: 'My Retail Store',
        address: '123 Main Street',
        phone: '+1 234 567 8900',
        email: 'store@myretail.com',
        taxRate: 0,
        gstRate: 10,
        currency: 'USD',
      },
    })

    // Create categories
    const categories = await Promise.all([
      db.category.upsert({
        where: { slug: 'beverages' },
        update: {},
        create: {
          name: 'Beverages',
          slug: 'beverages',
          color: '#3b82f6',
          storeId: store.id,
        },
      }),
      db.category.upsert({
        where: { slug: 'snacks' },
        update: {},
        create: {
          name: 'Snacks',
          slug: 'snacks',
          color: '#f59e0b',
          storeId: store.id,
        },
      }),
      db.category.upsert({
        where: { slug: 'dairy' },
        update: {},
        create: {
          name: 'Dairy & Eggs',
          slug: 'dairy',
          color: '#10b981',
          storeId: store.id,
        },
      }),
      db.category.upsert({
        where: { slug: 'baked-goods' },
        update: {},
        create: {
          name: 'Baked Goods',
          slug: 'baked-goods',
          color: '#ef4444',
          storeId: store.id,
        },
      }),
      db.category.upsert({
        where: { slug: 'personal-care' },
        update: {},
        create: {
          name: 'Personal Care',
          slug: 'personal-care',
          color: '#8b5cf6',
          storeId: store.id,
        },
      }),
    ])

    // Create products
    const products = [
      {
        name: 'Cola 500ml',
        sku: 'BEV-001',
        barcode: '1234567890001',
        description: 'Refreshing cola soft drink',
        price: 2.50,
        cost: 1.50,
        stock: 50,
        minStock: 10,
        categoryId: categories[0].id,
      },
      {
        name: 'Orange Juice 1L',
        sku: 'BEV-002',
        barcode: '1234567890002',
        description: 'Fresh orange juice',
        price: 3.99,
        cost: 2.50,
        stock: 30,
        minStock: 8,
        categoryId: categories[0].id,
      },
      {
        name: 'Mineral Water 500ml',
        sku: 'BEV-003',
        barcode: '1234567890003',
        description: 'Natural mineral water',
        price: 1.50,
        cost: 0.80,
        stock: 100,
        minStock: 20,
        categoryId: categories[0].id,
      },
      {
        name: 'Potato Chips',
        sku: 'SNK-001',
        barcode: '1234567890101',
        description: 'Classic salted potato chips',
        price: 3.99,
        cost: 2.20,
        stock: 40,
        minStock: 10,
        categoryId: categories[1].id,
      },
      {
        name: 'Chocolate Bar',
        sku: 'SNK-002',
        barcode: '1234567890102',
        description: 'Milk chocolate bar',
        price: 1.99,
        cost: 1.20,
        stock: 60,
        minStock: 15,
        categoryId: categories[1].id,
      },
      {
        name: 'Fresh Milk 1L',
        sku: 'DAI-001',
        barcode: '1234567890201',
        description: 'Whole fresh milk',
        price: 2.99,
        cost: 1.80,
        stock: 25,
        minStock: 8,
        categoryId: categories[2].id,
      },
      {
        name: 'Large Eggs (12)',
        sku: 'DAI-002',
        barcode: '1234567890202',
        description: 'Farm fresh eggs, 12 pack',
        price: 4.99,
        cost: 3.20,
        stock: 20,
        minStock: 5,
        categoryId: categories[2].id,
      },
      {
        name: 'Greek Yogurt',
        sku: 'DAI-003',
        barcode: '1234567890203',
        description: 'Greek yogurt, 500g',
        price: 3.49,
        cost: 2.00,
        stock: 35,
        minStock: 10,
        categoryId: categories[2].id,
      },
      {
        name: 'Whole Wheat Bread',
        sku: 'BAK-001',
        barcode: '1234567890301',
        description: 'Fresh whole wheat bread',
        price: 3.49,
        cost: 2.00,
        stock: 15,
        minStock: 5,
        categoryId: categories[3].id,
      },
      {
        name: 'Croissants (4 pack)',
        sku: 'BAK-002',
        barcode: '1234567890302',
        description: 'Butter croissants',
        price: 4.99,
        cost: 3.00,
        stock: 12,
        minStock: 4,
        categoryId: categories[3].id,
      },
      {
        name: 'Shampoo 400ml',
        sku: 'PER-001',
        barcode: '1234567890401',
        description: 'Gentle shampoo',
        price: 6.99,
        cost: 4.50,
        stock: 30,
        minStock: 10,
        categoryId: categories[4].id,
      },
      {
        name: 'Toothpaste',
        sku: 'PER-002',
        barcode: '1234567890402',
        description: 'Mint toothpaste 100ml',
        price: 3.49,
        cost: 2.20,
        stock: 45,
        minStock: 12,
        categoryId: categories[4].id,
      },
    ]

    for (const product of products) {
      await db.product.upsert({
        where: { sku: product.sku },
        update: {},
        create: {
          ...product,
          storeId: store.id,
        },
      })
    }

    // Create sample customers
    await db.customer.upsert({
      where: { email: 'john@example.com' },
      update: {},
      create: {
        name: 'John Doe',
        email: 'john@example.com',
        phone: '+1 555 123 4567',
        address: '456 Oak Street',
        storeId: store.id,
        points: 150,
      },
    })

    await db.customer.upsert({
      where: { email: 'jane@example.com' },
      update: {},
      create: {
        name: 'Jane Smith',
        email: 'jane@example.com',
        phone: '+1 555 987 6543',
        address: '789 Pine Avenue',
        storeId: store.id,
        points: 320,
      },
    })

    console.log('🎉 Initialization completed successfully!')

    return NextResponse.json({
      success: true,
      message: 'Database initialized successfully with sample data',
    })
  } catch (error) {
    console.error('❌ Initialization failed:', error)
    return NextResponse.json(
      { error: 'Failed to initialize database' },
      { status: 500 }
    )
  }
}
