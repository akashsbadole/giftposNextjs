import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'

// Get single product
export async function GET(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const product = await db.product.findUnique({
      where: { id: params.id },
      include: {
        category: true,
      },
    })

    if (!product) {
      return NextResponse.json({ error: 'Product not found' }, { status: 404 })
    }

    return NextResponse.json(product)
  } catch (error) {
    console.error('Error fetching product:', error)
    return NextResponse.json({ error: 'Failed to fetch product' }, { status: 500 })
  }
}

// Update product
export async function PUT(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
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

    const product = await db.product.update({
      where: { id: params.id },
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
        isActive,
      },
      include: {
        category: true,
      },
    })

    return NextResponse.json(product)
  } catch (error: any) {
    console.error('Error updating product:', error)
    if (error.code === 'P2002') {
      return NextResponse.json(
        { error: 'SKU or barcode already exists' },
        { status: 400 }
      )
    }
    return NextResponse.json({ error: 'Failed to update product' }, { status: 500 })
  }
}

// Delete product
export async function DELETE(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    await db.product.delete({
      where: { id: params.id },
    })

    return NextResponse.json({ success: true })
  } catch (error) {
    console.error('Error deleting product:', error)
    return NextResponse.json({ error: 'Failed to delete product' }, { status: 500 })
  }
}
