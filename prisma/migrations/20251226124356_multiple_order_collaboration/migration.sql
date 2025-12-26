-- Migration for Multiple Order Management System
-- Collaboration, Locking, Analytics, Workflow, and Job Queue Features

-- CreateTable: CollaborationSession
CREATE TABLE "CollaborationSession" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "sessionId" TEXT NOT NULL,
    "heldOrderId" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "userEmail" TEXT,
    "userName" TEXT NOT NULL,
    "role" TEXT NOT NULL DEFAULT 'collaborator',
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "lastSeenAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "cursorPosition" TEXT,
    "editLock" TEXT,
    "heartbeatAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "metadata" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "CollaborationSession_heldOrderId_fkey" FOREIGN KEY ("heldOrderId") REFERENCES "HeldOrder" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable: OrderLock
CREATE TABLE "OrderLock" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "heldOrderId" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "userEmail" TEXT,
    "userName" TEXT NOT NULL,
    "lockType" TEXT NOT NULL DEFAULT 'full',
    "lockScope" TEXT NOT NULL DEFAULT 'exclusive',
    "reason" TEXT,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "expiresAt" DATETIME,
    "acquiredAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "lastRenewedAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "metadata" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "OrderLock_heldOrderId_fkey" FOREIGN KEY ("heldOrderId") REFERENCES "HeldOrder" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable: OrderAnalytics
CREATE TABLE "OrderAnalytics" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "date" DATETIME NOT NULL,
    "storeId" TEXT NOT NULL,
    "totalOrders" INTEGER NOT NULL DEFAULT 0,
    "completedOrders" INTEGER NOT NULL DEFAULT 0,
    "cancelledOrders" INTEGER NOT NULL DEFAULT 0,
    "expiredOrders" INTEGER NOT NULL DEFAULT 0,
    "totalRevenue" REAL NOT NULL DEFAULT 0,
    "avgOrderValue" REAL NOT NULL DEFAULT 0,
    "totalDiscounts" REAL NOT NULL DEFAULT 0,
    "totalGST" REAL NOT NULL DEFAULT 0,
    "avgProcessingTime" REAL NOT NULL DEFAULT 0,
    "avgHoldDuration" REAL NOT NULL DEFAULT 0,
    "peakHourOrders" INTEGER NOT NULL DEFAULT 0,
    "activeUsers" INTEGER NOT NULL DEFAULT 0,
    "collaborativeSessions" INTEGER NOT NULL DEFAULT 0,
    "categoryBreakdown" TEXT,
    "productBreakdown" TEXT,
    "customMetrics" TEXT,
    "metadata" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "OrderAnalytics_storeId_fkey" FOREIGN KEY ("storeId") REFERENCES "Store" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable: WorkflowRule
CREATE TABLE "WorkflowRule" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "name" TEXT NOT NULL,
    "description" TEXT,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "priority" INTEGER NOT NULL DEFAULT 0,
    "triggerType" TEXT NOT NULL,
    "triggerConditions" TEXT NOT NULL,
    "conditions" TEXT,
    "actions" TEXT NOT NULL,
    "maxExecutions" INTEGER NOT NULL DEFAULT 1,
    "executionCount" INTEGER NOT NULL DEFAULT 0,
    "lastExecutedAt" DATETIME,
    "nextExecutionAt" DATETIME,
    "errorCount" INTEGER NOT NULL DEFAULT 0,
    "lastError" TEXT,
    "storeId" TEXT NOT NULL,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "WorkflowRule_storeId_fkey" FOREIGN KEY ("storeId") REFERENCES "Store" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable: WorkflowAction
CREATE TABLE "WorkflowAction" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "ruleId" TEXT NOT NULL,
    "executionId" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'pending',
    "actionType" TEXT NOT NULL,
    "actionConfig" TEXT NOT NULL,
    "contextData" TEXT,
    "result" TEXT,
    "errorMessage" TEXT,
    "startedAt" DATETIME,
    "completedAt" DATETIME,
    "duration" REAL,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "WorkflowAction_ruleId_fkey" FOREIGN KEY ("ruleId") REFERENCES "WorkflowRule" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable: JobQueue
CREATE TABLE "JobQueue" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "jobId" TEXT NOT NULL,
    "type" TEXT NOT NULL,
    "jobData" TEXT NOT NULL,
    "priority" INTEGER NOT NULL DEFAULT 0,
    "scheduledAt" DATETIME NOT NULL,
    "startedAt" DATETIME,
    "completedAt" DATETIME,
    "status" TEXT NOT NULL DEFAULT 'pending',
    "attempts" INTEGER NOT NULL DEFAULT 0,
    "maxAttempts" INTEGER NOT NULL DEFAULT 3,
    "result" TEXT,
    "errorMessage" TEXT,
    "errorStack" TEXT,
    "dependsOn" TEXT,
    "parentJobId" TEXT,
    "metadata" TEXT,
    "storeId" TEXT,
    "userId" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL
);

-- CreateIndex: CollaborationSession
CREATE UNIQUE INDEX "CollaborationSession_sessionId_key" ON "CollaborationSession"("sessionId");
CREATE INDEX "CollaborationSession_heldOrderId_idx" ON "CollaborationSession"("heldOrderId");
CREATE INDEX "CollaborationSession_userId_idx" ON "CollaborationSession"("userId");
CREATE INDEX "CollaborationSession_sessionId_idx" ON "CollaborationSession"("sessionId");
CREATE INDEX "CollaborationSession_isActive_idx" ON "CollaborationSession"("isActive");
CREATE INDEX "CollaborationSession_heartbeatAt_idx" ON "CollaborationSession"("heartbeatAt");

-- CreateIndex: OrderLock
CREATE UNIQUE INDEX "OrderLock_heldOrderId_key" ON "OrderLock"("heldOrderId");
CREATE INDEX "OrderLock_heldOrderId_idx" ON "OrderLock"("heldOrderId");
CREATE INDEX "OrderLock_userId_idx" ON "OrderLock"("userId");
CREATE INDEX "OrderLock_isActive_idx" ON "OrderLock"("isActive");
CREATE INDEX "OrderLock_expiresAt_idx" ON "OrderLock"("expiresAt");

-- CreateIndex: OrderAnalytics
CREATE UNIQUE INDEX "OrderAnalytics_date_storeId_key" ON "OrderAnalytics"("date", "storeId");
CREATE INDEX "OrderAnalytics_date_idx" ON "OrderAnalytics"("date");
CREATE INDEX "OrderAnalytics_storeId_idx" ON "OrderAnalytics"("storeId");
CREATE INDEX "OrderAnalytics_totalRevenue_idx" ON "OrderAnalytics"("totalRevenue");

-- CreateIndex: WorkflowRule
CREATE INDEX "WorkflowRule_storeId_idx" ON "WorkflowRule"("storeId");
CREATE INDEX "WorkflowRule_isActive_idx" ON "WorkflowRule"("isActive");
CREATE INDEX "WorkflowRule_priority_idx" ON "WorkflowRule"("priority");
CREATE INDEX "WorkflowRule_triggerType_idx" ON "WorkflowRule"("triggerType");
CREATE INDEX "WorkflowRule_nextExecutionAt_idx" ON "WorkflowRule"("nextExecutionAt");

-- CreateIndex: WorkflowAction
CREATE INDEX "WorkflowAction_ruleId_idx" ON "WorkflowAction"("ruleId");
CREATE UNIQUE INDEX "WorkflowAction_executionId_key" ON "WorkflowAction"("executionId");
CREATE INDEX "WorkflowAction_status_idx" ON "WorkflowAction"("status");
CREATE INDEX "WorkflowAction_actionType_idx" ON "WorkflowAction"("actionType");
CREATE INDEX "WorkflowAction_startedAt_idx" ON "WorkflowAction"("startedAt");

-- CreateIndex: JobQueue
CREATE UNIQUE INDEX "JobQueue_jobId_key" ON "JobQueue"("jobId");
CREATE INDEX "JobQueue_type_idx" ON "JobQueue"("type");
CREATE INDEX "JobQueue_status_idx" ON "JobQueue"("status");
CREATE INDEX "JobQueue_priority_idx" ON "JobQueue"("priority");
CREATE INDEX "JobQueue_scheduledAt_idx" ON "JobQueue"("scheduledAt");
CREATE INDEX "JobQueue_startedAt_idx" ON "JobQueue"("startedAt");
CREATE INDEX "JobQueue_storeId_idx" ON "JobQueue"("storeId");
CREATE INDEX "JobQueue_parentJobId_idx" ON "JobQueue"("parentJobId");