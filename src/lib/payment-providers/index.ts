// Payment Provider Interface and Factory
import { PaytmProvider } from './paytm'
import { PineLabsProvider } from './pinelabs'

export interface PaymentProviderConfig {
  apiKey?: string
  secretKey?: string
  merchantId?: string
  terminalId?: string
  environment: 'sandbox' | 'production'
  webhookSecret?: string
  [key: string]: any
}

export interface PaymentCapabilities {
  paymentMethods: string[]
  features: string[]
  terminalSupport: boolean
  refundSupport: boolean
  voidSupport: boolean
}

export interface PaymentRequest {
  amount: number
  currency: string
  orderId: string
  customerId?: string
  description?: string
  metadata?: Record<string, any>
  paymentMethod: string
  terminalId?: string
  returnUrl?: string
  callbackUrl?: string
}

export interface PaymentResponse {
  transactionId: string
  status: 'pending' | 'processing' | 'completed' | 'failed' | 'cancelled'
  amount: number
  currency: string
  providerResponse: any
  redirectUrl?: string
  terminalData?: any
}

export interface TerminalStatus {
  terminalId: string
  status: 'online' | 'offline' | 'error' | 'busy'
  lastHeartbeat: Date
  capabilities: string[]
  model?: string
  serialNumber?: string
}

export interface WebhookPayload {
  event: string
  data: any
  signature: string
  timestamp: number
}

export interface PaymentProviderInterface {
  name: string
  type: 'terminal' | 'api' | 'hybrid'
  capabilities: PaymentCapabilities

  // Core payment operations
  initiatePayment(request: PaymentRequest): Promise<PaymentResponse>
  checkPaymentStatus(transactionId: string): Promise<PaymentResponse>
  refundPayment(transactionId: string, amount?: number, reason?: string): Promise<PaymentResponse>
  voidPayment(transactionId: string): Promise<PaymentResponse>

  // Terminal operations
  getTerminalStatus(terminalId?: string): Promise<TerminalStatus[]>
  sendToTerminal(terminalId: string, amount: number, reference: string): Promise<PaymentResponse>
  cancelTerminalTransaction(terminalId: string): Promise<void>

  // Webhook operations
  verifyWebhook(payload: WebhookPayload): Promise<boolean>
  parseWebhookEvent(payload: WebhookPayload): any

  // Configuration
  validateConfig(config: PaymentProviderConfig): boolean
}

// Provider Factory
export class PaymentProviderFactory {
  private static providers: Map<string, new (config: any) => PaymentProviderInterface> = new Map()

  static registerProvider(name: string, providerClass: new (config: any) => PaymentProviderInterface) {
    this.providers.set(name, providerClass)
  }

  static createProvider(name: string, config: any): PaymentProviderInterface {
    const ProviderClass = this.providers.get(name.toLowerCase())
    if (!ProviderClass) {
      throw new Error(`Payment provider '${name}' not registered`)
    }
    return new ProviderClass(config)
  }

  static getRegisteredProviders(): string[] {
    return Array.from(this.providers.keys())
  }
}

// Register built-in providers
PaymentProviderFactory.registerProvider('paytm', PaytmProvider)
PaymentProviderFactory.registerProvider('pinelabs', PineLabsProvider)

// Provider-specific types
export interface PaytmConfig extends PaymentProviderConfig {
  mid: string // Merchant ID
  key: string // Secret key
  website: string
  industryTypeId: string
  channelId: string
}

export interface PineLabsConfig extends PaymentProviderConfig {
  merchantId: string
  secretKey: string
  accessToken: string
  storeId: string
}

export interface PaytmTerminalData {
  soundboxId: string
  deviceToken: string
  clientId: string
  clientSecret: string
}

export interface PineLabsTerminalData {
  deviceId: string
  merchantId: string
  storeId: string
  userId: string
  password: string
}