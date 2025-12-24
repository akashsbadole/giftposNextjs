import { NextResponse } from 'next/server'
import { db } from '@/lib/db'

// Get sales statistics
export async function GET() {
  try {
    // Get total sales and revenue
    const salesStats = await db.sale.groupBy({
      by: ['status'],
      _count: {
        id: true,
      },
      _sum: {
        total: true,
      },
      where: {
        status: 'completed',
      },
    })

    const totalRevenue = salesStats.reduce((sum, stat) => sum + (stat._sum.total || 0), 0)
    const totalTransactions = salesStats.reduce((sum, stat) => sum + stat._count.id, 0)

    // Get total customers
    const totalCustomers = await db.customer.count()

    // Get sales by payment method
    const salesByPayment = await db.sale.groupBy({
      by: ['paymentMethod'],
      _count: {
        id: true,
      },
      _sum: {
        total: true,
      },
      where: {
        status: 'completed',
      },
    })

    // Get top products
    const topProducts = await db.saleItem.groupBy({
      by: ['productId'],
      _sum: {
        quantity: true,
        subtotal: true,
      },
      orderBy: {
        _sum: {
          quantity: 'desc',
        },
      },
      take: 10,
    })

    const topProductsWithDetails = await Promise.all(
      topProducts.map(async (item) => {
        const product = await db.product.findUnique({
          where: { id: item.productId },
          select: { name: true },
        })
        return {
          name: product?.name || 'Unknown',
          quantity: item._sum.quantity || 0,
          revenue: item._sum.subtotal || 0,
        }
      })
    )

    const stats = {
      totalRevenue,
      totalSales: totalTransactions,
      totalTransactions,
      totalCustomers,
      topProducts: topProductsWithDetails,
      salesByPayment: salesByPayment.map((item) => ({
        method: item.paymentMethod,
        count: item._count.id,
        total: item._sum.total || 0,
      })),
    }

    return NextResponse.json(stats)
  } catch (error) {
    console.error('Error fetching sales stats:', error)
    return NextResponse.json({ error: 'Failed to fetch sales stats' }, { status: 500 })
  }
}
