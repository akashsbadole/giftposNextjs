import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'

// Get all products
export async function GET() {
  try {
    const products = await db.product.findMany({
      include: {
        category: true,
      },
      orderBy: { createdAt: 'desc' },
    })

    return NextResponse.json(products)
  } catch (error) {
    console.error('Error fetching products:', error)
    return NextResponse.json({ error: 'Failed to fetch products' }, { status: 500 })
  }
}

// Create new product
export async function POST(request: NextRequest) {
  try {
    const body = await request.json()
    const {
      name,
      sku,
      barcode,
      description,
      price,
      cost,
      stock,
      minStock,
      categoryId,
      isActive,
    } = body

    if (!name || !sku || !price || !categoryId) {
      return NextResponse.json(
        { error: 'Name, SKU, price, and category are required' },
        { status: 400 }
      )
    }

    // Get or create store
    let store = await db.store.findFirst()
    if (!store) {
      store = await db.store.create({
        data: {
          name: 'My Store',
          taxRate: 0,
          currency: 'USD',
        },
      })
    }

    const product = await db.product.create({
      data: {
        name,
        sku,
        barcode,
        description,
        price,
        cost,
        stock,
        minStock,
        categoryId,
        storeId: store.id,
        isActive: isActive ?? true,
      },
      include: {
        category: true,
      },
    })

    return NextResponse.json(product, { status: 201 })
  } catch (error: any) {
    console.error('Error creating product:', error)
    if (error.code === 'P2002') {
      return NextResponse.json(
        { error: 'SKU or barcode already exists' },
        { status: 400 }
      )
    }
    return NextResponse.json({ error: 'Failed to create product' }, { status: 500 })
  }
}
