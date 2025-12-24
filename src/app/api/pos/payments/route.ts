import { NextRequest, NextResponse } from 'next/server'
import { paymentService } from '@/lib/payment-service'
import { PrismaClient } from '@prisma/client'

const prisma = new PrismaClient()

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url)
    const providerId = searchParams.get('providerId')
    const terminalId = searchParams.get('terminalId')
    const status = searchParams.get('status')
    const startDate = searchParams.get('startDate')
    const endDate = searchParams.get('endDate')
    const limit = parseInt(searchParams.get('limit') || '100')

    // Build date filters
    const dateFilter: any = {}
    if (startDate) dateFilter.gte = new Date(startDate)
    if (endDate) dateFilter.lte = new Date(endDate)

    // Build where clause
    const where: any = {}
    if (providerId) where.providerId = providerId
    if (terminalId) where.terminalId = terminalId
    if (status) where.status = status
    if (startDate || endDate) where.createdAt = dateFilter

    const transactions = await prisma.paymentTransaction.findMany({
      where,
      include: {
        provider: {
          select: {
            name: true,
            displayName: true,
          },
        },
        terminal: {
          select: {
            name: true,
            terminalId: true,
            model: true,
          },
        },
        sale: {
          select: {
            id: true,
            invoiceNumber: true,
            total: true,
          },
        },
      },
      orderBy: { createdAt: 'desc' },
      take: limit,
    })

    return NextResponse.json({
      success: true,
      data: transactions,
      total: transactions.length,
    })
  } catch (error) {
    console.error('Payment history error:', error)
    return NextResponse.json(
      { 
        success: false, 
        error: 'Failed to fetch payment history',
        details: error instanceof Error ? error.message : 'Unknown error'
      },
      { status: 500 }
    )
  }
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json()
    const {
      providerId,
      terminalId,
      amount,
      currency = 'INR',
      orderId,
      customerId,
      description,
      paymentMethod,
      metadata,
      returnUrl,
      callbackUrl,
    } = body

    // Validation
    if (!providerId || !amount || !orderId || !paymentMethod) {
      return NextResponse.json(
        { 
          success: false, 
          error: 'Missing required fields: providerId, amount, orderId, paymentMethod' 
        },
        { status: 400 }
      )
    }

    if (amount <= 0) {
      return NextResponse.json(
        { 
          success: false, 
          error: 'Amount must be greater than zero' 
        },
        { status: 400 }
      )
    }

    // Check if provider exists and is active
    const provider = await prisma.paymentProvider.findUnique({
      where: { id: providerId },
    })

    if (!provider || !provider.isActive) {
      return NextResponse.json(
        { 
          success: false, 
          error: 'Payment provider not found or inactive' 
        },
        { status: 404 }
      )
    }

    // Check terminal if specified
    if (terminalId) {
      const terminal = await prisma.terminalIntegration.findUnique({
        where: { id: terminalId },
        include: { provider: true },
      })

      if (!terminal) {
        return NextResponse.json(
          { 
            success: false, 
            error: 'Terminal not found' 
          },
          { status: 404 }
        )
      }

      if (terminal.status === 'offline') {
        return NextResponse.json(
          { 
            success: false, 
            error: 'Terminal is offline' 
          },
          { status: 400 }
        )
      }
    }

    // Process payment through payment service
    const result = await paymentService.processPayment({
      providerId,
      terminalId,
      amount: parseFloat(amount),
      currency,
      orderId,
      customerId,
      description,
      paymentMethod,
      metadata,
      returnUrl,
      callbackUrl,
    })

    if (result.success) {
      return NextResponse.json({
        success: true,
        data: {
          transactionId: result.transactionId,
          status: result.status,
          amount: result.amount,
          currency: result.currency,
          providerResponse: result.providerResponse,
          terminalData: result.terminalData,
        },
        message: 'Payment initiated successfully',
      })
    } else {
      return NextResponse.json({
        success: false,
        error: result.error || 'Payment initiation failed',
        details: result.providerResponse,
      }, { status: 400 })
    }
  } catch (error) {
    console.error('Payment processing error:', error)
    return NextResponse.json(
      { 
        success: false, 
        error: 'Payment processing failed',
        details: error instanceof Error ? error.message : 'Unknown error'
      },
      { status: 500 }
    )
  }
}

export async function PATCH(request: NextRequest) {
  try {
    const body = await request.json()
    const {
      transactionId,
      providerId,
      action,
      amount,
      reason,
    } = body

    // Validation
    if (!transactionId || !providerId || !action) {
      return NextResponse.json(
        { 
          success: false, 
          error: 'Missing required fields: transactionId, providerId, action' 
        },
        { status: 400 }
      )
    }

    let result
    const validActions = ['refund', 'void', 'status_check']

    if (!validActions.includes(action)) {
      return NextResponse.json(
        { 
          success: false, 
          error: `Invalid action. Must be one of: ${validActions.join(', ')}` 
        },
        { status: 400 }
      )
    }

    switch (action) {
      case 'refund':
        result = await paymentService.processRefund(transactionId, providerId, amount, reason)
        break
      
      case 'void':
        result = await paymentService.processVoid(transactionId, providerId)
        break
      
      case 'status_check':
        result = await paymentService.checkPaymentStatus(transactionId, providerId)
        break
      
      default:
        return NextResponse.json(
          { success: false, error: 'Invalid action' },
          { status: 400 }
        )
    }

    if (result.success) {
      return NextResponse.json({
        success: true,
        data: {
          transactionId: result.transactionId,
          status: result.status,
          amount: result.amount,
          currency: result.currency,
          providerResponse: result.providerResponse,
          terminalData: result.terminalData,
        },
        message: `${action.charAt(0).toUpperCase() + action.slice(1)} completed successfully`,
      })
    } else {
      return NextResponse.json({
        success: false,
        error: result.error || `${action} failed`,
        details: result.providerResponse,
      }, { status: 400 })
    }
  } catch (error) {
    console.error('Payment action error:', error)
    return NextResponse.json(
      { 
        success: false, 
        error: 'Payment action failed',
        details: error instanceof Error ? error.message : 'Unknown error'
      },
      { status: 500 }
    )
  }
}