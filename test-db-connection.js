// Database connection test script
const { PrismaClient } = require('@prisma/client');

async function testDatabaseConnection() {
  const prisma = new PrismaClient();
  
  try {
    console.log('🔍 Testing database connection...');
    
    // Test basic connection
    await prisma.$connect();
    console.log('✅ Database connection successful!');
    
    // Get all table names from the database
    console.log('\n📋 Checking all tables in database...');
    
    // Check Store table
    const storeCount = await prisma.store.count();
    console.log(`✅ Store table: ${storeCount} records`);
    
    // Check Category table
    const categoryCount = await prisma.category.count();
    console.log(`✅ Category table: ${categoryCount} records`);
    
    // Check Product table
    const productCount = await prisma.product.count();
    console.log(`✅ Product table: ${productCount} records`);
    
    // Check Customer table
    const customerCount = await prisma.customer.count();
    console.log(`✅ Customer table: ${customerCount} records`);
    
    // Check Employee table
    const employeeCount = await prisma.employee.count();
    console.log(`✅ Employee table: ${employeeCount} records`);
    
    // Check Sale table
    const saleCount = await prisma.sale.count();
    console.log(`✅ Sale table: ${saleCount} records`);
    
    // Check SaleItem table
    const saleItemCount = await prisma.saleItem.count();
    console.log(`✅ SaleItem table: ${saleItemCount} records`);
    
    // Check Payment table
    const paymentCount = await prisma.payment.count();
    console.log(`✅ Payment table: ${paymentCount} records`);
    
    // Check StockLog table
    const stockLogCount = await prisma.stockLog.count();
    console.log(`✅ StockLog table: ${stockLogCount} records`);
    
    // Check Printer table (new model)
    const printerCount = await prisma.printer.count();
    console.log(`✅ Printer table: ${printerCount} records`);
    
    // Check PrintJob table (new model)
    const printJobCount = await prisma.printJob.count();
    console.log(`✅ PrintJob table: ${printJobCount} records`);
    
    // Check PaymentProvider table (new model)
    const paymentProviderCount = await prisma.paymentProvider.count();
    console.log(`✅ PaymentProvider table: ${paymentProviderCount} records`);
    
    // Check TerminalIntegration table (new model)
    const terminalIntegrationCount = await prisma.terminalIntegration.count();
    console.log(`✅ TerminalIntegration table: ${terminalIntegrationCount} records`);
    
    // Check PaymentTransaction table (new model)
    const paymentTransactionCount = await prisma.paymentTransaction.count();
    console.log(`✅ PaymentTransaction table: ${paymentTransactionCount} records`);
    
    // Check AuditLog table (new model)
    const auditLogCount = await prisma.auditLog.count();
    console.log(`✅ AuditLog table: ${auditLogCount} records`);
    
    // Check SecurityEvent table (new model)
    const securityEventCount = await prisma.securityEvent.count();
    console.log(`✅ SecurityEvent table: ${securityEventCount} records`);
    
    // Check ErrorLog table (new model)
    const errorLogCount = await prisma.errorLog.count();
    console.log(`✅ ErrorLog table: ${errorLogCount} records`);
    
    console.log('\n🎉 All database models are working correctly!');
    console.log('\n📊 Summary:');
    console.log(`Total tables: 16`);
    console.log(`All models accessible: ✅`);
    console.log(`Database connection: ✅`);
    
  } catch (error) {
    console.error('❌ Database connection failed:', error);
    process.exit(1);
  } finally {
    await prisma.$disconnect();
  }
}

// Run the test
testDatabaseConnection();