import { NextRequest, NextResponse } from 'next/server'
import { paymentService } from '@/lib/payment-service'
import { PrismaClient } from '@prisma/client'

const prisma = new PrismaClient()

export async function POST(request: NextRequest) {
  try {
    const body = await request.json()
    
    // PineLabs webhook structure
    const {
      event,
      paymentId,
      orderId,
      amount,
      currency,
      status,
      paymentMethod,
      customerId,
      terminalData,
      transactionId,
      gatewayResponse,
      signature,
      timestamp,
      ...additionalFields
    } = body

    // Validation
    if (!event || !paymentId) {
      return NextResponse.json(
        { success: false, error: 'Missing required fields: event, paymentId' },
        { status: 400 }
      )
    }

    // Find the payment provider for PineLabs
    const provider = await prisma.paymentProvider.findFirst({
      where: {
        name: 'pinelabs',
        isActive: true,
      },
    })

    if (!provider) {
      return NextResponse.json(
        { success: false, error: 'PineLabs provider not configured' },
        { status: 404 }
      )
    }

    // Create webhook payload
    const webhookPayload = {
      event,
      data: {
        paymentId,
        orderId,
        amount,
        currency,
        status,
        paymentMethod,
        customerId,
        terminalData,
        transactionId,
        gatewayResponse,
        ...additionalFields,
      },
      signature: signature || '',
      timestamp: timestamp || Date.now(),
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
    const eventData = result.event
    if (eventData.transactionId || eventData.orderId) {
      await prisma.paymentTransaction.updateMany({
        where: {
          OR: [
            { transactionId: eventData.transactionId },
            { orderId: eventData.orderId }
          ]
        },
        data: {
          status: eventData.status,
          providerStatus: eventData.status,
          responseData: JSON.stringify(webhookPayload.data),
          terminalData: eventData.terminalData ? JSON.stringify(eventData.terminalData) : null,
          completedAt: ['completed', 'failed', 'cancelled'].includes(eventData.status) ? new Date() : null,
          updatedAt: new Date(),
        }
      })

      // If payment is completed, update the associated sale
      if (eventData.status === 'completed' && eventData.orderId) {
        const sale = await prisma.sale.findFirst({
          where: { invoiceNumber: eventData.orderId },
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
                reference: eventData.transactionId,
              }
            })
          }
        }
      }
    }

    // Update terminal status if provided
    if (terminalData?.deviceId) {
      await prisma.terminalIntegration.updateMany({
        where: {
          terminalId: terminalData.deviceId,
          providerId: provider.id,
        },
        data: {
          status: 'online',
          lastHeartbeat: new Date(),
          updatedAt: new Date(),
        }
      })
    }

    // Log webhook processing
    console.log('PineLabs webhook processed:', {
      event,
      paymentId,
      orderId,
      status,
      amount: amount / 100, // Convert from paise
    })

    // Return success response (PineLabs expects 200)
    return NextResponse.json({
      success: true,
      message: 'Webhook processed successfully',
      data: {
        event,
        paymentId,
        orderId,
        status,
        amount: amount / 100, // Convert from paise
      }
    })

  } catch (error) {
    console.error('PineLabs webhook error:', error)
    
    // PineLabs expects 200 response even for errors to prevent retry loops
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
    // Check if PineLabs provider is configured
    const provider = await prisma.paymentProvider.findFirst({
      where: {
        name: 'pinelabs',
        isActive: true,
      },
    })

    if (!provider) {
      return NextResponse.json({
        success: false,
        error: 'PineLabs provider not configured',
        configured: false,
      })
    }

    // Get terminal count
    const terminalCount = await prisma.terminalIntegration.count({
      where: { providerId: provider.id }
    })

    return NextResponse.json({
      success: true,
      message: 'PineLabs webhook endpoint is active',
      configured: true,
      provider: {
        id: provider.id,
        name: provider.name,
        displayName: provider.displayName,
        terminalCount,
      }
    })
  } catch (error) {
    console.error('PineLabs webhook health check error:', error)
    return NextResponse.json({
      success: false,
      error: 'Health check failed',
      details: error instanceof Error ? error.message : 'Unknown error'
    }, { status: 500 })
  }
}