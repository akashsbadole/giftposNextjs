import { NextRequest, NextResponse } from 'next/server'
import { PrismaClient } from '@prisma/client'
import { auth } from '@clerk/nextjs/server'

const prisma = new PrismaClient()

// GET /api/pos/batch-operations/analytics - Get batch operations analytics and reports
export async function GET(request: NextRequest) {
  try {
    const { userId } = await auth()
    if (!userId) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const { searchParams } = new URL(request.url)
    const storeId = searchParams.get('storeId')
    const reportType = searchParams.get('reportType') || 'overview'
    const startDate = searchParams.get('startDate')
    const endDate = searchParams.get('endDate')
    const groupBy = searchParams.get('groupBy') || 'day'
    const entityType = searchParams.get('entityType')
    const operationType = searchParams.get('operationType')

    if (!storeId) {
      return NextResponse.json({ error: 'Store ID is required' }, { status: 400 })
    }

    // Set default date range (last 30 days)
    const end = endDate ? new Date(endDate) : new Date()
    const start = startDate ? new Date(startDate) : new Date(Date.now() - 30 * 24 * 60 * 60 * 1000)

    // Build where clause
    const whereClause: any = {
      storeId,
      createdAt: {
        gte: start,
        lte: end
      }
    }

    if (entityType) whereClause.entityType = entityType
    if (operationType) whereClause.type = operationType

    let reportData = {}

    switch (reportType) {
      case 'overview':
        reportData = await getOverviewReport(storeId, start, end, whereClause)
        break
      case 'performance':
        reportData = await getPerformanceReport(storeId, start, end, whereClause, groupBy)
        break
      case 'trends':
        reportData = await getTrendsReport(storeId, start, end, whereClause, groupBy)
        break
      case 'entity-analysis':
        reportData = await getEntityAnalysisReport(storeId, start, end, whereClause)
        break
      case 'error-analysis':
        reportData = await getErrorAnalysisReport(storeId, start, end, whereClause)
        break
      case 'resource-usage':
        reportData = await getResourceUsageReport(storeId, start, end, whereClause)
        break
      default:
        return NextResponse.json({ error: 'Invalid report type' }, { status: 400 })
    }

    return NextResponse.json({
      reportType,
      period: {
        start: start.toISOString(),
        end: end.toISOString(),
        days: Math.ceil((end.getTime() - start.getTime()) / (24 * 60 * 60 * 1000))
      },
      filters: {
        entityType,
        operationType,
        groupBy
      },
      data: reportData
    })

  } catch (error) {
    console.error('Error generating batch operations analytics:', error)
    return NextResponse.json(
      { error: 'Failed to generate analytics report' },
      { status: 500 }
    )
  }
}

// Overview report - high-level statistics
async function getOverviewReport(storeId: string, start: Date, end: Date, whereClause: any) {
  // Get total operations count
  const totalOperations = await prisma.batchOperation.count({ where: whereClause })

  // Get status breakdown
  const statusBreakdown = await prisma.batchOperation.groupBy({
    by: ['status'],
    where: whereClause,
    _count: { status: true }
  })

  const statusStats = statusBreakdown.reduce((acc, stat) => {
    acc[stat.status] = stat._count.status
    return acc
  }, {} as Record<string, number>)

  // Get operation type breakdown
  const typeBreakdown = await prisma.batchOperation.groupBy({
    by: ['type'],
    where: whereClause,
    _count: { type: true }
  })

  const typeStats = typeBreakdown.reduce((acc, stat) => {
    acc[stat.type] = stat._count.type
    return acc
  }, {} as Record<string, number>)

  // Get entity type breakdown
  const entityBreakdown = await prisma.batchOperation.groupBy({
    by: ['entityType'],
    where: whereClause,
    _count: { entityType: true }
  })

  const entityStats = entityBreakdown.reduce((acc, stat) => {
    acc[stat.entityType] = stat._count.entityType
    return acc
  }, {} as Record<string, number>)

  // Get recent operations (last 10)
  const recentOperations = await prisma.batchOperation.findMany({
    where: whereClause,
    orderBy: { createdAt: 'desc' },
    take: 10,
    select: {
      operationId: true,
      name: true,
      type: true,
      entityType: true,
      status: true,
      progressPercentage: true,
      totalRecords: true,
      successRecords: true,
      failedRecords: true,
      createdAt: true,
      completedAt: true
    }
  })

  // Calculate success rate
  const successRate = totalOperations > 0 ? 
    ((statusStats.completed || 0) / totalOperations * 100) : 0

  // Get average processing time for completed operations
  const completedOperations = await prisma.batchOperation.findMany({
    where: {
      ...whereClause,
      status: 'completed',
      startedAt: { not: null },
      completedAt: { not: null }
    },
    select: {
      startedAt: true,
      completedAt: true,
      totalRecords: true
    }
  })

  const avgProcessingTime = completedOperations.length > 0 ?
    completedOperations.reduce((sum, op) => {
      const duration = op.completedAt!.getTime() - op.startedAt!.getTime()
      return sum + duration
    }, 0) / completedOperations.length / 1000 / 60 : 0 // in minutes

  const avgRecordsPerMinute = completedOperations.length > 0 ?
    completedOperations.reduce((sum, op) => {
      const duration = op.completedAt!.getTime() - op.startedAt!.getTime()
      const minutes = duration / 1000 / 60
      return sum + (minutes > 0 ? op.totalRecords / minutes : 0)
    }, 0) / completedOperations.length : 0

  return {
    summary: {
      totalOperations,
      successRate: Math.round(successRate * 100) / 100,
      avgProcessingTime: Math.round(avgProcessingTime * 100) / 100,
      avgRecordsPerMinute: Math.round(avgRecordsPerMinute * 100) / 100
    },
    breakdown: {
      byStatus: statusStats,
      byType: typeStats,
      byEntity: entityStats
    },
    recentOperations
  }
}

// Performance report - detailed performance metrics
async function getPerformanceReport(storeId: string, start: Date, end: Date, whereClause: any, groupBy: string) {
  // Group operations by time period
  const dateFormat = getDateFormat(groupBy)
  
  const performanceData = await prisma.$queryRaw`
    SELECT 
      strftime('${dateFormat}', createdAt) as period,
      type,
      entityType,
      COUNT(*) as totalOperations,
      AVG(CASE WHEN status = 'completed' AND startedAt IS NOT NULL AND completedAt IS NOT NULL 
          THEN (julianday(completedAt) - julianday(startedAt)) * 24 * 60 
          ELSE NULL END) as avgDurationMinutes,
      AVG(CASE WHEN status = 'completed' AND startedAt IS NOT NULL AND completedAt IS NOT NULL AND totalRecords > 0
          THEN totalRecords / ((julianday(completedAt) - julianday(startedAt)) * 24 * 60)
          ELSE NULL END) as avgRecordsPerMinute,
      SUM(CASE WHEN status = 'completed' THEN totalRecords ELSE 0 END) as totalRecordsProcessed,
      SUM(CASE WHEN status = 'completed' THEN successRecords ELSE 0 END) as totalSuccessRecords,
      SUM(CASE WHEN status = 'completed' THEN failedRecords ELSE 0 END) as totalFailedRecords,
      COUNT(CASE WHEN status = 'failed' THEN 1 END) as failedOperations,
      COUNT(CASE WHEN status = 'completed' THEN 1 END) as successfulOperations
    FROM BatchOperation
    WHERE storeId = '${storeId}'
      AND createdAt >= '${start.toISOString()}'
      AND createdAt <= '${end.toISOString()}'
      ${entityType ? `AND entityType = '${entityType}'` : ''}
      ${operationType ? `AND type = '${operationType}'` : ''}
    GROUP BY period, type, entityType
    ORDER BY period DESC
  `

  // Get error distribution
  const errorData = await prisma.batchOperation.findMany({
    where: {
      ...whereClause,
      status: 'failed'
    },
    select: {
      type: true,
      entityType: true,
      errorLog: true,
      createdAt: true
    }
  })

  const errorBreakdown = errorData.reduce((acc, op) => {
    const key = `${op.type}_${op.entityType}`
    acc[key] = (acc[key] || 0) + 1
    return acc
  }, {} as Record<string, number>)

  // Get peak performance times
  const hourlyStats = await prisma.$queryRaw`
    SELECT 
      strftime('%H', createdAt) as hour,
      COUNT(*) as operationCount,
      AVG(CASE WHEN status = 'completed' AND startedAt IS NOT NULL AND completedAt IS NOT NULL 
          THEN (julianday(completedAt) - julianday(startedAt)) * 24 * 60 
          ELSE NULL END) as avgDurationMinutes
    FROM BatchOperation
    WHERE storeId = '${storeId}'
      AND createdAt >= '${start.toISOString()}'
      AND createdAt <= '${end.toISOString()}'
    GROUP BY hour
    ORDER BY hour
  `

  return {
    performanceByPeriod: performanceData,
    errorBreakdown,
    peakHours: hourlyStats,
    trends: {
      // Calculate trends compared to previous period
      operationCountChange: 0, // Would calculate from previous period
      avgDurationChange: 0,
      successRateChange: 0
    }
  }
}

// Trends report - time-series analysis
async function getTrendsReport(storeId: string, start: Date, end: Date, whereClause: any, groupBy: string) {
  const dateFormat = getDateFormat(groupBy)
  
  const trendsData = await prisma.$queryRaw`
    SELECT 
      strftime('${dateFormat}', createdAt) as period,
      COUNT(*) as operationCount,
      COUNT(CASE WHEN status = 'completed' THEN 1 END) as completedCount,
      COUNT(CASE WHEN status = 'failed' THEN 1 END) as failedCount,
      SUM(CASE WHEN status = 'completed' THEN totalRecords ELSE 0 END) as recordsProcessed,
      AVG(CASE WHEN status = 'completed' AND startedAt IS NOT NULL AND completedAt IS NOT NULL 
          THEN (julianday(completedAt) - julianday(startedAt)) * 24 * 60 
          ELSE NULL END) as avgDurationMinutes
    FROM BatchOperation
    WHERE storeId = '${storeId}'
      AND createdAt >= '${start.toISOString()}'
      AND createdAt <= '${end.toISOString()}'
    GROUP BY period
    ORDER BY period
  `

  // Calculate moving averages
  const trendsWithMA = trendsData.map((item: any, index: number) => {
    const window = 7 // 7-period moving average
    const startIdx = Math.max(0, index - window + 1)
    const windowData = trendsData.slice(startIdx, index + 1)
    
    const avgOperationCount = windowData.reduce((sum: number, item: any) => sum + parseInt(item.operationCount), 0) / windowData.length
    const avgDuration = windowData.reduce((sum: number, item: any) => sum + (parseFloat(item.avgDurationMinutes) || 0), 0) / windowData.length

    return {
      ...item,
      movingAvgOperations: Math.round(avgOperationCount * 100) / 100,
      movingAvgDuration: Math.round(avgDuration * 100) / 100
    }
  })

  return {
    trends: trendsWithMA,
    insights: generateTrendInsights(trendsWithMA)
  }
}

// Entity analysis report - breakdown by entity type
async function getEntityAnalysisReport(storeId: string, start: Date, end: Date, whereClause: any) {
  // Operations by entity type
  const entityStats = await prisma.batchOperation.groupBy({
    by: ['entityType', 'type'],
    where: whereClause,
    _count: { entityType: true },
    _avg: { totalRecords: true, progressPercentage: true }
  })

  // Success rates by entity
  const successRates = await prisma.$queryRaw`
    SELECT 
      entityType,
      type,
      COUNT(*) as totalOperations,
      COUNT(CASE WHEN status = 'completed' THEN 1 END) as completedOperations,
      ROUND(COUNT(CASE WHEN status = 'completed' THEN 1 END) * 100.0 / COUNT(*), 2) as successRate,
      AVG(CASE WHEN status = 'completed' AND startedAt IS NOT NULL AND completedAt IS NOT NULL 
          THEN (julianday(completedAt) - julianday(startedAt)) * 24 * 60 
          ELSE NULL END) as avgDurationMinutes
    FROM BatchOperation
    WHERE storeId = '${storeId}'
      AND createdAt >= '${start.toISOString()}'
      AND createdAt <= '${end.toISOString()}'
    GROUP BY entityType, type
    ORDER BY entityType, type
  `

  // Most active entity types
  const mostActive = await prisma.batchOperation.groupBy({
    by: ['entityType'],
    where: whereClause,
    _count: { entityType: true },
    orderBy: { _count: { entityType: 'desc' } },
    take: 5
  })

  return {
    entityBreakdown: entityStats,
    successRates,
    mostActiveEntities: mostActive,
    recommendations: generateEntityRecommendations(entityStats, successRates)
  }
}

// Error analysis report - detailed error breakdown
async function getErrorAnalysisReport(storeId: string, start: Date, end: Date, whereClause: any) {
  // Failed operations
  const failedOps = await prisma.batchOperation.findMany({
    where: {
      ...whereClause,
      status: 'failed'
    },
    select: {
      operationId: true,
      name: true,
      type: true,
      entityType: true,
      errorLog: true,
      retryCount: true,
      maxRetries: true,
      createdAt: true,
      completedAt: true
    },
    orderBy: { createdAt: 'desc' }
  })

  // Error patterns by type and entity
  const errorPatterns = failedOps.reduce((acc, op) => {
    const key = `${op.type}_${op.entityType}`
    if (!acc[key]) {
      acc[key] = {
        count: 0,
        errors: [],
        avgRetries: 0
      }
    }
    acc[key].count++
    
    if (op.errorLog) {
      try {
        const errorData = JSON.parse(op.errorLog)
        acc[key].errors.push(errorData.message || 'Unknown error')
      } catch {
        acc[key].errors.push('Invalid error data')
      }
    }
    
    acc[key].avgRetries += op.retryCount
    
    return acc
  }, {} as Record<string, any>)

  // Calculate averages
  Object.keys(errorPatterns).forEach(key => {
    errorPatterns[key].avgRetries = errorPatterns[key].avgRetries / errorPatterns[key].count
  })

  // Time-based error analysis
  const hourlyErrors = await prisma.$queryRaw`
    SELECT 
      strftime('%H', createdAt) as hour,
      COUNT(*) as errorCount
    FROM BatchOperation
    WHERE storeId = '${storeId}'
      AND createdAt >= '${start.toISOString()}'
      AND createdAt <= '${end.toISOString()}'
      AND status = 'failed'
    GROUP BY hour
    ORDER BY hour
  `

  return {
    failedOperations: failedOps,
    errorPatterns,
    errorByHour: hourlyErrors,
    recommendations: generateErrorRecommendations(errorPatterns)
  }
}

// Resource usage report - performance and resource utilization
async function getResourceUsageReport(storeId: string, start: Date, end: Date, whereClause: any) {
  // Get processing time distribution
  const processingTimes = await prisma.batchOperation.findMany({
    where: {
      ...whereClause,
      status: 'completed',
      startedAt: { not: null },
      completedAt: { not: null }
    },
    select: {
      totalRecords: true,
      startedAt: true,
      completedAt: true,
      type: true,
      entityType: true
    }
  })

  // Calculate processing statistics
  const processingStats = processingTimes.map(op => {
    const duration = op.completedAt!.getTime() - op.startedAt!.getTime()
    const minutes = duration / 1000 / 60
    const recordsPerMinute = minutes > 0 ? op.totalRecords / minutes : 0
    
    return {
      ...op,
      duration,
      minutes,
      recordsPerMinute
    }
  })

  // Group by type and entity for averages
  const resourceUsage = processingStats.reduce((acc, op) => {
    const key = `${op.type}_${op.entityType}`
    if (!acc[key]) {
      acc[key] = {
        count: 0,
        totalDuration: 0,
        totalRecords: 0,
        durations: [],
        recordsPerMinute: []
      }
    }
    
    acc[key].count++
    acc[key].totalDuration += op.duration
    acc[key].totalRecords += op.totalRecords
    acc[key].durations.push(op.duration)
    acc[key].recordsPerMinute.push(op.recordsPerMinute)
    
    return acc
  }, {} as Record<string, any>)

  // Calculate averages and percentiles
  Object.keys(resourceUsage).forEach(key => {
    const data = resourceUsage[key]
    data.avgDuration = data.totalDuration / data.count
    data.avgRecordsPerMinute = data.totalRecords / data.count / (data.avgDuration / 1000 / 60)
    data.p95Duration = calculatePercentile(data.durations, 95)
    data.p50Duration = calculatePercentile(data.durations, 50)
  })

  // Peak usage times
  const hourlyUsage = await prisma.$queryRaw`
    SELECT 
      strftime('%H', startedAt) as hour,
      COUNT(*) as concurrentJobs,
      AVG(CASE WHEN completedAt IS NOT NULL AND startedAt IS NOT NULL 
          THEN (julianday(completedAt) - julianday(startedAt)) * 24 * 60 
          ELSE NULL END) as avgDurationMinutes
    FROM BatchOperation
    WHERE storeId = '${storeId}'
      AND startedAt >= '${start.toISOString()}'
      AND startedAt <= '${end.toISOString()}'
      AND status = 'completed'
    GROUP BY hour
    ORDER BY hour
  `

  return {
    processingStats: processingStats,
    resourceUsage,
    peakUsageHours: hourlyUsage,
    performanceInsights: generatePerformanceInsights(resourceUsage)
  }
}

// Helper functions
function getDateFormat(groupBy: string): string {
  switch (groupBy) {
    case 'hour': return '%Y-%m-%d %H:00:00'
    case 'day': return '%Y-%m-%d'
    case 'week': return '%Y-%W'
    case 'month': return '%Y-%m'
    default: return '%Y-%m-%d'
  }
}

function calculatePercentile(values: number[], percentile: number): number {
  const sorted = values.sort((a, b) => a - b)
  const index = Math.ceil((percentile / 100) * sorted.length) - 1
  return sorted[Math.max(0, index)]
}

function generateTrendInsights(trendsData: any[]): string[] {
  const insights: string[] = []
  
  if (trendsData.length < 2) {
    insights.push('Insufficient data for trend analysis')
    return insights
  }

  const recent = trendsData[trendsData.length - 1]
  const previous = trendsData[trendsData.length - 2]

  if (recent.operationCount > previous.operationCount * 1.1) {
    insights.push('Batch operations activity is increasing')
  } else if (recent.operationCount < previous.operationCount * 0.9) {
    insights.push('Batch operations activity is decreasing')
  }

  if (recent.avgDurationMinutes < previous.avgDurationMinutes * 0.9) {
    insights.push('Average processing time is improving')
  } else if (recent.avgDurationMinutes > previous.avgDurationMinutes * 1.1) {
    insights.push('Average processing time is increasing')
  }

  return insights
}

function generateEntityRecommendations(entityStats: any[], successRates: any[]): string[] {
  const recommendations: string[] = []
  
  // Find entity types with low success rates
  successRates.forEach(rate => {
    if (rate.successRate < 80) {
      recommendations.push(`Consider optimizing ${rate.entityType} ${rate.type} operations (success rate: ${rate.successRate}%)`)
    }
  })

  if (recommendations.length === 0) {
    recommendations.push('All entity types are performing well')
  }

  return recommendations
}

function generateErrorRecommendations(errorPatterns: Record<string, any>): string[] {
  const recommendations: string[] = []
  
  Object.keys(errorPatterns).forEach(key => {
    const pattern = errorPatterns[key]
    if (pattern.count > 5) {
      recommendations.push(`High error rate for ${key.replace('_', ' ')} operations - investigate root cause`)
    }
    if (pattern.avgRetries > 2) {
      recommendations.push(`High retry count for ${key.replace('_', ' ')} operations - consider improving error handling`)
    }
  })

  if (recommendations.length === 0) {
    recommendations.push('Error rates are within acceptable limits')
  }

  return recommendations
}

function generatePerformanceInsights(resourceUsage: Record<string, any>): string[] {
  const insights: string[] = []
  
  Object.keys(resourceUsage).forEach(key => {
    const usage = resourceUsage[key]
    if (usage.avgRecordsPerMinute < 100) {
      insights.push(`${key.replace('_', ' ')} operations could benefit from performance optimization`)
    }
    if (usage.p95Duration > usage.p50Duration * 3) {
      insights.push(`${key.replace('_', ' ')} operations show high variability - consider standardizing processes`)
    }
  })

  if (insights.length === 0) {
    insights.push('Performance metrics are within acceptable ranges')
  }

  return insights
}