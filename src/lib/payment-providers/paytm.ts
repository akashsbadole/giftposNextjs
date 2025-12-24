import { 
  PaymentProviderInterface, 
  PaymentRequest, 
  PaymentResponse, 
  TerminalStatus, 
  WebhookPayload,
  PaytmConfig,
  PaytmTerminalData 
} from './index'

export class PaytmProvider implements PaymentProviderInterface {
  name = 'paytm'
  type = 'hybrid' as const
  capabilities = {
    paymentMethods: [
      'card_swipe', 'upi', 'wallet', 'netbanking', 
      'emi', 'paytm_postpaid', 'card'
    ],
    features: [
      'instant_refund', 'partial_refund', 'void', 
      'terminal_payments', 'soundbox_integration'
    ],
    terminalSupport: true,
    refundSupport: true,
    voidSupport: true
  }

  private config: PaytmConfig
  private baseUrl: string

  constructor(config: PaytmConfig) {
    this.config = config
    this.baseUrl = config.environment === 'production' 
      ? 'https://securegw.paytm.in' 
      : 'https://securegw-stage.paytm.in'
  }

  validateConfig(config: PaytmConfig): boolean {
    return !!(
      config.mid &&
      config.key &&
      config.website &&
      config.industryTypeId &&
      config.channelId &&
      config.environment
    )
  }

  async initiatePayment(request: PaymentRequest): Promise<PaymentResponse> {
    try {
      const orderAmount = (request.amount * 100).toString() // Paytm uses paise
      const checksum = await this.generateChecksum({
        MID: this.config.mid,
        ORDER_ID: request.orderId,
        CUST_ID: request.customerId || `CUST_${Date.now()}`,
        INDUSTRY_TYPE_ID: this.config.industryTypeId,
        CHANNEL_ID: this.config.channelId,
        TXN_AMOUNT: orderAmount,
        WEBSITE: this.config.website,
        CALLBACK_URL: request.callbackUrl || `${this.baseUrl}/theia/paytmCallback`,
      })

      const payload = {
        requestType: 'Payment',
        mid: this.config.mid,
        websiteName: this.config.website,
        orderId: request.orderId,
        callbackUrl: request.callbackUrl || `${this.baseUrl}/theia/paytmCallback`,
        txnAmount: {
          value: orderAmount,
          currency: request.currency,
        },
        userInfo: {
          custId: request.customerId || `CUST_${Date.now()}`,
        },
        paytmSsoToken: '',
        consumeProfile: {
          profile: 'DOCUMENT_PERSISTENT',
          profileParams: {
            subscriberName: request.customerId || 'Customer',
            deviceId: 'WEB',
            channel: 'WEB',
            identityType: 'native',
            mobileNumber: '',
          },
        },
        extensions: {
          LOCATION_DATA: {
            latLong: '',
          },
        },
        paymentModeCount: {},
        paymentStageInfo: {
          nodeLabel: 'DEFAULT',
          deviceId: 'WEB',
        },
        promoCode: '',
        linkInfo: {
          linkType: 0,
          linkDescription: '',
        },
        deepLinkInfo: {
          deepLinkExpiryTime: '',
        },
       emandateDetails: {
          isEmandate: false,
          mandateAmount: '',
          mandateType: '',
          splitUpi: false,
        },
        emiDetails: {
          isEmi: false,
          emiTenure: '',
        },
        userFieldMap: request.metadata || {},
        addressList: [],
        addressInfo: [],
        cartDetails: {
          txnTokens: [],
        },
       emiTransactionMode: {},
        paymentModeOrder: [],
        enableFitment: false,
        orderItems: [{
          itemId: request.orderId,
          itemName: request.description || 'POSPrice: order Purchase',
          itemAmount: orderAmount,
          quantity: 1,
        }],
        promoCampaignId: '',
        websiteLink: '',
        checksumHash: checksum,
      }

      const response = await fetch(`${this.baseUrl}/theia/api/v1/showPaymentPage`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Accept': 'application/json',
        },
        body: JSON.stringify(payload),
      })

      const data = await response.json()

      if (data.resultInfo?.resultStatus === 'S') {
        return {
          transactionId: data.txnToken,
          status: 'pending',
          amount: request.amount,
          currency: request.currency,
          providerResponse: data,
          redirectUrl: data.paymentPageUrl,
        }
      } else {
        throw new Error(data.resultInfo?.resultMsg || 'Payment initiation failed')
      }
    } catch (error) {
      console.error('Paytm payment initiation error:', error)
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
      const postData = {
        MID: this.config.mid,
        ORDERID: transactionId,
        TXNTYPE: '',
        TOKEN: transactionId,
        TXNID: '',
      }

      const checksum = await this.generateChecksum(postData)

      const response = await fetch(`${this.baseUrl}/merchant-status/api/v1/getPaymentPageStatus`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Accept': 'application/json',
        },
        body: JSON.stringify({
          ...postData,
          CHECKSUMHASH: checksum,
        }),
      })

      const data = await response.json()

      return {
        transactionId: data.TXNID || transactionId,
        status: this.mapPaytmStatus(data.STATUS),
        amount: parseFloat(data.TXNAMOUNT || '0'),
        currency: data.CURRENCY || 'INR',
        providerResponse: data,
      }
    } catch (error) {
      console.error('Paytm status check error:', error)
      throw error
    }
  }

  async refundPayment(transactionId: string, amount?: number, reason?: string): Promise<PaymentResponse> {
    try {
      const refundOrderId = `REF_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`
      const refundAmount = amount ? (amount * 100).toString() : undefined

      const postData = {
        MID: this.config.mid,
        ORDERID: transactionId,
        TXNID: transactionId,
        REFUNDAMOUNT: refundAmount,
        REFID: refundOrderId,
        REFUNDTYPE: 'MANUAL',
      }

      const checksum = await this.generateChecksum(postData)

      const response = await fetch(`${this.baseUrl}/refund/api/v1/refundStatus`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Accept': 'application/json',
        },
        body: JSON.stringify({
          ...postData,
          CHECKSUMHASH: checksum,
        }),
      })

      const data = await response.json()

      return {
        transactionId: refundOrderId,
        status: data.RESPCODE === '01' ? 'completed' : 'failed',
        amount: amount || parseFloat(data.REFUNDAMOUNT || '0') / 100,
        currency: 'INR',
        providerResponse: data,
      }
    } catch (error) {
      console.error('Paytm refund error:', error)
      throw error
    }
  }

  async voidPayment(transactionId: string): Promise<PaymentResponse> {
    try {
      // Paytm doesn't have direct void, so we use refund for pending transactions
      return await this.refundPayment(transactionId)
    } catch (error) {
      console.error('Paytm void error:', error)
      throw error
    }
  }

  async getTerminalStatus(terminalId?: string): Promise<TerminalStatus[]> {
    try {
      // For Soundbox terminals, check status via API
      const response = await fetch(`${this.baseUrl}/voice/v1/device/soundbox/status`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${this.config.apiKey}`,
        },
        body: JSON.stringify({
          deviceIds: terminalId ? [terminalId] : [],
        }),
      })

      if (response.ok) {
        const data = await response.json()
        return data.data?.map((device: any) => ({
          terminalId: device.deviceId,
          status: device.online ? 'online' : 'offline',
          lastHeartbeat: new Date(device.lastSeen),
          capabilities: device.capabilities || [],
          model: device.model,
          serialNumber: device.serialNumber,
        })) || []
      }

      return []
    } catch (error) {
      console.error('Paytm terminal status error:', error)
      return []
    }
  }

  async sendToTerminal(terminalId: string, amount: number, reference: string): Promise<PaymentResponse> {
    try {
      const response = await fetch(`${this.baseUrl}/voice/v1/device/soundbox/pushTxn`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${this.config.apiKey}`,
        },
        body: JSON.stringify({
          deviceId: terminalId,
          orderId: reference,
          amount: (amount * 100).toString(),
          currency: 'INR',
          callbackUrl: `${this.baseUrl}/voice/v1/device/soundbox/callback`,
        }),
      })

      const data = await response.json()

      return {
        transactionId: data.txnId || reference,
        status: 'processing',
        amount,
        currency: 'INR',
        providerResponse: data,
        terminalData: data,
      }
    } catch (error) {
      console.error('Paytm terminal payment error:', error)
      throw error
    }
  }

  async cancelTerminalTransaction(terminalId: string): Promise<void> {
    try {
      await fetch(`${this.baseUrl}/voice/v1/device/soundbox/cancelTxn`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${this.config.apiKey}`,
        },
        body: JSON.stringify({
          deviceId: terminalId,
        }),
      })
    } catch (error) {
      console.error('Paytm terminal cancel error:', error)
      throw error
    }
  }

  async verifyWebhook(payload: WebhookPayload): Promise<boolean> {
    try {
      // Paytm webhook verification logic would go here
      // This is a simplified version
      const expectedSignature = payload.data.CHECKSUMHASH
      const computedSignature = await this.generateChecksum(payload.data)
      return expectedSignature === computedSignature
    } catch (error) {
      console.error('Paytm webhook verification error:', error)
      return false
    }
  }

  parseWebhookEvent(payload: WebhookPayload): any {
    const data = payload.data
    return {
      transactionId: data.TXNID,
      orderId: data.ORDERID,
      amount: parseFloat(data.TXNAMOUNT) / 100,
      status: this.mapPaytmStatus(data.STATUS),
      customerId: data.CUSTID,
      paymentMethod: data.PAYMENTMODE,
      gatewayResponse: data,
    }
  }

  private async generateChecksum(params: Record<string, any>): Promise<string> {
    // Simplified checksum generation - in production, use Paytm's official library
    const sortedParams = Object.keys(params)
      .filter(key => params[key] !== undefined && params[key] !== '')
      .sort()
      .map(key => `${key}=${params[key]}`)
      .join('&')

    // In production, use proper HMAC-SHA256 with secret key
    // For now, return a placeholder using Web Crypto API compatible method
    const encoder = new TextEncoder()
    const data = encoder.encode(sortedParams)
    const base64Hash = btoa(String.fromCharCode(...data))
    return `HASH_${base64Hash}`
  }

  private async generateChecksumSync(params: Record<string, any>): Promise<string> {
    // Synchronous version for webhook verification using Web Crypto API
    const sortedParams = Object.keys(params)
      .filter(key => params[key] !== undefined && params[key] !== '')
      .sort()
      .map(key => `${key}=${params[key]}`)
      .join('&')

    // Use TextEncoder to convert string to bytes for Web Crypto API compatibility
    const encoder = new TextEncoder()
    const data = encoder.encode(sortedParams)
    const base64Hash = btoa(String.fromCharCode(...data))
    return `HASH_${base64Hash}`
  }

  private mapPaytmStatus(status: string): 'pending' | 'processing' | 'completed' | 'failed' | 'cancelled' {
    switch (status?.toUpperCase()) {
      case 'PENDING':
      case 'OPEN':
        return 'pending'
      case 'SUCCESS':
      case 'TXN_SUCCESS':
        return 'completed'
      case 'FAILED':
      case 'TXN_FAILURE':
        return 'failed'
      case 'CANCELLED':
        return 'cancelled'
      default:
        return 'processing'
    }
  }
}