import { PrismaClient } from '@prisma/client'
import { 
  PaymentProviderInterface, 
  PaymentProviderFactory, 
  PaymentRequest, 
  PaymentResponse,
  PaymentProviderConfig,
  TerminalStatus,
  WebhookPayload 
} from './payment-providers'

const prisma = new PrismaClient()

export interface PaymentContext {
  providerId: string
  terminalId?: string
  amount: number
  currency: string
  orderId: string
  customerId?: string
  description?: string
  paymentMethod: string
  metadata?: Record<string, any>
  returnUrl?: string
  callbackUrl?: string
}

export interface PaymentResult {
  success: boolean
  transactionId?: string
  status: string
  amount: number
  currency: string
  providerResponse?: any
  terminalData?: any
  error?: string
}

export interface TransactionUpdate {
  transactionId: string
  status: string
  providerResponse?: any
  terminalData?: any
  completedAt?: Date
  failureReason?: string
}

export class PaymentService {
  private providerCache = new Map<string, PaymentProviderInterface>()
  private webhookCache = new Map<string, WebhookPayload>()

  /**
   * Initialize payment provider from database configuration
   */
  async initializeProvider(providerId: string): Promise<PaymentProviderInterface | null> {
    try {
      // Check cache first
      if (this.providerCache.has(providerId)) {
        return this.providerCache.get(providerId)!
      }

      // Load provider configuration from database
      const provider = await prisma.paymentProvider.findUnique({
        where: { id: providerId },
        include: { store: true }
      })

      if (!provider || !provider.isActive) {
        console.error(`Payment provider ${providerId} not found or inactive`)
        return null
      }

      // Parse configuration
      const config: PaymentProviderConfig = {
        environment: 'sandbox', // Default to sandbox for safety
        ...(provider.config ? JSON.parse(provider.config) : {}),
      }

      // Create provider instance
      const providerInstance = PaymentProviderFactory.createProvider(
        provider.name.toLowerCase(),
        config
      )

      // Cache the provider
      this.providerCache.set(providerId, providerInstance)
      
      return providerInstance
    } catch (error) {
      console.error(`Failed to initialize payment provider ${providerId}:`, error)
      return null
    }
  }

  /**
   * Process a payment transaction
   */
  async processPayment(context: PaymentContext): Promise<PaymentResult> {
    try {
      const provider = await this.initializeProvider(context.providerId)
      if (!provider) {
        return {
          success: false,
          status: 'failed',
          amount: context.amount,
          currency: context.currency,
          error: 'Payment provider not available'
        }
      }

      // Create payment request
      const paymentRequest: PaymentRequest = {
        amount: context.amount,
        currency: context.currency,
        orderId: context.orderId,
        customerId: context.customerId,
        description: context.description,
        paymentMethod: context.paymentMethod,
        terminalId: context.terminalId,
        returnUrl: context.returnUrl,
        callbackUrl: context.callbackUrl,
        metadata: context.metadata,
      }

      // Process payment through provider
      const paymentResponse = await provider.initiatePayment(paymentRequest)

      // Store transaction in database
      const transaction = await prisma.paymentTransaction.create({
        data: {
          transactionId: paymentResponse.transactionId,
          orderId: context.orderId,
          amount: context.amount,
          currency: context.currency,
          paymentMethod: context.paymentMethod,
          status: paymentResponse.status,
          providerStatus: paymentResponse.status,
          responseData: JSON.stringify(paymentResponse.providerResponse),
          providerId: context.providerId,
          terminalId: context.terminalId,
          customerInfo: context.customerId ? JSON.stringify({ customerId: context.customerId }) : null,
        }
      })

      return {
        success: paymentResponse.status !== 'failed',
        transactionId: paymentResponse.transactionId,
        status: paymentResponse.status,
        amount: paymentResponse.amount,
        currency: paymentResponse.currency,
        providerResponse: paymentResponse.providerResponse,
        terminalData: paymentResponse.terminalData,
        error: paymentResponse.status === 'failed' ? 'Payment initiation failed' : undefined
      }
    } catch (error) {
      console.error('Payment processing error:', error)
      return {
        success: false,
        status: 'failed',
        amount: context.amount,
        currency: context.currency,
        error: error instanceof Error ? error.message : 'Unknown error occurred'
      }
    }
  }

  /**
   * Check payment status and update transaction
   */
  async checkPaymentStatus(transactionId: string, providerId: string): Promise<PaymentResult> {
    try {
      const provider = await this.initializeProvider(providerId)
      if (!provider) {
        return {
          success: false,
          status: 'failed',
          amount: 0,
          currency: 'INR',
          error: 'Payment provider not available'
        }
      }

      const paymentResponse = await provider.checkPaymentStatus(transactionId)

      // Update transaction in database
      const updatedTransaction = await prisma.paymentTransaction.updateMany({
        where: { transactionId: transactionId },
        data: {
          status: paymentResponse.status,
          providerStatus: paymentResponse.status,
          responseData: JSON.stringify(paymentResponse.providerResponse),
          completedAt: ['completed', 'failed', 'cancelled'].includes(paymentResponse.status) ? new Date() : null,
          updatedAt: new Date(),
        }
      })

      return {
        success: paymentResponse.status === 'completed',
        transactionId: paymentResponse.transactionId,
        status: paymentResponse.status,
        amount: paymentResponse.amount,
        currency: paymentResponse.currency,
        providerResponse: paymentResponse.providerResponse,
        terminalData: paymentResponse.terminalData,
        error: paymentResponse.status === 'failed' ? 'Payment failed' : undefined
      }
    } catch (error) {
      console.error('Payment status check error:', error)
      return {
        success: false,
        status: 'failed',
        amount: 0,
        currency: 'INR',
        error: error instanceof Error ? error.message : 'Status check failed'
      }
    }
  }

  /**
   * Process refund
   */
  async processRefund(transactionId: string, providerId: string, amount?: number, reason?: string): Promise<PaymentResult> {
    try {
      const provider = await this.initializeProvider(providerId)
      if (!provider) {
        return {
          success: false,
          status: 'failed',
          amount: 0,
          currency: 'INR',
          error: 'Payment provider not available'
        }
      }

      const refundResponse = await provider.refundPayment(transactionId, amount, reason)

      // Update transaction with refund information
      const updatedTransaction = await prisma.paymentTransaction.updateMany({
        where: { transactionId: transactionId },
        data: {
          status: refundResponse.status === 'completed' ? 'refunded' : refundResponse.status,
          providerStatus: refundResponse.status,
          responseData: JSON.stringify(refundResponse.providerResponse),
          refundAmount: amount,
          refundReason: reason,
          completedAt: new Date(),
          updatedAt: new Date(),
        }
      })

      return {
        success: refundResponse.status === 'completed',
        transactionId: refundResponse.transactionId,
        status: refundResponse.status,
        amount: refundResponse.amount,
        currency: refundResponse.currency,
        providerResponse: refundResponse.providerResponse,
        error: refundResponse.status === 'failed' ? 'Refund failed' : undefined
      }
    } catch (error) {
      console.error('Refund processing error:', error)
      return {
        success: false,
        status: 'failed',
        amount: 0,
        currency: 'INR',
        error: error instanceof Error ? error.message : 'Refund failed'
      }
    }
  }

  /**
   * Process void/cancellation
   */
  async processVoid(transactionId: string, providerId: string): Promise<PaymentResult> {
    try {
      const provider = await this.initializeProvider(providerId)
      if (!provider) {
        return {
          success: false,
          status: 'failed',
          amount: 0,
          currency: 'INR',
          error: 'Payment provider not available'
        }
      }

      const voidResponse = await provider.voidPayment(transactionId)

      // Update transaction status
      const updatedTransaction = await prisma.paymentTransaction.updateMany({
        where: { transactionId: transactionId },
        data: {
          status: 'cancelled',
          providerStatus: 'cancelled',
          responseData: JSON.stringify(voidResponse.providerResponse),
          completedAt: new Date(),
          updatedAt: new Date(),
        }
      })

      return {
        success: voidResponse.status === 'cancelled',
        transactionId: voidResponse.transactionId,
        status: voidResponse.status,
        amount: voidResponse.amount,
        currency: voidResponse.currency,
        providerResponse: voidResponse.providerResponse,
        error: voidResponse.status === 'failed' ? 'Void failed' : undefined
      }
    } catch (error) {
      console.error('Void processing error:', error)
      return {
        success: false,
        status: 'failed',
        amount: 0,
        currency: 'INR',
        error: error instanceof Error ? error.message : 'Void failed'
      }
    }
  }

  /**
   * Get terminal status for a provider
   */
  async getTerminalStatus(providerId: string, terminalId?: string): Promise<TerminalStatus[]> {
    try {
      const provider = await this.initializeProvider(providerId)
      if (!provider) {
        return []
      }

      return await provider.getTerminalStatus(terminalId)
    } catch (error) {
      console.error('Terminal status error:', error)
      return []
    }
  }

  /**
   * Send payment to terminal
   */
  async sendToTerminal(
    providerId: string, 
    terminalId: string, 
    amount: number, 
    reference: string
  ): Promise<PaymentResult> {
    try {
      const provider = await this.initializeProvider(providerId)
      if (!provider) {
        return {
          success: false,
          status: 'failed',
          amount,
          currency: 'INR',
          error: 'Payment provider not available'
        }
      }

      const terminalResponse = await provider.sendToTerminal(terminalId, amount, reference)

      // Create transaction record for terminal payment
      const transaction = await prisma.paymentTransaction.create({
        data: {
          transactionId: terminalResponse.transactionId,
          orderId: reference,
          amount,
          currency: 'INR',
          paymentMethod: 'card_swipe', // Default for terminal
          status: terminalResponse.status,
          providerStatus: terminalResponse.status,
          responseData: JSON.stringify(terminalResponse.providerResponse),
          terminalId: terminalId,
          providerId,
        }
      })

      return {
        success: terminalResponse.status !== 'failed',
        transactionId: terminalResponse.transactionId,
        status: terminalResponse.status,
        amount: terminalResponse.amount,
        currency: terminalResponse.currency,
        providerResponse: terminalResponse.providerResponse,
        terminalData: terminalResponse.terminalData,
        error: terminalResponse.status === 'failed' ? 'Terminal payment failed' : undefined
      }
    } catch (error) {
      console.error('Terminal payment error:', error)
      return {
        success: false,
        status: 'failed',
        amount,
        currency: 'INR',
        error: error instanceof Error ? error.message : 'Terminal payment failed'
      }
    }
  }

  /**
   * Process webhook event
   */
  async processWebhook(
    providerId: string, 
    payload: WebhookPayload
  ): Promise<{ success: boolean; event?: any; error?: string }> {
    try {
      const provider = await this.initializeProvider(providerId)
      if (!provider) {
        return { success: false, error: 'Payment provider not available' }
      }

      // Verify webhook signature
      if (!provider.verifyWebhook(payload)) {
        return { success: false, error: 'Invalid webhook signature' }
      }

      // Parse webhook event
      const event = provider.parseWebhookEvent(payload)

      // Update transaction if it exists
      if (event.transactionId) {
        await this.updateTransactionFromWebhook(event)
      }

      return { success: true, event }
    } catch (error) {
      console.error('Webhook processing error:', error)
      return { 
        success: false, 
        error: error instanceof Error ? error.message : 'Webhook processing failed' 
      }
    }
  }

  /**
   * Update transaction from webhook event
   */
  private async updateTransactionFromWebhook(event: any): Promise<void> {
    try {
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
          responseData: JSON.stringify(event.gatewayResponse),
          terminalId: event.terminalId,
          completedAt: ['completed', 'failed', 'cancelled'].includes(event.status) ? new Date() : null,
          updatedAt: new Date(),
        }
      })
    } catch (error) {
      console.error('Transaction update error:', error)
    }
  }

  /**
   * Get payment transaction history
   */
  async getTransactionHistory(
    providerId?: string,
    terminalId?: string,
    startDate?: Date,
    endDate?: Date,
    status?: string,
    limit = 100
  ) {
    try {
      const where: any = {}
      
      if (providerId) where.providerId = providerId
      if (terminalId) where.terminalId = terminalId
      if (status) where.status = status
      if (startDate || endDate) {
        where.createdAt = {}
        if (startDate) where.createdAt.gte = startDate
        if (endDate) where.createdAt.lte = endDate
      }

      const transactions = await prisma.paymentTransaction.findMany({
        where,
        include: {
          provider: true,
          terminal: true,
          sale: true,
        },
        orderBy: { createdAt: 'desc' },
        take: limit,
      })

      return transactions
    } catch (error) {
      console.error('Transaction history error:', error)
      return []
    }
  }

  /**
   * Clear provider cache
   */
  clearCache(providerId?: string): void {
    if (providerId) {
      this.providerCache.delete(providerId)
    } else {
      this.providerCache.clear()
    }
  }

  /**
   * Health check for payment providers
   */
  async healthCheck(): Promise<{ provider: string; healthy: boolean; error?: string }[]> {
    const results: { provider: string; healthy: boolean; error?: string }[] = []

    try {
      const providers = await prisma.paymentProvider.findMany({
        where: { isActive: true }
      })

      for (const provider of providers) {
        try {
          const providerInstance = await this.initializeProvider(provider.id)
          if (providerInstance) {
            // Try to get terminal status as a health check
            const terminalStatus = await providerInstance.getTerminalStatus()
            results.push({
              provider: provider.name,
              healthy: true,
            })
          } else {
            results.push({
              provider: provider.name,
              healthy: false,
              error: 'Provider initialization failed'
            })
          }
        } catch (error) {
          results.push({
            provider: provider.name,
            healthy: false,
            error: error instanceof Error ? error.message : 'Unknown error'
          })
        }
      }
    } catch (error) {
      console.error('Health check error:', error)
    }

    return results
  }
}

// Export singleton instance
export const paymentService = new PaymentService()