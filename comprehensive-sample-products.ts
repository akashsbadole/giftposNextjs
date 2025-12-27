/**
 * Comprehensive Sample Products for POS System Testing
 * 
 * This file contains diverse sample products designed to test all aspects
 * of the POS system functionality including:
 * - Different product categories (electronics, clothing, food, etc.)
 * - Various pricing strategies (regular, sale, wholesale)
 * - Different stock levels (high, low, out of stock)
 * - Products with variants (size, color, etc.)
 * - Realistic and varied test data
 */

import { PrismaClient } from '@prisma/client'

const prisma = new PrismaClient()

// Enhanced Categories with comprehensive retail coverage
const enhancedCategories = [
  // Existing categories (keeping them for compatibility)
  { name: 'Beverages', slug: 'beverages', color: '#3b82f6' },
  { name: 'Snacks', slug: 'snacks', color: '#f59e0b' },
  { name: 'Dairy & Eggs', slug: 'dairy', color: '#10b981' },
  { name: 'Baked Goods', slug: 'baked-goods', color: '#ef4444' },
  { name: 'Personal Care', slug: 'personal-care', color: '#8b5cf6' },
  
  // New comprehensive categories
  { name: 'Electronics', slug: 'electronics', color: '#06b6d4' },
  { name: 'Clothing & Apparel', slug: 'clothing', color: '#ec4899' },
  { name: 'Home & Kitchen', slug: 'home-kitchen', color: '#84cc16' },
  { name: 'Books & Stationery', slug: 'books-stationery', color: '#f97316' },
  { name: 'Health & Wellness', slug: 'health-wellness', color: '#14b8a6' },
  { name: 'Toys & Games', slug: 'toys-games', color: '#8b5cf6' },
  { name: 'Automotive', slug: 'automotive', color: '#6b7280' },
  { name: 'Garden & Outdoor', slug: 'garden-outdoor', color: '#22c55e' },
  { name: 'Grocery Essentials', slug: 'grocery-essentials', color: '#dc2626' },
  { name: 'Cleaning Supplies', slug: 'cleaning-supplies', color: '#64748b' },
]

// Comprehensive Sample Products
const comprehensiveProducts = [
  // BEVERAGES (Enhanced)
  {
    name: 'Energy Drink 250ml',
    sku: 'BEV-ENR-001',
    barcode: '8901234567001',
    description: 'High-energy drink with caffeine and vitamins',
    price: 4.99, cost: 3.20, stock: 85, minStock: 15,
    category: 'beverages', isActive: true
  },
  {
    name: 'Fresh Apple Juice 1L',
    sku: 'BEV-AJ-001',
    barcode: '8901234567002',
    description: 'Pure apple juice, no added sugar',
    price: 5.49, cost: 3.50, stock: 42, minStock: 10,
    category: 'beverages', isActive: true
  },
  {
    name: 'Cold Brew Coffee 350ml',
    sku: 'BEV-CBC-001',
    barcode: '8901234567003',
    description: 'Premium cold brew coffee',
    price: 6.99, cost: 4.80, stock: 8, minStock: 12, // Low stock
    category: 'beverages', isActive: true
  },

  // SNACKS (Enhanced)
  {
    name: 'Premium Mixed Nuts 200g',
    sku: 'SNK-NUT-001',
    barcode: '8901234567101',
    description: 'Assorted premium nuts and dried fruits',
    price: 12.99, cost: 8.50, stock: 28, minStock: 8,
    category: 'snacks', isActive: true
  },
  {
    name: 'Organic Granola Bars (6 pack)',
    sku: 'SNK-GRB-001',
    barcode: '8901234567102',
    description: 'Healthy oat granola bars with honey',
    price: 7.99, cost: 5.20, stock: 0, minStock: 15, // Out of stock
    category: 'snacks', isActive: true
  },
  {
    name: 'Sea Salt Pretzels',
    sku: 'SNK-PTZ-001',
    barcode: '8901234567103',
    description: 'Crispy pretzels with sea salt',
    price: 3.49, cost: 2.10, stock: 67, minStock: 20,
    category: 'snacks', isActive: true
  },

  // DAIRY & EGGS (Enhanced)
  {
    name: 'Organic Whole Milk 1L',
    sku: 'DAI-MLK-001',
    barcode: '8901234567201',
    description: 'Farm fresh organic whole milk',
    price: 4.29, cost: 2.80, stock: 35, minStock: 12,
    category: 'dairy', isActive: true
  },
  {
    name: 'Aged Cheddar Cheese 500g',
    sku: 'DAI-CHD-001',
    barcode: '8901234567202',
    description: 'Premium aged cheddar cheese',
    price: 8.99, cost: 6.20, stock: 18, minStock: 8,
    category: 'dairy', isActive: true
  },
  {
    name: 'Free-Range Eggs (18 pack)',
    sku: 'DAI-EGG-001',
    barcode: '8901234567203',
    description: 'Large free-range eggs, 18 count',
    price: 7.49, cost: 5.10, stock: 6, minStock: 10, // Low stock
    category: 'dairy', isActive: true
  },

  // BAKED GOODS (Enhanced)
  {
    name: 'Sourdough Bread Loaf',
    sku: 'BAK-SOU-001',
    barcode: '8901234567301',
    description: 'Artisan sourdough bread, freshly baked',
    price: 5.99, cost: 3.80, stock: 12, minStock: 6,
    category: 'baked-goods', isActive: true
  },
  {
    name: 'Chocolate Croissants (6 pack)',
    sku: 'BAK-CHC-001',
    barcode: '8901234567302',
    description: 'Buttery croissants with chocolate filling',
    price: 8.99, cost: 6.50, stock: 15, minStock: 8,
    category: 'baked-goods', isActive: true
  },

  // PERSONAL CARE (Enhanced)
  {
    name: 'Luxury Body Lotion 500ml',
    sku: 'PER-BDL-001',
    barcode: '8901234567401',
    description: 'Moisturizing body lotion with natural oils',
    price: 12.99, cost: 8.80, stock: 25, minStock: 10,
    category: 'personal-care', isActive: true
  },
  {
    name: 'Electric Toothbrush',
    sku: 'PER-ETB-001',
    barcode: '8901234567402',
    description: 'Rechargeable electric toothbrush',
    price: 39.99, cost: 28.50, stock: 15, minStock: 5,
    category: 'personal-care', isActive: true
  },

  // ELECTRONICS (New)
  {
    name: 'Wireless Bluetooth Headphones',
    sku: 'ELE-BTH-001',
    barcode: '8901234568001',
    description: 'High-quality wireless headphones with noise cancellation',
    price: 89.99, cost: 65.00, stock: 22, minStock: 8,
    category: 'electronics', isActive: true
  },
  {
    name: 'USB-C Cable 3m',
    sku: 'ELE-USC-001',
    barcode: '8901234568002',
    description: 'Fast charging USB-C cable',
    price: 15.99, cost: 10.50, stock: 45, minStock: 20,
    category: 'electronics', isActive: true
  },
  {
    name: 'Power Bank 20000mAh',
    sku: 'ELE-PWB-001',
    barcode: '8901234568003',
    description: 'High-capacity portable power bank',
    price: 34.99, cost: 24.80, stock: 18, minStock: 10,
    category: 'electronics', isActive: true
  },
  {
    name: 'Wireless Phone Charger',
    sku: 'ELE-WPC-001',
    barcode: '8901234568004',
    description: 'Fast wireless charging pad',
    price: 24.99, cost: 17.50, stock: 7, minStock: 12, // Low stock
    category: 'electronics', isActive: true
  },

  // CLOTHING & APPAREL (New)
  {
    name: 'Classic Cotton T-Shirt - White M',
    sku: 'CLO-TSH-WM',
    barcode: '8901234568101',
    description: 'Comfortable 100% cotton t-shirt, size Medium, White',
    price: 19.99, cost: 12.50, stock: 35, minStock: 15,
    category: 'clothing', isActive: true
  },
  {
    name: 'Classic Cotton T-Shirt - Black L',
    sku: 'CLO-TSH-BL',
    barcode: '8901234568102',
    description: 'Comfortable 100% cotton t-shirt, size Large, Black',
    price: 19.99, cost: 12.50, stock: 28, minStock: 15,
    category: 'clothing', isActive: true
  },
  {
    name: 'Denim Jeans - Blue 32W',
    sku: 'CLO-JNS-B32',
    barcode: '8901234568103',
    description: 'Classic fit denim jeans, waist size 32, Blue',
    price: 49.99, cost: 35.20, stock: 42, minStock: 18,
    category: 'clothing', isActive: true
  },
  {
    name: 'Denim Jeans - Black 34W',
    sku: 'CLO-JNS-B34',
    barcode: '8901234568104',
    description: 'Classic fit denim jeans, waist size 34, Black',
    price: 49.99, cost: 35.20, stock: 0, minStock: 18, // Out of stock
    category: 'clothing', isActive: true
  },
  {
    name: 'Wool Sweater - Navy M',
    sku: 'CLO-SWR-NM',
    barcode: '8901234568105',
    description: 'Premium wool sweater, size Medium, Navy Blue',
    price: 79.99, cost: 58.50, stock: 12, minStock: 8,
    category: 'clothing', isActive: true
  },

  // HOME & KITCHEN (New)
  {
    name: 'Stainless Steel Cookware Set (10 piece)',
    sku: 'HOM-CKW-001',
    barcode: '8901234568201',
    description: 'Professional grade stainless steel cookware set',
    price: 129.99, cost: 89.50, stock: 8, minStock: 5,
    category: 'home-kitchen', isActive: true
  },
  {
    name: 'Coffee Maker - Programmable',
    sku: 'HOM-CFM-001',
    barcode: '8901234568202',
    description: '12-cup programmable coffee maker',
    price: 79.99, cost: 55.80, stock: 15, minStock: 8,
    category: 'home-kitchen', isActive: true
  },
  {
    name: 'Bamboo Cutting Board Large',
    sku: 'HOM-CBB-001',
    barcode: '8901234568203',
    description: 'Large bamboo cutting board with juice groove',
    price: 24.99, cost: 16.80, stock: 32, minStock: 15,
    category: 'home-kitchen', isActive: true
  },

  // BOOKS & STATIONERY (New)
  {
    name: 'Hardcover Novel - Fiction',
    sku: 'BOK-NOV-FIC',
    barcode: '8901234568301',
    description: 'Bestselling fiction novel, hardcover edition',
    price: 24.99, cost: 16.20, stock: 45, minStock: 20,
    category: 'books-stationery', isActive: true
  },
  {
    name: 'Notebook - A5 Ruled (3 pack)',
    sku: 'BOK-NTB-A5',
    barcode: '8901234568302',
    description: 'Premium ruled notebooks, A5 size, 3 pack',
    price: 12.99, cost: 8.50, stock: 68, minStock: 25,
    category: 'books-stationery', isActive: true
  },
  {
    name: 'Gel Pen Set - 12 colors',
    sku: 'BOK-GPN-012',
    barcode: '8901234568303',
    description: 'Smooth writing gel pens, 12 vibrant colors',
    price: 15.99, cost: 10.80, stock: 38, minStock: 15,
    category: 'books-stationery', isActive: true
  },

  // HEALTH & WELLNESS (New)
  {
    name: 'Vitamin C Tablets (100 count)',
    sku: 'HLT-VTC-100',
    barcode: '8901234568401',
    description: 'High-potency vitamin C supplements',
    price: 18.99, cost: 12.50, stock: 42, minStock: 15,
    category: 'health-wellness', isActive: true
  },
  {
    name: 'Protein Powder - Chocolate 1kg',
    sku: 'HLT-PPW-CH',
    barcode: '8901234568402',
    description: 'Whey protein powder, chocolate flavor',
    price: 54.99, cost: 38.80, stock: 25, minStock: 10,
    category: 'health-wellness', isActive: true
  },
  {
    name: 'Digital Blood Pressure Monitor',
    sku: 'HLT-BPM-001',
    barcode: '8901234568403',
    description: 'Automatic digital blood pressure monitor',
    price: 69.99, cost: 48.50, stock: 12, minStock: 6,
    category: 'health-wellness', isActive: true
  },

  // TOYS & GAMES (New)
  {
    name: 'Educational Building Blocks Set',
    sku: 'TOY-BLK-001',
    barcode: '8901234568501',
    description: 'Colorful educational building blocks, 100 pieces',
    price: 29.99, cost: 20.80, stock: 18, minStock: 10,
    category: 'toys-games', isActive: true
  },
  {
    name: 'Board Game - Strategy',
    sku: 'TOY-BGD-001',
    barcode: '8901234568502',
    description: 'Family strategy board game for 2-6 players',
    price: 39.99, cost: 28.50, stock: 15, minStock: 8,
    category: 'toys-games', isActive: true
  },
  {
    name: 'Action Figure - Collectible',
    sku: 'TOY-AFC-001',
    barcode: '8901234568503',
    description: 'Detailed action figure with accessories',
    price: 24.99, cost: 17.20, stock: 8, minStock: 12, // Low stock
    category: 'toys-games', isActive: true
  },

  // AUTOMOTIVE (New)
  {
    name: 'Motor Oil 5W-30 (4L)',
    sku: 'AUT-MOL-530',
    barcode: '8901234568601',
    description: 'High-performance synthetic motor oil',
    price: 34.99, cost: 24.80, stock: 22, minStock: 10,
    category: 'automotive', isActive: true
  },
  {
    name: 'Car Air Freshener - Vanilla',
    sku: 'AUT-AFV-001',
    barcode: '8901234568602',
    description: 'Long-lasting car air freshener, vanilla scent',
    price: 8.99, cost: 5.80, stock: 55, minStock: 20,
    category: 'automotive', isActive: true
  },
  {
    name: 'Emergency Road Kit',
    sku: 'AUT-ERK-001',
    barcode: '8901234568603',
    description: 'Complete emergency roadside assistance kit',
    price: 49.99, cost: 35.20, stock: 6, minStock: 5,
    category: 'automotive', isActive: true
  },

  // GARDEN & OUTDOOR (New)
  {
    name: 'Organic Plant Fertilizer 2kg',
    sku: 'GRD-FER-ORG',
    barcode: '8901234568701',
    description: 'All-purpose organic plant fertilizer',
    price: 19.99, cost: 13.50, stock: 32, minStock: 15,
    category: 'garden-outdoor', isActive: true
  },
  {
    name: 'Garden Hose 50ft',
    sku: 'GRD-HOS-050',
    barcode: '8901234568702',
    description: 'Durable garden hose with brass fittings',
    price: 34.99, cost: 24.80, stock: 18, minStock: 8,
    category: 'garden-outdoor', isActive: true
  },
  {
    name: 'Bird Feeder - Window Mount',
    sku: 'GRD-BFW-001',
    barcode: '8901234568703',
    description: 'Clear window-mounted bird feeder',
    price: 24.99, cost: 17.20, stock: 12, minStock: 8,
    category: 'garden-outdoor', isActive: true
  },

  // GROCERY ESSENTIALS (New)
  {
    name: 'Basmati Rice 5kg',
    sku: 'GRC-RIC-BAS',
    barcode: '8901234568801',
    description: 'Premium aged basmati rice',
    price: 22.99, cost: 16.50, stock: 45, minStock: 20,
    category: 'grocery-essentials', isActive: true
  },
  {
    name: 'Olive Oil Extra Virgin 1L',
    sku: 'GRC-OIL-OLV',
    barcode: '8901234568802',
    description: 'Cold-pressed extra virgin olive oil',
    price: 18.99, cost: 13.20, stock: 28, minStock: 12,
    category: 'grocery-essentials', isActive: true
  },
  {
    name: 'Sea Salt 1kg',
    sku: 'GRC-SLT-SEA',
    barcode: '8901234568803',
    description: 'Pure sea salt, coarse grain',
    price: 6.99, cost: 4.50, stock: 65, minStock: 25,
    category: 'grocery-essentials', isActive: true
  },

  // CLEANING SUPPLIES (New)
  {
    name: 'Multi-Surface Cleaner 1L',
    sku: 'CLN-MSC-001',
    barcode: '8901234568901',
    description: 'All-purpose surface cleaning solution',
    price: 8.99, cost: 5.80, stock: 58, minStock: 25,
    category: 'cleaning-supplies', isActive: true
  },
  {
    name: 'Dishwashing Liquid 500ml',
    sku: 'CLN-DSL-500',
    barcode: '8901234568902',
    description: 'Concentrated dishwashing liquid',
    price: 4.99, cost: 3.20, stock: 72, minStock: 30,
    category: 'cleaning-supplies', isActive: true
  },
  {
    name: 'Microfiber Cleaning Cloths (10 pack)',
    sku: 'CLN-MFC-010',
    barcode: '8901234568903',
    description: 'Lint-free microfiber cleaning cloths',
    price: 12.99, cost: 8.50, stock: 8, minStock: 15, // Low stock
    category: 'cleaning-supplies', isActive: true
  },

  // WHOLESALE/PROMOTIONAL PRODUCTS
  {
    name: 'Bulk Coffee Beans 5kg',
    sku: 'WHS-CFB-005',
    barcode: '8901234569001',
    description: 'Premium roast coffee beans, wholesale size',
    price: 89.99, cost: 65.20, stock: 5, minStock: 3,
    category: 'grocery-essentials', isActive: true
  },
  {
    name: 'Office Paper A4 (10 reams)',
    sku: 'WHS-PAP-A4',
    barcode: '8901234569002',
    description: 'White copy paper A4 size, 10 ream bulk pack',
    price: 49.99, cost: 35.80, stock: 3, minStock: 5, // Low stock
    category: 'books-stationery', isActive: true
  },

  // SEASONAL/LIMITED EDITION PRODUCTS
  {
    name: 'Holiday Special Chocolate Box',
    sku: 'SEA-CHC-HOL',
    barcode: '8901234569101',
    description: 'Premium chocolate assortment - Limited Edition',
    price: 29.99, cost: 20.50, stock: 25, minStock: 10,
    category: 'snacks', isActive: true
  },
  {
    name: 'Summer Beach Towel',
    sku: 'SEA-BTW-SUM',
    barcode: '8901234569102',
    description: 'Large absorbent beach towel with tropical design',
    price: 19.99, cost: 13.80, stock: 35, minStock: 15,
    category: 'home-kitchen', isActive: true
  },

  // PRODUCTS WITH DIFFERENT STOCK LEVELS FOR TESTING
  {
    name: 'Low Stock Test Product',
    sku: 'TEST-LOW-001',
    barcode: '8901234569201',
    description: 'Product with very low stock for testing alerts',
    price: 15.99, cost: 10.50, stock: 2, minStock: 8,
    category: 'books-stationery', isActive: true
  },
  {
    name: 'Out of Stock Test Product',
    sku: 'TEST-OUT-001',
    barcode: '8901234569202',
    description: 'Product with zero stock for testing out-of-stock scenarios',
    price: 25.99, cost: 18.20, stock: 0, minStock: 5,
    category: 'electronics', isActive: true
  },
  {
    name: 'High Stock Product',
    sku: 'TEST-HGH-001',
    barcode: '8901234569203',
    description: 'Product with high stock levels for testing inventory',
    price: 8.99, cost: 5.80, stock: 250, minStock: 50,
    category: 'cleaning-supplies', isActive: true
  },

  // INACTIVE PRODUCTS FOR TESTING
  {
    name: 'Discontinued Product',
    sku: 'DISC-001',
    barcode: '8901234569301',
    description: 'Product that has been discontinued',
    price: 12.99, cost: 8.50, stock: 0, minStock: 5,
    category: 'electronics', isActive: false
  },
  {
    name: 'Temporarily Disabled Product',
    sku: 'DISAB-001',
    barcode: '8901234569302',
    description: 'Product temporarily disabled for maintenance',
    price: 18.99, cost: 12.80, stock: 15, minStock: 8,
    category: 'home-kitchen', isActive: false
  }
]

async function seedComprehensiveProducts() {
  console.log('🌱 Starting comprehensive product seeding...')

  try {
    // Get or create store
    let store = await prisma.store.findFirst()
    if (!store) {
      store = await prisma.store.create({
        data: {
          name: 'My Retail Store',
          address: '123 Main Street',
          phone: '+1 234 567 8900',
          email: 'store@myretail.com',
          taxRate: 10,
          currency: 'USD',
        },
      })
      console.log('✅ Store created')
    }

    // Create or update categories
    const categoryMap = new Map()
    for (const categoryData of enhancedCategories) {
      const category = await prisma.category.upsert({
        where: { slug: categoryData.slug },
        update: {
          name: categoryData.name,
          color: categoryData.color,
        },
        create: {
          name: categoryData.name,
          slug: categoryData.slug,
          color: categoryData.color,
          storeId: store.id,
        },
      })
      categoryMap.set(categoryData.slug, category)
    }
    console.log('✅ Categories created/updated')

    // Create products
    let createdCount = 0
    let updatedCount = 0

    for (const productData of comprehensiveProducts) {
      const category = categoryMap.get(productData.category)
      if (!category) {
        console.warn(`⚠️  Category not found: ${productData.category}`)
        continue
      }

      const result = await prisma.product.upsert({
        where: { sku: productData.sku },
        update: {
          name: productData.name,
          barcode: productData.barcode,
          description: productData.description,
          price: productData.price,
          cost: productData.cost,
          stock: productData.stock,
          minStock: productData.minStock,
          categoryId: category.id,
          isActive: productData.isActive,
        },
        create: {
          name: productData.name,
          sku: productData.sku,
          barcode: productData.barcode,
          description: productData.description,
          price: productData.price,
          cost: productData.cost,
          stock: productData.stock,
          minStock: productData.minStock,
          categoryId: category.id,
          storeId: store.id,
          isActive: productData.isActive,
        },
      })

      if (result.createdAt.getTime() === result.updatedAt.getTime()) {
        createdCount++
      } else {
        updatedCount++
      }
    }

    console.log(`✅ Products processed: ${createdCount} created, ${updatedCount} updated`)

    // Generate summary statistics
    const totalProducts = await prisma.product.count()
    const activeProducts = await prisma.product.count({ where: { isActive: true } })
    const lowStockProducts = await prisma.product.count({
      where: {
        stock: {
          lte: 10
        }
      }
    })
    const outOfStockProducts = await prisma.product.count({
      where: {
        stock: 0
      }
    })
    const categoryStats = await prisma.category.findMany({
      include: {
        products: {
          select: { id: true }
        }
      }
    })

    console.log('\n📊 Database Summary:')
    console.log(`Total Products: ${totalProducts}`)
    console.log(`Active Products: ${activeProducts}`)
    console.log(`Low Stock Products (≤10): ${lowStockProducts}`)
    console.log(`Out of Stock Products: ${outOfStockProducts}`)
    console.log('\n📂 Products by Category:')
    categoryStats.forEach(cat => {
      console.log(`  ${cat.name}: ${cat.products.length} products`)
    })

    console.log('\n🎉 Comprehensive product seeding completed successfully!')
  } catch (error) {
    console.error('❌ Seeding failed:', error)
    throw error
  }
}

// Export for use in scripts
export { comprehensiveProducts, enhancedCategories, seedComprehensiveProducts }

// Run if called directly
if (require.main === module) {
  seedComprehensiveProducts()
    .catch((e) => {
      console.error('❌ Seed failed:', e)
      process.exit(1)
    })
    .finally(async () => {
      await prisma.$disconnect()
    })
}