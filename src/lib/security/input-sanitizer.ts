import { z } from 'zod'
import DOMPurify from 'isomorphic-dompurify'

// Sanitization rules for different data types
export interface SanitizationRules {
  maxLength?: number
  allowHtml?: boolean
  allowScripts?: boolean
  allowUrls?: boolean
  pattern?: RegExp
  customValidator?: (value: string) => boolean
  [key: string]: any
}

// Default sanitization rules
const defaultRules: SanitizationRules = {
  maxLength: 1000,
  allowHtml: false,
  allowScripts: false,
  allowUrls: true,
}

export class InputSanitizer {
  /**
   * Sanitize a string value based on rules
   */
  static sanitize(value: string, rules: SanitizationRules = defaultRules): string {
    if (typeof value !== 'string') {
      return ''
    }

    let sanitized = value.trim()

    // Remove null bytes and control characters
    sanitized = sanitized.replace(/[\x00-\x08\x0B\x0C\x0E-\x1F\x7F]/g, '')

    // Apply HTML sanitization
    if (!rules.allowHtml) {
      sanitized = DOMPurify.sanitize(sanitized, {
        ALLOWED_TAGS: [],
        ALLOWED_ATTR: [],
        FORBID_TAGS: ['style', 'script', 'iframe', 'object', 'embed'],
        FORBID_ATTR: ['onerror', 'onclick', 'onload', 'onmouseover', 'onfocus'],
        ADD_TAGS: [],
        ADD_ATTR: [],
      })
    }

    // Remove scripts if not allowed
    if (!rules.allowScripts) {
      sanitized = sanitized.replace(/<script\b[^<]*(?:(?!<\/script>)<[^<]*)*<\/script>/gi, '')
      sanitized = sanitized.replace(/javascript:/gi, '')
      sanitized = sanitized.replace(/on\w+="[^"]*"/gi, '')
      sanitized = sanitized.replace(/on\w+='[^']*'/gi, '')
      sanitized = sanitized.replace(/on\w+=\w+/gi, '')
    }

    // Handle URLs
    if (!rules.allowUrls) {
      // Remove potentially dangerous URL schemes
      sanitized = sanitized.replace(/(javascript|vbscript|data):/gi, '')
    }

    // Enforce maximum length
    if (rules.maxLength && sanitized.length > rules.maxLength) {
      sanitized = sanitized.substring(0, rules.maxLength)
    }

    return sanitized
  }

  /**
   * Sanitize an object recursively
   */
  static sanitizeObject<T extends Record<string, any>>(
    obj: T,
    rules: Record<string, SanitizationRules> = {}
  ): T {
    if (typeof obj !== 'object' || obj === null) {
      return obj
    }

    const sanitized: Record<string, any> = {}

    for (const [key, value] of Object.entries(obj)) {
      const keyRules = rules[key] || defaultRules

      if (typeof value === 'string') {
        sanitized[key] = this.sanitize(value, keyRules)
      } else if (Array.isArray(value)) {
        sanitized[key] = value.map(item => 
          typeof item === 'string' ? this.sanitize(item, keyRules) : item
        )
      } else if (typeof value === 'object' && value !== null) {
        sanitized[key] = this.sanitizeObject(value, keyRules)
      } else {
        sanitized[key] = value
      }
    }

    return sanitized as T
  }

  /**
   * Validate and sanitize email
   */
  static sanitizeEmail(email: string): string {
    const sanitized = this.sanitize(email, { maxLength: 255 })
    const emailSchema = z.string().email().max(255)
    
    try {
      emailSchema.parse(sanitized)
      return sanitized.toLowerCase()
    } catch {
      throw new Error('Invalid email format')
    }
  }

  /**
   * Validate and sanitize phone number
   */
  static sanitizePhoneNumber(phone: string): string {
    const sanitized = this.sanitize(phone, { maxLength: 20 })
    // Remove all non-digit characters except + and -
    const cleaned = sanitized.replace(/[^\d+\-]/g, '')
    
    // Basic phone validation (7-15 digits)
    const phoneRegex = /^\+?[\d\-]{7,15}$/
    if (!phoneRegex.test(cleaned)) {
      throw new Error('Invalid phone number format')
    }
    
    return cleaned
  }

  /**
   * Validate and sanitize currency amount
   */
  static sanitizeCurrency(amount: string | number): number {
    if (typeof amount === 'number') {
      if (isNaN(amount) || amount < 0 || amount > 999999999.99) {
        throw new Error('Invalid currency amount')
      }
      return Math.round(amount * 100) / 100 // Round to 2 decimal places
    }

    const sanitized = this.sanitize(amount.toString(), { maxLength: 20 })
    const cleaned = sanitized.replace(/[^\d.]/g, '')
    
    const num = parseFloat(cleaned)
    if (isNaN(num) || num < 0 || num > 999999999.99) {
      throw new Error('Invalid currency amount')
    }
    
    return Math.round(num * 100) / 100
  }

  /**
   * Validate and sanitize SKU/Barcode
   */
  static sanitizeSKU(sku: string): string {
    const sanitized = this.sanitize(sku, { 
      maxLength: 50,
      pattern: /^[A-Za-z0-9\-_]+$/ 
    })
    
    if (!sanitized) {
      throw new Error('SKU cannot be empty')
    }
    
    return sanitized.toUpperCase()
  }

  /**
   * Validate and sanitize product name
   */
  static sanitizeProductName(name: string): string {
    const sanitized = this.sanitize(name, { maxLength: 200 })
    
    if (!sanitized || sanitized.length < 1) {
      throw new Error('Product name cannot be empty')
    }
    
    return sanitized
  }

  /**
   * Validate and sanitize stock quantity
   */
  static sanitizeStockQuantity(quantity: string | number): number {
    if (typeof quantity === 'number') {
      if (!Number.isInteger(quantity) || quantity < 0 || quantity > 999999) {
        throw new Error('Invalid stock quantity')
      }
      return quantity
    }

    const sanitized = this.sanitize(quantity.toString(), { maxLength: 10 })
    const num = parseInt(sanitized, 10)
    
    if (isNaN(num) || !Number.isInteger(num) || num < 0 || num > 999999) {
      throw new Error('Invalid stock quantity')
    }
    
    return num
  }

  /**
   * Sanitize SQL-like patterns to prevent injection
   */
  static sanitizeForSQL(value: string): string {
    const sanitized = this.sanitize(value)
    
    // Escape common SQL injection patterns
    return sanitized
      .replace(/'/g, "''")
      .replace(/"/g, '""')
      .replace(/;/g, '')
      .replace(/--/g, '')
      .replace(/\/\*/g, '')
      .replace(/\*\//g, '')
      .replace(/xp_/gi, '')
      .replace(/sp_/gi, '')
  }

  /**
   * Sanitize for JSON storage
   */
  static sanitizeForJSON(value: string): string {
    const sanitized = this.sanitize(value)
    
    // Remove potentially dangerous JSON patterns
    return sanitized
      .replace(/<script/gi, '<script')
      .replace(/<\/script>/gi, '</script>')
      .replace(/javascript:/gi, '')
      .replace(/data:/gi, '')
  }

  /**
   * Middleware for Next.js API routes
   */
  static middleware(rules?: Record<string, SanitizationRules>) {
    return (req: Request) => {
      // Clone the request
      const requestClone = req.clone()
      
      return requestClone.json().then(body => {
        const sanitizedBody = this.sanitizeObject(body, rules)
        
        // Replace the body with sanitized version
        return new Request(req.url, {
          method: req.method,
          headers: req.headers,
          body: JSON.stringify(sanitizedBody),
        })
      }).catch(() => {
        // If JSON parsing fails, return original request
        return req
      })
    }
  }
}

// Common sanitization rule sets
export const sanitizationRules = {
  // Product data
  product: {
    name: { maxLength: 200 },
    description: { maxLength: 1000, allowHtml: false },
    sku: { maxLength: 50, pattern: /^[A-Za-z0-9\-_]+$/ },
    barcode: { maxLength: 50, pattern: /^[A-Za-z0-9\-_]+$/ },
    price: { maxLength: 20 },
    cost: { maxLength: 20 },
    stock: { maxLength: 10 },
  },

  // Customer data
  customer: {
    name: { maxLength: 100 },
    email: { maxLength: 255 },
    phone: { maxLength: 20 },
    address: { maxLength: 500 },
  },

  // Employee data
  employee: {
    name: { maxLength: 100 },
    email: { maxLength: 255 },
    phone: { maxLength: 20 },
    role: { maxLength: 50 },
  },

  // Sale data
  sale: {
    notes: { maxLength: 1000 },
    paymentMethod: { maxLength: 50 },
  },

  // General text fields
  text: {
    maxLength: 1000,
    allowHtml: false,
  },
}