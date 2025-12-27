-- Enhanced Batch Operations System Migration
-- Comprehensive bulk processing capabilities for all POS operations

-- Create Batch Operation Templates
CREATE TABLE IF NOT EXISTS "BatchOperationTemplate" (
    "id" TEXT NOT NULL PRIMARY KEY DEFAULT (lower(hex(randomblob(16)))),
    "name" TEXT NOT NULL,
    "description" TEXT,
    "operationType" TEXT NOT NULL, -- import_products, export_customers, bulk_inventory_update, etc.
    "targetEntity" TEXT NOT NULL, -- products, customers, inventory, orders, categories
    "validationRules" TEXT, -- JSON validation rules
    "defaultParameters" TEXT, -- JSON default parameters
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "storeId" TEXT NOT NULL,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "BatchOperationTemplate_storeId_fkey" FOREIGN KEY ("storeId") REFERENCES "Store"("id") ON DELETE CASCADE
);

-- Create Batch Operations
CREATE TABLE IF NOT EXISTS "BatchOperation" (
    "id" TEXT NOT NULL PRIMARY KEY DEFAULT (lower(hex(randomblob(16)))),
    "operationId" TEXT NOT NULL UNIQUE, -- Human-readable operation ID
    "name" TEXT NOT NULL,
    "description" TEXT,
    "type" TEXT NOT NULL, -- import, export, bulk_update, mass_processing, scheduled
    "entityType" TEXT NOT NULL, -- products, customers, inventory, orders, categories, sales
    "status" TEXT NOT NULL DEFAULT "pending", -- pending, queued, running, paused, completed, failed, cancelled
    "priority" INTEGER NOT NULL DEFAULT 0,
    "totalRecords" INTEGER DEFAULT 0,
    "processedRecords" INTEGER DEFAULT 0,
    "successRecords" INTEGER DEFAULT 0,
    "failedRecords" INTEGER DEFAULT 0,
    "skippedRecords" INTEGER DEFAULT 0,
    "progressPercentage" REAL DEFAULT 0,
    "storeId" TEXT NOT NULL,
    "userId" TEXT, -- Clerk user ID who initiated the operation
    "templateId" TEXT, -- Reference to template if created from template
    "jobQueueId" TEXT, -- Reference to JobQueue for background processing
    "parameters" TEXT, -- JSON operation parameters
    "validationResults" TEXT, -- JSON validation results
    "errorLog" TEXT, -- JSON error details
    "resultData" TEXT, -- JSON operation results
    "scheduledAt" DATETIME,
    "startedAt" DATETIME,
    "completedAt" DATETIME,
    "pausedAt" DATETIME,
    "estimatedDuration" INTEGER, -- Estimated duration in seconds
    "actualDuration" INTEGER, -- Actual duration in seconds
    "canResume" BOOLEAN NOT NULL DEFAULT true,
    "retryCount" INTEGER NOT NULL DEFAULT 0,
    "maxRetries" INTEGER NOT NULL DEFAULT 3,
    "parentOperationId" TEXT, -- For nested operations
    "metadata" TEXT, -- JSON additional metadata
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "BatchOperation_storeId_fkey" FOREIGN KEY ("storeId") REFERENCES "Store"("id") ON DELETE CASCADE,
    CONSTRAINT "BatchOperation_userId_fkey" FOREIGN KEY ("userId") REFERENCES "Employee"("clerkId"),
    CONSTRAINT "BatchOperation_templateId_fkey" FOREIGN KEY ("templateId") REFERENCES "BatchOperationTemplate"("id"),
    CONSTRAINT "BatchOperation_jobQueueId_fkey" FOREIGN KEY ("jobQueueId") REFERENCES "JobQueue"("id"),
    CONSTRAINT "BatchOperation_parentOperationId_fkey" FOREIGN KEY ("parentOperationId") REFERENCES "BatchOperation"("id")
);

-- Create Batch Operation Records (Individual records in a batch)
CREATE TABLE IF NOT EXISTS "BatchOperationRecord" (
    "id" TEXT NOT NULL PRIMARY KEY DEFAULT (lower(hex(randomblob(16)))),
    "batchOperationId" TEXT NOT NULL,
    "recordId" TEXT, -- ID of the actual record being processed
    "recordIndex" INTEGER NOT NULL, -- Position in the batch
    "data" TEXT, -- JSON record data
    "status" TEXT NOT NULL DEFAULT "pending", -- pending, processing, completed, failed, skipped
    "validationStatus" TEXT NOT NULL DEFAULT "pending", -- pending, valid, invalid, warning
    "validationErrors" TEXT, -- JSON validation errors
    "processingResult" TEXT, -- JSON processing result
    "errorMessage" TEXT,
    "retryCount" INTEGER NOT NULL DEFAULT 0,
    "processedAt" DATETIME,
    "errorAt" DATETIME,
    "skippedAt" DATETIME,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "BatchOperationRecord_batchOperationId_fkey" FOREIGN KEY ("batchOperationId") REFERENCES "BatchOperation"("id") ON DELETE CASCADE
);

-- Create Batch Operation Progress Tracking
CREATE TABLE IF NOT EXISTS "BatchOperationProgress" (
    "id" TEXT NOT NULL PRIMARY KEY DEFAULT (lower(hex(randomblob(16)))),
    "batchOperationId" TEXT NOT NULL,
    "phase" TEXT NOT NULL, -- validation, processing, completion, rollback
    "phaseStatus" TEXT NOT NULL DEFAULT "pending", -- pending, running, completed, failed
    "currentStep" TEXT, -- Current step being processed
    "totalSteps" INTEGER,
    "completedSteps" INTEGER DEFAULT 0,
    "progressPercentage" REAL DEFAULT 0,
    "startTime" DATETIME,
    "endTime" DATETIME,
    "estimatedTimeRemaining" INTEGER, -- Seconds
    "currentRecordIndex" INTEGER DEFAULT 0,
    "lastProcessedRecordId" TEXT,
    "currentProcessingRate" REAL, -- Records per second
    "peakMemoryUsage" REAL, -- MB
    "errorCount" INTEGER DEFAULT 0,
    "warningCount" INTEGER DEFAULT 0,
    "metadata" TEXT, -- JSON additional progress metadata
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "BatchOperationProgress_batchOperationId_fkey" FOREIGN KEY ("batchOperationId") REFERENCES "BatchOperation"("id") ON DELETE CASCADE
);

-- Create Batch Operation Files (for import/export)
CREATE TABLE IF NOT EXISTS "BatchOperationFile" (
    "id" TEXT NOT NULL PRIMARY KEY DEFAULT (lower(hex(randomblob(16)))),
    "batchOperationId" TEXT NOT NULL,
    "fileName" TEXT NOT NULL,
    "originalFileName" TEXT,
    "fileType" TEXT NOT NULL, -- csv, xlsx, json, xml
    "fileSize" INTEGER, -- File size in bytes
    "filePath" TEXT, -- Storage path
    "fileHash" TEXT, -- SHA256 hash for integrity
    "mimeType" TEXT,
    "encoding" TEXT,
    "delimiter" TEXT, -- For CSV files
    "hasHeader" BOOLEAN NOT NULL DEFAULT true,
    "sheetName" TEXT, -- For Excel files
    "totalRows" INTEGER,
    "processedRows" INTEGER DEFAULT 0,
    "validRows" INTEGER DEFAULT 0,
    "invalidRows" INTEGER DEFAULT 0,
    "skippedRows" INTEGER DEFAULT 0,
    "errorRows" INTEGER DEFAULT 0,
    "previewData" TEXT, -- JSON preview of first few rows
    "columnMapping" TEXT, -- JSON column mapping
    "fileStatus" TEXT NOT NULL DEFAULT "uploaded", -- uploaded, processing, processed, failed
    "uploadedAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "processedAt" DATETIME,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "BatchOperationFile_batchOperationId_fkey" FOREIGN KEY ("batchOperationId") REFERENCES "BatchOperation"("id") ON DELETE CASCADE
);

-- Create Batch Operation History/Audit
CREATE TABLE IF NOT EXISTS "BatchOperationHistory" (
    "id" TEXT NOT NULL PRIMARY KEY DEFAULT (lower(hex(randomblob(16)))),
    "batchOperationId" TEXT NOT NULL,
    "eventType" TEXT NOT NULL, -- created, started, paused, resumed, completed, failed, cancelled
    "eventDescription" TEXT,
    "userId" TEXT,
    "userName" TEXT,
    "userEmail" TEXT,
    "previousStatus" TEXT,
    "newStatus" TEXT,
    "phase" TEXT,
    "step" TEXT,
    "details" TEXT, -- JSON additional details
    "errorMessage" TEXT,
    "timestamp" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "BatchOperationHistory_batchOperationId_fkey" FOREIGN KEY ("batchOperationId") REFERENCES "BatchOperation"("id") ON DELETE CASCADE
);

-- Create Batch Operation Schedules
CREATE TABLE IF NOT EXISTS "BatchOperationSchedule" (
    "id" TEXT NOT NULL PRIMARY KEY DEFAULT (lower(hex(randomblob(16)))),
    "name" TEXT NOT NULL,
    "description" TEXT,
    "batchOperationTemplateId" TEXT NOT NULL,
    "cronExpression" TEXT, -- Cron expression for scheduling
    "intervalMinutes" INTEGER, -- Alternative to cron for simple intervals
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "priority" INTEGER NOT NULL DEFAULT 0,
    "maxConcurrentRuns" INTEGER NOT NULL DEFAULT 1,
    "parameters" TEXT, -- JSON parameters to override template defaults
    "conditions" TEXT, -- JSON conditions for execution
    "lastRunAt" DATETIME,
    "nextRunAt" DATETIME,
    "runCount" INTEGER NOT NULL DEFAULT 0,
    "failureCount" INTEGER NOT NULL DEFAULT 0,
    "lastFailureAt" DATETIME,
    "storeId" TEXT NOT NULL,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "BatchOperationSchedule_batchOperationTemplateId_fkey" FOREIGN KEY ("batchOperationTemplateId") REFERENCES "BatchOperationTemplate"("id") ON DELETE CASCADE,
    CONSTRAINT "BatchOperationSchedule_storeId_fkey" FOREIGN KEY ("storeId") REFERENCES "Store"("id") ON DELETE CASCADE
);

-- Create indexes for performance
CREATE INDEX IF NOT EXISTS "BatchOperationTemplate_storeId_idx" ON "BatchOperationTemplate"("storeId");
CREATE INDEX IF NOT EXISTS "BatchOperationTemplate_operationType_idx" ON "BatchOperationTemplate"("operationType");
CREATE INDEX IF NOT EXISTS "BatchOperationTemplate_targetEntity_idx" ON "BatchOperationTemplate"("targetEntity");

CREATE INDEX IF NOT EXISTS "BatchOperation_storeId_idx" ON "BatchOperation"("storeId");
CREATE INDEX IF NOT EXISTS "BatchOperation_status_idx" ON "BatchOperation"("status");
CREATE INDEX IF NOT EXISTS "BatchOperation_type_idx" ON "BatchOperation"("type");
CREATE INDEX IF NOT EXISTS "BatchOperation_entityType_idx" ON "BatchOperation"("entityType");
CREATE INDEX IF NOT EXISTS "BatchOperation_userId_idx" ON "BatchOperation"("userId");
CREATE INDEX IF NOT EXISTS "BatchOperation_createdAt_idx" ON "BatchOperation"("createdAt");
CREATE INDEX IF NOT EXISTS "BatchOperation_priority_idx" ON "BatchOperation"("priority");
CREATE INDEX IF NOT EXISTS "BatchOperation_scheduledAt_idx" ON "BatchOperation"("scheduledAt");
CREATE INDEX IF NOT EXISTS "BatchOperation_parentOperationId_idx" ON "BatchOperation"("parentOperationId");

CREATE INDEX IF NOT EXISTS "BatchOperationRecord_batchOperationId_idx" ON "BatchOperationRecord"("batchOperationId");
CREATE INDEX IF NOT EXISTS "BatchOperationRecord_status_idx" ON "BatchOperationRecord"("status");
CREATE INDEX IF NOT EXISTS "BatchOperationRecord_validationStatus_idx" ON "BatchOperationRecord"("validationStatus");
CREATE INDEX IF NOT EXISTS "BatchOperationRecord_recordIndex_idx" ON "BatchOperationRecord"("recordIndex");

CREATE INDEX IF NOT EXISTS "BatchOperationProgress_batchOperationId_idx" ON "BatchOperationProgress"("batchOperationId");
CREATE INDEX IF NOT EXISTS "BatchOperationProgress_phase_idx" ON "BatchOperationProgress"("phase");
CREATE INDEX IF NOT EXISTS "BatchOperationProgress_phaseStatus_idx" ON "BatchOperationProgress"("phaseStatus");

CREATE INDEX IF NOT EXISTS "BatchOperationFile_batchOperationId_idx" ON "BatchOperationFile"("batchOperationId");
CREATE INDEX IF NOT EXISTS "BatchOperationFile_fileStatus_idx" ON "BatchOperationFile"("fileStatus");
CREATE INDEX IF NOT EXISTS "BatchOperationFile_fileType_idx" ON "BatchOperationFile"("fileType");

CREATE INDEX IF NOT EXISTS "BatchOperationHistory_batchOperationId_idx" ON "BatchOperationHistory"("batchOperationId");
CREATE INDEX IF NOT EXISTS "BatchOperationHistory_eventType_idx" ON "BatchOperationHistory"("eventType");
CREATE INDEX IF NOT EXISTS "BatchOperationHistory_timestamp_idx" ON "BatchOperationHistory"("timestamp");

CREATE INDEX IF NOT EXISTS "BatchOperationSchedule_storeId_idx" ON "BatchOperationSchedule"("storeId");
CREATE INDEX IF NOT EXISTS "BatchOperationSchedule_batchOperationTemplateId_idx" ON "BatchOperationSchedule"("batchOperationTemplateId");
CREATE INDEX IF NOT EXISTS "BatchOperationSchedule_isActive_idx" ON "BatchOperationSchedule"("isActive");
CREATE INDEX IF NOT EXISTS "BatchOperationSchedule_nextRunAt_idx" ON "BatchOperationSchedule"("nextRunAt");