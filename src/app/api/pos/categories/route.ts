import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'

// Get all categories
export async function GET() {
  try {
    const categories = await db.category.findMany({
      orderBy: { name: 'asc' },
    })

    return NextResponse.json(categories)
  } catch (error) {
    console.error('Error fetching categories:', error)
    return NextResponse.json({ error: 'Failed to fetch categories' }, { status: 500 })
  }
}

// Create new category
export async function POST(request: NextRequest) {
  try {
    const body = await request.json()
    const { name, slug, color, storeId } = body

    if (!name || !slug) {
      return NextResponse.json({ error: 'Name and slug are required' }, { status: 400 })
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

    const category = await db.category.create({
      data: {
        name,
        slug,
        color,
        storeId: store.id,
      },
    })

    return NextResponse.json(category, { status: 201 })
  } catch (error: any) {
    console.error('Error creating category:', error)
    if (error.code === 'P2002') {
      return NextResponse.json({ error: 'Slug already exists' }, { status: 400 })
    }
    return NextResponse.json({ error: 'Failed to create category' }, { status: 500 })
  }
}
