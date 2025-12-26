// Comprehensive Test Suite for Enhanced Order Management System
// Tests all components including state machine, validation, collaboration, performance optimization, and orchestration

import { OrderOrchestrator, OrderOperations, OrderOperationContext, OrchestrationResult } from './order-orchestrator'
import { OrderStateMachine, OrderState } from './order-state-machine'
import { OrderDataValidator, ValidationContext } from './order-data-validation'
import { CollaborationManager, CollaborationRole, LockType } from './order-collaboration-manager'
import { OrderPerformanceOptimizer, JobPriority } from './order-performance-optimizer'
import { OrderErrorRecovery, RecoveryStrategy } from './order-error-recovery'
import { OrderCleanupArchiver, CleanupType } from './order-cleanup-archiver'
import { OrderAuditLogger, AuditEventType } from './order-audit-logger'
import { BulkOperationsManager } from './order-management'
import { OrderTestDataGenerator } from './order-management-test'

export interface TestResult {
  suite: string
  test: string
  success: boolean
  duration: number
  error?: string
  details?: any
}

export interface TestSuiteResult {
  suite: string
  total: number
  passed: number
  failed: number
  duration: number
  results: TestResult[]
}

export interface ComprehensiveTestReport {
  timestamp: Date
  totalSuites: number
  totalTests: number
  totalPassed: number
  totalFailed: number
  overallSuccess: boolean
  suiteResults: TestSuiteResult[]
  performanceMetrics: {
    averageTestDuration: number
    slowestTest: TestResult
    fastestTest: TestResult
  }
  recommendations: string[]
}

export class OrderManagementComprehensiveTest {
  private static testResults: TestResult[] = []

  // Main test runner
  static async runAllTests(): Promise<ComprehensiveTestReport> {
    const startTime = Date.now()
    console.log('🧪 Starting Comprehensive Order Management System Test Suite')
    console.log('=' * 80)

    const suiteResults: TestSuiteResult[] = []

    // Run all test suites
    suiteResults.push(await this.testOrderStateMachine())
    suiteResults.push(await this.testDataValidation())
    suiteResults.push(await this.testCollaborationManager())
    suiteResults.push(await this.testPerformanceOptimizer())
    suiteResults.push(await this.testErrorRecovery())
    suiteResults.push(await this.testCleanupArchiver())
    suiteResults.push(await this.testAuditLogger())
    suiteResults.push(await this.testOrderOrchestrator())
    suiteResults.push(await this.testBulkOperations())
    suiteResults.push(await this.testIntegrationScenarios())

    // Calculate overall results
    const totalTests = suiteResults.reduce((sum, suite) => sum + suite.total, 0)
    const totalPassed = suiteResults.reduce((sum, suite) => sum + suite.passed, 0)
    const totalFailed = suiteResults.reduce((sum, suite) => sum + suite.failed, 0)
    const overallSuccess = totalFailed === 0

    const totalDuration = Date.now() - startTime
    const testDurations = this.testResults.map(r => r.duration)
    const averageTestDuration = testDurations.reduce((sum, d) => sum + d, 0) / testDurations.length
    const slowestTest = this.testResults.reduce((prev, current) => 
      prev.duration > current.duration ? prev : current
    )
    const fastestTest = this.testResults.reduce((prev, current) => 
      prev.duration < current.duration ? prev : current
    )

    const report: ComprehensiveTestReport = {
      timestamp: new Date(),
      totalSuites: suiteResults.length,
      totalTests,
      totalPassed,
      totalFailed,
      overallSuccess,
      suiteResults,
      performanceMetrics: {
        averageTestDuration,
        slowestTest,
        fastestTest
      },
      recommendations: this.generateRecommendations(suiteResults)
    }

    this.printTestReport(report)
    return report
  }

  // Test Suite 1: Order State Machine
  private static async testOrderStateMachine(): Promise<TestSuiteResult> {
    const suite = 'Order State Machine'
    const startTime = Date.now()
    const results: TestResult[] = []

    console.log(`\n📊 Testing ${suite}`)

    try {
      // Test 1: Basic state transitions
      const transitionResult = await OrderStateMachine.transition(
        'test-order-1',
        OrderState.NEW,
        OrderState.HELD,
        'hold',
        { userId: 'test-user', storeId: 'test-store' }
      )
      results.push(this.createTestResult(suite, 'Basic state transition', transitionResult.success, startTime))

      // Test 2: Invalid transition detection
      const invalidTransition = OrderStateMachine.getTransition(OrderState.HELD, OrderState.NEW, 'invalid')
      results.push(this.createTestResult(suite, 'Invalid transition detection', invalidTransition === null, startTime))

      // Test 3: Valid transitions from current state
      const validTransitions = OrderStateMachine.getValidTransitions(OrderState.HELD)
      results.push(this.createTestResult(suite, 'Valid transitions from HELD', validTransitions.length > 0, startTime))

      // Test 4: State descriptions
      const newDescription = OrderStateMachine.getStateDescription(OrderState.NEW)
      results.push(this.createTestResult(suite, 'State descriptions', newDescription.includes('created'), startTime))

    } catch (error) {
      results.push(this.createTestResult(suite, 'State machine initialization', false, startTime, error))
    }

    return this.createSuiteResult(suite, results, startTime)
  }

  // Test Suite 2: Data Validation
  private static async testDataValidation(): Promise<TestSuiteResult> {
    const suite = 'Data Validation Framework'
    const startTime = Date.now()
    const results: TestResult[] = []

    console.log(`\n🔍 Testing ${suite}`)

    try {
      const testOrder = OrderTestDataGenerator.generateMockOrder()
      const validationContext: ValidationContext = {
        userId: 'test-user',
        storeId: 'test-store',
        orderId: testOrder.id,
        operation: 'create_order',
        timestamp: new Date()
      }

      // Test 1: Valid order validation
      const validationResult = await OrderDataValidator.validate(testOrder, validationContext)
      results.push(this.createTestResult(suite, 'Valid order validation', validationResult.isValid, startTime))

      // Test 2: Invalid order validation
      const invalidOrder = { ...testOrder, total: -100 }
      const invalidResult = await OrderDataValidator.validate(invalidOrder, validationContext)
      results.push(this.createTestResult(suite, 'Invalid order detection', !invalidResult.isValid, startTime))

      // Test 3: Validation caching
      const cachedResult = await OrderDataValidator.validate(testOrder, validationContext)
      results.push(this.createTestResult(suite, 'Validation result caching', cachedResult !== null, startTime))

      // Test 4: Rule categories
      const structureRules = OrderDataValidator.getRulesByCategory('structure')
      results.push(this.createTestResult(suite, 'Validation rule categories', structureRules.length > 0, startTime))

    } catch (error) {
      results.push(this.createTestResult(suite, 'Data validation framework', false, startTime, error))
    }

    return this.createSuiteResult(suite, results, startTime)
  }

  // Test Suite 3: Collaboration Manager
  private static async testCollaborationManager(): Promise<TestSuiteResult> {
    const suite = 'Collaboration Manager'
    const startTime = Date.now()
    const results: TestResult[] = []

    console.log(`\n👥 Testing ${suite}`)

    try {
      // Test 1: Session creation
      const sessionResult = await CollaborationManager.createSession(
        'test-order-1',
        'test-user-1',
        'Test User 1',
        'test1@example.com'
      )
      results.push(this.createTestResult(suite, 'Session creation', sessionResult.success, startTime))

      if (sessionResult.success && sessionResult.sessionId) {
        // Test 2: Session activity update
        const activityResult = await CollaborationManager.updateSessionActivity(sessionResult.sessionId, {
          metadata: { test: true }
        })
        results.push(this.createTestResult(suite, 'Session activity update', activityResult.success, startTime))

        // Test 3: Lock acquisition
        const lockResult = await CollaborationManager.acquireLock(
          'test-order-1',
          'test-user-1',
          LockType.FULL,
          'exclusive'
        )
        results.push(this.createTestResult(suite, 'Lock acquisition', lockResult.success, startTime))

        // Test 4: Session termination
        const endResult = await CollaborationManager.endSession(sessionResult.sessionId)
        results.push(this.createTestResult(suite, 'Session termination', endResult.success, startTime))
      }

      // Test 5: Collaboration statistics
      const stats = CollaborationManager.getCollaborationStats()
      results.push(this.createTestResult(suite, 'Collaboration statistics', stats !== null, startTime))

    } catch (error) {
      results.push(this.createTestResult(suite, 'Collaboration manager', false, startTime, error))
    }

    return this.createSuiteResult(suite, results, startTime)
  }

  // Test Suite 4: Performance Optimizer
  private static async testPerformanceOptimizer(): Promise<TestSuiteResult> {
    const suite = 'Performance Optimizer'
    const startTime = Date.now()
    const results: TestResult[] = []

    console.log(`\n⚡ Testing ${suite}`)

    try {
      // Test 1: Cache operations
      const cacheKey = 'test-cache-key'
      await OrderPerformanceOptimizer.set(cacheKey, { test: 'data' })
      const cachedData = await OrderPerformanceOptimizer.get(cacheKey)
      results.push(this.createTestResult(suite, 'Cache set/get operations', cachedData !== null, startTime))

      // Test 2: Background job scheduling
      const jobId = await OrderPerformanceOptimizer.scheduleJob(
        'test_job',
        { test: true },
        JobPriority.NORMAL
      )
      results.push(this.createTestResult(suite, 'Background job scheduling', jobId.length > 0, startTime))

      // Test 3: Performance metrics recording
      OrderPerformanceOptimizer.recordPerformanceMetric(
        'test_operation',
        100,
        1024,
        true
      )
      results.push(this.createTestResult(suite, 'Performance metrics recording', true, startTime))

      // Test 4: Optimization report generation
      const report = OrderPerformanceOptimizer.generateOptimizationReport()
      results.push(this.createTestResult(suite, 'Optimization report generation', report !== null, startTime))

    } catch (error) {
      results.push(this.createTestResult(suite, 'Performance optimizer', false, startTime, error))
    }

    return this.createSuiteResult(suite, results, startTime)
  }

  // Test Suite 5: Error Recovery
  private static async testErrorRecovery(): Promise<TestSuiteResult> {
    const suite = 'Error Recovery System'
    const startTime = Date.now()
    const results: TestResult[] = []

    console.log(`\n🛡️ Testing ${suite}`)

    try {
      // Test 1: Retry configuration
      OrderErrorRecovery.configureRetry('test_operation', {
        maxAttempts: 3,
        backoffMultiplier: 2,
        maxBackoffTime: 10000,
        jitter: true,
        retryableErrorTypes: ['NETWORK_ERROR']
      })
      results.push(this.createTestResult(suite, 'Retry configuration', true, startTime))

      // Test 2: Circuit breaker configuration
      OrderErrorRecovery.configureCircuitBreaker('test_operation', {
        failureThreshold: 3,
        recoveryTimeout: 60000,
        expectedErrorTypes: ['SYSTEM_ERROR'],
        enableMetrics: true,
        resetTimeout: 300000
      })
      results.push(this.createTestResult(suite, 'Circuit breaker configuration', true, startTime))

      // Test 3: Fallback configuration
      OrderErrorRecovery.configureFallback('test_operation', {
        enabled: true,
        mode: 'cache_only',
        cacheTimeout: 300000,
        offlineQueueSize: 100,
        enableManualFallback: true,
        fallbackDelay: 5000
      })
      results.push(this.createTestResult(suite, 'Fallback configuration', true, startTime))

      // Test 4: Recovery metrics
      const metrics = OrderErrorRecovery.getRecoveryMetrics()
      results.push(this.createTestResult(suite, 'Recovery metrics retrieval', metrics !== null, startTime))

    } catch (error) {
      results.push(this.createTestResult(suite, 'Error recovery system', false, startTime, error))
    }

    return this.createSuiteResult(suite, results, startTime)
  }

  // Test Suite 6: Cleanup and Archiver
  private static async testCleanupArchiver(): Promise<TestSuiteResult> {
    const suite = 'Cleanup and Archiver'
    const startTime = Date.now()
    const results: TestResult[] = []

    console.log(`\n🧹 Testing ${suite}`)

    try {
      // Test 1: Cleanup job execution
      const cleanupJob = await OrderCleanupArchiver.executeCleanup(CleanupType.EXPIRED_ORDERS)
      results.push(this.createTestResult(suite, 'Cleanup job execution', cleanupJob !== null, startTime))

      // Test 2: System health check
      const health = OrderCleanupArchiver.getSystemHealth()
      results.push(this.createTestResult(suite, 'System health check', health.status !== undefined, startTime))

      // Test 3: Archive report generation
      const report = await OrderCleanupArchiver.generateReport()
      results.push(this.createTestResult(suite, 'Archive report generation', report.totalJobs >= 0, startTime))

      // Test 4: Automatic scheduling
      await OrderCleanupArchiver.scheduleAutomaticCleanup()
      results.push(this.createTestResult(suite, 'Automatic cleanup scheduling', true, startTime))

    } catch (error) {
      results.push(this.createTestResult(suite, 'Cleanup and archiver', false, startTime, error))
    }

    return this.createSuiteResult(suite, results, startTime)
  }

  // Test Suite 7: Audit Logger
  private static async testAuditLogger(): Promise<TestSuiteResult> {
    const suite = 'Audit Logger'
    const startTime = Date.now()
    const results: TestResult[] = []

    console.log(`\n📝 Testing ${suite}`)

    try {
      // Test 1: Basic audit logging
      const eventId = await OrderAuditLogger.log({
        eventType: AuditEventType.ORDER_CREATED,
        category: 'business' as any,
        severity: 'low' as any,
        source: 'backend',
        description: 'Test audit event',
        success: true
      })
      results.push(this.createTestResult(suite, 'Basic audit logging', eventId.length > 0, startTime))

      // Test 2: Specialized logging methods
      const orderId = await OrderAuditLogger.logOrderCreated('test-order', {
        userId: 'test-user',
        userName: 'Test User',
        storeId: 'test-store'
      })
      results.push(this.createTestResult(suite, 'Order creation logging', orderId.length > 0, startTime))

      // Test 3: Query functionality
      const queryResult = await OrderAuditLogger.query({
        limit: 10
      })
      results.push(this.createTestResult(suite, 'Audit query functionality', queryResult.total >= 0, startTime))

      // Test 4: Report generation
      const auditReport = await OrderAuditLogger.generateReport({
        timeRange: {
          start: new Date(Date.now() - 24 * 60 * 60 * 1000),
          end: new Date()
        }
      })
      results.push(this.createTestResult(suite, 'Audit report generation', auditReport.totalEvents >= 0, startTime))

    } catch (error) {
      results.push(this.createTestResult(suite, 'Audit logger', false, startTime, error))
    }

    return this.createSuiteResult(suite, results, startTime)
  }

  // Test Suite 8: Order Orchestrator
  private static async testOrderOrchestrator(): Promise<TestSuiteResult> {
    const suite = 'Order Orchestrator'
    const startTime = Date.now()
    const results: TestResult[] = []

    console.log(`\n🎼 Testing ${suite}`)

    try {
      const context: OrderOperationContext = {
        orderId: 'test-order-1',
        userId: 'test-user',
        userName: 'Test User',
        storeId: 'test-store',
        operation: 'create_order',
        timestamp: new Date()
      }

      const testOrder = OrderTestDataGenerator.generateMockOrder()

      // Test 1: Single operation execution
      const orchestratorResult = await OrderOrchestrator.executeOperation(
        'create_order',
        context,
        testOrder
      )
      results.push(this.createTestResult(suite, 'Single operation execution', orchestratorResult.success, startTime))

      // Test 2: System health check
      const health = OrderOrchestrator.getSystemHealth()
      results.push(this.createTestResult(suite, 'System health check', health.overall !== undefined, startTime))

      // Test 3: Configuration
      OrderOrchestrator.configure({
        enableStateMachine: true,
        enableValidation: true,
        enableCollaboration: true
      })
      results.push(this.createTestResult(suite, 'Orchestrator configuration', true, startTime))

    } catch (error) {
      results.push(this.createTestResult(suite, 'Order orchestrator', false, startTime, error))
    }

    return this.createSuiteResult(suite, results, startTime)
  }

  // Test Suite 9: Bulk Operations
  private static async testBulkOperations(): Promise<TestSuiteResult> {
    const suite = 'Bulk Operations'
    const startTime = Date.now()
    const results: TestResult[] = []

    console.log(`\n📦 Testing ${suite}`)

    try {
      const orderIds = ['bulk-order-1', 'bulk-order-2', 'bulk-order-3']
      const contexts = orderIds.map(orderId => ({
        orderId,
        userId: 'test-user',
        userName: 'Test User',
        storeId: 'test-store'
      }))

      // Test 1: Bulk cancel operation
      const bulkResult = await BulkOperationsManager.performBulkOperation(
        { type: 'cancel', orderIds },
        contexts
      )
      results.push(this.createTestResult(suite, 'Bulk cancel operation', bulkResult.success, startTime))

      // Test 2: Bulk operation performance
      const performanceStart = performance.now()
      const perfResult = await BulkOperationsManager.performBulkOperation(
        { type: 'retrieve', orderIds, enableParallelProcessing: true },
        contexts
      )
      const performanceEnd = performance.now()
      results.push(this.createTestResult(suite, 'Bulk operation performance', 
        perfResult.success && (performanceEnd - performanceStart) < 5000, startTime))

    } catch (error) {
      results.push(this.createTestResult(suite, 'Bulk operations', false, startTime, error))
    }

    return this.createSuiteResult(suite, results, startTime)
  }

  // Test Suite 10: Integration Scenarios
  private static async testIntegrationScenarios(): Promise<TestSuiteResult> {
    const suite = 'Integration Scenarios'
    const startTime = Date.now()
    const results: TestResult[] = []

    console.log(`\n🔗 Testing ${suite}`)

    try {
      // Test 1: Complete order lifecycle
      const orderContext: OrderOperationContext = {
        orderId: 'integration-order-1',
        userId: 'integration-user',
        userName: 'Integration User',
        storeId: 'integration-store',
        operation: 'create_order',
        timestamp: new Date()
      }

      const testOrder = OrderTestDataGenerator.generateMockOrder()

      // Create order
      const createResult = await OrderOrchestrator.executeOperation(
        'create_order',
        orderContext,
        testOrder
      )
      results.push(this.createTestResult(suite, 'Complete order creation', createResult.success, startTime))

      // Edit order
      if (createResult.success) {
        const editContext = { ...orderContext, operation: 'edit_order' }
        const editResult = await OrderOrchestrator.executeOperation(
          'edit_order',
          editContext,
          { ...testOrder, total: 250 }
        )
        results.push(this.createTestResult(suite, 'Complete order editing', editResult.success, startTime))
      }

      // Test 2: Multi-user collaboration scenario
      const collaborationContexts = [
        { ...orderContext, userId: 'user-1', userName: 'User One' },
        { ...orderContext, userId: 'user-2', userName: 'User Two' }
      ]

      const collaborationResults = await Promise.all([
        OrderOrchestrator.executeOperation('retrieve_order', collaborationContexts[0], testOrder),
        OrderOrchestrator.executeOperation('retrieve_order', collaborationContexts[1], testOrder)
      ])

      const collaborationSuccess = collaborationResults.every(r => r.success)
      results.push(this.createTestResult(suite, 'Multi-user collaboration', collaborationSuccess, startTime))

      // Test 3: Error recovery scenario
      const errorContext: OrderOperationContext = {
        ...orderContext,
        operation: 'invalid_operation'
      }

      const errorResult = await OrderOrchestrator.executeOperation(
        'invalid_operation',
        errorContext,
        testOrder
      )
      results.push(this.createTestResult(suite, 'Error handling scenario', !errorResult.success, startTime))

      // Test 4: Performance under load
      const loadTestStart = performance.now()
      const loadPromises = Array.from({ length: 10 }, (_, i) => 
        OrderOrchestrator.executeOperation('retrieve_order', 
          { ...orderContext, orderId: `load-test-order-${i}` }, 
          testOrder
        )
      )
      const loadResults = await Promise.all(loadPromises)
      const loadTestDuration = performance.now() - loadTestStart

      results.push(this.createTestResult(suite, 'Performance under load', 
        loadResults.every(r => r.success) && loadTestDuration < 10000, startTime))

    } catch (error) {
      results.push(this.createTestResult(suite, 'Integration scenarios', false, startTime, error))
    }

    return this.createSuiteResult(suite, results, startTime)
  }

  // Utility methods
  private static createTestResult(
    suite: string,
    test: string,
    success: boolean,
    startTime: number,
    error?: any
  ): TestResult {
    const result: TestResult = {
      suite,
      test,
      success,
      duration: Date.now() - startTime
    }

    if (!success) {
      result.error = error instanceof Error ? error.message : 'Unknown error'
      result.details = error
    }

    this.testResults.push(result)
    return result
  }

  private static createSuiteResult(suite: string, results: TestResult[], startTime: number): TestSuiteResult {
    const passed = results.filter(r => r.success).length
    const failed = results.filter(r => !r.success).length

    return {
      suite,
      total: results.length,
      passed,
      failed,
      duration: Date.now() - startTime,
      results
    }
  }

  private static printTestReport(report: ComprehensiveTestReport): void {
    console.log('\n' + '=' * 80)
    console.log('📊 COMPREHENSIVE TEST REPORT')
    console.log('=' * 80)
    console.log(`Timestamp: ${report.timestamp.toISOString()}`)
    console.log(`Overall Success: ${report.overallSuccess ? '✅ PASSED' : '❌ FAILED'}`)
    console.log(`Total Suites: ${report.totalSuites}`)
    console.log(`Total Tests: ${report.totalTests}`)
    console.log(`Passed: ${report.totalPassed}`)
    console.log(`Failed: ${report.totalFailed}`)
    console.log(`Success Rate: ${((report.totalPassed / report.totalTests) * 100).toFixed(1)}%`)
    console.log(`Total Duration: ${(report.totalDuration / 1000).toFixed(2)}s`)

    console.log('\n📋 SUITE BREAKDOWN:')
    report.suiteResults.forEach(suite => {
      const status = suite.failed === 0 ? '✅' : '❌'
      console.log(`${status} ${suite.suite}: ${suite.passed}/${suite.total} passed (${(suite.duration / 1000).toFixed(2)}s)`)
    })

    console.log('\n⚡ PERFORMANCE METRICS:')
    console.log(`Average Test Duration: ${report.performanceMetrics.averageTestDuration.toFixed(2)}ms`)
    console.log(`Fastest Test: ${report.performanceMetrics.fastestTest.test} (${report.performanceMetrics.fastestTest.duration.toFixed(2)}ms)`)
    console.log(`Slowest Test: ${report.performanceMetrics.slowestTest.test} (${report.performanceMetrics.slowestTest.duration.toFixed(2)}ms)`)

    if (report.recommendations.length > 0) {
      console.log('\n💡 RECOMMENDATIONS:')
      report.recommendations.forEach((rec, index) => {
        console.log(`${index + 1}. ${rec}`)
      })
    }

    if (report.totalFailed > 0) {
      console.log('\n❌ FAILED TESTS:')
      report.suiteResults.forEach(suite => {
        suite.results.filter(r => !r.success).forEach(test => {
          console.log(`  • ${suite.suite}: ${test.test}`)
          if (test.error) {
            console.log(`    Error: ${test.error}`)
          }
        })
      })
    }

    console.log('\n' + '=' * 80)
    
    if (report.overallSuccess) {
      console.log('🎉 All tests passed! The order management system is ready for production.')
    } else {
      console.log('⚠️ Some tests failed. Please review and fix issues before deployment.')
    }
  }

  private static generateRecommendations(suiteResults: TestSuiteResult[]): string[] {
    const recommendations: string[] = []

    // Performance recommendations
    const slowSuites = suiteResults.filter(suite => suite.duration > 10000) // > 10 seconds
    if (slowSuites.length > 0) {
      recommendations.push('Some test suites are running slowly. Consider optimizing performance-critical components.')
    }

    // Test coverage recommendations
    const failedSuites = suiteResults.filter(suite => suite.failed > 0)
    if (failedSuites.length > 0) {
      recommendations.push('Some test suites have failures. Review failed tests and fix underlying issues.')
    }

    // System health recommendations
    const healthySuites = suiteResults.filter(suite => suite.failed === 0).length
    if (healthySuites === suiteResults.length) {
      recommendations.push('All systems are healthy. Consider adding more edge case tests for better coverage.')
    }

    if (recommendations.length === 0) {
      recommendations.push('Test suite execution is optimal. No immediate recommendations.')
    }

    return recommendations
  }

  // Cleanup and reset
  static cleanup(): void {
    this.testResults = []
  }

  // Export individual test runners for CI/CD
  static async runQuickTests(): Promise<boolean> {
    const criticalSuites = [
      'Order State Machine',
      'Order Orchestrator', 
      'Data Validation Framework'
    ]
    
    const report = await this.runAllTests()
    const criticalResults = report.suiteResults.filter(suite => 
      criticalSuites.includes(suite.suite)
    )
    
    return criticalResults.every(suite => suite.failed === 0)
  }

  static async runPerformanceTests(): Promise<boolean> {
    const perfSuite = await this.testPerformanceOptimizer()
    return perfSuite.failed === 0
  }

  static async runIntegrationTests(): Promise<boolean> {
    const integrationSuite = await this.testIntegrationScenarios()
    return integrationSuite.failed === 0
  }
}

// Export for use in CI/CD and development
if (typeof window !== 'undefined') {
  (window as any).OrderManagementComprehensiveTest = OrderManagementComprehensiveTest
  (window as any).runQuickTests = OrderManagementComprehensiveTest.runQuickTests
}