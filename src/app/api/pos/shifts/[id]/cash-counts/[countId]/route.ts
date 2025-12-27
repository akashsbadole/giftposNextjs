import { NextRequest, NextResponse } from 'next/server'
import { PrismaClient } from '@prisma/client'
import { getAuth } from '@clerk/nextjs/server'

const prisma = new PrismaClient()

export async function PATCH(
  request: NextRequest,
  { params }: { params: { id: string, countId: string } }
) {
  try {
    const { userId } = getAuth(request)
    if (!userId) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const body = await request.json()
    const { status, rejectionReason, notes } = body

    // Verify shift exists
    const shift = await prisma.shift.findUnique({
      where: { id: params.id }
    })

    if (!shift) {
      return NextResponse.json({ error: 'Shift not found' }, { status: 404 })
    }

    // Verify cash count exists
    const cashCount = await prisma.cashCount.findUnique({
      where: { id: params.countId }
    })

    if (!cashCount || cashCount.shiftId !== params.id) {
      return NextResponse.json({ error: 'Cash count not found' }, { status: 404 })
    }

    if (cashCount.status !== 'pending') {
      return NextResponse.json(
        { error: 'Cash count has already been processed' },
        { status: 400 }
      )
    }

    if (status === 'approved') {
      const updatedCount = await prisma.cashCount.update({
        where: { id: params.countId },
        data: {
          status: 'approved',
          approvedBy: userId,
          approvedAt: new Date(),
          notes
        }
      })
      return NextResponse.json(updatedCount)
    } else if (status === 'rejected') {
      if (!rejectionReason) {
        return NextResponse.json(
          { error: 'Rejection reason is required when rejecting a cash count' },
          { status: 400 }
        )
      }

      const updatedCount = await prisma.cashCount.update({
        where: { id: params.countId },
        data: {
          status: 'rejected',
          rejectionReason,
          notes
        }
      })
      return NextResponse.json(updatedCount)
    } else {
      return NextResponse.json(
        { error: 'Invalid status. Must be approved or rejected' },
        { status: 400 }
      )
    }
  } catch (error) {
    console.error('Error updating cash count:', error)
    return NextResponse.json(
      { error: 'Failed to update cash count' },
      { status: 500 }
    )
  }
}

export async function DELETE(
  request: NextRequest,
  { params }: { params: { id: string, countId: string } }
) {
  try {
    const { userId } = getAuth(request)
    if (!userId) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    // Verify cash count exists and is deletable
    const cashCount = await prisma.cashCount.findUnique({
      where: { id: params.countId }
    })

    if (!cashCount || cashCount.shiftId !== params.id) {
      return NextResponse.json({ error: 'Cash count not found' }, { status: 404 })
    }

    if (cashCount.status !== 'pending') {
      return NextResponse.json(
        { error: 'Cannot delete a processed cash count' },
        { status: 400 }
      )
    }

    await prisma.cashCount.delete({
      where: { id: params.countId }
    })

    return NextResponse.json({ message: 'Cash count deleted successfully' })
  } catch (error) {
    console.error('Error deleting cash count:', error)
    return NextResponse.json(
      { error: 'Failed to delete cash count' },
      { status: 500 }
    )
  }
}