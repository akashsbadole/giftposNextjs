/**
 * Currency Formatting Service
 * Provides consistent currency formatting across the POS system
 */

export interface CurrencyConfig {
  currency: string
  locale?: string
  minimumFractionDigits?: number
  maximumFractionDigits?: number
}

const DEFAULT_CURRENCY_CONFIG: CurrencyConfig = {
  currency: 'USD',
  locale: 'en-US',
  minimumFractionDigits: 2,
  maximumFractionDigits: 2,
}

/**
 * Formats a number as currency using Intl.NumberFormat
 * @param amount - The amount to format
 * @param config - Currency configuration options
 * @returns Formatted currency string
 */
export function formatCurrency(
  amount: number,
  config: CurrencyConfig = DEFAULT_CURRENCY_CONFIG
): string {
  const { currency, locale, minimumFractionDigits, maximumFractionDigits } = config

  try {
    return new Intl.NumberFormat(locale, {
      style: 'currency',
      currency,
      minimumFractionDigits,
      maximumFractionDigits,
    }).format(amount)
  } catch (error) {
    console.warn(`Invalid currency configuration:`, error)
    // Fallback to basic formatting
    return `${currency} ${amount.toFixed(2)}`
  }
}

/**
 * Formats currency for display in lists and tables
 * Uses shorter format for space-constrained displays
 */
export function formatCurrencyCompact(
  amount: number,
  config: CurrencyConfig = DEFAULT_CURRENCY_CONFIG
): string {
  const { currency } = config

  try {
    if (amount >= 1000000) {
      // Format millions
      return `${currency} ${(amount / 1000000).toFixed(1)}M`
    } else if (amount >= 1000) {
      // Format thousands
      return `${currency} ${(amount / 1000).toFixed(1)}K`
    } else {
      // Format normally
      return formatCurrency(amount, config)
    }
  } catch (error) {
    return formatCurrency(amount, config)
  }
}

/**
 * Parses a formatted currency string back to a number
 * Useful for extracting values from user input
 * @param formattedValue - The formatted currency string
 * @returns The numeric value
 */
export function parseCurrency(formattedValue: string): number {
  // Remove all non-numeric characters except decimal point and minus
  const cleaned = formattedValue.replace(/[^0-9.-]/g, '')
  return parseFloat(cleaned) || 0
}

/**
 * Gets the currency symbol for a given currency code
 * @param currencyCode - ISO currency code (e.g., 'USD', 'EUR')
 * @returns Currency symbol
 */
export function getCurrencySymbol(currencyCode: string): string {
  const symbols: Record<string, string> = {
    USD: '$',
    EUR: '€',
    GBP: '£',
    JPY: '¥',
    CNY: '¥',
    INR: '₹',
    AUD: 'A$',
    CAD: 'C$',
    CHF: 'CHF',
    SEK: 'kr',
    NOK: 'kr',
    DKK: 'kr',
    PLN: 'zł',
    CZK: 'Kč',
    HUF: 'Ft',
    RUB: '₽',
    BRL: 'R$',
    MXN: '$',
    SGD: 'S$',
    HKD: 'HK$',
    NZD: 'NZ$',
    ZAR: 'R',
  }

  return symbols[currencyCode.toUpperCase()] || currencyCode.toUpperCase()
}

/**
 * Validates if a currency code is valid
 * @param currencyCode - ISO currency code to validate
 * @returns true if valid, false otherwise
 */
export function isValidCurrency(currencyCode: string): boolean {
  try {
    new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: currencyCode.toUpperCase(),
    }).format(0)
    return true
  } catch {
    return false
  }
}

/**
 * Gets common currency options for UI selection
 */
export const COMMON_CURRENCIES = [
  { code: 'USD', name: 'US Dollar', symbol: '$' },
  { code: 'EUR', name: 'Euro', symbol: '€' },
  { code: 'GBP', name: 'British Pound', symbol: '£' },
  { code: 'JPY', name: 'Japanese Yen', symbol: '¥' },
  { code: 'CNY', name: 'Chinese Yuan', symbol: '¥' },
  { code: 'INR', name: 'Indian Rupee', symbol: '₹' },
  { code: 'AUD', name: 'Australian Dollar', symbol: 'A$' },
  { code: 'CAD', name: 'Canadian Dollar', symbol: 'C$' },
  { code: 'CHF', name: 'Swiss Franc', symbol: 'CHF' },
  { code: 'SGD', name: 'Singapore Dollar', symbol: 'S$' },
]

/**
 * Gets currency display name for UI
 */
export function getCurrencyDisplayName(currencyCode: string): string {
  const currency = COMMON_CURRENCIES.find(c => c.code === currencyCode.toUpperCase())
  return currency ? `${currency.name} (${currency.symbol})` : currencyCode.toUpperCase()
}