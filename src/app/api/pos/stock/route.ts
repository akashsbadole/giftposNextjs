import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'

// Get all stock logs for a product
export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url)
    const productId = searchParams.get('productId')
    const type = searchParams.get('type')

    const where: any = {}
    if (productId) {
      where.productId = productId
    }
    if (type) {
      where.type = type
    }

    const stockLogs = await db.stockLog.findMany({
      where,
      include: {
        product: {
          include: {
            category: true,
          },
        },
      },
      orderBy: { createdAt: 'desc' },
      take: 100,
    })

    return NextResponse.json(stockLogs)
  } catch (error) {
    console.error('Error fetching stock logs:', error)
    return NextResponse.json({ error: 'Failed to fetch stock logs' }, { status: 500 })
  }
}

// Create a stock adjustment
export async function POST(request: NextRequest) {
  try {
    const body = await request.json()
    const { productId, quantity, type, reason } = body

    if (!productId || !quantity || !type) {
      return NextResponse.json(
        { error: 'Product ID, quantity, and type are required' },
        { status: 400 }
      )
    }

    // Validate stock types
    const validTypes = ['restock', 'sale', 'return', 'adjustment', 'damage']
    if (!validTypes.includes(type)) {
      return NextResponse.json(
        { error: `Type must be one of: ${validTypes.join(', ')}` },
        { status: 400 }
      )
    }

    // Get product
    const product = await db.product.findUnique({
      where: { id: productId },
    })

    if (!product) {
      return NextResponse.json({ error: 'Product not found' }, { status: 404 })
    }

    // Check if sufficient stock for negative adjustments
    if (quantity < 0 && Math.abs(quantity) > product.stock) {
      return NextResponse.json(
        { error: 'Insufficient stock for this adjustment' },
        { status: 400 }
      )
    }

    // Update product stock
    const updatedProduct = await db.product.update({
      where: { id: productId },
      data: {
        stock: {
          increment: quantity,
        },
      },
    })

    // Create stock log
    const stockLog = await db.stockLog.create({
      data: {
        quantity,
        type,
        reason: reason || `${type.charAt(0).toUpperCase() + type.slice(1)} adjustment`,
        productId,
      },
      include: {
        product: true,
      },
    })

    return NextResponse.json({
      product: updatedProduct,
      stockLog,
    })
  } catch (error) {
    console.error('Error creating stock adjustment:', error)
    return NextResponse.json({ error: 'Failed to create stock adjustment' }, { status: 500 })
  }
}
