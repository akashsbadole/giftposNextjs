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

    const zReport = await prisma.zReport.findUnique({
      where: { id: params.id },
      include: {
        shift: {
          include: {
            employee: {
              select: {
                id: true,
                name: true,
                email: true,
                role: true
              }
            }
          }
        }
      }
    })

    if (!zReport) {
      return NextResponse.json({ error: 'Z-report not found' }, { status: 404 })
    }

    // Parse JSON fields
    const reportWithParsedData = {
      ...zReport,
      taxBreakdown: zReport.taxBreakdown ? JSON.parse(zReport.taxBreakdown) : null,
      reportData: zReport.reportData ? JSON.parse(zReport.reportData) : null
    }

    return NextResponse.json(reportWithParsedData)
  } catch (error) {
    console.error('Error fetching Z-report:', error)
    return NextResponse.json(
      { error: 'Failed to fetch Z-report' },
      { status: 500 }
    )
  }
}

export async function PATCH(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const { userId } = getAuth(request)
    if (!userId) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const body = await request.json()
    const { status, reportData } = body

    const zReport = await prisma.zReport.findUnique({
      where: { id: params.id }
    })

    if (!zReport) {
      return NextResponse.json({ error: 'Z-report not found' }, { status: 404 })
    }

    const updateData: any = {}
    
    if (status) {
      updateData.status = status
      if (status === 'printed') {
        updateData.printedAt = new Date()
      } else if (status === 'submitted') {
        updateData.submittedAt = new Date()
      }
    }

    if (reportData) {
      updateData.reportData = JSON.stringify(reportData)
    }

    const updatedReport = await prisma.zReport.update({
      where: { id: params.id },
      data: updateData,
      include: {
        shift: {
          include: {
            employee: {
              select: {
                id: true,
                name: true,
                email: true,
                role: true
              }
            }
          }
        }
      }
    })

    return NextResponse.json({
      ...updatedReport,
      taxBreakdown: updatedReport.taxBreakdown ? JSON.parse(updatedReport.taxBreakdown) : null,
      reportData: updatedReport.reportData ? JSON.parse(updatedReport.reportData) : null
    })
  } catch (error) {
    console.error('Error updating Z-report:', error)
    return NextResponse.json(
      { error: 'Failed to update Z-report' },
      { status: 500 }
    )
  }
}

export async function DELETE(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const { userId } = getAuth(request)
    if (!userId) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const zReport = await prisma.zReport.findUnique({
      where: { id: params.id }
    })

    if (!zReport) {
      return NextResponse.json({ error: 'Z-report not found' }, { status: 404 })
    }

    // Only allow deletion of reports that haven't been submitted
    if (zReport.status === 'submitted') {
      return NextResponse.json(
        { error: 'Cannot delete a submitted Z-report' },
        { status: 400 }
      )
    }

    await prisma.zReport.delete({
      where: { id: params.id }
    })

    return NextResponse.json({ message: 'Z-report deleted successfully' })
  } catch (error) {
    console.error('Error deleting Z-report:', error)
    return NextResponse.json(
      { error: 'Failed to delete Z-report' },
      { status: 500 }
    )
  }
}