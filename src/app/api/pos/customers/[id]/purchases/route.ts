import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { auth } from '@clerk/nextjs/server'

// Get customer's purchase history
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params
  try {
    const { userId } = await auth()

    if (!userId) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    // Verify customer exists
    const customer = await db.customer.findUnique({
      where: { id },
    })

    if (!customer) {
      return NextResponse.json({ error: 'Customer not found' }, { status: 404 })
    }

    // Get sales with items for this customer
    const sales = await db.sale.findMany({
      where: { customerId: id },
      orderBy: { createdAt: 'desc' },
      include: {
        items: {
          include: {
            product: {
              select: {
                name: true,
              },
            },
          },
        },
      },
    })

    // Transform the data to match the frontend interface
    const purchaseHistory = sales.map(sale => ({
      id: sale.id,
      invoiceNumber: sale.invoiceNumber,
      total: sale.total,
      createdAt: sale.createdAt,
      items: sale.items.map(item => ({
        quantity: item.quantity,
        product: {
          name: item.product.name,
        },
      })),
    }))

    return NextResponse.json(purchaseHistory)
  } catch (error) {
    console.error('Error fetching customer purchase history:', error)
    return NextResponse.json({ error: 'Failed to fetch purchase history' }, { status: 500 })
  }
}