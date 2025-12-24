const { PrismaClient } = require('@prisma/client')

const prisma = new PrismaClient()

async function main() {
  console.log('Creating default categories...')
  
  // Get or create store
  let store = await prisma.store.findFirst()
  if (!store) {
    console.log('Creating default store...')
    store = await prisma.store.create({
      data: {
        name: 'My Store',
        taxRate: 0,
        currency: 'USD',
      },
    })
    console.log('Created store with ID:', store.id)
  } else {
    console.log('Found existing store with ID:', store.id)
  }

  // Create default categories
  const categories = [
    { name: 'General', slug: 'general', color: '#3b82f6' },
    { name: 'Electronics', slug: 'electronics', color: '#ef4444' },
    { name: 'Clothing', slug: 'clothing', color: '#10b981' },
    { name: 'Food & Beverages', slug: 'food-beverages', color: '#f59e0b' },
    { name: 'Books', slug: 'books', color: '#8b5cf6' },
  ]

  for (const category of categories) {
    try {
      const existing = await prisma.category.findUnique({
        where: { slug: category.slug }
      })
      
      if (!existing) {
        const created = await prisma.category.create({
          data: {
            ...category,
            storeId: store.id,
          },
        })
        console.log(`Created category: ${category.name} (${category.slug})`)
      } else {
        console.log(`Category already exists: ${category.name}`)
      }
    } catch (error) {
      console.error(`Error creating category ${category.name}:`, error.message)
    }
  }

  console.log('Default categories creation completed!')
}

main()
  .catch((e) => {
    console.error(e)
    process.exit(1)
  })
  .finally(async () => {
    await prisma.$disconnect()
  })