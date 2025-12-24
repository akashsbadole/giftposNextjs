import { NextResponse } from 'next/server'
import { db } from '@/lib/db'

// Reset all data
export async function POST() {
  try {
    // Delete all data in correct order (respecting foreign keys)
    await db.payment.deleteMany()
    await db.saleItem.deleteMany()
    await db.sale.deleteMany()
    await db.stockLog.deleteMany()
    await db.product.deleteMany()
    await db.category.deleteMany()
    await db.customer.deleteMany()
    await db.employee.deleteMany()

    // Reset store to defaults
    const store = await db.store.findFirst()
    if (store) {
      await db.store.update({
        where: { id: store.id },
        data: {
          name: 'My Store',
          taxRate: 10,
          currency: 'USD',
          address: null,
          phone: null,
          email: null,
        },
      })
    }

    return NextResponse.json({ success: true, message: 'All data has been reset' })
  } catch (error) {
    console.error('Error resetting data:', error)
    return NextResponse.json({ error: 'Failed to reset data' }, { status: 500 })
  }
}
