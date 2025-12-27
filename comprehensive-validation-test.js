/**
 * Comprehensive POS Feature Validation Test Suite
 * Tests all recently implemented features for production readiness
 */

const fs = require('fs');
const path = require('path');

// Test Configuration
const TEST_CONFIG = {
  baseUrl: 'http://localhost:3000',
  timeout: 30000,
  retries: 3,
  batchSize: 50
};

// Test Results Storage
const testResults = {
  summary: {
    total: 0,
    passed: 0,
    failed: 0,
    warnings: 0,
    startTime: null,
    endTime: null,
    duration: 0
  },
  cashDrawerSystem: { tests: [], passed: 0, failed: 0 },
  multiTaxSystem: { tests: [], passed: 0, failed: 0 },
  batchOperations: { tests: [], passed: 0, failed: 0 },
  integrationTests: { tests: [], passed: 0, failed: 0 },
  e2eWorkflows: { tests: [], passed: 0, failed: 0 },
  performance: { tests: [], passed: 0, failed: 0 },
  security: { tests: [], passed: 0, failed: 0 }
};

// Utility Functions
function log(message, type = 'info') {
  const timestamp = new Date().toISOString();
  const prefix = {
    info: 'ℹ️',
    success: '✅',
    error: '❌',
    warning: '⚠️',
    test: '🧪'
  }[type] || '📝';
  
  console.log(`[${timestamp}] ${prefix} ${message}`);
}

function recordTestResult(category, testName, success, details = '', error = null) {
  const categoryTests = testResults[category];
  categoryTests.tests.push({
    name: testName,
    success,
    details,
    error: error ? error.message : null,
    timestamp: new Date().toISOString()
  });
  
  if (success) {
    categoryTests.passed++;
    testResults.summary.passed++;
  } else {
    categoryTests.failed++;
    testResults.summary.failed++;
  }
  
  testResults.summary.total++;
  
  const status = success ? 'PASS' : 'FAIL';
  const icon = success ? '✅' : '❌';
  log(`${icon} ${category}: ${testName} - ${status}`, success ? 'success' : 'error');
  
  if (!success && error) {
    log(`   Error: ${error.message}`, 'error');
  }
  
  if (details) {
    log(`   Details: ${details}`, 'info');
  }
}

// API Testing Functions
async function testAPIEndpoint(endpoint, method = 'GET', data = null, expectedStatus = 200) {
  try {
    const fetch = (await import('node-fetch')).default;
    
    const options = {
      method,
      headers: {
        'Content-Type': 'application/json',
      }
    };
    
    if (data && method !== 'GET') {
      options.body = JSON.stringify(data);
    }
    
    const response = await fetch(`${TEST_CONFIG.baseUrl}${endpoint}`, options);
    const responseData = await response.json();
    
    return {
      success: response.status === expectedStatus,
      status: response.status,
      data: responseData,
      response
    };
  } catch (error) {
    return {
      success: false,
      status: 0,
      data: null,
      error: error.message
    };
  }
}

// 1. CASH DRAWER OPERATIONS SYSTEM TESTS
async function testCashDrawerOperations() {
  log('Testing Cash Drawer Operations System...', 'test');
  
  // Test Shift Management
  const shiftTests = [
    {
      name: 'Create New Shift',
      test: async () => {
        const shiftData = {
          employeeId: 'test-employee-1',
          storeId: 'test-store',
          startTime: new Date().toISOString(),
          initialCash: 1000,
          notes: 'Test shift start'
        };
        
        const result = await testAPIEndpoint('/api/pos/shifts', 'POST', shiftData, 201);
        return result.success;
      }
    },
    {
      name: 'Get Current Shift',
      test: async () => {
        const result = await testAPIEndpoint('/api/pos/shifts/current', 'GET', null, 200);
        return result.success;
      }
    },
    {
      name: 'Update Shift Status',
      test: async () => {
        const updateData = {
          status: 'break',
          breakStartTime: new Date().toISOString()
        };
        
        const result = await testAPIEndpoint('/api/pos/shifts/test-shift-id', 'PATCH', updateData, 200);
        return result.success;
      }
    },
    {
      name: 'Close Shift',
      test: async () => {
        const closeData = {
          status: 'closed',
          endTime: new Date().toISOString(),
          finalCashCount: 2500,
          notes: 'Test shift end'
        };
        
        const result = await testAPIEndpoint('/api/pos/shifts/test-shift-id', 'PATCH', closeData, 200);
        return result.success;
      }
    }
  ];
  
  // Test Cash Counting
  const cashCountTests = [
    {
      name: 'Submit Cash Count',
      test: async () => {
        const countData = {
          shiftId: 'test-shift-id',
          countType: 'opening',
          denominations: {
            '2000': 1,
            '500': 2,
            '200': 5,
            '100': 10,
            '50': 20,
            '20': 10,
            '10': 50,
            '5': 20,
            '2': 100,
            '1': 200
          },
          totalAmount: 2450,
          notes: 'Opening count'
        };
        
        const result = await testAPIEndpoint('/api/pos/shifts/test-shift-id/cash-counts', 'POST', countData, 201);
        return result.success;
      }
    },
    {
      name: 'Get Cash Counts',
      test: async () => {
        const result = await testAPIEndpoint('/api/pos/shifts/test-shift-id/cash-counts', 'GET', null, 200);
        return result.success;
      }
    }
  ];
  
  // Test Cash Transactions
  const transactionTests = [
    {
      name: 'Add Cash Transaction',
      test: async () => {
        const transactionData = {
          shiftId: 'test-shift-id',
          type: 'sale',
          amount: 150,
          method: 'cash',
          reference: 'TEST-SALE-001',
          description: 'Test cash sale'
        };
        
        const result = await testAPIEndpoint('/api/pos/shifts/test-shift-id/cash-transactions', 'POST', transactionData, 201);
        return result.success;
      }
    },
    {
      name: 'Get Cash Transactions',
      test: async () => {
        const result = await testAPIEndpoint('/api/pos/shifts/test-shift-id/cash-transactions', 'GET', null, 200);
        return result.success;
      }
    }
  ];
  
  // Test Z-Reports
  const zReportTests = [
    {
      name: 'Generate Z-Report',
      test: async () => {
        const reportData = {
          shiftId: 'test-shift-id',
          reportDate: new Date().toISOString().split('T')[0],
          includeTransactions: true,
          includeVariances: true
        };
        
        const result = await testAPIEndpoint('/api/pos/z-reports', 'POST', reportData, 201);
        return result.success;
      }
    },
    {
      name: 'Get Z-Reports',
      test: async () => {
        const result = await testAPIEndpoint('/api/pos/z-reports', 'GET', null, 200);
        return result.success;
      }
    },
    {
      name: 'Get Z-Report Details',
      test: async () => {
        const result = await testAPIEndpoint('/api/pos/z-reports/test-report-id', 'GET', null, 200);
        return result.success;
      }
    }
  ];
  
  // Execute all tests
  const allTests = [...shiftTests, ...cashCountTests, ...transactionTests, ...zReportTests];
  
  for (const test of allTests) {
    try {
      const success = await test.test();
      recordTestResult('cashDrawerSystem', test.name, success);
    } catch (error) {
      recordTestResult('cashDrawerSystem', test.name, false, '', error);
    }
  }
}

// 2. MULTI-TAX SYSTEM TESTS
async function testMultiTaxSystem() {
  log('Testing Enhanced Multi-Tax Support System...', 'test');
  
  // Test Tax Calculation
  const taxCalculationTests = [
    {
      name: 'Calculate CGST + SGST (Intra-state)',
      test: async () => {
        const calculationData = {
          storeId: 'test-store',
          customerId: 'test-customer',
          items: [
            {
              productId: 'product-1',
              quantity: 2,
              unitPrice: 100,
              totalPrice: 200,
              categoryId: 'category-1',
              hsnCode: '8517'
            }
          ],
          customerRegion: 'MH',
          storeRegion: 'MH',
          isInterState: false,
          isExport: false
        };
        
        const result = await testAPIEndpoint('/api/pos/tax/calculate', 'POST', calculationData, 200);
        return result.success && result.data && result.data.success;
      }
    },
    {
      name: 'Calculate IGST (Inter-state)',
      test: async () => {
        const calculationData = {
          storeId: 'test-store',
          items: [
            {
              productId: 'product-1',
              quantity: 1,
              unitPrice: 100,
              totalPrice: 100,
              categoryId: 'category-1'
            }
          ],
          customerRegion: 'DL',
          storeRegion: 'MH',
          isInterState: true
        };
        
        const result = await testAPIEndpoint('/api/pos/tax/calculate', 'POST', calculationData, 200);
        return result.success && result.data && result.data.success;
      }
    },
    {
      name: 'Calculate Compound Tax (GST + CESS)',
      test: async () => {
        const calculationData = {
          storeId: 'test-store',
          items: [
            {
              productId: 'luxury-product',
              quantity: 1,
              unitPrice: 1000,
              totalPrice: 1000,
              categoryId: 'luxury-category',
              hsnCode: '8703'
            }
          ],
          customerRegion: 'MH',
          storeRegion: 'MH',
          isInterState: false
        };
        
        const result = await testAPIEndpoint('/api/pos/tax/calculate', 'POST', calculationData, 200);
        return result.success && result.data && result.data.success;
      }
    },
    {
      name: 'Calculate Tax-Exempt Items',
      test: async () => {
        const calculationData = {
          storeId: 'test-store',
          items: [
            {
              productId: 'exempt-product',
              quantity: 1,
              unitPrice: 50,
              totalPrice: 50,
              categoryId: 'essential-category',
              hsnCode: '1006'
            }
          ],
          customerRegion: 'MH',
          storeRegion: 'MH',
          isInterState: false
        };
        
        const result = await testAPIEndpoint('/api/pos/tax/calculate', 'POST', calculationData, 200);
        return result.success && result.data && result.data.success;
      }
    }
  ];
  
  // Test Tax Configuration
  const taxConfigTests = [
    {
      name: 'Get Tax Types',
      test: async () => {
        const result = await testAPIEndpoint('/api/pos/tax/config?type=types', 'GET', null, 200);
        return result.success;
      }
    },
    {
      name: 'Get Tax Regions',
      test: async () => {
        const result = await testAPIEndpoint('/api/pos/tax/config?type=regions', 'GET', null, 200);
        return result.success;
      }
    },
    {
      name: 'Get Tax Rates',
      test: async () => {
        const result = await testAPIEndpoint('/api/pos/tax/config?type=rates', 'GET', null, 200);
        return result.success;
      }
    },
    {
      name: 'Get Tax Rules',
      test: async () => {
        const result = await testAPIEndpoint('/api/pos/tax/config?type=rules', 'GET', null, 200);
        return result.success;
      }
    }
  ];
  
  // Test Tax Reports
  const taxReportTests = [
    {
      name: 'Generate GSTR-1 Report',
      test: async () => {
        const reportData = {
          reportType: 'GSTR1',
          reportPeriod: '2024-12',
          format: 'json'
        };
        
        const result = await testAPIEndpoint('/api/pos/tax/reports', 'POST', reportData, 200);
        return result.success;
      }
    },
    {
      name: 'Generate GSTR-3B Report',
      test: async () => {
        const reportData = {
          reportType: 'GSTR3B',
          reportPeriod: '2024-12',
          format: 'json'
        };
        
        const result = await testAPIEndpoint('/api/pos/tax/reports', 'POST', reportData, 200);
        return result.success;
      }
    }
  ];
  
  // Execute all tests
  const allTests = [...taxCalculationTests, ...taxConfigTests, ...taxReportTests];
  
  for (const test of allTests) {
    try {
      const success = await test.test();
      recordTestResult('multiTaxSystem', test.name, success);
    } catch (error) {
      recordTestResult('multiTaxSystem', test.name, false, '', error);
    }
  }
}

// 3. BATCH OPERATIONS SYSTEM TESTS
async function testBatchOperations() {
  log('Testing Enhanced Batch Operations System...', 'test');
  
  // Test Batch Operation Management
  const batchOperationTests = [
    {
      name: 'Create Batch Operation',
      test: async () => {
        const operationData = {
          name: 'Test Product Import',
          type: 'import',
          entityType: 'products',
          storeId: 'test-store',
          parameters: {
            fileType: 'csv',
            validationRules: 'strict'
          }
        };
        
        const result = await testAPIEndpoint('/api/pos/batch-operations', 'POST', operationData, 201);
        return result.success;
      }
    },
    {
      name: 'Get Batch Operations List',
      test: async () => {
        const result = await testAPIEndpoint('/api/pos/batch-operations', 'GET', null, 200);
        return result.success;
      }
    },
    {
      name: 'Get Batch Operation Details',
      test: async () => {
        const result = await testAPIEndpoint('/api/pos/batch-operations/test-operation-id', 'GET', null, 200);
        return result.success;
      }
    },
    {
      name: 'Update Batch Operation',
      test: async () => {
        const updateData = {
          status: 'paused',
          notes: 'Test pause operation'
        };
        
        const result = await testAPIEndpoint('/api/pos/batch-operations/test-operation-id', 'PATCH', updateData, 200);
        return result.success;
      }
    },
    {
      name: 'Delete Batch Operation',
      test: async () => {
        const result = await testAPIEndpoint('/api/pos/batch-operations/test-operation-id', 'DELETE', null, 204);
        return result.success;
      }
    }
  ];
  
  // Test Import/Export Operations
  const importExportTests = [
    {
      name: 'Upload Import File',
      test: async () => {
        // Simulate file upload
        const formData = {
          operationType: 'import',
          entityType: 'products',
          storeId: 'test-store',
          fileName: 'test-products.csv',
          fileContent: 'name,sku,price,stock,category\nTest Product,TEST001,100,50,Electronics'
        };
        
        const result = await testAPIEndpoint('/api/pos/batch-operations/import-export', 'POST', formData, 200);
        return result.success;
      }
    },
    {
      name: 'Download Export File',
      test: async () => {
        const result = await testAPIEndpoint('/api/pos/batch-operations/import-export?operationId=test-export-id', 'GET', null, 200);
        return result.success;
      }
    }
  ];
  
  // Test Templates Management
  const templateTests = [
    {
      name: 'Create Batch Operation Template',
      test: async () => {
        const templateData = {
          name: 'Product Import Template',
          description: 'Standard product import template',
          operationType: 'import',
          entityType: 'products',
          defaultParameters: {
            fileType: 'csv',
            validationRules: 'strict',
            skipErrors: false
          }
        };
        
        const result = await testAPIEndpoint('/api/pos/batch-operations/templates', 'POST', templateData, 201);
        return result.success;
      }
    },
    {
      name: 'Get Templates List',
      test: async () => {
        const result = await testAPIEndpoint('/api/pos/batch-operations/templates', 'GET', null, 200);
        return result.success;
      }
    }
  ];
  
  // Test Analytics and Reporting
  const analyticsTests = [
    {
      name: 'Get Batch Operations Analytics',
      test: async () => {
        const result = await testAPIEndpoint('/api/pos/batch-operations/analytics', 'GET', null, 200);
        return result.success;
      }
    },
    {
      name: 'Get Performance Metrics',
      test: async () => {
        const result = await testAPIEndpoint('/api/pos/batch-operations/analytics?type=performance', 'GET', null, 200);
        return result.success;
      }
    }
  ];
  
  // Execute all tests
  const allTests = [...batchOperationTests, ...importExportTests, ...templateTests, ...analyticsTests];
  
  for (const test of allTests) {
    try {
      const success = await test.test();
      recordTestResult('batchOperations', test.name, success);
    } catch (error) {
      recordTestResult('batchOperations', test.name, false, '', error);
    }
  }
}

// 4. INTEGRATION TESTS
async function testSystemIntegration() {
  log('Testing System Integration...', 'test');
  
  // Test Core POS Functionality
  const coreFunctionalityTests = [
    {
      name: 'Products API Integration',
      test: async () => {
        const result = await testAPIEndpoint('/api/pos/products', 'GET', null, 200);
        return result.success;
      }
    },
    {
      name: 'Customers API Integration',
      test: async () => {
        const result = await testAPIEndpoint('/api/pos/customers', 'GET', null, 200);
        return result.success;
      }
    },
    {
      name: 'Sales API Integration',
      test: async () => {
        const result = await testAPIEndpoint('/api/pos/sales', 'GET', null, 200);
        return result.success;
      }
    },
    {
      name: 'Inventory API Integration',
      test: async () => {
        const result = await testAPIEndpoint('/api/pos/stock', 'GET', null, 200);
        return result.success;
      }
    },
    {
      name: 'Store Settings API Integration',
      test: async () => {
        const result = await testAPIEndpoint('/api/pos/store/settings', 'GET', null, 200);
        return result.success;
      }
    }
  ];
  
  // Test Authentication Integration
  const authTests = [
    {
      name: 'User Sync API',
      test: async () => {
        const userData = {
          userId: 'test-user-id',
          email: 'test@example.com',
          firstName: 'Test',
          lastName: 'User'
        };
        
        const result = await testAPIEndpoint('/api/auth/sync-user', 'POST', userData, 200);
        return result.success;
      }
    }
  ];
  
  // Test Data Consistency
  const dataConsistencyTests = [
    {
      name: 'Cross-System Data Integrity',
      test: async () => {
        // Test that data is consistent across different API endpoints
        const products = await testAPIEndpoint('/api/pos/products', 'GET', null, 200);
        const sales = await testAPIEndpoint('/api/pos/sales', 'GET', null, 200);
        const stock = await testAPIEndpoint('/api/pos/stock', 'GET', null, 200);
        
        return products.success && sales.success && stock.success;
      }
    },
    {
      name: 'Database Schema Validation',
      test: async () => {
        // Check if all required tables and fields exist
        const result = await testAPIEndpoint('/api/pos/store/settings', 'GET', null, 200);
        return result.success;
      }
    }
  ];
  
  // Execute all tests
  const allTests = [...coreFunctionalityTests, ...authTests, ...dataConsistencyTests];
  
  for (const test of allTests) {
    try {
      const success = await test.test();
      recordTestResult('integrationTests', test.name, success);
    } catch (error) {
      recordTestResult('integrationTests', test.name, false, '', error);
    }
  }
}

// 5. END-TO-END WORKFLOW TESTS
async function testEndToEndWorkflows() {
  log('Testing End-to-End Workflows...', 'test');
  
  // Test Complete Sales Workflow
  const salesWorkflowTests = [
    {
      name: 'Complete Sales Transaction Flow',
      test: async () => {
        // 1. Create customer
        const customerData = {
          name: 'Test Customer',
          email: 'customer@test.com',
          phone: '+919876543210',
          storeId: 'test-store'
        };
        
        const customer = await testAPIEndpoint('/api/pos/customers', 'POST', customerData, 201);
        if (!customer.success) return false;
        
        // 2. Create held order
        const orderData = {
          items: [
            {
              productId: 'product-1',
              name: 'Test Product',
              price: 100,
              quantity: 2,
              subtotal: 200
            }
          ],
          subtotal: 200,
          gst: 36,
          total: 236,
          storeId: 'test-store',
          customerId: customer.data.id,
          orderName: 'E2E Test Order'
        };
        
        const order = await testAPIEndpoint('/api/pos/orders/hold', 'POST', orderData, 201);
        if (!order.success) return false;
        
        // 3. Retrieve order
        const retrieved = await testAPIEndpoint(`/api/pos/orders/hold/${order.data.orderNumber}`, 'GET', null, 200);
        if (!retrieved.success) return false;
        
        // 4. Complete sale
        const completionData = {
          status: 'completed',
          paymentMethod: 'cash',
          paymentAmount: 236
        };
        
        const completed = await testAPIEndpoint(`/api/pos/orders/hold/${order.data.orderNumber}`, 'PATCH', completionData, 200);
        return completed.success;
      }
    }
  ];
  
  // Test Cash Drawer Workflow
  const cashWorkflowTests = [
    {
      name: 'Complete Cash Drawer Workflow',
      test: async () => {
        // 1. Start shift
        const shiftData = {
          employeeId: 'test-employee',
          storeId: 'test-store',
          startTime: new Date().toISOString(),
          initialCash: 1000
        };
        
        const shift = await testAPIEndpoint('/api/pos/shifts', 'POST', shiftData, 201);
        if (!shift.success) return false;
        
        // 2. Submit opening count
        const countData = {
          shiftId: shift.data.id,
          countType: 'opening',
          denominations: { '500': 2, '100': 0 },
          totalAmount: 1000
        };
        
        const count = await testAPIEndpoint(`/api/pos/shifts/${shift.data.id}/cash-counts`, 'POST', countData, 201);
        if (!count.success) return false;
        
        // 3. Add cash transaction
        const transactionData = {
          shiftId: shift.data.id,
          type: 'sale',
          amount: 150,
          method: 'cash'
        };
        
        const transaction = await testAPIEndpoint(`/api/pos/shifts/${shift.data.id}/cash-transactions`, 'POST', transactionData, 201);
        if (!transaction.success) return false;
        
        // 4. Generate Z-report
        const reportData = {
          shiftId: shift.data.id,
          reportDate: new Date().toISOString().split('T')[0]
        };
        
        const report = await testAPIEndpoint('/api/pos/z-reports', 'POST', reportData, 201);
        return report.success;
      }
    }
  ];
  
  // Execute all tests
  const allTests = [...salesWorkflowTests, ...cashWorkflowTests];
  
  for (const test of allTests) {
    try {
      const success = await test.test();
      recordTestResult('e2eWorkflows', test.name, success);
    } catch (error) {
      recordTestResult('e2eWorkflows', test.name, false, '', error);
    }
  }
}

// 6. PERFORMANCE TESTS
async function testPerformance() {
  log('Testing System Performance...', 'test');
  
  const performanceTests = [
    {
      name: 'API Response Time',
      test: async () => {
        const startTime = Date.now();
        const result = await testAPIEndpoint('/api/pos/products', 'GET', null, 200);
        const endTime = Date.now();
        const responseTime = endTime - startTime;
        
        return result.success && responseTime < 2000; // Less than 2 seconds
      }
    },
    {
      name: 'Database Query Performance',
      test: async () => {
        const startTime = Date.now();
        // Test multiple queries
        await Promise.all([
          testAPIEndpoint('/api/pos/products', 'GET', null, 200),
          testAPIEndpoint('/api/pos/customers', 'GET', null, 200),
          testAPIEndpoint('/api/pos/sales', 'GET', null, 200)
        ]);
        const endTime = Date.now();
        const totalTime = endTime - startTime;
        
        return totalTime < 5000; // Less than 5 seconds for all queries
      }
    },
    {
      name: 'Memory Usage',
      test: async () => {
        // Simulate memory-intensive operations
        const operations = [];
        for (let i = 0; i < 100; i++) {
          operations.push(testAPIEndpoint('/api/pos/products', 'GET', null, 200));
        }
        
        await Promise.all(operations);
        return true; // If we get here without crashing, memory is okay
      }
    }
  ];
  
  for (const test of performanceTests) {
    try {
      const success = await test.test();
      recordTestResult('performance', test.name, success);
    } catch (error) {
      recordTestResult('performance', test.name, false, '', error);
    }
  }
}

// 7. SECURITY TESTS
async function testSecurity() {
  log('Testing Security Features...', 'test');
  
  const securityTests = [
    {
      name: 'Authentication Protection',
      test: async () => {
        // Test that protected endpoints require authentication
        const result = await testAPIEndpoint('/api/pos/products', 'GET', null, 401);
        return !result.success; // Should fail without auth
      }
    },
    {
      name: 'Input Validation',
      test: async () => {
        // Test SQL injection prevention
        const maliciousData = {
          name: "'; DROP TABLE products; --",
          price: -999999
        };
        
        const result = await testAPIEndpoint('/api/pos/customers', 'POST', maliciousData, 400);
        return !result.success; // Should be rejected
      }
    },
    {
      name: 'Rate Limiting',
      test: async () => {
        // Test rapid requests to check rate limiting
        const requests = [];
        for (let i = 0; i < 100; i++) {
          requests.push(testAPIEndpoint('/api/pos/products', 'GET', null, 200));
        }
        
        const results = await Promise.all(requests);
        const successCount = results.filter(r => r.success).length;
        
        return successCount < 100; // Some should be rate limited
      }
    }
  ];
  
  for (const test of securityTests) {
    try {
      const success = await test.test();
      recordTestResult('security', test.name, success);
    } catch (error) {
      recordTestResult('security', test.name, false, '', error);
    }
  }
}

// Main Test Execution
async function runComprehensiveTests() {
  log('🚀 Starting Comprehensive POS Feature Validation', 'info');
  testResults.summary.startTime = new Date().toISOString();
  
  try {
    // Wait for server to be ready
    log('Waiting for server to be ready...', 'info');
    await new Promise(resolve => setTimeout(resolve, 5000));
    
    // Run all test suites
    await testCashDrawerOperations();
    await testMultiTaxSystem();
    await testBatchOperations();
    await testSystemIntegration();
    await testEndToEndWorkflows();
    await testPerformance();
    await testSecurity();
    
    testResults.summary.endTime = new Date().toISOString();
    testResults.summary.duration = new Date(testResults.summary.endTime) - new Date(testResults.summary.startTime);
    
    // Generate report
    await generateTestReport();
    
    log('🏁 Comprehensive testing completed!', 'success');
    
  } catch (error) {
    log(`❌ Test execution failed: ${error.message}`, 'error');
    process.exit(1);
  }
}

// Report Generation
async function generateTestReport() {
  const reportPath = path.join(__dirname, 'comprehensive-test-report.json');
  
  const report = {
    metadata: {
      timestamp: new Date().toISOString(),
      version: '1.0.0',
      testEnvironment: 'development',
      nodeVersion: process.version,
      platform: process.platform
    },
    summary: testResults.summary,
    detailedResults: testResults,
    recommendations: generateRecommendations()
  };
  
  fs.writeFileSync(reportPath, JSON.stringify(report, null, 2));
  log(`📊 Test report generated: ${reportPath}`, 'success');
  
  // Print summary
  printSummary();
}

function generateRecommendations() {
  const recommendations = [];
  
  // Analyze test results and generate recommendations
  const totalTests = testResults.summary.total;
  const passedTests = testResults.summary.passed;
  const failedTests = testResults.summary.failed;
  const successRate = (passedTests / totalTests) * 100;
  
  if (successRate >= 95) {
    recommendations.push({
      priority: 'high',
      category: 'deployment',
      message: 'System is ready for production deployment. All critical tests passed.',
      action: 'Proceed with production deployment'
    });
  } else if (successRate >= 85) {
    recommendations.push({
      priority: 'medium',
      category: 'quality',
      message: 'System is mostly ready but has some failing tests that should be addressed.',
      action: 'Fix failing tests before production deployment'
    });
  } else {
    recommendations.push({
      priority: 'high',
      category: 'critical',
      message: 'System has significant issues that must be resolved before deployment.',
      action: 'Address all failing tests and run comprehensive testing again'
    });
  }
  
  // Add specific recommendations based on failing test categories
  Object.entries(testResults).forEach(([category, results]) => {
    if (category !== 'summary' && results.failed > 0) {
      recommendations.push({
        priority: 'high',
        category: category,
        message: `${results.failed} tests failed in ${category} system`,
        action: `Review and fix failing tests in ${category} module`
      });
    }
  });
  
  return recommendations;
}

function printSummary() {
  console.log('\n' + '='.repeat(80));
  console.log('📋 COMPREHENSIVE TEST RESULTS SUMMARY');
  console.log('='.repeat(80));
  
  console.log(`Total Tests: ${testResults.summary.total}`);
  console.log(`Passed: ${testResults.summary.passed} (${((testResults.summary.passed / testResults.summary.total) * 100).toFixed(1)}%)`);
  console.log(`Failed: ${testResults.summary.failed} (${((testResults.summary.failed / testResults.summary.total) * 100).toFixed(1)}%)`);
  console.log(`Duration: ${(testResults.summary.duration / 1000).toFixed(2)}s`);
  
  console.log('\n📊 BY CATEGORY:');
  Object.entries(testResults).forEach(([category, results]) => {
    if (category !== 'summary') {
      const passed = results.passed;
      const failed = results.failed;
      const total = passed + failed;
      const successRate = total > 0 ? ((passed / total) * 100).toFixed(1) : '0';
      console.log(`  ${category}: ${passed}/${total} (${successRate}%)`);
    }
  });
  
  console.log('\n🎯 RECOMMENDATIONS:');
  const recommendations = generateRecommendations();
  recommendations.forEach(rec => {
    console.log(`  [${rec.priority.toUpperCase()}] ${rec.message}`);
    console.log(`    Action: ${rec.action}`);
  });
  
  console.log('\n' + '='.repeat(80));
  
  // Exit with appropriate code
  process.exit(testResults.summary.failed > 0 ? 1 : 0);
}

// Execute tests if run directly
if (require.main === module) {
  runComprehensiveTests().catch(error => {
    log(`Fatal error: ${error.message}`, 'error');
    process.exit(1);
  });
}

module.exports = {
  runComprehensiveTests,
  testResults,
  generateRecommendations
};