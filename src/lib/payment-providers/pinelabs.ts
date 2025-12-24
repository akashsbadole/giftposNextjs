import { 
  PaymentProviderInterface, 
  PaymentRequest, 
  PaymentResponse, 
  TerminalStatus, 
  WebhookPayload,
  PineLabsConfig,
  PineLabsTerminalData 
} from './index'

export class PineLabsProvider implements PaymentProviderInterface {
  name = 'pinelabs'
  type = 'terminal' as const
  capabilities = {
    paymentMethods: [
      'card_swipe', 'card_insert', 'upi', 'wallet', 
      'netbanking', 'emi', 'sodexo', 'meal_voucher'
    ],
    features: [
      'terminal_payments', 'split_payments', 'emi_support',
      'tip_adjustment', 'cashback', 'loyalty_points'
    ],
    terminalSupport: true,
    refundSupport: true,
    voidSupport: true
  }

  private config: PineLabsConfig
  private baseUrl: string

  constructor(config: PineLabsConfig) {
    this.config = config
    this.baseUrl = config.environment === 'production' 
      ? 'https://api.pinelabs.com' 
      : 'https://sandbox-api.pinelabs.com'
  }

  validateConfig(config: PineLabsConfig): boolean {
    return !!(
      config.merchantId &&
      config.secretKey &&
      config.accessToken &&
      config.storeId &&
      config.environment
    )
  }

  async initiatePayment(request: PaymentRequest): Promise<PaymentResponse> {
    try {
      // For PineLabs, terminal payments are the primary method
      if (request.terminalId) {
        return await this.sendToTerminal(request.terminalId, request.amount, request.orderId)
      }

      // API-based payment initiation
      const response = await fetch(`${this.baseUrl}/v3/payments/initialize`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${this.config.accessToken}`,
          'X-MyId': this.config.merchantId,
        },
        body: JSON.stringify({
          amount: Math.round(request.amount * 100), // Convert to paise
          currency: request.currency,
          description: request.description || 'POS Payment',
          callbackUrl: request.callbackUrl,
          customerDetails: {
            customerId: request.customerId,
            customerEmail: '',
            customerPhone: '',
          },
          metadata: request.metadata || {},
          paymentMethod: this.mapPaymentMethod(request.paymentMethod),
          storeId: this.config.storeId,
          merchantId: this.config.merchantId,
        }),
      })

      const data = await response.json()

      if (response.ok && data.status === 'SUCCESS') {
        return {
          transactionId: data.paymentId,
          status: 'pending',
          amount: request.amount,
          currency: request.currency,
          providerResponse: data,
          redirectUrl: data.paymentUrl,
        }
      } else {
        throw new Error(data.message || 'Payment initiation failed')
      }
    } catch (error) {
      console.error('PineLabs payment initiation error:', error)
      return {
        transactionId: '',
        status: 'failed',
        amount: request.amount,
        currency: request.currency,
        providerResponse: { error: error instanceof Error ? error.message : 'Unknown error' },
      }
    }
  }

  async checkPaymentStatus(transactionId: string): Promise<PaymentResponse> {
    try {
      const response = await fetch(`${this.baseUrl}/v3/payments/${transactionId}`, {
        method: 'GET',
        headers: {
          'Authorization': `Bearer ${this.config.accessToken}`,
          'X-MyId': this.config.merchantId,
        },
      })

      const data = await response.json()

      return {
        transactionId: data.paymentId,
        status: this.mapPineLabsStatus(data.status),
        amount: data.amount / 100, // Convert from paise
        currency: data.currency || 'INR',
        providerResponse: data,
      }
    } catch (error) {
      console.error('PineLabs status check error:', error)
      throw error
    }
  }

  async refundPayment(transactionId: string, amount?: number, reason?: string): Promise<PaymentResponse> {
    try {
      const refundData = {
        paymentId: transactionId,
        amount: amount ? Math.round(amount * 100) : undefined, // Convert to paise
        reason: reason || 'Customer request',
        storeId: this.config.storeId,
        merchantId: this.config.merchantId,
      }

      const response = await fetch(`${this.baseUrl}/v3/refunds`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${this.config.accessToken}`,
          'X-MyId': this.config.merchantId,
        },
        body: JSON.stringify(refundData),
      })

      const data = await response.json()

      return {
        transactionId: data.refundId,
        status: data.status === 'SUCCESS' ? 'completed' : 'failed',
        amount: (data.amount || 0) / 100, // Convert from paise
        currency: 'INR',
        providerResponse: data,
      }
    } catch (error) {
      console.error('PineLabs refund error:', error)
      throw error
    }
  }

  async voidPayment(transactionId: string): Promise<PaymentResponse> {
    try {
      const response = await fetch(`${this.baseUrl}/v3/payments/${transactionId}/void`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${this.config.accessToken}`,
          'X-MyId': this.config.merchantId,
        },
        body: JSON.stringify({
          storeId: this.config.storeId,
          merchantId: this.config.merchantId,
        }),
      })

      const data = await response.json()

      return {
        transactionId: data.paymentId,
        status: data.status === 'SUCCESS' ? 'cancelled' : 'failed',
        amount: (data.amount || 0) / 100,
        currency: 'INR',
        providerResponse: data,
      }
    } catch (error) {
      console.error('PineLabs void error:', error)
      throw error
    }
  }

  async getTerminalStatus(terminalId?: string): Promise<TerminalStatus[]> {
    try {
      const queryParams = terminalId ? `?deviceId=${terminalId}` : ''
      const response = await fetch(`${this.baseUrl}/v2/devices${queryParams}`, {
        method: 'GET',
        headers: {
          'Authorization': `Bearer ${this.config.accessToken}`,
          'X-MyId': this.config.merchantId,
        },
      })

      if (response.ok) {
        const data = await response.json()
        return data.devices?.map((device: any) => ({
          terminalId: device.deviceId,
          status: this.mapDeviceStatus(device.status),
          lastHeartbeat: new Date(device.lastSeen || Date.now()),
          capabilities: device.capabilities || [],
          model: device.model,
          serialNumber: device.serialNumber,
        })) || []
      }

      return []
    } catch (error) {
      console.error('PineLabs terminal status error:', error)
      return []
    }
  }

  async sendToTerminal(terminalId: string, amount: number, reference: string): Promise<PaymentResponse> {
    try {
      const response = await fetch(`${this.baseUrl}/v2/devices/${terminalId}/transactions`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${this.config.accessToken}`,
          'X-MyId': this.config.merchantId,
        },
        body: JSON.stringify({
          amount: Math.round(amount * 100), // Convert to paise
          currency: 'INR',
          reference: reference,
          storeId: this.config.storeId,
          callbackUrl: `${this.baseUrl}/v2/callback/payment`,
          merchantId: this.config.merchantId,
          allowTip: true,
          tipAmounts: [0, 50, 100, 200], // Tip options in paise
        }),
      })

      const data = await response.json()

      return {
        transactionId: data.transactionId,
        status: 'processing',
        amount,
        currency: 'INR',
        providerResponse: data,
        terminalData: data,
      }
    } catch (error) {
      console.error('PineLabs terminal payment error:', error)
      throw error
    }
  }

  async cancelTerminalTransaction(terminalId: string): Promise<void> {
    try {
      await fetch(`${this.baseUrl}/v2/devices/${terminalId}/transactions/cancel`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${this.config.accessToken}`,
          'X-MyId': this.config.merchantId,
        },
        body: JSON.stringify({
          storeId: this.config.storeId,
          merchantId: this.config.merchantId,
        }),
      })
    } catch (error) {
      console.error('PineLabs terminal cancel error:', error)
      throw error
    }
  }

  async verifyWebhook(payload: WebhookPayload): Promise<boolean> {
    try {
      // PineLabs webhook verification using HMAC-SHA256 with Web Crypto API
      return await this.verifyHmacSignature(payload.data, payload.signature, this.config.secretKey)
    } catch (error) {
      console.error('PineLabs webhook verification error:', error)
      return false
    }
  }

  /**
   * Verify HMAC-SHA256 signature using Web Crypto API
   */
  private async verifyHmacSignature(data: any, signature: string, secretKey: string): Promise<boolean> {
    try {
      // Convert secret key to CryptoKey
      const encoder = new TextEncoder()
      const keyData = encoder.encode(secretKey)
      const cryptoKey = await crypto.subtle.importKey(
        'raw',
        keyData,
        { name: 'HMAC', hash: 'SHA-256' },
        false,
        ['sign']
      )

      // Sign the data
      const dataToSign = encoder.encode(JSON.stringify(data))
      const signatureBuffer = await crypto.subtle.sign('HMAC', cryptoKey, dataToSign)
      
      // Convert to hex string
      const computedSignature = Array.from(new Uint8Array(signatureBuffer))
        .map(b => b.toString(16).padStart(2, '0'))
        .join('')
      
      return signature === computedSignature
    } catch (error) {
      console.error('HMAC verification error:', error)
      return false
    }
  }

  parseWebhookEvent(payload: WebhookPayload): any {
    const data = payload.data
    return {
      transactionId: data.paymentId || data.transactionId,
      orderId: data.orderId,
      amount: (data.amount || 0) / 100, // Convert from paise
      status: this.mapPineLabsStatus(data.status),
      customerId: data.customerId,
      paymentMethod: data.paymentMethod,
      terminalData: data.deviceData,
      gatewayResponse: data,
    }
  }

  private mapPaymentMethod(method: string): string {
    const methodMap: Record<string, string> = {
      'card_swipe': 'CARD_SWIPE',
      'card_insert': 'CARD_INSERT',
      'upi': 'UPI',
      'wallet': 'WALLET',
      'netbanking': 'NETBANKING',
      'emi': 'EMI',
      'card': 'CARD',
    }
    return methodMap[method] || 'CARD_SWIPE'
  }

  private mapPineLabsStatus(status: string): 'pending' | 'processing' | 'completed' | 'failed' | 'cancelled' {
    switch (status?.toUpperCase()) {
      case 'PENDING':
      case 'INITIALIZED':
        return 'pending'
      case 'SUCCESS':
      case 'COMPLETED':
        return 'completed'
      case 'FAILED':
      case 'ERROR':
        return 'failed'
      case 'CANCELLED':
      case 'VOID':
        return 'cancelled'
      default:
        return 'processing'
    }
  }

  private mapDeviceStatus(status: string): 'online' | 'offline' | 'error' | 'busy' {
    switch (status?.toUpperCase()) {
      case 'ONLINE':
      case 'ACTIVE':
        return 'online'
      case 'OFFLINE':
      case 'INACTIVE':
        return 'offline'
      case 'BUSY':
      case 'PROCESSING':
        return 'busy'
      case 'ERROR':
      case 'FAILED':
        return 'error'
      default:
        return 'offline'
    }
  }
}