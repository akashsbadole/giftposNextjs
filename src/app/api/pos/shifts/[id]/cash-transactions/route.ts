import { NextRequest, NextResponse } from 'next/server'
import { PrismaClient } from '@prisma/client'
import { getAuth } from '@clerk/nextjs/server'

const prisma = new PrismaClient()

export async function GET(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const { userId } = getAuth(request)
    if (!userId) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const { searchParams } = new URL(request.url)
    const type = searchParams.get('type')
    const limit = parseInt(searchParams.get('limit') || '100')

    // Verify shift exists
    const shift = await prisma.shift.findUnique({
      where: { id: params.id }
    })

    if (!shift) {
      return NextResponse.json({ error: 'Shift not found' }, { status: 404 })
    }

    const where: any = { shiftId: params.id }
    if (type) where.type = type

    const transactions = await prisma.cashTransaction.findMany({
      where,
      orderBy: { createdAt: 'desc' },
      take: limit
    })

    return NextResponse.json(transactions)
  } catch (error) {
    console.error('Error fetching cash transactions:', error)
    return NextResponse.json(
      { error: 'Failed to fetch cash transactions' },
      { status: 500 }
    )
  }
}

export async function POST(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const { userId } = getAuth(request)
    if (!userId) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const body = await request.json()
    const { type, amount, reason, notes, denominationBreakdown, referenceId, referenceType } = body

    if (!type || amount === undefined) {
      return NextResponse.json(
        { error: 'Type and amount are required' },
        { status: 400 }
      )
    }

    if (amount <= 0) {
      return NextResponse.json(
        { error: 'Amount must be greater than 0' },
        { status: 400 }
      )
    }

    // Verify shift exists and is active
    const shift = await prisma.shift.findUnique({
      where: { id: params.id }
    })

    if (!shift) {
      return NextResponse.json({ error: 'Shift not found' }, { status: 404 })
    }

    if (shift.status !== 'active') {
      return NextResponse.json(
        { error: 'Cannot add transactions to inactive shift' },
        { status: 400 }
      )
    }

    // Validate transaction type
    const validTypes = ['sale', 'cash_in', 'cash_out', 'count', 'adjustment', 'refund']
    if (!validTypes.includes(type)) {
      return NextResponse.json(
        { error: 'Invalid transaction type' },
        { status: 400 }
      )
    }

    // Create cash transaction
    const transaction = await prisma.cashTransaction.create({
      data: {
        shiftId: params.id,
        type,
        amount,
        reason,
        notes,
        denominationBreakdown: denominationBreakdown ? JSON.stringify(denominationBreakdown) : null,
        referenceId,
        referenceType,
        createdBy: userId
      }
    })

    return NextResponse.json(transaction, { status: 201 })
  } catch (error) {
    console.error('Error creating cash transaction:', error)
    return NextResponse.json(
      { error: 'Failed to create cash transaction' },
      { status: 500 }
    )
  }
}