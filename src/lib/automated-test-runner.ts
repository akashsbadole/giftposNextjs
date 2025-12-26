// Automated Test Runners and CI/CD Integration
// Production-ready test execution automation for different scenarios

import { ComprehensiveTestingFramework } from './comprehensive-testing-framework'
import { TestDataManager, TestDataScenarios } from './test-data-manager'
import TestingTroubleshootingGuide from './testing-troubleshooting-guide'
import { TestExecutionResult, TestCategory } from './comprehensive-testing-framework'

// Test Execution Configuration
export interface TestRunnerConfig {
  environment: 'development' | 'staging' | 'production' | 'ci'
  testSuites: string[]
  parallelExecution: boolean
  retryAttempts: number
  timeoutMinutes: number
  generateReport: boolean
  uploadResults: boolean
  slackNotifications: boolean
  emailNotifications: boolean
  performanceThresholds: PerformanceThresholds
  coverageThresholds: CoverageThresholds
}

export interface PerformanceThresholds {
  maxTestDuration: number // milliseconds
  maxMemoryUsage: number // MB
  maxDatabaseQueries: number
  maxNetworkRequests: number
}

export interface CoverageThresholds {
  lineCoverage: number // percentage
  branchCoverage: number // percentage
  functionCoverage: number // percentage
  statementCoverage: number // percentage
}

// Test Runner Types
export enum TestRunnerType {
  QUICK_SMOKE = 'quick_smoke',
  UNIT_TESTS = 'unit_tests',
  INTEGRATION_TESTS = 'integration_tests',
  E2E_TESTS = 'end_to_end_tests',
  PERFORMANCE_TESTS = 'performance_tests',
  STRESS_TESTS = 'stress_tests',
  SECURITY_TESTS = 'security_tests',
  ACCESSIBILITY_TESTS = 'accessibility_tests',
  FULL_SUITE = 'full_suite',
  PRE_DEPLOYMENT = 'pre_deployment',
  POST_DEPLOYMENT = 'post_deployment'
}

// Test Runner Result
export interface TestRunnerResult {
  type: TestRunnerType
  success: boolean
  duration: number
  totalTests: number
  passedTests: number
  failedTests: number
  skippedTests: number
  coverage?: CoverageReport
  performance?: PerformanceReport
  issues: TestIssueSummary[]
  recommendations: string[]
  nextSteps: string[]
}

export interface CoverageReport {
  line: number
  branch: number
  function: number
  statement: number
  uncoveredLines: string[]
  uncoveredBranches: string[]
}

export interface PerformanceReport {
  averageTestDuration: number
  slowestTests: { testName: string; duration: number }[]
  memoryUsage: {
    average: number
    peak: number
    trend: 'increasing' | 'decreasing' | 'stable'
  }
  databasePerformance: {
    averageQueryTime: number
    slowQueries: string[]
  }
}

export interface TestIssueSummary {
  category: string
  count: number
  severity: 'low' | 'medium' | 'high' | 'critical'
  examples: string[]
}

// Automated Test Runner
export class AutomatedTestRunner {
  private static config: TestRunnerConfig = {
    environment: 'development',
    testSuites: [],
    parallelExecution: true,
    retryAttempts: 2,
    timeoutMinutes: 30,
    generateReport: true,
    uploadResults: false,
    slackNotifications: false,
    emailNotifications: false,
    performanceThresholds: {
      maxTestDuration: 30000,
      maxMemoryUsage: 512,
      maxDatabaseQueries: 1000,
      maxNetworkRequests: 500
    },
    coverageThresholds: {
      lineCoverage: 80,
      branchCoverage: 75,
      functionCoverage: 85,
      statementCoverage: 80
    }
  }

  static configure(config: Partial<TestRunnerConfig>): void {
    this.config = { ...this.config, ...config }
  }

  // ========================================
  // QUICK TEST RUNNERS
  // ========================================

  static async runQuickSmokeTest(): Promise<TestRunnerResult> {
    console.log('🚀 Running Quick Smoke Test...')
    const startTime = Date.now()

    try {
      await TestDataManager.generateTestData({
        storeCount: 1,
        userCount: 5,
        productCount: 10,
        customerCount: 5,
        orderCount: 10,
        enableRelationships: true,
        generateHistoricalData: false
      })

      const results = await ComprehensiveTestingFramework.runAllTestSuites({
        suites: ['unit'],
        parallel: true
      })

      const success = results.failed === 0
      const issues = this.analyzeTestIssues(results.results)

      return {
        type: TestRunnerType.QUICK_SMOKE,
        success,
        duration: Date.now() - startTime,
        totalTests: results.total,
        passedTests: results.passed,
        failedTests: results.failed,
        skippedTests: 0,
        issues,
        recommendations: success ? [] : ['Fix failing unit tests before proceeding'],
        nextSteps: success ? ['Run integration tests', 'Proceed with deployment'] : ['Debug and fix failing tests']
      }
    } catch (error) {
      console.error('Quick smoke test failed:', error)
      return {
        type: TestRunnerType.QUICK_SMOKE,
        success: false,
        duration: Date.now() - startTime,
        totalTests: 0,
        passedTests: 0,
        failedTests: 0,
        skippedTests: 0,
        issues: [{
          category: 'execution',
          count: 1,
          severity: 'critical',
          examples: [error instanceof Error ? error.message : 'Unknown error']
        }],
        recommendations: ['Check test environment setup', 'Verify dependencies'],
        nextSteps: ['Fix environment issues', 'Retry smoke test']
      }
    } finally {
      await TestDataManager.clearAllData()
    }
  }

  static async runUnitTests(): Promise<TestRunnerResult> {
    console.log('🧪 Running Unit Tests...')
    const startTime = Date.now()

    try {
      await TestDataManager.generateTestData({
        storeCount: 2,
        userCount: 10,
        productCount: 20,
        customerCount: 15,
        orderCount: 30,
        enableRelationships: true,
        generateHistoricalData: false
      })

      const results = await ComprehensiveTestingFramework.runAllTestSuites({
        suites: ['unit', 'business_logic'],
        parallel: true
      })

      const success = results.failed === 0
      const issues = this.analyzeTestIssues(results.results)

      return {
        type: TestRunnerType.UNIT_TESTS,
        success,
        duration: Date.now() - startTime,
        totalTests: results.total,
        passedTests: results.passed,
        failedTests: results.failed,
        skippedTests: 0,
        coverage: await this.calculateCoverage(results.results),
        issues,
        recommendations: this.generateRecommendations(results),
        nextSteps: success ? ['Run integration tests', 'Code coverage analysis'] : ['Fix failing unit tests', 'Review test coverage']
      }
    } catch (error) {
      console.error('Unit tests failed:', error)
      return {
        type: TestRunnerType.UNIT_TESTS,
        success: false,
        duration: Date.now() - startTime,
        totalTests: 0,
        passedTests: 0,
        failedTests: 0,
        skippedTests: 0,
        issues: [{
          category: 'execution',
          count: 1,
          severity: 'critical',
          examples: [error instanceof Error ? error.message : 'Unknown error']
        }],
        recommendations: ['Check unit test environment', 'Verify test dependencies'],
        nextSteps: ['Fix environment issues', 'Retry unit tests']
      }
    } finally {
      await TestDataManager.clearAllData()
    }
  }

  static async runIntegrationTests(): Promise<TestRunnerResult> {
    console.log('🔗 Running Integration Tests...')
    const startTime = Date.now()

    try {
      await TestDataManager.generateTestData({
        storeCount: 3,
        userCount: 15,
        productCount: 50,
        customerCount: 25,
        orderCount: 100,
        enableRelationships: true,
        generateHistoricalData: true,
        historicalDays: 7
      })

      const results = await ComprehensiveTestingFramework.runAllTestSuites({
        suites: ['integration', 'edge_case'],
        parallel: false
      })

      const success = results.failed === 0
      const issues = this.analyzeTestIssues(results.results)

      return {
        type: TestRunnerType.INTEGRATION_TESTS,
        success,
        duration: Date.now() - startTime,
        totalTests: results.total,
        passedTests: results.passed,
        failedTests: results.failed,
        skippedTests: 0,
        performance: await this.analyzePerformance(results.results),
        issues,
        recommendations: this.generateIntegrationRecommendations(results),
        nextSteps: success ? ['Run end-to-end tests', 'Performance testing'] : ['Debug integration issues', 'Review system dependencies']
      }
    } catch (error) {
      console.error('Integration tests failed:', error)
      return {
        type: TestRunnerType.INTEGRATION_TESTS,
        success: false,
        duration: Date.now() - startTime,
        totalTests: 0,
        passedTests: 0,
        failedTests: 0,
        skippedTests: 0,
        issues: [{
          category: 'execution',
          count: 1,
          severity: 'critical',
          examples: [error instanceof Error ? error.message : 'Unknown error']
        }],
        recommendations: ['Check integration environment', 'Verify system dependencies'],
        nextSteps: ['Fix integration issues', 'Retry integration tests']
      }
    } finally {
      await TestDataManager.clearAllData()
    }
  }

  static async runPerformanceTests(): Promise<TestRunnerResult> {
    console.log('⚡ Running Performance Tests...')
    const startTime = Date.now()

    try {
      await TestDataScenarios.generateHighVolumeScenario()

      const results = await ComprehensiveTestingFramework.runAllTestSuites({
        suites: ['performance'],
        parallel: false
      })

      const success = results.failed === 0 && this.validatePerformanceThresholds(results.results)
      const issues = this.analyzeTestIssues(results.results)

      return {
        type: TestRunnerType.PERFORMANCE_TESTS,
        success,
        duration: Date.now() - startTime,
        totalTests: results.total,
        passedTests: results.passed,
        failedTests: results.failed,
        skippedTests: 0,
        performance: await this.analyzePerformance(results.results),
        issues,
        recommendations: this.generatePerformanceRecommendations(results),
        nextSteps: success ? ['Run stress tests', 'Deploy to staging'] : ['Optimize performance', 'Review performance bottlenecks']
      }
    } catch (error) {
      console.error('Performance tests failed:', error)
      return {
        type: TestRunnerType.PERFORMANCE_TESTS,
        success: false,
        duration: Date.now() - startTime,
        totalTests: 0,
        passedTests: 0,
        failedTests: 0,
        skippedTests: 0,
        issues: [{
          category: 'execution',
          count: 1,
          severity: 'critical',
          examples: [error instanceof Error ? error.message : 'Unknown error']
        }],
        recommendations: ['Check performance test environment', 'Verify load testing setup'],
        nextSteps: ['Fix performance environment', 'Retry performance tests']
      }
    } finally {
      await TestDataManager.clearAllData()
    }
  }

  static async runEndToEndTests(): Promise<TestRunnerResult> {
    console.log('🎭 Running End-to-End Tests...')
    const startTime = Date.now()

    try {
      await TestDataScenarios.generateCollaborationScenario()

      const results = await ComprehensiveTestingFramework.runAllTestSuites({
        suites: ['user_experience', 'integration'],
        parallel: false
      })

      const success = results.failed === 0
      const issues = this.analyzeTestIssues(results.results)

      return {
        type: TestRunnerType.E2E_TESTS,
        success,
        duration: Date.now() - startTime,
        totalTests: results.total,
        passedTests: results.passed,
        failedTests: results.failed,
        skippedTests: 0,
        issues,
        recommendations: this.generateUXRecommendations(results),
        nextSteps: success ? ['Deploy to production', 'Monitor production metrics'] : ['Fix UX issues', 'Review user workflows']
      }
    } catch (error) {
      console.error('End-to-end tests failed:', error)
      return {
        type: TestRunnerType.E2E_TESTS,
        success: false,
        duration: Date.now() - startTime,
        totalTests: 0,
        passedTests: 0,
        failedTests: 0,
        skippedTests: 0,
        issues: [{
          category: 'execution',
          count: 1,
          severity: 'critical',
          examples: [error instanceof Error ? error.message : 'Unknown error']
        }],
        recommendations: ['Check E2E test environment', 'Verify user workflow setup'],
        nextSteps: ['Fix E2E environment', 'Retry E2E tests']
      }
    } finally {
      await TestDataManager.clearAllData()
    }
  }

  static async runFullTestSuite(): Promise<TestRunnerResult> {
    console.log('🏆 Running Full Test Suite...')
    const startTime = Date.now()

    try {
      await TestDataScenarios.generateHighVolumeScenario()

      const results = await ComprehensiveTestingFramework.runAllTestSuites({
        suites: ['unit', 'integration', 'performance', 'edge_case', 'user_experience', 'business_logic'],
        parallel: false
      })

      const success = results.failed === 0
      const issues = this.analyzeTestIssues(results.results)

      return {
        type: TestRunnerType.FULL_SUITE,
        success,
        duration: Date.now() - startTime,
        totalTests: results.total,
        passedTests: results.passed,
        failedTests: results.failed,
        skippedTests: 0,
        coverage: await this.calculateCoverage(results.results),
        performance: await this.analyzePerformance(results.results),
        issues,
        recommendations: this.generateFullSuiteRecommendations(results),
        nextSteps: success ? ['Deploy to production', 'Monitor production metrics'] : ['Fix all failing tests', 'Review test coverage']
      }
    } catch (error) {
      console.error('Full test suite failed:', error)
      return {
        type: TestRunnerType.FULL_SUITE,
        success: false,
        duration: Date.now() - startTime,
        totalTests: 0,
        passedTests: 0,
        failedTests: 0,
        skippedTests: 0,
        issues: [{
          category: 'execution',
          count: 1,
          severity: 'critical',
          examples: [error instanceof Error ? error.message : 'Unknown error']
        }],
        recommendations: ['Check full test environment', 'Verify all dependencies'],
        nextSteps: ['Fix environment issues', 'Retry full test suite']
      }
    } finally {
      await TestDataManager.clearAllData()
    }
  }

  // ========================================
  // CI/CD INTEGRATION
  // ========================================

  static async runPreDeploymentTests(): Promise<TestRunnerResult> {
    console.log('🚀 Running Pre-Deployment Tests...')
    const startTime = Date.now()

    // Run critical test suites for deployment readiness
    const smokeResult = await this.runQuickSmokeTest()
    const unitResult = await this.runUnitTests()
    const integrationResult = await this.runIntegrationTests()

    const allPassed = smokeResult.success && unitResult.success && integrationResult.success

    return {
      type: TestRunnerType.PRE_DEPLOYMENT,
      success: allPassed,
      duration: Date.now() - startTime,
      totalTests: smokeResult.totalTests + unitResult.totalTests + integrationResult.totalTests,
      passedTests: smokeResult.passedTests + unitResult.passedTests + integrationResult.passedTests,
      failedTests: smokeResult.failedTests + unitResult.failedTests + integrationResult.failedTests,
      skippedTests: 0,
      issues: [...smokeResult.issues, ...unitResult.issues, ...integrationResult.issues],
      recommendations: [
        ...smokeResult.recommendations,
        ...unitResult.recommendations,
        ...integrationResult.recommendations
      ],
      nextSteps: allPassed 
        ? ['Deploy to staging', 'Run post-deployment tests'] 
        : ['Fix failing tests', 'Re-run pre-deployment tests']
    }
  }

  static async runPostDeploymentTests(): Promise<TestRunnerResult> {
    console.log('✅ Running Post-Deployment Tests...')
    const startTime = Date.now()

    // Focus on smoke tests and basic functionality
    const smokeResult = await this.runQuickSmokeTest()
    const e2eResult = await this.runEndToEndTests()

    const allPassed = smokeResult.success && e2eResult.success

    return {
      type: TestRunnerType.POST_DEPLOYMENT,
      success: allPassed,
      duration: Date.now() - startTime,
      totalTests: smokeResult.totalTests + e2eResult.totalTests,
      passedTests: smokeResult.passedTests + e2eResult.passedTests,
      failedTests: smokeResult.failedTests + e2eResult.failedTests,
      skippedTests: 0,
      issues: [...smokeResult.issues, ...e2eResult.issues],
      recommendations: allPassed ? ['Deployment successful', 'Monitor production metrics'] : ['Deployment issues detected', 'Rollback may be required'],
      nextSteps: allPassed 
        ? ['Monitor production', 'Schedule full test suite'] 
        : ['Investigate deployment issues', 'Consider rollback']
    }
  }

  // ========================================
  // UTILITY METHODS
  // ========================================

  private static analyzeTestIssues(results: TestExecutionResult[]): TestIssueSummary[] {
    const issues: TestIssueSummary[] = []

    // Group issues by category and severity
    const issueMap = new Map<string, { category: string; severity: string; examples: string[] }>()

    results.filter(r => !r.success).forEach(result => {
      if (result.error) {
        const category = this.categorizeError(result.error)
        const key = `${category}-${result.error.type}`
        
        if (!issueMap.has(key)) {
          issueMap.set(key, {
            category,
            severity: this.getSeverityFromError(result.error),
            examples: []
          })
        }
        
        issueMap.get(key)!.examples.push(result.error.message)
      }
    })

    // Convert to TestIssueSummary format
    issueMap.forEach((value, key) => {
      issues.push({
        category: value.category,
        count: value.examples.length,
        severity: value.severity as any,
        examples: value.examples.slice(0, 3) // Limit examples
      })
    })

    return issues
  }

  private static categorizeError(error: any): string {
    const message = error.message?.toLowerCase() || ''
    
    if (message.includes('database') || message.includes('sql')) return 'database'
    if (message.includes('network') || message.includes('fetch') || message.includes('timeout')) return 'network'
    if (message.includes('memory') || message.includes('heap')) return 'memory'
    if (message.includes('validation') || message.includes('invalid')) return 'validation'
    if (message.includes('collaboration') || message.includes('websocket')) return 'collaboration'
    if (message.includes('state') || message.includes('transition')) return 'state_machine'
    if (message.includes('api') || message.includes('endpoint')) return 'api'
    
    return 'general'
  }

  private static getSeverityFromError(error: any): 'low' | 'medium' | 'high' | 'critical' {
    const message = error.message?.toLowerCase() || ''
    
    if (message.includes('critical') || message.includes('fatal') || message.includes('crash')) return 'critical'
    if (message.includes('timeout') || message.includes('performance') || message.includes('memory')) return 'high'
    if (message.includes('validation') || message.includes('business')) return 'medium'
    
    return 'low'
  }

  private static async calculateCoverage(results: TestExecutionResult[]): Promise<CoverageReport> {
    // Mock coverage calculation - in real implementation, this would analyze actual coverage
    const passedTests = results.filter(r => r.success).length
    const totalTests = results.length
    const coveragePercentage = (passedTests / totalTests) * 100

    return {
      line: coveragePercentage,
      branch: coveragePercentage * 0.9,
      function: coveragePercentage * 0.95,
      statement: coveragePercentage,
      uncoveredLines: [],
      uncoveredBranches: []
    }
  }

  private static async analyzePerformance(results: TestExecutionResult[]): Promise<PerformanceReport> {
    const durations = results.map(r => r.duration)
    const averageDuration = durations.reduce((sum, d) => sum + d, 0) / durations.length
    const slowestTests = results
      .sort((a, b) => b.duration - a.duration)
      .slice(0, 5)
      .map(r => ({ testName: r.name, duration: r.duration }))

    const memoryUsages = results.map(r => r.performance?.memoryUsage || 0)
    const averageMemory = memoryUsages.reduce((sum, m) => sum + m, 0) / memoryUsages.length
    const peakMemory = Math.max(...memoryUsages)

    return {
      averageTestDuration: averageDuration,
      slowestTests,
      memoryUsage: {
        average: averageMemory,
        peak: peakMemory,
        trend: 'stable' // Would calculate actual trend
      },
      databasePerformance: {
        averageQueryTime: 50, // Mock value
        slowQueries: []
      }
    }
  }

  private static validatePerformanceThresholds(results: TestExecutionResult[]): boolean {
    for (const result of results) {
      if (result.duration > this.config.performanceThresholds.maxTestDuration) {
        return false
      }
      
      if (result.performance?.memoryUsage && 
          result.performance.memoryUsage > this.config.performanceThresholds.maxMemoryUsage * 1024 * 1024) {
        return false
      }
    }
    
    return true
  }

  private static generateRecommendations(results: any): string[] {
    const recommendations: string[] = []
    
    if (results.failed > 0) {
      recommendations.push('Fix failing unit tests before proceeding')
      recommendations.push('Review test coverage for uncovered functionality')
    }
    
    if (results.duration > 300000) { // 5 minutes
      recommendations.push('Consider optimizing slow unit tests')
    }
    
    return recommendations
  }

  private static generateIntegrationRecommendations(results: any): string[] {
    const recommendations: string[] = []
    
    if (results.failed > 0) {
      recommendations.push('Debug integration issues with external dependencies')
      recommendations.push('Verify test data consistency across services')
    }
    
    recommendations.push('Monitor integration test performance in CI/CD')
    recommendations.push('Add integration test coverage for new features')
    
    return recommendations
  }

  private static generatePerformanceRecommendations(results: any): string[] {
    const recommendations: string[] = []
    
    if (results.failed > 0) {
      recommendations.push('Optimize performance bottlenecks identified in tests')
      recommendations.push('Review database query performance')
    }
    
    recommendations.push('Implement performance monitoring in production')
    recommendations.push('Set up automated performance regression detection')
    
    return recommendations
  }

  private static generateUXRecommendations(results: any): string[] {
    const recommendations: string[] = []
    
    if (results.failed > 0) {
      recommendations.push('Fix user experience issues and accessibility problems')
      recommendations.push('Review user workflow design')
    }
    
    recommendations.push('Conduct user testing with real users')
    recommendations.push('Monitor user feedback and analytics')
    
    return recommendations
  }

  private static generateFullSuiteRecommendations(results: any): string[] {
    const recommendations: string[] = []
    
    if (results.failed === 0) {
      recommendations.push('All tests passed! Ready for production deployment')
      recommendations.push('Consider implementing automated regression testing')
    } else {
      recommendations.push('Address all failing tests before production deployment')
      recommendations.push('Review test coverage and add missing tests')
    }
    
    recommendations.push('Set up continuous testing pipeline')
    recommendations.push('Implement test result reporting and notifications')
    
    return recommendations
  }

  // ========================================
  // REPORTING AND NOTIFICATIONS
  // ========================================

  static async generateTestReport(result: TestRunnerResult): Promise<string> {
    const report = {
      timestamp: new Date().toISOString(),
      environment: this.config.environment,
      testRunner: result.type,
      summary: {
        success: result.success,
        duration: result.duration,
        totalTests: result.totalTests,
        passedTests: result.passedTests,
        failedTests: result.failedTests,
        successRate: ((result.passedTests / result.totalTests) * 100).toFixed(2) + '%'
      },
      coverage: result.coverage,
      performance: result.performance,
      issues: result.issues,
      recommendations: result.recommendations,
      nextSteps: result.nextSteps
    }

    return JSON.stringify(report, null, 2)
  }

  static async sendSlackNotification(result: TestRunnerResult): Promise<void> {
    if (!this.config.slackNotifications) return

    const emoji = result.success ? '✅' : '❌'
    const message = `${emoji} ${result.type} Test Results
    
Success: ${result.success}
Tests: ${result.passedTests}/${result.totalTests} passed
Duration: ${(result.duration / 1000).toFixed(1)}s

${result.recommendations.length > 0 ? 'Recommendations:' + result.recommendations.join('\n• ') : ''}`

    console.log('📱 Slack Notification:', message)
    // In real implementation, send to Slack webhook
  }

  static async sendEmailNotification(result: TestRunnerResult, recipients: string[]): Promise<void> {
    if (!this.config.emailNotifications || recipients.length === 0) return

    const subject = `[${this.config.environment}] ${result.type} Test Results - ${result.success ? 'PASSED' : 'FAILED'}`
    const body = `
Test Results Summary:
- Success: ${result.success}
- Total Tests: ${result.totalTests}
- Passed: ${result.passedTests}
- Failed: ${result.failedTests}
- Duration: ${(result.duration / 1000).toFixed(1)}s

${result.recommendations.length > 0 ? 'Recommendations:\n• ' + result.recommendations.join('\n• ') : ''}

${result.nextSteps.length > 0 ? 'Next Steps:\n• ' + result.nextSteps.join('\n• ') : ''}
    `

    console.log('📧 Email Notification:', { subject, body, recipients })
    // In real implementation, send email
  }

  // ========================================
  // COMMAND LINE INTERFACE
  // ========================================

  static async runFromCommandLine(args: string[]): Promise<void> {
    const command = args[2]
    
    try {
      let result: TestRunnerResult
      
      switch (command) {
        case 'smoke':
          result = await this.runQuickSmokeTest()
          break
        case 'unit':
          result = await this.runUnitTests()
          break
        case 'integration':
          result = await this.runIntegrationTests()
          break
        case 'performance':
          result = await this.runPerformanceTests()
          break
        case 'e2e':
          result = await this.runEndToEndTests()
          break
        case 'full':
          result = await this.runFullTestSuite()
          break
        case 'pre-deploy':
          result = await this.runPreDeploymentTests()
          break
        case 'post-deploy':
          result = await this.runPostDeploymentTests()
          break
        default:
          console.log('Usage: npm run test:runner <smoke|unit|integration|performance|e2e|full|pre-deploy|post-deploy>')
          return
      }

      // Generate and display report
      const report = await this.generateTestReport(result)
      console.log('\n' + '=' * 80)
      console.log('📊 TEST RUNNER RESULTS')
      console.log('=' * 80)
      console.log(report)

      // Send notifications if configured
      if (this.config.slackNotifications) {
        await this.sendSlackNotification(result)
      }

      // Exit with appropriate code
      process.exit(result.success ? 0 : 1)
      
    } catch (error) {
      console.error('Test runner failed:', error)
      process.exit(1)
    }
  }
}

// Export utility functions
export const TestRunners = {
  quick: () => AutomatedTestRunner.runQuickSmokeTest(),
  unit: () => AutomatedTestRunner.runUnitTests(),
  integration: () => AutomatedTestRunner.runIntegrationTests(),
  performance: () => AutomatedTestRunner.runPerformanceTests(),
  e2e: () => AutomatedTestRunner.runEndToEndTests(),
  full: () => AutomatedTestRunner.runFullTestSuite(),
  preDeploy: () => AutomatedTestRunner.runPreDeploymentTests(),
  postDeploy: () => AutomatedTestRunner.runPostDeploymentTests()
}

// Make available globally
if (typeof window !== 'undefined') {
  (window as any).AutomatedTestRunner = AutomatedTestRunner
  (window as any).TestRunners = TestRunners
}

// CLI execution
if (require.main === module) {
  AutomatedTestRunner.runFromCommandLine(process.argv)
}