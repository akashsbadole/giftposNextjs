import { NextRequest, NextResponse } from 'next/server'
import { PrismaClient } from '@prisma/client'
import { auth } from '@clerk/nextjs/server'
import { AuditLogger } from '@/lib/security/audit-logger'
import { OrderErrorHandler } from '@/lib/order-management-errors'

const prisma = new PrismaClient()

// GET /api/pos/orders/jobs/manage - Get job queue status and manage jobs
export async function GET(request: NextRequest) {
  try {
    const { userId } = await auth()
    if (!userId) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const { searchParams } = new URL(request.url)
    const storeId = searchParams.get('storeId')
    const status = searchParams.get('status') // pending, running, completed, failed, cancelled
    const jobType = searchParams.get('jobType') // order_cleanup, analytics_update, notification, etc.
    const limit = parseInt(searchParams.get('limit') || '50')
    const offset = parseInt(searchParams.get('offset') || '0')
    const includeHistory = searchParams.get('includeHistory') === 'true'

    if (!storeId) {
      return NextResponse.json({ error: 'Store ID is required' }, { status: 400 })
    }

    // Build where clause
    const whereClause: any = {}
    
    if (storeId) {
      whereClause.storeId = storeId
    }

    if (status) {
      whereClause.status = status
    }

    if (jobType) {
      whereClause.type = jobType
    }

    // Get jobs from queue
    const jobs = await prisma.jobQueue.findMany({
      where: whereClause,
      orderBy: [
        { priority: 'desc' },
        { scheduledAt: 'asc' }
      ],
      take: limit,
      skip: offset
    })

    // Parse JSON fields for each job
    const processedJobs = jobs.map(job => ({
      ...job,
      jobData: job.jobData ? JSON.parse(job.jobData) : {},
      result: job.result ? JSON.parse(job.result) : null,
      dependsOn: job.dependsOn ? JSON.parse(job.dependsOn) : [],
      metadata: job.metadata ? JSON.parse(job.metadata) : {}
    }))

    // Get job statistics
    const jobStats = await getJobStatistics(storeId)

    // Get queue health
    const queueHealth = await getQueueHealth(storeId)

    return NextResponse.json({
      jobs: processedJobs,
      pagination: {
        total: processedJobs.length,
        limit,
        offset,
        hasMore: processedJobs.length === limit
      },
      statistics: jobStats,
      health: queueHealth,
      summary: {
        totalJobs: jobStats.total,
        activeJobs: jobStats.byStatus.running + jobStats.byStatus.pending,
        completedJobs: jobStats.byStatus.completed,
        failedJobs: jobStats.byStatus.failed,
        queueUtilization: queueHealth.utilization
      }
    })

  } catch (error) {
    console.error('Error fetching job queue:', error)
    
    const errorContext = {
      operation: 'FETCH_JOB_QUEUE',
      timestamp: new Date()
    }

    const orderError = OrderErrorHandler.createError(
      'SYSTEM_ERROR' as any,
      'Failed to fetch job queue',
      errorContext,
      { severity: 'high' }
    )

    return NextResponse.json(
      { 
        error: 'Failed to fetch job queue',
        errorId: orderError.id
      },
      { status: 500 }
    )
  }
}

// POST /api/pos/orders/jobs/manage - Create new job
export async function POST(request: NextRequest) {
  try {
    const { userId } = await auth()
    if (!userId) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const body = await request.json()
    const { 
      type,
      jobData,
      priority = 0,
      scheduledAt,
      maxAttempts = 3,
      dependsOn = [],
      parentJobId,
      metadata = {}
    } = body

    if (!type) {
      return NextResponse.json({ error: 'Job type is required' }, { status: 400 })
    }

    if (!jobData) {
      return NextResponse.json({ error: 'Job data is required' }, { status: 400 })
    }

    const { searchParams } = new URL(request.url)
    const storeId = searchParams.get('storeId')
    if (!storeId) {
      return NextResponse.json({ error: 'Store ID is required' }, { status: 400 })
    }

    // Validate job type
    const validJobTypes = [
      'order_cleanup',
      'analytics_update',
      'notification',
      'reminder',
      'sync',
      'backup',
      'export',
      'import',
      'custom'
    ]

    if (!validJobTypes.includes(type)) {
      return NextResponse.json({ 
        error: `Invalid job type. Must be one of: ${validJobTypes.join(', ')}` 
      }, { status: 400 })
    }

    // Generate unique job ID
    const jobId = `job_${type}_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`

    // Create job in queue
    const job = await prisma.jobQueue.create({
      data: {
        jobId,
        type,
        jobData: JSON.stringify(jobData),
        priority,
        scheduledAt: scheduledAt ? new Date(scheduledAt) : new Date(),
        maxAttempts,
        attempts: 0,
        status: 'pending',
        dependsOn: dependsOn.length > 0 ? JSON.stringify(dependsOn) : null,
        parentJobId: parentJobId || null,
        metadata: JSON.stringify(metadata),
        storeId,
        userId
      }
    })

    // Log job creation
    await AuditLogger.log({
      timestamp: new Date(),
      userId,
      action: 'job_created',
      resource: 'job_queue',
      resourceId: job.id,
      method: 'POST',
      path: request.url,
      status: 'success',
      severity: 'low',
      details: {
        jobId,
        type,
        priority,
        scheduledAt: job.scheduledAt,
        dependsOnCount: dependsOn.length
      }
    })

    // Trigger job processor (in real implementation, this would be handled by a worker)
    await triggerJobProcessor(job.id)

    return NextResponse.json({
      job: {
        ...job,
        jobData,
        dependsOn,
        metadata
      },
      message: 'Job created successfully and queued for execution'
    }, { status: 201 })

  } catch (error) {
    console.error('Error creating job:', error)
    
    const errorContext = {
      operation: 'CREATE_JOB',
      timestamp: new Date()
    }

    const orderError = OrderErrorHandler.createError(
      'SYSTEM_ERROR' as any,
      'Failed to create job',
      errorContext,
      { severity: 'high' }
    )

    await AuditLogger.log({
      timestamp: new Date(),
      action: 'job_creation_failed',
      resource: 'job_queue',
      method: 'POST',
      path: request.url,
      status: 'failure',
      severity: 'high',
      details: { error: error instanceof Error ? error.message : 'Unknown error' }
    })

    return NextResponse.json(
      { 
        error: 'Failed to create job',
        errorId: orderError.id
      },
      { status: 500 }
    )
  }
}

// PATCH /api/pos/orders/jobs/manage - Update job status or properties
export async function PATCH(request: NextRequest) {
  try {
    const { userId } = await auth()
    if (!userId) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const body = await request.json()
    const { action, jobId, updates = {} } = body

    if (!action || !jobId) {
      return NextResponse.json({ 
        error: 'Action and job ID are required' 
      }, { status: 400 })
    }

    const { searchParams } = new URL(request.url)
    const storeId = searchParams.get('storeId')
    if (!storeId) {
      return NextResponse.json({ error: 'Store ID is required' }, { status: 400 })
    }

    // Find the job
    const job = await prisma.jobQueue.findFirst({
      where: {
        jobId,
        storeId
      }
    })

    if (!job) {
      return NextResponse.json({ error: 'Job not found' }, { status: 404 })
    }

    let result

    switch (action) {
      case 'cancel':
        result = await cancelJob(jobId, userId)
        break
      case 'retry':
        result = await retryJob(jobId, userId)
        break
      case 'priority':
        result = await updateJobPriority(jobId, updates.priority, userId)
        break
      case 'reschedule':
        result = await rescheduleJob(jobId, updates.scheduledAt, userId)
        break
      case 'force_complete':
        result = await forceCompleteJob(jobId, updates.result, userId)
        break
      default:
        return NextResponse.json({ error: 'Invalid action' }, { status: 400 })
    }

    return NextResponse.json(result)

  } catch (error) {
    console.error('Error updating job:', error)
    return NextResponse.json(
      { error: 'Failed to update job' },
      { status: 500 }
    )
  }
}

// DELETE /api/pos/orders/jobs/manage - Remove job from queue
export async function DELETE(request: NextRequest) {
  try {
    const { userId } = await auth()
    if (!userId) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const { searchParams } = new URL(request.url)
    const jobId = searchParams.get('jobId')
    const force = searchParams.get('force') === 'true'

    if (!jobId) {
      return NextResponse.json({ error: 'Job ID is required' }, { status: 400 })
    }

    const storeId = searchParams.get('storeId')
    if (!storeId) {
      return NextResponse.json({ error: 'Store ID is required' }, { status: 400 })
    }

    // Find the job
    const job = await prisma.jobQueue.findFirst({
      where: {
        jobId,
        storeId
      }
    })

    if (!job) {
      return NextResponse.json({ error: 'Job not found' }, { status: 404 })
    }

    // Only allow deletion of completed, failed, or cancelled jobs
    // or force deletion with proper permissions
    if (!force && !['completed', 'failed', 'cancelled'].includes(job.status)) {
      return NextResponse.json({ 
        error: 'Cannot delete running or pending jobs. Use cancel action instead.' 
      }, { status: 400 })
    }

    // Delete the job
    await prisma.jobQueue.delete({
      where: { id: job.id }
    })

    // Log job deletion
    await AuditLogger.log({
      timestamp: new Date(),
      userId,
      action: 'job_deleted',
      resource: 'job_queue',
      resourceId: job.id,
      method: 'DELETE',
      path: request.url,
      status: 'success',
      severity: 'low',
      details: {
        jobId,
        jobType: job.type,
        previousStatus: job.status,
        forceDeleted: force
      }
    })

    return NextResponse.json({
      message: 'Job deleted successfully'
    })

  } catch (error) {
    console.error('Error deleting job:', error)
    return NextResponse.json(
      { error: 'Failed to delete job' },
      { status: 500 }
    )
  }
}

// Helper functions
async function getJobStatistics(storeId: string) {
  const [totalJobs, statusCounts, typeCounts] = await Promise.all([
    prisma.jobQueue.count({ where: { storeId } }),
    
    prisma.jobQueue.groupBy({
      by: ['status'],
      where: { storeId },
      _count: true
    }),
    
    prisma.jobQueue.groupBy({
      by: ['type'],
      where: { storeId },
      _count: true,
      orderBy: { _count: { type: 'desc' } },
      take: 10
    })
  ])

  const byStatus = statusCounts.reduce((acc, item) => {
    acc[item.status] = item._count
    return acc
  }, {} as Record<string, number>)

  const byType = typeCounts.map(item => ({
    type: item.type,
    count: item._count
  }))

  return {
    total: totalJobs,
    byStatus,
    byType
  }
}

async function getQueueHealth(storeId: string) {
  const now = new Date()
  
  // Get jobs from last hour for health calculation
  const recentJobs = await prisma.jobQueue.findMany({
    where: {
      storeId,
      createdAt: {
        gte: new Date(now.getTime() - 60 * 60 * 1000)
      }
    }
  })

  const completedJobs = recentJobs.filter(job => job.status === 'completed')
  const failedJobs = recentJobs.filter(job => job.status === 'failed')
  const runningJobs = recentJobs.filter(job => job.status === 'running')
  
  const successRate = recentJobs.length > 0 
    ? (completedJobs.length / recentJobs.length) * 100 
    : 100

  const avgExecutionTime = completedJobs.length > 0
    ? completedJobs.reduce((sum, job) => {
        if (job.startedAt && job.completedAt) {
          return sum + (job.completedAt.getTime() - job.startedAt.getTime())
        }
        return sum
      }, 0) / completedJobs.length
    : 0

  const utilization = Math.min(100, (runningJobs.length / 10) * 100) // Assuming max 10 concurrent jobs

  return {
    status: successRate >= 90 ? 'healthy' : successRate >= 70 ? 'degraded' : 'critical',
    successRate,
    avgExecutionTime: Math.round(avgExecutionTime / 1000), // Convert to seconds
    utilization: Math.round(utilization),
    activeJobs: runningJobs.length,
    recentActivity: {
      completed: completedJobs.length,
      failed: failedJobs.length,
      pending: recentJobs.filter(job => job.status === 'pending').length
    }
  }
}

async function triggerJobProcessor(jobId: string) {
  try {
    // In a real implementation, this would notify a job processor/worker
    // For now, we'll simulate job processing
    console.log(`Triggering job processor for job: ${jobId}`)
    
    // Update job status to running
    await prisma.jobQueue.update({
      where: { id: jobId },
      data: {
        status: 'running',
        startedAt: new Date()
      }
    })

    // Simulate job execution (in real implementation, this would be handled by a worker)
    setTimeout(async () => {
      try {
        await simulateJobExecution(jobId)
      } catch (error) {
        console.error('Error in simulated job execution:', error)
      }
    }, 1000)

  } catch (error) {
    console.error('Error triggering job processor:', error)
  }
}

async function simulateJobExecution(jobId: string) {
  try {
    const job = await prisma.jobQueue.findUnique({ where: { id: jobId } })
    
    if (!job) {
      throw new Error('Job not found')
    }

    // Simulate job processing based on type
    let result = {}
    
    switch (job.type) {
      case 'order_cleanup':
        result = await simulateOrderCleanup(job.jobData)
        break
      case 'analytics_update':
        result = await simulateAnalyticsUpdate(job.jobData)
        break
      case 'notification':
        result = await simulateNotification(job.jobData)
        break
      default:
        result = { message: 'Job completed successfully', processedAt: new Date() }
    }

    // Mark job as completed
    await prisma.jobQueue.update({
      where: { id: jobId },
      data: {
        status: 'completed',
        completedAt: new Date(),
        result: JSON.stringify(result)
      }
    })

    console.log(`Job ${jobId} completed successfully`)

  } catch (error) {
    // Mark job as failed
    await prisma.jobQueue.update({
      where: { id: jobId },
      data: {
        status: 'failed',
        completedAt: new Date(),
        errorMessage: error instanceof Error ? error.message : 'Unknown error',
        attempts: { increment: 1 }
      }
    })

    console.error(`Job ${jobId} failed:`, error)
  }
}

// Simulate different job types
async function simulateOrderCleanup(jobData: any) {
  // Simulate cleaning up old orders
  const { storeId, olderThanDays = 30 } = jobData
  
  const cutoffDate = new Date(Date.now() - olderThanDays * 24 * 60 * 60 * 1000)
  
  // This would actually perform cleanup in a real implementation
  return {
    cleanedOrders: Math.floor(Math.random() * 50) + 10,
    cutoffDate,
    storeId
  }
}

async function simulateAnalyticsUpdate(jobData: any) {
  // Simulate updating analytics
  const { storeId, timeRange = '24h' } = jobData
  
  return {
    updatedMetrics: ['revenue', 'orders', 'customers', 'performance'],
    timeRange,
    storeId,
    updatedAt: new Date()
  }
}

async function simulateNotification(jobData: any) {
  // Simulate sending notifications
  const { type, recipients, message } = jobData
  
  return {
    sent: Math.floor(Math.random() * recipients.length) + 1,
    totalRecipients: recipients.length,
    type,
    message
  }
}

// Job management actions
async function cancelJob(jobId: string, userId: string) {
  const job = await prisma.jobQueue.findFirst({ where: { jobId } })
  
  if (!job) {
    throw new Error('Job not found')
  }

  if (!['pending', 'running'].includes(job.status)) {
    throw new Error('Can only cancel pending or running jobs')
  }

  const updatedJob = await prisma.jobQueue.update({
    where: { id: job.id },
    data: {
      status: 'cancelled',
      completedAt: new Date(),
      metadata: JSON.stringify({
        ...(job.metadata ? JSON.parse(job.metadata) : {}),
        cancelledBy: userId,
        cancelledAt: new Date()
      })
    }
  })

  // Log cancellation
  await AuditLogger.log({
    timestamp: new Date(),
    userId,
    action: 'job_cancelled',
    resource: 'job_queue',
    resourceId: job.id,
    method: 'PATCH',
    path: '/api/pos/orders/jobs/manage',
    status: 'success',
    severity: 'low',
    details: { jobId, previousStatus: job.status }
  })

  return {
    job: updatedJob,
    message: 'Job cancelled successfully'
  }
}

async function retryJob(jobId: string, userId: string) {
  const job = await prisma.jobQueue.findFirst({ where: { jobId } })
  
  if (!job) {
    throw new Error('Job not found')
  }

  if (job.attempts >= job.maxAttempts) {
    throw new Error('Maximum retry attempts reached')
  }

  const updatedJob = await prisma.jobQueue.update({
    where: { id: job.id },
    data: {
      status: 'pending',
      startedAt: null,
      completedAt: null,
      errorMessage: null,
      attempts: { increment: 1 },
      scheduledAt: new Date()
    }
  })

  // Trigger processing
  await triggerJobProcessor(updatedJob.id)

  return {
    job: updatedJob,
    message: 'Job queued for retry'
  }
}

async function updateJobPriority(jobId: string, priority: number, userId: string) {
  const job = await prisma.jobQueue.findFirst({ where: { jobId } })
  
  if (!job) {
    throw new Error('Job not found')
  }

  if (!['pending', 'running'].includes(job.status)) {
    throw new Error('Can only update priority of pending or running jobs')
  }

  const updatedJob = await prisma.jobQueue.update({
    where: { id: job.id },
    data: { priority }
  })

  return {
    job: updatedJob,
    message: 'Job priority updated successfully'
  }
}

async function rescheduleJob(jobId: string, scheduledAt: string, userId: string) {
  const job = await prisma.jobQueue.findFirst({ where: { jobId } })
  
  if (!job) {
    throw new Error('Job not found')
  }

  if (job.status !== 'pending') {
    throw new Error('Can only reschedule pending jobs')
  }

  const updatedJob = await prisma.jobQueue.update({
    where: { id: job.id },
    data: { scheduledAt: new Date(scheduledAt) }
  })

  return {
    job: updatedJob,
    message: 'Job rescheduled successfully'
  }
}

async function forceCompleteJob(jobId: string, result: any, userId: string) {
  const job = await prisma.jobQueue.findFirst({ where: { jobId } })
  
  if (!job) {
    throw new Error('Job not found')
  }

  const updatedJob = await prisma.jobQueue.update({
    where: { id: job.id },
    data: {
      status: 'completed',
      completedAt: new Date(),
      result: JSON.stringify(result || { forceCompleted: true, completedBy: userId })
    }
  })

  return {
    job: updatedJob,
    message: 'Job force completed successfully'
  }
}