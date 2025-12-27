import { PrismaClient } from '@prisma/client'
import { BatchOperationManager } from './batch-operations-manager'
import { AuditLogger } from './security/audit-logger'

const prisma = new PrismaClient()

export interface JobProcessorConfig {
  maxConcurrentJobs: number
  jobTimeoutMinutes: number
  retryDelaySeconds: number
  maxRetries: number
  batchSize: number
  enableMonitoring: boolean
}

export interface ProcessingMetrics {
  jobId: string
  operationId: string
  startTime: Date
  endTime?: Date
  duration?: number
  recordsProcessed: number
  recordsPerSecond: number
  peakMemoryUsage: number
  errors: string[]
  warnings: string[]
}

export class BatchJobProcessor {
  private static instance: BatchJobProcessor
  private isProcessing = false
  private activeJobs = new Map<string, ProcessingMetrics>()
  private config: JobProcessorConfig

  private constructor(config?: Partial<JobProcessorConfig>) {
    this.config = {
      maxConcurrentJobs: 5,
      jobTimeoutMinutes: 60,
      retryDelaySeconds: 30,
      maxRetries: 3,
      batchSize: 100,
      enableMonitoring: true,
      ...config
    }
  }

  public static getInstance(config?: Partial<JobProcessorConfig>): BatchJobProcessor {
    if (!BatchJobProcessor.instance) {
      BatchJobProcessor.instance = new BatchJobProcessor(config)
    }
    return BatchJobProcessor.instance
  }

  // Start the job processor
  public async start(): Promise<void> {
    if (this.isProcessing) {
      console.log('Batch job processor is already running')
      return
    }

    this.isProcessing = true
    console.log('Starting batch job processor...')

    // Start the main processing loop
    this.processJobsLoop()

    // Start monitoring loop
    if (this.config.enableMonitoring) {
      this.monitoringLoop()
    }

    console.log('Batch job processor started successfully')
  }

  // Stop the job processor
  public async stop(): Promise<void> {
    if (!this.isProcessing) {
      return
    }

    this.isProcessing = false
    console.log('Stopping batch job processor...')

    // Wait for active jobs to complete (with timeout)
    const startTime = Date.now()
    const timeout = this.config.jobTimeoutMinutes * 60 * 1000

    while (this.activeJobs.size > 0 && Date.now() - startTime < timeout) {
      await this.sleep(1000)
    }

    console.log('Batch job processor stopped')
  }

  // Main processing loop
  private async processJobsLoop(): Promise<void> {
    while (this.isProcessing) {
      try {
        // Check if we can process more jobs
        if (this.activeJobs.size >= this.config.maxConcurrentJobs) {
          await this.sleep(2000)
          continue
        }

        // Get next queued job
        const nextJob = await this.getNextQueuedJob()
        if (!nextJob) {
          await this.sleep(5000) // No jobs, wait longer
          continue
        }

        // Process the job
        this.processJob(nextJob)

      } catch (error) {
        console.error('Error in job processing loop:', error)
        await this.sleep(10000) // Wait before retrying
      }
    }
  }

  // Monitoring loop for job health and progress
  private async monitoringLoop(): Promise<void> {
    while (this.isProcessing) {
      try {
        await this.monitorActiveJobs()
        await this.cleanupCompletedJobs()
        await this.updateJobProgress()
        await this.sleep(30000) // Check every 30 seconds
      } catch (error) {
        console.error('Error in monitoring loop:', error)
        await this.sleep(60000) // Wait longer on error
      }
    }
  }

  // Get the next queued job
  private async getNextQueuedJob() {
    return await prisma.batchOperation.findFirst({
      where: {
        status: 'queued'
      },
      orderBy: [
        { priority: 'desc' },
        { createdAt: 'asc' }
      ],
      include: {
        store: {
          select: { id: true, name: true }
        },
        user: {
          select: { id: true, name: true, email: true }
        }
      }
    })
  }

  // Process a single job
  private async processJob(job: any): Promise<void> {
    const jobId = `job-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`
    const metrics: ProcessingMetrics = {
      jobId,
      operationId: job.operationId,
      startTime: new Date(),
      recordsProcessed: 0,
      recordsPerSecond: 0,
      peakMemoryUsage: 0,
      errors: [],
      warnings: []
    }

    this.activeJobs.set(job.operationId, metrics)

    try {
      console.log(`Starting job ${jobId} for operation ${job.operationId}`)

      // Update job status to running
      await prisma.batchOperation.update({
        where: { operationId: job.operationId },
        data: {
          status: 'running',
          startedAt: new Date(),
          jobQueueId: jobId
        }
      })

      // Initialize progress tracking
      await this.initializeProgressTracking(job)

      // Get operation parameters
      const parameters = job.parameters ? JSON.parse(job.parameters) : {}
      const metadata = job.metadata ? JSON.parse(job.metadata) : {}

      // Process based on operation type
      let result
      switch (job.type) {
        case 'import':
          result = await this.processImportJob(job, parameters, metadata)
          break
        case 'export':
          result = await this.processExportJob(job, parameters, metadata)
          break
        case 'bulk_update':
          result = await this.processBulkUpdateJob(job, parameters, metadata)
          break
        case 'mass_processing':
          result = await this.processMassProcessingJob(job, parameters, metadata)
          break
        default:
          throw new Error(`Unsupported operation type: ${job.type}`)
      }

      // Update final metrics
      metrics.endTime = new Date()
      metrics.duration = metrics.endTime.getTime() - metrics.startTime.getTime()

      console.log(`Completed job ${jobId} for operation ${job.operationId}`, {
        duration: metrics.duration,
        recordsProcessed: metrics.recordsProcessed,
        recordsPerSecond: metrics.recordsPerSecond
      })

      // Log completion
      await AuditLogger.log({
        timestamp: new Date(),
        userId: job.userId,
        userEmail: job.user?.email,
        action: 'batch_job_completed',
        resource: 'batch_operation',
        resourceId: job.id,
        method: 'POST',
        path: '/api/pos/batch-operations',
        status: 'success',
        severity: 'low',
        details: {
          jobId,
          operationId: job.operationId,
          duration: metrics.duration,
          recordsProcessed: metrics.recordsProcessed,
          recordsPerSecond: metrics.recordsPerSecond,
          result
        }
      })

    } catch (error) {
      console.error(`Error processing job ${jobId}:`, error)
      
      metrics.endTime = new Date()
      metrics.duration = metrics.endTime.getTime() - metrics.startTime.getTime()
      metrics.errors.push(error instanceof Error ? error.message : 'Unknown error')

      // Update job status to failed
      await prisma.batchOperation.update({
        where: { operationId: job.operationId },
        data: {
          status: 'failed',
          completedAt: new Date(),
          errorLog: JSON.stringify({
            jobId,
            error: error instanceof Error ? error.message : 'Unknown error',
            stack: error instanceof Error ? error.stack : undefined,
            metrics
          })
        }
      })

      // Log failure
      await AuditLogger.log({
        timestamp: new Date(),
        userId: job.userId,
        userEmail: job.user?.email,
        action: 'batch_job_failed',
        resource: 'batch_operation',
        resourceId: job.id,
        method: 'POST',
        path: '/api/pos/batch-operations',
        status: 'failure',
        severity: 'high',
        details: {
          jobId,
          operationId: job.operationId,
          error: error instanceof Error ? error.message : 'Unknown error',
          metrics
        }
      })

    } finally {
      // Clean up
      this.activeJobs.delete(job.operationId)
      
      // Remove from JobQueue if it was added there
      try {
        await prisma.jobQueue.deleteMany({
          where: { jobId }
        })
      } catch (error) {
        console.warn('Failed to clean up job queue entry:', error)
      }
    }
  }

  // Process import job
  private async processImportJob(job: any, parameters: any, metadata: any) {
    const { operationId, storeId, userId } = job
    const user = job.user

    // Get the uploaded files
    const files = await prisma.batchOperationFile.findMany({
      where: { batchOperationId: job.id }
    })

    let allResults = []

    for (const file of files) {
      if (file.fileStatus !== 'processed') continue

      // Get file data (in real implementation, this would read from storage)
      const fileData = await this.getFileData(file)

      if (!fileData || fileData.length === 0) {
        continue
      }

      // Process in batches
      const batchSize = this.config.batchSize
      const totalBatches = Math.ceil(fileData.length / batchSize)

      for (let i = 0; i < totalBatches; i++) {
        const batch = fileData.slice(i * batchSize, (i + 1) * batchSize)
        
        try {
          const result = await BatchOperationManager.startBatchOperation({
            operationId: `${operationId}-batch-${i}`,
            type: 'import',
            entityType: job.entityType,
            parameters,
            storeId,
            userId,
            userName: user?.name,
            userEmail: user?.email,
            records: batch
          })

          allResults.push(result)

          // Update progress
          await this.updateJobProgress(job.operationId, {
            processedRecords: (i + 1) * batch.length,
            totalRecords: fileData.length,
            currentBatch: i + 1,
            totalBatches
          })

          // Check for memory usage
          const memoryUsage = process.memoryUsage()
          if (memoryUsage.heapUsed > 500 * 1024 * 1024) { // 500MB threshold
            console.warn('High memory usage detected, forcing garbage collection')
            if (global.gc) {
              global.gc()
            }
          }

        } catch (batchError) {
          console.error(`Error processing batch ${i}:`, batchError)
          // Continue with next batch
        }

        // Small delay between batches to prevent overwhelming the database
        await this.sleep(100)
      }
    }

    return allResults
  }

  // Process export job
  private async processExportJob(job: any, parameters: any, metadata: any) {
    const { operationId, storeId, userId } = job
    const user = job.user

    const result = await BatchOperationManager.startBatchOperation({
      operationId,
      type: 'export',
      entityType: job.entityType,
      parameters,
      storeId,
      userId,
      userName: user?.name,
      userEmail: user?.email
    })

    // Create export file
    if (result.success && result.results.length > 0) {
      const exportData = result.results[0]
      const fileName = `${job.entityType}_export_${new Date().toISOString().split('T')[0]}.csv`
      
      await prisma.batchOperationFile.create({
        data: {
          batchOperationId: job.id,
          fileName,
          fileType: 'csv',
          fileStatus: 'completed',
          totalRows: exportData.totalRecords || 0,
          processedRows: exportData.totalRecords || 0,
          validRows: exportData.totalRecords || 0,
          processedAt: new Date()
        }
      })
    }

    return result
  }

  // Process bulk update job
  private async processBulkUpdateJob(job: any, parameters: any, metadata: any) {
    const { operationId, storeId, userId } = job
    const user = job.user

    // Get records to update
    const records = await this.getRecordsForUpdate(job.entityType, parameters, storeId)

    const result = await BatchOperationManager.startBatchOperation({
      operationId,
      type: 'bulk_update',
      entityType: job.entityType,
      parameters,
      storeId,
      userId,
      userName: user?.name,
      userEmail: user?.email,
      records
    })

    return result
  }

  // Process mass processing job
  private async processMassProcessingJob(job: any, parameters: any, metadata: any) {
    const { operationId, storeId, userId } = job
    const user = job.user

    // Get records to process
    const records = await this.getRecordsForProcessing(job.entityType, parameters, storeId)

    const result = await BatchOperationManager.startBatchOperation({
      operationId,
      type: 'mass_processing',
      entityType: job.entityType,
      parameters,
      storeId,
      userId,
      userName: user?.name,
      userEmail: user?.email,
      records
    })

    return result
  }

  // Initialize progress tracking
  private async initializeProgressTracking(job: any): Promise<void> {
    await prisma.batchOperationProgress.create({
      data: {
        batchOperationId: job.id,
        phase: 'initialization',
        phaseStatus: 'running',
        currentStep: 'Preparing operation',
        progressPercentage: 0
      }
    })
  }

  // Update job progress
  private async updateJobProgress(operationId?: string, progress?: any): Promise<void> {
    const updates: any = {}

    if (progress) {
      if (progress.totalRecords) {
        updates.totalRecords = progress.totalRecords
      }
      if (progress.processedRecords) {
        updates.processedRecords = progress.processedRecords
        updates.progressPercentage = progress.totalRecords ? 
          Math.round((progress.processedRecords / progress.totalRecords) * 100) : 0
      }
      if (progress.currentBatch !== undefined) {
        updates.currentStep = `Processing batch ${progress.currentBatch} of ${progress.totalBatches}`
      }
    }

    if (Object.keys(updates).length > 0) {
      await prisma.batchOperation.update({
        where: { operationId },
        data: updates
      })
    }
  }

  // Monitor active jobs for health
  private async monitorActiveJobs(): Promise<void> {
    const timeout = this.config.jobTimeoutMinutes * 60 * 1000
    const now = Date.now()

    for (const [operationId, metrics] of this.activeJobs) {
      const jobAge = now - metrics.startTime.getTime()

      if (jobAge > timeout) {
        console.warn(`Job ${operationId} exceeded timeout, marking as failed`)
        
        await prisma.batchOperation.update({
          where: { operationId },
          data: {
            status: 'failed',
            completedAt: new Date(),
            errorLog: JSON.stringify({
              error: 'Job timeout',
              timeoutMinutes: this.config.jobTimeoutMinutes,
              jobAge: Math.round(jobAge / 1000 / 60)
            })
          }
        })

        this.activeJobs.delete(operationId)
      }
    }
  }

  // Cleanup completed jobs
  private async cleanupCompletedJobs(): Promise<void> {
    // Remove old completed operations from active tracking
    const cutoff = Date.now() - (5 * 60 * 1000) // 5 minutes ago

    for (const [operationId, metrics] of this.activeJobs) {
      if (metrics.endTime && metrics.endTime.getTime() < cutoff) {
        this.activeJobs.delete(operationId)
      }
    }
  }

  // Get file data (placeholder implementation)
  private async getFileData(file: any): Promise<any[]> {
    // In a real implementation, this would read from cloud storage or local filesystem
    // For now, return empty array
    return []
  }

  // Get records for bulk update
  private async getRecordsForUpdate(entityType: string, parameters: any, storeId: string): Promise<any[]> {
    // Implementation would fetch records based on parameters
    return []
  }

  // Get records for mass processing
  private async getRecordsForProcessing(entityType: string, parameters: any, storeId: string): Promise<any[]> {
    // Implementation would fetch records based on parameters
    return []
  }

  // Utility sleep function
  private sleep(ms: number): Promise<void> {
    return new Promise(resolve => setTimeout(resolve, ms))
  }

  // Get processor status
  public getStatus() {
    return {
      isProcessing: this.isProcessing,
      activeJobs: this.activeJobs.size,
      config: this.config,
      jobs: Array.from(this.activeJobs.entries()).map(([operationId, metrics]) => ({
        operationId,
        ...metrics
      }))
    }
  }

  // Force stop a specific job
  public async forceStopJob(operationId: string): Promise<boolean> {
    if (this.activeJobs.has(operationId)) {
      this.activeJobs.delete(operationId)
      
      await prisma.batchOperation.update({
        where: { operationId },
        data: {
          status: 'cancelled',
          completedAt: new Date()
        }
      })

      return true
    }
    return false
  }

  // Get job metrics
  public getJobMetrics(operationId: string): ProcessingMetrics | undefined {
    return this.activeJobs.get(operationId)
  }

  // Update configuration
  public updateConfig(newConfig: Partial<JobProcessorConfig>): void {
    this.config = { ...this.config, ...newConfig }
  }
}

// Background job processor singleton
export const batchJobProcessor = BatchJobProcessor.getInstance()

// Auto-start the processor when the module is loaded
if (typeof window === 'undefined') { // Only run on server side
  // Start the processor in development or when explicitly enabled
  if (process.env.NODE_ENV === 'development' || process.env.BATCH_PROCESSOR_ENABLED === 'true') {
    batchJobProcessor.start().catch(error => {
      console.error('Failed to start batch job processor:', error)
    })
  }
}

// Graceful shutdown
process.on('SIGTERM', async () => {
  console.log('Received SIGTERM, shutting down batch job processor...')
  await batchJobProcessor.stop()
  process.exit(0)
})

process.on('SIGINT', async () => {
  console.log('Received SIGINT, shutting down batch job processor...')
  await batchJobProcessor.stop()
  process.exit(0)
})