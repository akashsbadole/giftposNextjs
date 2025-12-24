import { NextResponse } from 'next/server'
import { db } from '@/lib/db'

// Get sale for receipt
export async function GET(
  request: Request,
  { params }: { params: { id: string } }
) {
  try {
    const sale = await db.sale.findUnique({
      where: { id: params.id },
      include: {
        items: {
          include: {
            product: true,
          },
        },
        customer: true,
        employee: true,
        store: true,
        payment: true,
      },
    })

    if (!sale) {
      return NextResponse.json({ error: 'Sale not found' }, { status: 404 })
    }

    return NextResponse.json(sale)
  } catch (error) {
    console.error('Error fetching receipt:', error)
    return NextResponse.json({ error: 'Failed to fetch receipt' }, { status: 500 })
  }
}
