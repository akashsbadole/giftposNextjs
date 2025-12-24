-- Create Printer and PrintJob tables for comprehensive printer support
-- Migration: Add multiple printer support systems

-- Printer device management table
CREATE TABLE IF NOT EXISTS "Printer" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "name" TEXT NOT NULL,
    "type" TEXT NOT NULL, -- thermal, inkjet, label, laser
    "brand" TEXT NOT NULL, -- epson, star, tvs, hp, canon, zebra, dymo
    "model" TEXT NOT NULL,
    "connection" TEXT NOT NULL, -- usb, bluetooth, network, wifi
    "status" TEXT NOT NULL DEFAULT 'offline' CHECK ("status" IN ('online', 'offline', 'error', 'printing')),
    "isDefault" BOOLEAN NOT NULL DEFAULT FALSE,
    "settings" TEXT, -- JSON string with printer-specific settings
    "capabilities" TEXT, -- JSON string with printer capabilities
    "lastConnected" DATETIME,
    "storeId" TEXT NOT NULL,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY ("storeId") REFERENCES "Store"("id") ON DELETE CASCADE
);

-- Print job queue table
CREATE TABLE IF NOT EXISTS "PrintJob" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "type" TEXT NOT NULL, -- receipt, invoice, label, report
    "content" TEXT NOT NULL, -- Content to print (ESC/POS commands, text, etc.)
    "status" TEXT NOT NULL DEFAULT 'pending' CHECK ("status" IN ('pending', 'printing', 'completed', 'failed')),
    "priority" INTEGER NOT NULL DEFAULT 0, -- Higher numbers = higher priority
    "retryCount" INTEGER NOT NULL DEFAULT 0,
    "error" TEXT, -- Error message if failed
    "printerId" TEXT NOT NULL,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "startedAt" DATETIME,
    "completedAt" DATETIME,
    FOREIGN KEY ("printerId") REFERENCES "Printer"("id") ON DELETE CASCADE
);

-- Create indexes for better performance
CREATE INDEX IF NOT EXISTS "idx_printer_storeId" ON "Printer"("storeId");
CREATE INDEX IF NOT EXISTS "idx_printer_type" ON "Printer"("type");
CREATE INDEX IF NOT EXISTS "idx_printer_status" ON "Printer"("status");
CREATE INDEX IF NOT EXISTS "idx_printJob_printerId" ON "PrintJob"("printerId");
CREATE INDEX IF NOT EXISTS "idx_printJob_status" ON "PrintJob"("status");
CREATE INDEX IF NOT EXISTS "idx_printJob_createdAt" ON "PrintJob"("createdAt");

-- Create trigger to update updatedAt on Printer changes
CREATE TRIGGER IF NOT EXISTS "update_printer_updated_at"
    AFTER UPDATE ON "Printer"
    FOR EACH ROW
    BEGIN
        UPDATE "Printer" SET "updatedAt" = CURRENT_TIMESTAMP WHERE "id" = NEW."id";
    END;

-- Add PrintJob table to Store relation (implicitly through Printer)
-- This ensures data consistency and allows cascade deletes