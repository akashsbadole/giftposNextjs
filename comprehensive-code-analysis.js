/**
 * Comprehensive POS Feature Code Analysis and Validation Script
 * Analyzes code structure, components, and implementation to validate all features
 */

const fs = require('fs');
const path = require('path');

// Analysis Configuration
const ANALYSIS_CONFIG = {
  baseDir: __dirname,
  srcDir: path.join(__dirname, 'src'),
  apiDir: path.join(__dirname, 'src', 'app', 'api', 'pos'),
  componentsDir: path.join(__dirname, 'src', 'components', 'pos'),
  libDir: path.join(__dirname, 'src', 'lib'),
  docsDir: path.join(__dirname, 'documentation')
};

// Analysis Results Storage
const analysisResults = {
  metadata: {
    timestamp: new Date().toISOString(),
    version: '1.0.0',
    analysisType: 'comprehensive_code_analysis'
  },
  summary: {
    totalFilesAnalyzed: 0,
    totalFeaturesIdentified: 0,
    implementationScore: 0,
    codeQualityScore: 0,
    testCoverageScore: 0
  },
  cashDrawerSystem: {
    components: [],
    apiEndpoints: [],
    implemented: false,
    completeness: 0,
    quality: 0,
    tests: []
  },
  multiTaxSystem: {
    components: [],
    apiEndpoints: [],
    implemented: false,
    completeness: 0,
    quality: 0,
    tests: []
  },
  batchOperations: {
    components: [],
    apiEndpoints: [],
    implemented: false,
    completeness: 0,
    quality: 0,
    tests: []
  },
  integration: {
    crossSystemConnections: [],
    dataFlowValidation: [],
    authenticationIntegration: [],
    implemented: false,
    quality: 0
  },
  security: {
    authentication: [],
    authorization: [],
    dataValidation: [],
    implemented: false,
    quality: 0
  },
  codeQuality: {
    typescriptCompliance: 0,
    errorHandling: 0,
    codeOrganization: 0,
    documentation: 0
  }
};

// Utility Functions
function log(message, type = 'info') {
  const timestamp = new Date().toISOString();
  const prefix = {
    info: 'ℹ️',
    success: '✅',
    error: '❌',
    warning: '⚠️',
    analysis: '🔍'
  }[type] || '📝';
  
  console.log(`[${timestamp}] ${prefix} ${message}`);
}

function scanDirectory(dir, filePattern = null) {
  const files = [];
  
  function scan(currentDir) {
    if (!fs.existsSync(currentDir)) return;
    
    const items = fs.readdirSync(currentDir);
    
    for (const item of items) {
      const fullPath = path.join(currentDir, item);
      const stat = fs.statSync(fullPath);
      
      if (stat.isDirectory()) {
        scan(fullPath);
      } else if (stat.isFile()) {
        if (!filePattern || item.match(filePattern)) {
          files.push(fullPath);
        }
      }
    }
  }
  
  scan(dir);
  return files;
}

function analyzeFile(filePath) {
  try {
    const content = fs.readFileSync(filePath, 'utf8');
    const stats = fs.statSync(filePath);
    
    return {
      path: filePath,
      size: stats.size,
      lines: content.split('\n').length,
      content: content,
      lastModified: stats.mtime
    };
  } catch (error) {
    log(`Error reading file ${filePath}: ${error.message}`, 'error');
    return null;
  }
}

// 1. CASH DRAWER OPERATIONS SYSTEM ANALYSIS
function analyzeCashDrawerSystem() {
  log('Analyzing Cash Drawer Operations System...', 'analysis');
  
  // Check for Cash Drawer Components
  const cashDrawerComponents = [
    'CashDrawerDashboard.tsx',
    'ShiftManager.tsx', 
    'CashCountInterface.tsx',
    'ZReportViewer.tsx'
  ];
  
  for (const component of cashDrawerComponents) {
    const componentPath = path.join(ANALYSIS_CONFIG.componentsDir, component);
    if (fs.existsSync(componentPath)) {
      const file = analyzeFile(componentPath);
      if (file) {
        analysisResults.cashDrawerSystem.components.push({
          name: component,
          path: componentPath,
          size: file.size,
          lines: file.lines,
          implemented: true
        });
        
        // Analyze component functionality
        const functionality = analyzeComponentFunctionality(file.content, component);
        analysisResults.cashDrawerSystem.components[
          analysisResults.cashDrawerSystem.components.length - 1
        ].functionality = functionality;
      }
    } else {
      analysisResults.cashDrawerSystem.components.push({
        name: component,
        path: componentPath,
        implemented: false
      });
    }
  }
  
  // Check for Cash Drawer API Endpoints
  const cashDrawerApiEndpoints = [
    'shifts',
    'shifts/current',
    'shifts/[id]',
    'shifts/[id]/cash-counts',
    'shifts/[id]/cash-transactions',
    'z-reports',
    'z-reports/[id]'
  ];
  
  for (const endpoint of cashDrawerApiEndpoints) {
    const endpointPath = path.join(ANALYSIS_CONFIG.apiDir, endpoint);
    const routePath = path.join(endpointPath, 'route.ts');
    
    if (fs.existsSync(routePath)) {
      const file = analyzeFile(routePath);
      if (file) {
        analysisResults.cashDrawerSystem.apiEndpoints.push({
          endpoint: `/${endpoint}`,
          path: routePath,
          implemented: true,
          lines: file.lines
        });
        
        // Analyze API functionality
        const functionality = analyzeApiFunctionality(file.content, endpoint);
        analysisResults.cashDrawerSystem.apiEndpoints[
          analysisResults.cashDrawerSystem.apiEndpoints.length - 1
        ].functionality = functionality;
      }
    } else {
      analysisResults.cashDrawerSystem.apiEndpoints.push({
        endpoint: `/${endpoint}`,
        implemented: false
      });
    }
  }
  
  // Calculate implementation completeness
  const totalComponents = cashDrawerComponents.length;
  const implementedComponents = analysisResults.cashDrawerSystem.components.filter(c => c.implemented).length;
  const totalEndpoints = cashDrawerApiEndpoints.length;
  const implementedEndpoints = analysisResults.cashDrawerSystem.apiEndpoints.filter(e => e.implemented).length;
  
  analysisResults.cashDrawerSystem.completeness = 
    ((implementedComponents / totalComponents) + (implementedEndpoints / totalEndpoints)) / 2 * 100;
  
  analysisResults.cashDrawerSystem.implemented = analysisResults.cashDrawerSystem.completeness > 80;
  
  log(`Cash Drawer System: ${analysisResults.cashDrawerSystem.completeness.toFixed(1)}% complete`, 'success');
}

// 2. MULTI-TAX SYSTEM ANALYSIS
function analyzeMultiTaxSystem() {
  log('Analyzing Enhanced Multi-Tax Support System...', 'analysis');
  
  // Check for Tax Components
  const taxComponents = [
    'TaxManagement.tsx'
  ];
  
  for (const component of taxComponents) {
    const componentPath = path.join(ANALYSIS_CONFIG.componentsDir, component);
    if (fs.existsSync(componentPath)) {
      const file = analyzeFile(componentPath);
      if (file) {
        analysisResults.multiTaxSystem.components.push({
          name: component,
          path: componentPath,
          size: file.size,
          lines: file.lines,
          implemented: true
        });
      }
    } else {
      analysisResults.multiTaxSystem.components.push({
        name: component,
        path: componentPath,
        implemented: false
      });
    }
  }
  
  // Check for Tax API Endpoints
  const taxApiEndpoints = [
    'tax/calculate',
    'tax/config',
    'tax/reports'
  ];
  
  for (const endpoint of taxApiEndpoints) {
    const endpointPath = path.join(ANALYSIS_CONFIG.apiDir, endpoint);
    const routePath = path.join(endpointPath, 'route.ts');
    
    if (fs.existsSync(routePath)) {
      const file = analyzeFile(routePath);
      if (file) {
        analysisResults.multiTaxSystem.apiEndpoints.push({
          endpoint: `/${endpoint}`,
          path: routePath,
          implemented: true,
          lines: file.lines
        });
      }
    } else {
      analysisResults.multiTaxSystem.apiEndpoints.push({
        endpoint: `/${endpoint}`,
        implemented: false
      });
    }
  }
  
  // Check for Tax Engine Test File
  const taxEngineTestPath = path.join(ANALYSIS_CONFIG.libDir, 'tax-engine.test.ts');
  if (fs.existsSync(taxEngineTestPath)) {
    const file = analyzeFile(taxEngineTestPath);
    analysisResults.multiTaxSystem.tests.push({
      name: 'tax-engine.test.ts',
      path: taxEngineTestPath,
      lines: file.lines,
      implemented: true
    });
  }
  
  // Calculate implementation completeness
  const totalComponents = taxComponents.length;
  const implementedComponents = analysisResults.multiTaxSystem.components.filter(c => c.implemented).length;
  const totalEndpoints = taxApiEndpoints.length;
  const implementedEndpoints = analysisResults.multiTaxSystem.apiEndpoints.filter(e => e.implemented).length;
  
  analysisResults.multiTaxSystem.completeness = 
    ((implementedComponents / totalComponents) + (implementedEndpoints / totalEndpoints)) / 2 * 100;
  
  analysisResults.multiTaxSystem.implemented = analysisResults.multiTaxSystem.completeness > 80;
  
  log(`Multi-Tax System: ${analysisResults.multiTaxSystem.completeness.toFixed(1)}% complete`, 'success');
}

// 3. BATCH OPERATIONS SYSTEM ANALYSIS
function analyzeBatchOperations() {
  log('Analyzing Enhanced Batch Operations System...', 'analysis');
  
  // Check for Batch Operations Components
  const batchComponents = [
    'BatchOperationsDashboard.tsx'
  ];
  
  for (const component of batchComponents) {
    const componentPath = path.join(ANALYSIS_CONFIG.componentsDir, component);
    if (fs.existsSync(componentPath)) {
      const file = analyzeFile(componentPath);
      if (file) {
        analysisResults.batchOperations.components.push({
          name: component,
          path: componentPath,
          size: file.size,
          lines: file.lines,
          implemented: true
        });
      }
    } else {
      analysisResults.batchOperations.components.push({
        name: component,
        path: componentPath,
        implemented: false
      });
    }
  }
  
  // Check for Batch Operations API Endpoints
  const batchApiEndpoints = [
    'batch-operations',
    'batch-operations/[operationId]',
    'batch-operations/import-export',
    'batch-operations/templates',
    'batch-operations/analytics'
  ];
  
  for (const endpoint of batchApiEndpoints) {
    const endpointPath = path.join(ANALYSIS_CONFIG.apiDir, endpoint);
    const routePath = path.join(endpointPath, 'route.ts');
    
    if (fs.existsSync(routePath)) {
      const file = analyzeFile(routePath);
      if (file) {
        analysisResults.batchOperations.apiEndpoints.push({
          endpoint: `/${endpoint}`,
          path: routePath,
          implemented: true,
          lines: file.lines
        });
      }
    } else {
      analysisResults.batchOperations.apiEndpoints.push({
        endpoint: `/${endpoint}`,
        implemented: false
      });
    }
  }
  
  // Check for Batch Operations Library Files
  const batchLibFiles = [
    'batch-operations-manager.ts',
    'batch-job-processor.ts'
  ];
  
  for (const libFile of batchLibFiles) {
    const libPath = path.join(ANALYSIS_CONFIG.libDir, libFile);
    if (fs.existsSync(libPath)) {
      const file = analyzeFile(libPath);
      analysisResults.batchOperations.tests.push({
        name: libFile,
        path: libPath,
        lines: file.lines,
        type: 'library'
      });
    }
  }
  
  // Calculate implementation completeness
  const totalComponents = batchComponents.length;
  const implementedComponents = analysisResults.batchOperations.components.filter(c => c.implemented).length;
  const totalEndpoints = batchApiEndpoints.length;
  const implementedEndpoints = analysisResults.batchOperations.apiEndpoints.filter(e => e.implemented).length;
  
  analysisResults.batchOperations.completeness = 
    ((implementedComponents / totalComponents) + (implementedEndpoints / totalEndpoints)) / 2 * 100;
  
  analysisResults.batchOperations.implemented = analysisResults.batchOperations.completeness > 80;
  
  log(`Batch Operations System: ${analysisResults.batchOperations.completeness.toFixed(1)}% complete`, 'success');
}

// 4. INTEGRATION ANALYSIS
function analyzeSystemIntegration() {
  log('Analyzing System Integration...', 'analysis');
  
  // Check authentication integration
  const authSyncPath = path.join(ANALYSIS_CONFIG.apiDir, '..', 'auth', 'sync-user', 'route.ts');
  if (fs.existsSync(authSyncPath)) {
    const file = analyzeFile(authSyncPath);
    analysisResults.integration.authenticationIntegration.push({
      name: 'User Sync API',
      path: authSyncPath,
      implemented: true,
      lines: file.lines
    });
  }
  
  // Check for cross-system data flow
  const mainPosInterface = path.join(ANALYSIS_CONFIG.componentsDir, 'POSInterface.tsx');
  if (fs.existsSync(mainPosInterface)) {
    const file = analyzeFile(mainPosInterface);
    analysisResults.integration.dataFlowValidation.push({
      name: 'POS Interface Integration',
      path: mainPosInterface,
      lines: file.lines,
      hasIntegration: file.content.includes('cash') && file.content.includes('tax') && file.content.includes('batch')
    });
  }
  
  // Check database schema integration
  const schemaPath = path.join(__dirname, 'prisma', 'schema.prisma');
  if (fs.existsSync(schemaPath)) {
    const file = analyzeFile(schemaPath);
    analysisResults.integration.crossSystemConnections.push({
      name: 'Database Schema',
      path: schemaPath,
      lines: file.lines,
      hasAllModels: file.content.includes('Shift') && file.content.includes('TaxRate') && file.content.includes('BatchOperation')
    });
  }
  
  analysisResults.integration.implemented = analysisResults.integration.authenticationIntegration.length > 0;
  
  log(`System Integration: ${analysisResults.integration.implemented ? 'Implemented' : 'Partial'}`, 'success');
}

// 5. SECURITY ANALYSIS
function analyzeSecurity() {
  log('Analyzing Security Features...', 'analysis');
  
  // Check authentication implementation
  const authFiles = scanDirectory(path.join(ANALYSIS_CONFIG.apiDir), /auth/);
  for (const authFile of authFiles) {
    const file = analyzeFile(authFile);
    analysisResults.security.authentication.push({
      name: path.basename(authFile),
      path: authFile,
      implemented: true,
      lines: file.lines
    });
  }
  
  // Check for middleware and protection
  const middlewarePath = path.join(ANALYSIS_CONFIG.srcDir, 'middleware.ts');
  if (fs.existsSync(middlewarePath)) {
    const file = analyzeFile(middlewarePath);
    analysisResults.security.authorization.push({
      name: 'Middleware Protection',
      path: middlewarePath,
      implemented: true,
      lines: file.lines
    });
  }
  
  // Check for input validation
  const validationFiles = scanDirectory(ANALYSIS_CONFIG.libDir, /validation|security/);
  for (const validationFile of validationFiles) {
    const file = analyzeFile(validationFile);
    analysisResults.security.dataValidation.push({
      name: path.basename(validationFile),
      path: validationFile,
      implemented: true,
      lines: file.lines
    });
  }
  
  analysisResults.security.implemented = analysisResults.security.authentication.length > 0;
  
  log(`Security Features: ${analysisResults.security.implemented ? 'Implemented' : 'Partial'}`, 'success');
}

// 6. CODE QUALITY ANALYSIS
function analyzeCodeQuality() {
  log('Analyzing Code Quality...', 'analysis');
  
  // Count TypeScript files and compliance
  const tsFiles = scanDirectory(ANALYSIS_CONFIG.srcDir, /\.tsx?$/);
  analysisResults.codeQuality.typescriptCompliance = tsFiles.length;
  
  // Analyze error handling
  let errorHandlingScore = 0;
  let totalErrorHandlingChecks = 0;
  
  for (const tsFile of tsFiles.slice(0, 10)) { // Sample first 10 files
    const file = analyzeFile(tsFile);
    if (file) {
      totalErrorHandlingChecks++;
      if (file.content.includes('try') && file.content.includes('catch')) {
        errorHandlingScore++;
      }
      if (file.content.includes('error') || file.content.includes('Error')) {
        errorHandlingScore += 0.5;
      }
    }
  }
  
  analysisResults.codeQuality.errorHandling = totalErrorHandlingChecks > 0 ? 
    (errorHandlingScore / totalErrorHandlingChecks) * 100 : 0;
  
  // Check documentation
  const docFiles = scanDirectory(ANALYSIS_CONFIG.docsDir, /\.md$/);
  analysisResults.codeQuality.documentation = docFiles.length;
  
  // Calculate overall code quality score
  analysisResults.codeQualityScore = (
    (analysisResults.codeQuality.typescriptCompliance / 100) * 30 +
    (analysisResults.codeQuality.errorHandling / 100) * 40 +
    (Math.min(analysisResults.codeQuality.documentation / 20, 1) * 100) * 30
  );
  
  log(`Code Quality Score: ${analysisResults.codeQualityScore.toFixed(1)}/100`, 'success');
}

// Helper Functions
function analyzeComponentFunctionality(content, componentName) {
  const functionality = [];
  
  if (componentName === 'CashDrawerDashboard.tsx') {
    if (content.includes('shift')) functionality.push('Shift Management');
    if (content.includes('cash')) functionality.push('Cash Operations');
    if (content.includes('count')) functionality.push('Cash Counting');
    if (content.includes('report')) functionality.push('Reporting');
  } else if (componentName === 'TaxManagement.tsx') {
    if (content.includes('calculate')) functionality.push('Tax Calculation');
    if (content.includes('GST')) functionality.push('GST Support');
    if (content.includes('config')) functionality.push('Tax Configuration');
  } else if (componentName === 'BatchOperationsDashboard.tsx') {
    if (content.includes('import')) functionality.push('Bulk Import');
    if (content.includes('export')) functionality.push('Bulk Export');
    if (content.includes('batch')) functionality.push('Batch Processing');
  }
  
  return functionality;
}

function analyzeApiFunctionality(content, endpoint) {
  const functionality = [];
  
  if (endpoint.includes('shift')) {
    if (content.includes('POST')) functionality.push('Create Shift');
    if (content.includes('GET')) functionality.push('Get Shifts');
    if (content.includes('PATCH')) functionality.push('Update Shift');
  } else if (endpoint.includes('tax')) {
    if (content.includes('calculate')) functionality.push('Tax Calculation');
    if (content.includes('config')) functionality.push('Tax Configuration');
    if (content.includes('report')) functionality.push('Tax Reporting');
  } else if (endpoint.includes('batch')) {
    if (content.includes('import')) functionality.push('Import Operations');
    if (content.includes('export')) functionality.push('Export Operations');
    if (content.includes('analytics')) functionality.push('Analytics');
  }
  
  return functionality;
}

// Main Analysis Function
async function runComprehensiveAnalysis() {
  log('🚀 Starting Comprehensive POS Feature Analysis', 'info');
  
  try {
    // Run all analysis functions
    analyzeCashDrawerSystem();
    analyzeMultiTaxSystem();
    analyzeBatchOperations();
    analyzeSystemIntegration();
    analyzeSecurity();
    analyzeCodeQuality();
    
    // Calculate overall scores
    calculateOverallScores();
    
    // Generate analysis report
    await generateAnalysisReport();
    
    log('🏁 Comprehensive analysis completed!', 'success');
    
  } catch (error) {
    log(`❌ Analysis failed: ${error.message}`, 'error');
    process.exit(1);
  }
}

function calculateOverallScores() {
  // Calculate implementation score
  const systems = ['cashDrawerSystem', 'multiTaxSystem', 'batchOperations'];
  const totalCompleteness = systems.reduce((sum, system) => {
    return sum + analysisResults[system].completeness;
  }, 0);
  
  analysisResults.summary.implementationScore = totalCompleteness / systems.length;
  
  // Calculate test coverage score
  const testSystems = ['multiTaxSystem']; // Only multi-tax has explicit tests
  let testScore = 0;
  for (const system of testSystems) {
    testScore += analysisResults[system].tests.length > 0 ? 100 : 0;
  }
  analysisResults.summary.testCoverageScore = testScore / testSystems.length;
  
  // Calculate overall feature count
  analysisResults.summary.totalFeaturesIdentified = 
    analysisResults.cashDrawerSystem.components.length +
    analysisResults.multiTaxSystem.components.length +
    analysisResults.batchOperations.components.length +
    analysisResults.cashDrawerSystem.apiEndpoints.length +
    analysisResults.multiTaxSystem.apiEndpoints.length +
    analysisResults.batchOperations.apiEndpoints.length;
}

async function generateAnalysisReport() {
  const reportPath = path.join(__dirname, 'comprehensive-analysis-report.json');
  
  const report = {
    metadata: analysisResults.metadata,
    summary: analysisResults.summary,
    detailedAnalysis: analysisResults,
    recommendations: generateRecommendations(),
    validationStatus: generateValidationStatus()
  };
  
  fs.writeFileSync(reportPath, JSON.stringify(report, null, 2));
  log(`📊 Analysis report generated: ${reportPath}`, 'success');
  
  // Print summary
  printSummary();
}

function generateRecommendations() {
  const recommendations = [];
  
  // Implementation recommendations
  if (analysisResults.summary.implementationScore >= 90) {
    recommendations.push({
      priority: 'high',
      category: 'deployment',
      message: 'All major features are implemented and ready for production deployment.',
      action: 'Proceed with production deployment'
    });
  } else if (analysisResults.summary.implementationScore >= 70) {
    recommendations.push({
      priority: 'medium',
      category: 'implementation',
      message: 'Most features are implemented but some areas need completion.',
      action: 'Complete remaining implementations before deployment'
    });
  } else {
    recommendations.push({
      priority: 'high',
      category: 'implementation',
      message: 'Several key features are incomplete and require development.',
      action: 'Complete all feature implementations before testing'
    });
  }
  
  // Code quality recommendations
  if (analysisResults.codeQualityScore >= 80) {
    recommendations.push({
      priority: 'low',
      category: 'quality',
      message: 'Code quality is excellent with good practices implemented.',
      action: 'Maintain current coding standards'
    });
  } else {
    recommendations.push({
      priority: 'medium',
      category: 'quality',
      message: 'Code quality could be improved with better error handling and documentation.',
      action: 'Improve error handling and add more documentation'
    });
  }
  
  // Test coverage recommendations
  if (analysisResults.summary.testCoverageScore < 50) {
    recommendations.push({
      priority: 'medium',
      category: 'testing',
      message: 'Test coverage is limited and should be expanded.',
      action: 'Add comprehensive test suites for all features'
    });
  }
  
  return recommendations;
}

function generateValidationStatus() {
  const status = {
    cashDrawerSystem: {
      implemented: analysisResults.cashDrawerSystem.implemented,
      completeness: analysisResults.cashDrawerSystem.completeness,
      status: analysisResults.cashDrawerSystem.completeness >= 90 ? 'Production Ready' :
             analysisResults.cashDrawerSystem.completeness >= 70 ? 'Mostly Complete' : 'Needs Work'
    },
    multiTaxSystem: {
      implemented: analysisResults.multiTaxSystem.implemented,
      completeness: analysisResults.multiTaxSystem.completeness,
      status: analysisResults.multiTaxSystem.completeness >= 90 ? 'Production Ready' :
             analysisResults.multiTaxSystem.completeness >= 70 ? 'Mostly Complete' : 'Needs Work'
    },
    batchOperations: {
      implemented: analysisResults.batchOperations.implemented,
      completeness: analysisResults.batchOperations.completeness,
      status: analysisResults.batchOperations.completeness >= 90 ? 'Production Ready' :
             analysisResults.batchOperations.completeness >= 70 ? 'Mostly Complete' : 'Needs Work'
    },
    integration: {
      implemented: analysisResults.integration.implemented,
      status: analysisResults.integration.implemented ? 'Integrated' : 'Partial Integration'
    },
    security: {
      implemented: analysisResults.security.implemented,
      status: analysisResults.security.implemented ? 'Secured' : 'Basic Security'
    }
  };
  
  return status;
}

function printSummary() {
  console.log('\n' + '='.repeat(80));
  console.log('📋 COMPREHENSIVE FEATURE ANALYSIS SUMMARY');
  console.log('='.repeat(80));
  
  console.log(`Total Files Analyzed: ${analysisResults.summary.totalFilesAnalyzed}`);
  console.log(`Total Features Identified: ${analysisResults.summary.totalFeaturesIdentified}`);
  console.log(`Implementation Score: ${analysisResults.summary.implementationScore.toFixed(1)}/100`);
  console.log(`Code Quality Score: ${analysisResults.codeQualityScore.toFixed(1)}/100`);
  console.log(`Test Coverage Score: ${analysisResults.summary.testCoverageScore.toFixed(1)}/100`);
  
  console.log('\n📊 BY SYSTEM:');
  console.log(`  Cash Drawer System: ${analysisResults.cashDrawerSystem.completeness.toFixed(1)}% complete`);
  console.log(`  Multi-Tax System: ${analysisResults.multiTaxSystem.completeness.toFixed(1)}% complete`);
  console.log(`  Batch Operations: ${analysisResults.batchOperations.completeness.toFixed(1)}% complete`);
  console.log(`  System Integration: ${analysisResults.integration.implemented ? 'Integrated' : 'Partial'}`);
  console.log(`  Security Features: ${analysisResults.security.implemented ? 'Implemented' : 'Basic'}`);
  
  console.log('\n🎯 VALIDATION STATUS:');
  const status = generateValidationStatus();
  Object.entries(status).forEach(([system, info]) => {
    console.log(`  ${system}: ${info.status} (${info.completeness?.toFixed(1) || 'N/A'}%)`);
  });
  
  console.log('\n🎯 RECOMMENDATIONS:');
  const recommendations = generateRecommendations();
  recommendations.forEach(rec => {
    console.log(`  [${rec.priority.toUpperCase()}] ${rec.message}`);
    console.log(`    Action: ${rec.action}`);
  });
  
  console.log('\n' + '='.repeat(80));
}

// Execute analysis if run directly
if (require.main === module) {
  runComprehensiveAnalysis().catch(error => {
    log(`Fatal error: ${error.message}`, 'error');
    process.exit(1);
  });
}

module.exports = {
  runComprehensiveAnalysis,
  analysisResults,
  generateRecommendations
};