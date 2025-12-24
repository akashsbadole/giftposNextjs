export abstract class AppError extends Error {
  public readonly statusCode: number
  public readonly code: string
  public readonly isOperational: boolean
  public readonly details?: any

  constructor(
    message: string,
    statusCode: number,
    code: string,
    isOperational = true,
    details?: any
  ) {
    super(message)
    this.statusCode = statusCode
    this.code = code
    this.isOperational = isOperational
    this.details = details

    Error.captureStackTrace(this, this.constructor)
  }
}

// Authentication Errors
export class AuthenticationError extends AppError {
  constructor(message = 'Authentication failed', details?: any) {
    super(message, 401, 'AUTHENTICATION_ERROR', true, details)
  }
}

export class AuthorizationError extends AppError {
  constructor(message = 'Insufficient permissions', details?: any) {
    super(message, 403, 'AUTHORIZATION_ERROR', true, details)
  }
}

export class TokenExpiredError extends AppError {
  constructor(message = 'Authentication token has expired', details?: any) {
    super(message, 401, 'TOKEN_EXPIRED', true, details)
  }
}

export class InvalidTokenError extends AppError {
  constructor(message = 'Invalid authentication token', details?: any) {
    super(message, 401, 'INVALID_TOKEN', true, details)
  }
}

// Validation Errors
export class ValidationError extends AppError {
  public readonly validationErrors: Array<{ field: string; message: string }>

  constructor(
    message = 'Validation failed',
    validationErrors: Array<{ field: string; message: string }>,
    details?: any
  ) {
    super(message, 400, 'VALIDATION_ERROR', true, details)
    this.validationErrors = validationErrors
  }
}

export class MissingRequiredFieldError extends AppError {
  constructor(fieldName: string, details?: any) {
    super(`Missing required field: ${fieldName}`, 400, 'MISSING_REQUIRED_FIELD', true, details)
  }
}

export class InvalidDataFormatError extends AppError {
  constructor(fieldName: string, expectedFormat: string, details?: any) {
    super(`Invalid format for field ${fieldName}. Expected: ${expectedFormat}`, 400, 'INVALID_DATA_FORMAT', true, details)
  }
}

// Rate Limiting Errors
export class RateLimitExceededError extends AppError {
  constructor(message = 'Rate limit exceeded', retryAfter?: number, details?: any) {
    super(message, 429, 'RATE_LIMIT_EXCEEDED', true, { retryAfter, ...details })
  }
}

// Database Errors
export class DatabaseConnectionError extends AppError {
  constructor(message = 'Database connection failed', details?: any) {
    super(message, 503, 'DATABASE_CONNECTION_ERROR', true, details)
  }
}

export class RecordNotFoundError extends AppError {
  constructor(resource: string, identifier?: string, details?: any) {
    const message = identifier 
      ? `${resource} with identifier '${identifier}' not found`
      : `${resource} not found`
    super(message, 404, 'RECORD_NOT_FOUND', true, details)
  }
}

export class DuplicateRecordError extends AppError {
  constructor(resource: string, field: string, value: string, details?: any) {
    super(`${resource} with ${field} '${value}' already exists`, 409, 'DUPLICATE_RECORD', true, details)
  }
}

export class DatabaseConstraintError extends AppError {
  constructor(message = 'Database constraint violation', details?: any) {
    super(message, 409, 'DATABASE_CONSTRAINT_ERROR', true, details)
  }
}

// Business Logic Errors
export class InsufficientStockError extends AppError {
  constructor(productName: string, requested: number, available: number, details?: any) {
    super(`Insufficient stock for ${productName}. Requested: ${requested}, Available: ${available}`, 422, 'INSUFFICIENT_STOCK', true, details)
  }
}

export class InvalidPaymentAmountError extends AppError {
  constructor(amount: number, details?: any) {
    super(`Invalid payment amount: ${amount}`, 422, 'INVALID_PAYMENT_AMOUNT', true, details)
  }
}

export class PaymentProcessingError extends AppError {
  constructor(message = 'Payment processing failed', details?: any) {
    super(message, 422, 'PAYMENT_PROCESSING_ERROR', true, details)
  }
}

export class PrinterNotAvailableError extends AppError {
  constructor(printerId?: string, details?: any) {
    const message = printerId 
      ? `Printer ${printerId} is not available`
      : 'No printer is available'
    super(message, 503, 'PRINTER_NOT_AVAILABLE', true, details)
  }
}

export class PrintJobFailedError extends AppError {
  constructor(message = 'Print job failed', details?: any) {
    super(message, 500, 'PRINT_JOB_FAILED', true, details)
  }
}

// External Service Errors
export class ExternalServiceError extends AppError {
  constructor(service: string, message: string, details?: any) {
    super(`External service error (${service}): ${message}`, 502, 'EXTERNAL_SERVICE_ERROR', true, details)
  }
}

export class PaymentProviderError extends AppError {
  constructor(provider: string, message: string, details?: any) {
    super(`Payment provider error (${provider}): ${message}`, 502, 'PAYMENT_PROVIDER_ERROR', true, details)
  }
}

// System Errors
export class InternalServerError extends AppError {
  constructor(message = 'Internal server error', details?: any) {
    super(message, 500, 'INTERNAL_SERVER_ERROR', false, details)
  }
}

export class ServiceUnavailableError extends AppError {
  constructor(service: string, details?: any) {
    super(`${service} is temporarily unavailable`, 503, 'SERVICE_UNAVAILABLE', true, details)
  }
}

export class ConfigurationError extends AppError {
  constructor(setting: string, details?: any) {
    super(`Configuration error: ${setting}`, 500, 'CONFIGURATION_ERROR', true, details)
  }
}

// Security Errors
export class SecurityViolationError extends AppError {
  constructor(violation: string, details?: any) {
    super(`Security violation: ${violation}`, 403, 'SECURITY_VIOLATION', true, details)
  }
}

export class InputSanitizationError extends AppError {
  constructor(field: string, reason: string, details?: any) {
    super(`Input sanitization failed for field '${field}': ${reason}`, 400, 'INPUT_SANITIZATION_ERROR', true, details)
  }
}

export class CSRFTokenError extends AppError {
  constructor(message = 'Invalid or missing CSRF token', details?: any) {
    super(message, 403, 'CSRF_TOKEN_ERROR', true, details)
  }
}

// File Operation Errors
export class FileNotFoundError extends AppError {
  constructor(filePath: string, details?: any) {
    super(`File not found: ${filePath}`, 404, 'FILE_NOT_FOUND', true, details)
  }
}

export class FileUploadError extends AppError {
  constructor(message = 'File upload failed', details?: any) {
    super(message, 422, 'FILE_UPLOAD_ERROR', true, details)
  }
}

export class UnsupportedFileTypeError extends AppError {
  constructor(fileType: string, allowedTypes: string[], details?: any) {
    super(`Unsupported file type: ${fileType}. Allowed types: ${allowedTypes.join(', ')}`, 422, 'UNSUPPORTED_FILE_TYPE', true, details)
  }
}

// Error Factory Functions
export const createValidationError = (errors: Array<{ field: string; message: string }>): ValidationError => {
  return new ValidationError('Validation failed', errors)
}

export const createRecordNotFoundError = (resource: string, identifier?: string): RecordNotFoundError => {
  return new RecordNotFoundError(resource, identifier)
}

export const createDuplicateRecordError = (resource: string, field: string, value: string): DuplicateRecordError => {
  return new DuplicateRecordError(resource, field, value)
}

export const createInsufficientStockError = (
  productName: string, 
  requested: number, 
  available: number
): InsufficientStockError => {
  return new InsufficientStockError(productName, requested, available)
}

// Error Response Formatter
export interface ErrorResponse {
  error: {
    code: string
    message: string
    details?: any
    timestamp: string
    requestId?: string
  }
}

export const formatErrorResponse = (
  error: AppError,
  requestId?: string
): ErrorResponse => {
  return {
    error: {
      code: error.code,
      message: error.message,
      details: error.details,
      timestamp: new Date().toISOString(),
      requestId,
    },
  }
}

// Error Type Guards
export const isAppError = (error: any): error is AppError => {
  return error instanceof AppError
}

export const isValidationError = (error: any): error is ValidationError => {
  return isAppError(error) && error.code === 'VALIDATION_ERROR'
}

export const isAuthenticationError = (error: any): error is AuthenticationError => {
  return isAppError(error) && error.code === 'AUTHENTICATION_ERROR'
}

export const isAuthorizationError = (error: any): error is AuthorizationError => {
  return isAppError(error) && error.code === 'AUTHORIZATION_ERROR'
}

export const isRateLimitError = (error: any): error is RateLimitExceededError => {
  return isAppError(error) && error.code === 'RATE_LIMIT_EXCEEDED'
}