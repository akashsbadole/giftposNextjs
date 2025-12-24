import { NextResponse } from 'next/server'
import { db } from '@/lib/db'

// Get products with low stock
export async function GET() {
  try {
    const lowStockProducts = await db.product.findMany({
      where: {
        stock: {
          lte: db.product.fields.minStock,
        },
        isActive: true,
      },
      include: {
        category: true,
      },
      orderBy: {
        stock: 'asc',
      },
    })

    return NextResponse.json(lowStockProducts)
  } catch (error) {
    console.error('Error fetching low stock products:', error)
    return NextResponse.json({ error: 'Failed to fetch low stock products' }, { status: 500 })
  }
}
