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
    const countType = searchParams.get('countType')
    const status = searchParams.get('status')

    // Verify shift exists
    const shift = await prisma.shift.findUnique({
      where: { id: params.id }
    })

    if (!shift) {
      return NextResponse.json({ error: 'Shift not found' }, { status: 404 })
    }

    const where: any = { shiftId: params.id }
    if (countType) where.countType = countType
    if (status) where.status = status

    const cashCounts = await prisma.cashCount.findMany({
      where,
      orderBy: { createdAt: 'desc' }
    })

    // Parse denomination breakdown for each count
    const countsWithBreakdown = cashCounts.map(count => ({
      ...count,
      denominationBreakdown: count.denominationBreakdown ? JSON.parse(count.denominationBreakdown) : null
    }))

    return NextResponse.json(countsWithBreakdown)
  } catch (error) {
    console.error('Error fetching cash counts:', error)
    return NextResponse.json(
      { error: 'Failed to fetch cash counts' },
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
    const { countType, expectedAmount, actualAmount, denominationBreakdown, notes } = body

    if (!countType || expectedAmount === undefined || actualAmount === undefined) {
      return NextResponse.json(
        { error: 'Count type, expected amount, and actual amount are required' },
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
        { error: 'Cannot add cash counts to inactive shift' },
        { status: 400 }
      )
    }

    // Validate count type
    const validCountTypes = ['opening', 'closing', 'mid_shift', 'variance_investigation']
    if (!validCountTypes.includes(countType)) {
      return NextResponse.json(
        { error: 'Invalid count type' },
        { status: 400 }
      )
    }

    // Check if count already exists for this type and shift
    const existingCount = await prisma.cashCount.findFirst({
      where: {
        shiftId: params.id,
        countType
      }
    })

    if (existingCount) {
      return NextResponse.json(
        { error: `Cash count of type '${countType}' already exists for this shift` },
        { status: 400 }
      )
    }

    const variance = actualAmount - expectedAmount

    const cashCount = await prisma.cashCount.create({
      data: {
        shiftId: params.id,
        countType,
        expectedAmount,
        actualAmount,
        variance,
        denominationBreakdown: denominationBreakdown ? JSON.stringify(denominationBreakdown) : null,
        notes,
        status: 'pending'
      }
    })

    // If this is a closing count and variance is acceptable, auto-approve
    if (countType === 'closing' && Math.abs(variance) <= 10) {
      await prisma.cashCount.update({
        where: { id: cashCount.id },
        data: {
          status: 'approved',
          approvedBy: userId,
          approvedAt: new Date()
        }
      })
    }

    return NextResponse.json({
      ...cashCount,
      denominationBreakdown: denominationBreakdown || null
    }, { status: 201 })
  } catch (error) {
    console.error('Error creating cash count:', error)
    return NextResponse.json(
      { error: 'Failed to create cash count' },
      { status: 500 }
    )
  }
}