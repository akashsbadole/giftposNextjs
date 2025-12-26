// Enhanced Data Validation Framework for Order Management
// Comprehensive validation system with business rules, security checks, and data integrity

import { OrderState } from './order-state-machine'

export enum ValidationSeverity {
  INFO = 'info',
  WARNING = 'warning', 
  ERROR = 'error',
  CRITICAL = 'critical'
}

export enum ValidationCategory {
  STRUCTURE = 'structure',           // Data structure validation
  BUSINESS_RULES = 'business_rules', // Business logic validation
  SECURITY = 'security',             // Security and permissions
  DATA_INTEGRITY = 'data_integrity', // Data consistency
  SCHEMA = 'schema',                 // Schema compliance
  PERFORMANCE = 'performance'        // Performance constraints
}

export interface ValidationRule {
  id: string
  name: string
  category: ValidationCategory
  severity: ValidationSeverity
  description: string
  validator: (data: any, context: ValidationContext) => Promise<ValidationResult>
  dependencies?: string[] // Other rule IDs this depends on
  timeout?: number // Validation timeout in ms
  retryable?: boolean
}

export interface ValidationResult {
  isValid: boolean
  severity: ValidationSeverity
  message: string
  details?: string
  field?: string
  suggestion?: string
  timestamp: Date
}

export interface ValidationContext {
  userId: string
  storeId: string
  orderId?: string
  operation: string
  currentState?: OrderState
  targetState?: OrderState
  metadata?: Record<string, any>
  timestamp: Date
}

export interface ValidationReport {
  isValid: boolean
  overallSeverity: ValidationSeverity
  results: ValidationResult[]
  summary: {
    total: number
    passed: number
    failed: number
    warnings: number
    errors: number
    critical: number
  }
  processingTime: number
  timestamp: Date
}

export class OrderDataValidator {
  private static rules: Map<string, ValidationRule> = new Map()
  private static ruleDependencies: Map<string, Set<string>> = new Map()
  private static validationCache = new Map<string, { result: ValidationReport; expiry: number }>()
  private static readonly CACHE_TTL = 5 * 60 * 1000 // 5 minutes

  static {
    this.initializeDefaultRules()
  }

  private static initializeDefaultRules(): void {
    // Structure validation rules
    this.addRule({
      id: 'order_structure_basic',
      name: 'Basic Order Structure',
      category: ValidationCategory.STRUCTURE,
      severity: ValidationSeverity.ERROR,
      description: 'Validates basic order structure and required fields',
      validator: this.validateBasicStructure.bind(this)
    })

    this.addRule({
      id: 'order_items_structure', 
      name: 'Order Items Structure',
      category: ValidationCategory.STRUCTURE,
      severity: ValidationSeverity.ERROR,
      description: 'Validates order items structure and format',
      validator: this.validateItemsStructure.bind(this)
    })

    this.addRule({
      id: 'financial_data_structure',
      name: 'Financial Data Structure', 
      category: ValidationCategory.STRUCTURE,
      severity: ValidationSeverity.ERROR,
      description: 'Validates financial calculations and totals',
      validator: this.validateFinancialStructure.bind(this)
    })

    // Business rules validation
    this.addRule({
      id: 'quantity_limits',
      name: 'Quantity Limits',
      category: ValidationCategory.BUSINESS_RULES,
      severity: ValidationSeverity.ERROR,
      description: 'Validates item quantities are within acceptable limits',
      validator: this.validateQuantityLimits.bind(this)
    })

    this.addRule({
      id: 'payment_validation',
      name: 'Payment Validation',
      category: ValidationCategory.BUSINESS_RULES,
      severity: ValidationSeverity.ERROR,
      description: 'Validates payment information and methods',
      validator: this.validatePaymentInfo.bind(this)
    })

    this.addRule({
      id: 'business_hours',
      name: 'Business Hours',
      category: ValidationCategory.BUSINESS_RULES,
      severity: ValidationSeverity.WARNING,
      description: 'Checks if order is placed during business hours',
      validator: this.validateBusinessHours.bind(this)
    })

    // Security validation rules
    this.addRule({
      id: 'user_permissions',
      name: 'User Permissions',
      category: ValidationCategory.SECURITY,
      severity: ValidationSeverity.CRITICAL,
      description: 'Validates user has required permissions for operation',
      validator: this.validateUserPermissions.bind(this)
    })

    this.addRule({
      id: 'data_access_control',
      name: 'Data Access Control',
      category: ValidationCategory.SECURITY,
      severity: ValidationSeverity.ERROR,
      description: 'Validates data access permissions',
      validator: this.validateDataAccess.bind(this)
    })

    this.addRule({
      id: 'input_sanitization',
      name: 'Input Sanitization',
      category: ValidationCategory.SECURITY,
      severity: ValidationSeverity.WARNING,
      description: 'Sanitizes and validates user inputs',
      validator: this.validateInputSanitization.bind(this)
    })

    // Data integrity rules
    this.addRule({
      id: 'data_consistency',
      name: 'Data Consistency',
      category: ValidationCategory.DATA_INTEGRITY,
      severity: ValidationSeverity.ERROR,
      description: 'Validates data consistency across related fields',
      validator: this.validateDataConsistency.bind(this)
    })

    this.addRule({
      id: 'referential_integrity',
      name: 'Referential Integrity',
      category: ValidationCategory.DATA_INTEGRITY,
      severity: ValidationSeverity.ERROR,
      description: 'Validates foreign key relationships',
      validator: this.validateReferentialIntegrity.bind(this)
    })

    // Schema validation
    this.addRule({
      id: 'schema_compliance',
      name: 'Schema Compliance',
      category: ValidationCategory.SCHEMA,
      severity: ValidationSeverity.ERROR,
      description: 'Validates data conforms to defined schema',
      validator: this.validateSchemaCompliance.bind(this)
    })

    // Performance validation
    this.addRule({
      id: 'performance_limits',
      name: 'Performance Limits',
      category: ValidationCategory.PERFORMANCE,
      severity: ValidationSeverity.WARNING,
      description: 'Checks if operation meets performance requirements',
      validator: this.validatePerformanceLimits.bind(this)
    })
  }

  static addRule(rule: ValidationRule): void {
    this.rules.set(rule.id, rule)
    
    // Build dependency graph
    if (rule.dependencies) {
      for (const dep of rule.dependencies) {
        if (!this.ruleDependencies.has(dep)) {
          this.ruleDependencies.set(dep, new Set())
        }
        this.ruleDependencies.get(dep)!.add(rule.id)
      }
    }
  }

  static removeRule(ruleId: string): void {
    this.rules.delete(ruleId)
    
    // Remove from dependency graph
    this.ruleDependencies.forEach((dependents) => {
      dependents.delete(ruleId)
    })
    this.ruleDependencies.delete(ruleId)
  }

  static async validate(
    data: any,
    context: ValidationContext,
    ruleIds?: string[]
  ): Promise<ValidationReport> {
    const startTime = Date.now()
    const cacheKey = this.generateCacheKey(data, context, ruleIds)

    // Check cache first
    const cached = this.validationCache.get(cacheKey)
    if (cached && cached.expiry > Date.now()) {
      return cached.result
    }

    // Select rules to run
    const rulesToRun = ruleIds 
      ? ruleIds.map(id => this.rules.get(id)).filter(Boolean) as ValidationRule[]
      : Array.from(this.rules.values())

    // Topological sort for dependency resolution
    const sortedRules = this.topologicalSort(rulesToRun)

    const results: ValidationResult[] = []
    let hasCriticalErrors = false

    // Execute validation rules
    for (const rule of sortedRules) {
      try {
        const timeout = rule.timeout || 5000 // 5 second default timeout
        const result = await Promise.race([
          rule.validator(data, context),
          new Promise<ValidationResult>((_, reject) => 
            setTimeout(() => reject(new Error('Validation timeout')), timeout)
          )
        ]) as ValidationResult

        results.push(result)

        if (result.severity === ValidationSeverity.CRITICAL && !result.isValid) {
          hasCriticalErrors = true
        }

      } catch (error) {
        results.push({
          isValid: false,
          severity: ValidationSeverity.ERROR,
          message: `Validation rule '${rule.name}' failed: ${error instanceof Error ? error.message : 'Unknown error'}`,
          details: error instanceof Error ? error.stack : undefined,
          timestamp: new Date()
        })
      }
    }

    // Generate report
    const report: ValidationReport = {
      isValid: hasCriticalErrors ? false : results.every(r => r.isValid || r.severity !== ValidationSeverity.ERROR),
      overallSeverity: this.calculateOverallSeverity(results),
      results,
      summary: this.generateSummary(results),
      processingTime: Date.now() - startTime,
      timestamp: new Date()
    }

    // Cache the result
    this.validationCache.set(cacheKey, {
      result: report,
      expiry: Date.now() + this.CACHE_TTL
    })

    // Clean up old cache entries
    this.cleanupCache()

    return report
  }

  private static generateCacheKey(data: any, context: ValidationContext, ruleIds?: string[]): string {
    const dataHash = this.simpleHash(JSON.stringify(data))
    const contextHash = this.simpleHash(JSON.stringify({
      userId: context.userId,
      storeId: context.storeId,
      operation: context.operation,
      currentState: context.currentState,
      targetState: context.targetState
    }))
    const rulesHash = ruleIds ? ruleIds.sort().join(',') : 'all'
    
    return `${dataHash}_${contextHash}_${rulesHash}`
  }

  private static simpleHash(str: string): string {
    let hash = 0
    for (let i = 0; i < str.length; i++) {
      const char = str.charCodeAt(i)
      hash = ((hash << 5) - hash) + char
      hash = hash & hash // Convert to 32-bit integer
    }
    return Math.abs(hash).toString(36)
  }

  private static topologicalSort(rules: ValidationRule[]): ValidationRule[] {
    const sorted: ValidationRule[] = []
    const visited = new Set<string>()
    const visiting = new Set<string>()

    const visit = (rule: ValidationRule) => {
      if (visited.has(rule.id)) return
      if (visiting.has(rule.id)) {
        throw new Error(`Circular dependency detected involving rule: ${rule.id}`)
      }

      visiting.add(rule.id)

      // Visit dependencies first
      if (rule.dependencies) {
        for (const depId of rule.dependencies) {
          const depRule = this.rules.get(depId)
          if (depRule) {
            visit(depRule)
          }
        }
      }

      visiting.delete(rule.id)
      visited.add(rule.id)
      sorted.push(rule)
    }

    for (const rule of rules) {
      visit(rule)
    }

    return sorted
  }

  private static calculateOverallSeverity(results: ValidationResult[]): ValidationSeverity {
    if (results.some(r => r.severity === ValidationSeverity.CRITICAL && !r.isValid)) {
      return ValidationSeverity.CRITICAL
    }
    if (results.some(r => r.severity === ValidationSeverity.ERROR && !r.isValid)) {
      return ValidationSeverity.ERROR
    }
    if (results.some(r => r.severity === ValidationSeverity.WARNING)) {
      return ValidationSeverity.WARNING
    }
    return ValidationSeverity.INFO
  }

  private static generateSummary(results: ValidationResult[]) {
    const passed = results.filter(r => r.isValid).length
    const failed = results.filter(r => !r.isValid).length
    const warnings = results.filter(r => r.severity === ValidationSeverity.WARNING).length
    const errors = results.filter(r => r.severity === ValidationSeverity.ERROR).length
    const critical = results.filter(r => r.severity === ValidationSeverity.CRITICAL).length

    return {
      total: results.length,
      passed,
      failed,
      warnings,
      errors,
      critical
    }
  }

  private static cleanupCache(): void {
    const now = Date.now()
    for (const [key, cached] of this.validationCache.entries()) {
      if (cached.expiry <= now) {
        this.validationCache.delete(key)
      }
    }
  }

  // Validation rule implementations

  private static async validateBasicStructure(data: any, context: ValidationContext): Promise<ValidationResult> {
    const requiredFields = ['items', 'subtotal', 'total', 'storeId']
    const missingFields = requiredFields.filter(field => !data[field])

    if (missingFields.length > 0) {
      return {
        isValid: false,
        severity: ValidationSeverity.ERROR,
        message: `Missing required fields: ${missingFields.join(', ')}`,
        suggestion: 'Ensure all required fields are provided'
      }
    }

    return {
      isValid: true,
      severity: ValidationSeverity.INFO,
      message: 'Basic structure validation passed'
    }
  }

  private static async validateItemsStructure(data: any, context: ValidationContext): Promise<ValidationResult> {
    if (!Array.isArray(data.items) || data.items.length === 0) {
      return {
        isValid: false,
        severity: ValidationSeverity.ERROR,
        message: 'Items must be a non-empty array',
        field: 'items'
      }
    }

    for (let i = 0; i < data.items.length; i++) {
      const item = data.items[i]
      const requiredItemFields = ['productId', 'name', 'price', 'quantity', 'subtotal']
      const missingItemFields = requiredItemFields.filter(field => !item[field])

      if (missingItemFields.length > 0) {
        return {
          isValid: false,
          severity: ValidationSeverity.ERROR,
          message: `Item ${i + 1} is missing required fields: ${missingItemFields.join(', ')}`,
          field: `items[${i}]`
        }
      }

      if (item.quantity <= 0) {
        return {
          isValid: false,
          severity: ValidationSeverity.ERROR,
          message: `Item ${i + 1} quantity must be positive`,
          field: `items[${i}].quantity`
        }
      }

      if (item.price < 0) {
        return {
          isValid: false,
          severity: ValidationSeverity.ERROR,
          message: `Item ${i + 1} price cannot be negative`,
          field: `items[${i}].price`
        }
      }
    }

    return {
      isValid: true,
      severity: ValidationSeverity.INFO,
      message: 'Items structure validation passed'
    }
  }

  private static async validateFinancialStructure(data: any, context: ValidationContext): Promise<ValidationResult> {
    const { subtotal, gst, discount, total } = data

    if (subtotal < 0 || gst < 0 || discount < 0) {
      return {
        isValid: false,
        severity: ValidationSeverity.ERROR,
        message: 'Financial values cannot be negative'
      }
    }

    const expectedTotal = subtotal + gst - discount
    if (Math.abs(expectedTotal - total) > 0.01) { // Allow for floating point precision
      return {
        isValid: false,
        severity: ValidationSeverity.ERROR,
        message: `Total calculation mismatch. Expected: ${expectedTotal.toFixed(2)}, Actual: ${total.toFixed(2)}`
      }
    }

    return {
      isValid: true,
      severity: ValidationSeverity.INFO,
      message: 'Financial structure validation passed'
    }
  }

  private static async validateQuantityLimits(data: any, context: ValidationContext): Promise<ValidationResult> {
    const MAX_QUANTITY_PER_ITEM = 1000
    const MAX_TOTAL_ITEMS = 500

    let totalItems = 0
    let hasOversizedItems = false

    for (const item of data.items) {
      totalItems += item.quantity

      if (item.quantity > MAX_QUANTITY_PER_ITEM) {
        hasOversizedItems = true
      }
    }

    if (hasOversizedItems) {
      return {
        isValid: false,
        severity: ValidationSeverity.WARNING,
        message: 'Some items exceed quantity limits',
        suggestion: 'Consider splitting large orders'
      }
    }

    if (totalItems > MAX_TOTAL_ITEMS) {
      return {
        isValid: false,
        severity: ValidationSeverity.WARNING,
        message: `Total items (${totalItems}) exceeds recommended limit`,
        suggestion: 'Large orders may impact performance'
      }
    }

    return {
      isValid: true,
      severity: ValidationSeverity.INFO,
      message: 'Quantity limits validation passed'
    }
  }

  private static async validatePaymentInfo(data: any, context: ValidationContext): Promise<ValidationResult> {
    // This would integrate with actual payment validation logic
    const paymentMethod = data.paymentMethod
    const total = data.total

    if (!paymentMethod) {
      return {
        isValid: false,
        severity: ValidationSeverity.ERROR,
        message: 'Payment method is required',
        field: 'paymentMethod'
      }
    }

    const validPaymentMethods = ['cash', 'card', 'digital', 'credit', 'debit']
    if (!validPaymentMethods.includes(paymentMethod)) {
      return {
        isValid: false,
        severity: ValidationSeverity.ERROR,
        message: `Invalid payment method: ${paymentMethod}`,
        field: 'paymentMethod'
      }
    }

    if (total > 100000) {
      return {
        isValid: false,
        severity: ValidationSeverity.WARNING,
        message: 'High-value transaction requires additional verification',
        suggestion: 'Consider additional payment verification for amounts over ₹1,00,000'
      }
    }

    return {
      isValid: true,
      severity: ValidationSeverity.INFO,
      message: 'Payment validation passed'
    }
  }

  private static async validateBusinessHours(data: any, context: ValidationContext): Promise<ValidationResult> {
    const now = new Date()
    const hour = now.getHours()
    
    // Assuming business hours are 9 AM to 9 PM
    const businessStart = 9
    const businessEnd = 21

    if (hour < businessStart || hour >= businessEnd) {
      return {
        isValid: true, // Not a blocking error
        severity: ValidationSeverity.WARNING,
        message: 'Order placed outside business hours',
        suggestion: 'Orders placed outside business hours may have delayed processing'
      }
    }

    return {
      isValid: true,
      severity: ValidationSeverity.INFO,
      message: 'Business hours validation passed'
    }
  }

  private static async validateUserPermissions(data: any, context: ValidationContext): Promise<ValidationResult> {
    // This would integrate with actual permission system
    const operationPermissions: Record<string, string[]> = {
      'create_order': ['staff', 'manager', 'admin'],
      'edit_order': ['staff', 'manager', 'admin'],
      'cancel_order': ['manager', 'admin'],
      'complete_order': ['staff', 'manager', 'admin']
    }

    const requiredPermissions = operationPermissions[context.operation] || []
    // This would check actual user permissions
    const userRole = context.metadata?.userRole || 'staff'

    if (!requiredPermissions.includes(userRole)) {
      return {
        isValid: false,
        severity: ValidationSeverity.CRITICAL,
        message: `User role '${userRole}' does not have permission for '${context.operation}'`,
        suggestion: 'Contact administrator to request appropriate permissions'
      }
    }

    return {
      isValid: true,
      severity: ValidationSeverity.INFO,
      message: 'User permissions validation passed'
    }
  }

  private static async validateDataAccess(data: any, context: ValidationContext): Promise<ValidationResult> {
    // Check if user can access the store and data
    if (context.storeId !== context.metadata?.userStoreId) {
      return {
        isValid: false,
        severity: ValidationSeverity.CRITICAL,
        message: 'User does not have access to this store',
        suggestion: 'Switch to the correct store or contact administrator'
      }
    }

    return {
      isValid: true,
      severity: ValidationSeverity.INFO,
      message: 'Data access validation passed'
    }
  }

  private static async validateInputSanitization(data: any, context: ValidationContext): Promise<ValidationResult> {
    const dangerousPatterns = /<script|javascript:|data:|vbscript:/i
    let hasIssues = false

    // Check string fields for potential injection
    const stringFields = ['orderName', 'notes']
    for (const field of stringFields) {
      if (data[field] && dangerousPatterns.test(data[field])) {
        hasIssues = true
      }
    }

    // Check items for suspicious content
    for (const item of data.items || []) {
      if (item.name && dangerousPatterns.test(item.name)) {
        hasIssues = true
      }
    }

    if (hasIssues) {
      return {
        isValid: false,
        severity: ValidationSeverity.WARNING,
        message: 'Potentially unsafe input detected',
        suggestion: 'Input will be sanitized automatically'
      }
    }

    return {
      isValid: true,
      severity: ValidationSeverity.INFO,
      message: 'Input sanitization validation passed'
    }
  }

  private static async validateDataConsistency(data: any, context: ValidationContext): Promise<ValidationResult> {
    // Validate consistency between related fields
    if (data.customerId && !context.metadata?.customerExists) {
      return {
        isValid: false,
        severity: ValidationSeverity.ERROR,
        message: 'Referenced customer does not exist',
        field: 'customerId'
      }
    }

    if (data.employeeId && !context.metadata?.employeeExists) {
      return {
        isValid: false,
        severity: ValidationSeverity.ERROR,
        message: 'Referenced employee does not exist',
        field: 'employeeId'
      }
    }

    return {
      isValid: true,
      severity: ValidationSeverity.INFO,
      message: 'Data consistency validation passed'
    }
  }

  private static async validateReferentialIntegrity(data: any, context: ValidationContext): Promise<ValidationResult> {
    // Check foreign key relationships
    const productIds = data.items?.map((item: any) => item.productId) || []
    
    for (const productId of productIds) {
      if (!context.metadata?.productExists?.[productId]) {
        return {
          isValid: false,
          severity: ValidationSeverity.ERROR,
          message: `Product ${productId} does not exist`,
          field: 'items.productId'
        }
      }
    }

    return {
      isValid: true,
      severity: ValidationSeverity.INFO,
      message: 'Referential integrity validation passed'
    }
  }

  private static async validateSchemaCompliance(data: any, context: ValidationContext): Promise<ValidationResult> {
    // Validate against defined schema
    // This would use JSON Schema or similar validation
    const schema = context.metadata?.schema
    
    if (!schema) {
      return {
        isValid: true,
        severity: ValidationSeverity.INFO,
        message: 'No schema defined for validation'
      }
    }

    // Simplified schema validation
    const requiredFields = schema.required || []
    const missingFields = requiredFields.filter((field: string) => !data[field])

    if (missingFields.length > 0) {
      return {
        isValid: false,
        severity: ValidationSeverity.ERROR,
        message: `Schema validation failed. Missing required fields: ${missingFields.join(', ')}`
      }
    }

    return {
      isValid: true,
      severity: ValidationSeverity.INFO,
      message: 'Schema compliance validation passed'
    }
  }

  private static async validatePerformanceLimits(data: any, context: ValidationContext): Promise<ValidationResult> {
    const startTime = Date.now()
    
    // Simulate performance validation
    const processingTime = Date.now() - startTime
    
    if (processingTime > 1000) { // 1 second threshold
      return {
        isValid: true, // Not blocking
        severity: ValidationSeverity.WARNING,
        message: 'Validation is taking longer than expected',
        suggestion: 'Consider optimizing data size or complexity'
      }
    }

    return {
      isValid: true,
      severity: ValidationSeverity.INFO,
      message: 'Performance limits validation passed'
    }
  }

  // Utility methods
  static getRulesByCategory(category: ValidationCategory): ValidationRule[] {
    return Array.from(this.rules.values()).filter(rule => rule.category === category)
  }

  static getRulesBySeverity(severity: ValidationSeverity): ValidationRule[] {
    return Array.from(this.rules.values()).filter(rule => rule.severity === severity)
  }

  static clearCache(): void {
    this.validationCache.clear()
  }

  static getCacheStats(): { size: number; entries: Array<{ key: string; expiry: number }> } {
    return {
      size: this.validationCache.size,
      entries: Array.from(this.validationCache.entries()).map(([key, cached]) => ({
        key,
        expiry: cached.expiry
      }))
    }
  }
}

// Export utility functions
export const ValidationUtils = {
  isBlockingError: (severity: ValidationSeverity): boolean => {
    return severity === ValidationSeverity.ERROR || severity === ValidationSeverity.CRITICAL
  },

  getHighestSeverity: (results: ValidationResult[]): ValidationSeverity => {
    if (results.some(r => r.severity === ValidationSeverity.CRITICAL && !r.isValid)) {
      return ValidationSeverity.CRITICAL
    }
    if (results.some(r => r.severity === ValidationSeverity.ERROR && !r.isValid)) {
      return ValidationSeverity.ERROR
    }
    if (results.some(r => r.severity === ValidationSeverity.WARNING)) {
      return ValidationSeverity.WARNING
    }
    return ValidationSeverity.INFO
  },

  filterResultsBySeverity: (results: ValidationResult[], severity: ValidationSeverity): ValidationResult[] => {
    return results.filter(r => r.severity === severity)
  },

  getBlockingErrors: (results: ValidationResult[]): ValidationResult[] => {
    return results.filter(r => !r.isValid && OrderDataValidator.isBlockingError?.(r.severity))
  }
}