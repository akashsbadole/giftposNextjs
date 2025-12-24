import { NextRequest, NextResponse } from 'next/server'
import { paymentService } from '@/lib/payment-service'
import { PrismaClient } from '@prisma/client'

const prisma = new PrismaClient()

export async function POST(request: NextRequest) {
  try {
    const body = await request.json()
    
    // Paytm webhook structure
    const {
      MID,
      TXNID,
      ORDERID,
      TXNAMOUNT,
      CURRENCY,
      STATUS,
      RESPCODE,
      RESPMSG,
      GATEWAYNAME,
      BANKTXNID,
      BANKNAME,
      PAYMENTMODE,
      CUSTID,
      UDF1,
      UDF2,
      UDF3,
      UDF4,
      UDF5,
      UDF6,
      UDF7,
      UDF8,
      UDF9,
      UDF10,
      CHECKSUMHASH,
      ...additionalFields
    } = body

    // Validation
    if (!ORDERID || !TXNID) {
      return NextResponse.json(
        { success: false, error: 'Missing required fields: ORDERID, TXNID' },
        { status: 400 }
      )
    }

    // Find the payment provider for Paytm
    const provider = await prisma.paymentProvider.findFirst({
      where: {
        name: 'paytm',
        isActive: true,
      },
    })

    if (!provider) {
      return NextResponse.json(
        { success: false, error: 'Paytm provider not configured' },
        { status: 404 }
      )
    }

    // Create webhook payload
    const webhookPayload = {
      event: 'payment_update',
      data: {
        MID,
        TXNID,
        ORDERID,
        TXNAMOUNT,
        CURRENCY,
        STATUS,
        RESPCODE,
        RESPMSG,
        GATEWAYNAME,
        BANKTXNID,
        BANKNAME,
        PAYMENTMODE,
        CUSTID,
        UDF1,
        UDF2,
        UDF3,
        UDF4,
        UDF5,
        UDF6,
        UDF7,
        UDF8,
        UDF9,
        UDF10,
        CHECKSUMHASH,
        ...additionalFields,
      },
      signature: CHECKSUMHASH || '',
      timestamp: Date.now(),
    }

    // Process webhook through payment service
    const result = await paymentService.processWebhook(provider.id, webhookPayload)

    if (!result.success) {
      return NextResponse.json(
        { success: false, error: result.error },
        { status: 400 }
      )
    }

    // Update transaction status in database
    const event = result.event
    if (event.transactionId || event.orderId) {
      await prisma.paymentTransaction.updateMany({
        where: {
          OR: [
            { transactionId: event.transactionId },
            { orderId: event.orderId }
          ]
        },
        data: {
          status: event.status,
          providerStatus: event.status,
          responseData: JSON.stringify(webhookPayload.data),
          completedAt: ['completed', 'failed', 'cancelled'].includes(event.status) ? new Date() : null,
          updatedAt: new Date(),
        }
      })

      // If payment is completed, update the associated sale
      if (event.status === 'completed' && event.orderId) {
        const sale = await prisma.sale.findFirst({
          where: { invoiceNumber: event.orderId },
          include: { payment: true }
        })

        if (sale) {
          await prisma.sale.update({
            where: { id: sale.id },
            data: { 
              paymentMethod: 'digital',
              status: 'completed'
            }
          })

          // Update payment record
          if (sale.payment) {
            await prisma.payment.update({
              where: { saleId: sale.id },
              data: {
                status: 'completed',
                reference: event.transactionId,
              }
            })
          }
        }
      }
    }

    // Log webhook processing
    console.log('Paytm webhook processed:', {
      orderId: ORDERID,
      transactionId: TXNID,
      status: STATUS,
      amount: TXNAMOUNT,
    })

    // Return success response (Paytm expects specific format)
    return NextResponse.json({
      success: true,
      message: 'Webhook processed successfully',
      data: {
        orderId: ORDERID,
        transactionId: TXNID,
        status: STATUS,
        amount: parseFloat(TXNAMOUNT || '0'),
      }
    })

  } catch (error) {
    console.error('Paytm webhook error:', error)
    
    // Paytm expects 200 response even for errors to prevent retry loops
    return NextResponse.json({
      success: false,
      error: 'Webhook processing failed',
      details: error instanceof Error ? error.message : 'Unknown error'
    }, { status: 200 })
  }
}

// Health check endpoint for webhook URL validation
export async function GET() {
  try {
    // Check if Paytm provider is configured
    const provider = await prisma.paymentProvider.findFirst({
      where: {
        name: 'paytm',
        isActive: true,
      },
    })

    if (!provider) {
      return NextResponse.json({
        success: false,
        error: 'Paytm provider not configured',
        configured: false,
      })
    }

    return NextResponse.json({
      success: true,
      message: 'Paytm webhook endpoint is active',
      configured: true,
      provider: {
        id: provider.id,
        name: provider.name,
        displayName: provider.displayName,
      }
    })
  } catch (error) {
    console.error('Paytm webhook health check error:', error)
    return NextResponse.json({
      success: false,
      error: 'Health check failed',
      details: error instanceof Error ? error.message : 'Unknown error'
    }, { status: 500 })
  }
}