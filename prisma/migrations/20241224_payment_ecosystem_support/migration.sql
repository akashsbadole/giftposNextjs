-- Payment Ecosystem Support Migration
-- This migration adds support for Paytm and PineLabs payment providers

-- Payment Provider Configuration
CREATE TABLE IF NOT EXISTS "PaymentProvider" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "name" TEXT NOT NULL,
    "displayName" TEXT NOT NULL,
    "type" TEXT NOT NULL,
    "isActive" BOOLEAN NOT NULL DEFAULT 1,
    "config" TEXT,
    "capabilities" TEXT,
    "storeId" TEXT NOT NULL,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "PaymentProvider_storeId_fkey" FOREIGN KEY ("storeId") REFERENCES "Store"("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- Payment Terminal Integration
CREATE TABLE IF NOT EXISTS "TerminalIntegration" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "name" TEXT NOT NULL,
    "serialNumber" TEXT,
    "terminalId" TEXT NOT NULL,
    "model" TEXT,
    "status" TEXT NOT NULL DEFAULT 'offline',
    "lastHeartbeat" DATETIME,
    "capabilities" TEXT,
    "settings" TEXT,
    "providerId" TEXT NOT NULL,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "TerminalIntegration_providerId_fkey" FOREIGN KEY ("providerId") REFERENCES "PaymentProvider"("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- Payment Transaction
CREATE TABLE IF NOT EXISTS "PaymentTransaction" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "transactionId" TEXT,
    "orderId" TEXT,
    "amount" REAL NOT NULL,
    "currency" TEXT NOT NULL DEFAULT 'INR',
    "paymentMethod" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'pending',
    "providerStatus" TEXT,
    "customerInfo" TEXT,
    "responseData" TEXT,
    "failureReason" TEXT,
    "refundAmount" REAL,
    "refundReason" TEXT,
    "terminalId" TEXT,
    "providerId" TEXT NOT NULL,
    "saleId" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "completedAt" DATETIME,
    CONSTRAINT "PaymentTransaction_terminalId_fkey" FOREIGN KEY ("terminalId") REFERENCES "TerminalIntegration"("id"),
    CONSTRAINT "PaymentTransaction_providerId_fkey" FOREIGN KEY ("providerId") REFERENCES "PaymentProvider"("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "PaymentTransaction_saleId_fkey" FOREIGN KEY ("saleId") REFERENCES "Sale"("id")
);

-- Create indexes for better performance
CREATE INDEX IF NOT EXISTS "PaymentProvider_name_idx" ON "PaymentProvider"("name");
CREATE INDEX IF NOT EXISTS "PaymentProvider_storeId_idx" ON "PaymentProvider"("storeId");
CREATE INDEX IF NOT EXISTS "TerminalIntegration_providerId_idx" ON "TerminalIntegration"("providerId");
CREATE INDEX IF NOT EXISTS "TerminalIntegration_status_idx" ON "TerminalIntegration"("status");
CREATE INDEX IF NOT EXISTS "PaymentTransaction_providerId_idx" ON "PaymentTransaction"("providerId");
CREATE INDEX IF NOT EXISTS "PaymentTransaction_terminalId_idx" ON "PaymentTransaction"("terminalId");
CREATE INDEX IF NOT EXISTS "PaymentTransaction_status_idx" ON "PaymentTransaction"("status");
CREATE INDEX IF NOT EXISTS "PaymentTransaction_createdAt_idx" ON "PaymentTransaction"("createdAt");

-- Insert sample payment providers (optional - can be removed in production)
INSERT OR IGNORE INTO "PaymentProvider" ("id", "name", "displayName", "type", "isActive", "config", "capabilities", "storeId", "createdAt", "updatedAt")
SELECT 
    'sample_paytm',
    'paytm',
    'Paytm',
    'hybrid',
    1,
    '{"environment": "sandbox", "mid": "sample_mid", "key": "sample_key", "website": "WEBSTAGING", "industryTypeId": "Retail", "channelId": "WEB"}',
    '["card_swipe", "upi", "wallet", "netbanking", "emi"]',
    s.id,
    CURRENT_TIMESTAMP,
    CURRENT_TIMESTAMP
FROM "Store" s
LIMIT 1;

INSERT OR IGNORE INTO "PaymentProvider" ("id", "name", "displayName", "type", "isActive", "config", "capabilities", "storeId", "createdAt", "updatedAt")
SELECT 
    'sample_pinelabs',
    'pinelabs',
    'PineLabs',
    'terminal',
    1,
    '{"environment": "sandbox", "merchantId": "sample_merchant", "secretKey": "sample_secret", "accessToken": "sample_token", "storeId": "sample_store"}',
    '["card_swipe", "card_insert", "upi", "wallet", "netbanking", "emi", "sodexo"]',
    s.id,
    CURRENT_TIMESTAMP,
    CURRENT_TIMESTAMP
FROM "Store" s
LIMIT 1;