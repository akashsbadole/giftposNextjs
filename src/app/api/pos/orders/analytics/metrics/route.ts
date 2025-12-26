import { NextRequest, NextResponse } from 'next/server'
import { PrismaClient } from '@prisma/client'
import { auth } from '@clerk/nextjs/server'
import { AuditLogger } from '@/lib/security/audit-logger'
import { OrderErrorHandler } from '@/lib/order-management-errors'

const prisma = new PrismaClient()

// GET /api/pos/orders/analytics/metrics - Get performance metrics and trends
export async function GET(request: NextRequest) {
  try {
    const { userId } = await auth()
    if (!userId) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const { searchParams } = new URL(request.url)
    const storeId = searchParams.get('storeId')
    const timeRange = searchParams.get('timeRange') || '24h'
    const metricType = searchParams.get('metricType') || 'all' // all, performance, financial, operational
    const granularity = searchParams.get('granularity') || 'hour' // minute, hour, day, week

    if (!storeId) {
      return NextResponse.json({ error: 'Store ID is required' }, { status: 400 })
    }

    // Calculate time range
    const timeRangeMs = getTimeRangeInMs(timeRange)
    const startDate = new Date(Date.now() - timeRangeMs)
    const endDate = new Date()

    // Get metrics based on type
    let metrics = {}

    switch (metricType) {
      case 'performance':
        metrics = await getPerformanceMetrics(storeId, startDate, endDate, granularity)
        break
      case 'financial':
        metrics = await getFinancialMetrics(storeId, startDate, endDate, granularity)
        break
      case 'operational':
        metrics = await getOperationalMetrics(storeId, startDate, endDate, granularity)
        break
      case 'all':
      default:
        metrics = {
          performance: await getPerformanceMetrics(storeId, startDate, endDate, granularity),
          financial: await getFinancialMetrics(storeId, startDate, endDate, granularity),
          operational: await getOperationalMetrics(storeId, startDate, endDate, granularity),
          system: await getSystemMetrics(storeId, startDate, endDate, granularity)
        }
        break
    }

    // Calculate trends and comparisons
    const trends = await calculateTrends(storeId, startDate, endDate, granularity)
    const benchmarks = await getBenchmarks(storeId, metricType)

    return NextResponse.json({
      timestamp: new Date().toISOString(),
      timeRange,
      granularity,
      storeId,
      metrics,
      trends,
      benchmarks,
      summary: generateMetricsSummary(metrics, trends)
    })

  } catch (error) {
    console.error('Error fetching analytics metrics:', error)
    
    const errorContext = {
      operation: 'FETCH_ANALYTICS_METRICS',
      timestamp: new Date()
    }

    const orderError = OrderErrorHandler.createError(
      'SYSTEM_ERROR' as any,
      'Failed to fetch analytics metrics',
      errorContext,
      { severity: 'high' }
    )

    return NextResponse.json(
      { 
        error: 'Failed to fetch analytics metrics',
        errorId: orderError.id
      },
      { status: 500 }
    )
  }
}

// POST /api/pos/orders/analytics/metrics - Record custom metrics
export async function POST(request: NextRequest) {
  try {
    const { userId } = await auth()
    if (!userId) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const body = await request.json()
    const { metricName, value, metadata = {} } = body

    if (!metricName || value === undefined) {
      return NextResponse.json({ 
        error: 'Metric name and value are required' 
      }, { status: 400 })
    }

    const { searchParams } = new URL(request.url)
    const storeId = searchParams.get('storeId')
    if (!storeId) {
      return NextResponse.json({ error: 'Store ID is required' }, { status: 400 })
    }

    // Create custom performance metric
    const metric = await prisma.performanceMetric.create({
      data: {
        timestamp: new Date(),
        operation: metricName,
        duration: typeof value === 'number' ? value : 0,
        success: true,
        metadata: JSON.stringify(metadata),
        userId,
        route: '/api/pos/orders/analytics/metrics',
        method: 'POST'
      }
    })

    // Log the metric recording
    await AuditLogger.log({
      timestamp: new Date(),
      userId,
      action: 'custom_metric_recorded',
      resource: 'analytics_metric',
      resourceId: metric.id,
      method: 'POST',
      path: request.url,
      status: 'success',
      severity: 'low',
      details: {
        metricName,
        value,
        metadata
      }
    })

    return NextResponse.json({
      success: true,
      metricId: metric.id,
      message: 'Custom metric recorded successfully'
    }, { status: 201 })

  } catch (error) {
    console.error('Error recording custom metric:', error)
    return NextResponse.json(
      { error: 'Failed to record custom metric' },
      { status: 500 }
    )
  }
}

// Helper functions
function getTimeRangeInMs(timeRange: string): number {
  switch (timeRange) {
    case '1h': return 60 * 60 * 1000
    case '6h': return 6 * 60 * 60 * 1000
    case '24h': return 24 * 60 * 60 * 1000
    case '7d': return 7 * 24 * 60 * 60 * 1000
    case '30d': return 30 * 24 * 60 * 60 * 1000
    case '90d': return 90 * 24 * 60 * 60 * 1000
    default: return 24 * 60 * 60 * 1000
  }
}

function getGranularityInterval(granularity: string): string {
  switch (granularity) {
    case 'minute': return '%Y-%m-%d %H:%M:00'
    case 'hour': return '%Y-%m-%d %H:00:00'
    case 'day': return '%Y-%m-%d 00:00:00'
    case 'week': return '%Y-%W 00:00:00'
    default: return '%Y-%m-%d %H:00:00'
  }
}

async function getPerformanceMetrics(storeId: string, startDate: Date, endDate: Date, granularity: string) {
  const interval = getGranularityInterval(granularity)
  
  // Get performance metrics time series
  const performanceData = await prisma.$queryRaw`
    SELECT 
      strftime('${interval}', timestamp) as time_bucket,
      AVG(duration) as avg_duration,
      MIN(duration) as min_duration,
      MAX(duration) as max_duration,
      COUNT(*) as total_requests,
      SUM(CASE WHEN success THEN 1 ELSE 0 END) as successful_requests,
      AVG(CASE WHEN success THEN duration ELSE NULL END) as avg_success_duration,
      AVG(memoryUsage) as avg_memory_usage,
      AVG(cpuUsage) as avg_cpu_usage
    FROM PerformanceMetric 
    WHERE timestamp >= ${startDate} AND timestamp <= ${endDate}
    GROUP BY time_bucket
    ORDER BY time_bucket
  `

  // Get API endpoint performance
  const endpointPerformance = await prisma.$queryRaw`
    SELECT 
      operation as endpoint,
      AVG(duration) as avg_duration,
      COUNT(*) as request_count,
      SUM(CASE WHEN success THEN 1 ELSE 0 END) as success_count,
      (SUM(CASE WHEN success THEN 1 ELSE 0 END) * 100.0 / COUNT(*)) as success_rate
    FROM PerformanceMetric 
    WHERE timestamp >= ${startDate} AND timestamp <= ${endDate}
    GROUP BY operation
    ORDER BY request_count DESC
    LIMIT 10
  `

  // Calculate error rates
  const errorData = await prisma.$queryRaw`
    SELECT 
      operation as endpoint,
      COUNT(*) as total_errors,
      GROUP_CONCAT(DISTINCT errorMessage) as error_messages
    FROM PerformanceMetric 
    WHERE timestamp >= ${startDate} AND timestamp <= ${endDate}
      AND success = 0
    GROUP BY operation
  `

  return {
    timeSeries: performanceData,
    endpoints: endpointPerformance,
    errors: errorData,
    summary: {
      totalRequests: (performanceData as any[]).reduce((sum, item) => sum + item.total_requests, 0),
      averageResponseTime: calculateAverageResponseTime(performanceData),
      overallSuccessRate: calculateOverallSuccessRate(performanceData),
      peakResponseTime: calculatePeakResponseTime(performanceData)
    }
  }
}

async function getFinancialMetrics(storeId: string, startDate: Date, endDate: Date, granularity: string) {
  const interval = getGranularityInterval(granularity)
  
  // Get financial time series data
  const financialData = await prisma.$queryRaw`
    SELECT 
      strftime('${interval}', createdAt) as time_bucket,
      COUNT(*) as order_count,
      SUM(total) as total_revenue,
      AVG(total) as avg_order_value,
      SUM(CASE WHEN status = 'retrieved' THEN total ELSE 0 END) as completed_revenue,
      SUM(CASE WHEN status = 'cancelled' THEN total ELSE 0 END) as cancelled_revenue
    FROM HeldOrder 
    WHERE storeId = ${storeId}
      AND createdAt >= ${startDate} AND createdAt <= ${endDate}
    GROUP BY time_bucket
    ORDER BY time_bucket
  `

  // Get revenue by customer
  const revenueByCustomer = await prisma.$queryRaw`
    SELECT 
      c.name as customer_name,
      c.phone as customer_phone,
      COUNT(ho.id) as order_count,
      SUM(ho.total) as total_spent,
      AVG(ho.total) as avg_order_value
    FROM HeldOrder ho
    LEFT JOIN Customer c ON ho.customerId = c.id
    WHERE ho.storeId = ${storeId}
      AND ho.createdAt >= ${startDate} AND ho.createdAt <= ${endDate}
      AND ho.customerId IS NOT NULL
    GROUP BY ho.customerId, c.name, c.phone
    ORDER BY total_spent DESC
    LIMIT 10
  `

  // Get discount analysis
  const discountAnalysis = await prisma.$queryRaw`
    SELECT 
      AVG(discount) as avg_discount,
      SUM(discount) as total_discounts,
      COUNT(CASE WHEN discount > 0 THEN 1 END) as orders_with_discount,
      (COUNT(CASE WHEN discount > 0 THEN 1 END) * 100.0 / COUNT(*)) as discount_rate
    FROM HeldOrder 
    WHERE storeId = ${storeId}
      AND createdAt >= ${startDate} AND createdAt <= ${endDate}
  `

  return {
    timeSeries: financialData,
    topCustomers: revenueByCustomer,
    discounts: discountAnalysis,
    summary: {
      totalRevenue: calculateTotalRevenue(financialData),
      totalOrders: calculateTotalOrders(financialData),
      averageOrderValue: calculateAverageOrderValue(financialData),
      revenueGrowth: await calculateRevenueGrowth(storeId, startDate, endDate)
    }
  }
}

async function getOperationalMetrics(storeId: string, startDate: Date, endDate: Date, granularity: string) {
  const interval = getGranularityInterval(granularity)
  
  // Get operational time series
  const operationalData = await prisma.$queryRaw`
    SELECT 
      strftime('${interval}', createdAt) as time_bucket,
      COUNT(*) as total_orders,
      SUM(CASE WHEN status = 'held' THEN 1 ELSE 0 END) as held_orders,
      SUM(CASE WHEN status = 'retrieved' THEN 1 ELSE 0 END) as retrieved_orders,
      SUM(CASE WHEN status = 'cancelled' THEN 1 ELSE 0 END) as cancelled_orders,
      SUM(CASE WHEN status = 'expired' THEN 1 ELSE 0 END) as expired_orders,
      AVG(strftime('%s', COALESCE(retrievedAt, updatedAt)) - strftime('%s', createdAt)) / 60 as avg_processing_time_minutes
    FROM HeldOrder 
    WHERE storeId = ${storeId}
      AND createdAt >= ${startDate} AND createdAt <= ${endDate}
    GROUP BY time_bucket
    ORDER BY time_bucket
  `

  // Get collaboration metrics
  const collaborationData = await prisma.$queryRaw`
    SELECT 
      strftime('${interval}', cs.createdAt) as time_bucket,
      COUNT(DISTINCT cs.sessionId) as active_sessions,
      COUNT(cs.id) as collaboration_events,
      AVG(strftime('%s', cs.lastSeenAt) - strftime('%s', cs.createdAt)) / 60 as avg_session_duration_minutes
    FROM CollaborationSession cs
    JOIN HeldOrder ho ON cs.heldOrderId = ho.id
    WHERE ho.storeId = ${storeId}
      AND cs.createdAt >= ${startDate} AND cs.createdAt <= ${endDate}
    GROUP BY time_bucket
    ORDER BY time_bucket
  `

  // Get user activity
  const userActivity = await prisma.$queryRaw`
    SELECT 
      userId,
      userEmail,
      COUNT(*) as action_count,
      COUNT(DISTINCT heldOrderId) as orders_touched,
      MAX(createdAt) as last_activity
    FROM AuditLog
    WHERE path LIKE '/api/pos/orders%'
      AND timestamp >= ${startDate} AND timestamp <= ${endDate}
      AND userId IS NOT NULL
    GROUP BY userId, userEmail
    ORDER BY action_count DESC
    LIMIT 20
  `

  return {
    timeSeries: operationalData,
    collaboration: collaborationData,
    userActivity,
    summary: {
      totalOrders: calculateTotalOrders(operationalData),
      averageProcessingTime: calculateAverageProcessingTime(operationalData),
      collaborationRate: calculateCollaborationRate(operationalData, collaborationData),
      activeUsers: userActivity.length
    }
  }
}

async function getSystemMetrics(storeId: string, startDate: Date, endDate: Date, granularity: string) {
  // Get system health metrics
  const systemHealth = await prisma.systemHealth.findMany({
    where: {
      timestamp: {
        gte: startDate,
        lte: endDate
      }
    },
    orderBy: { timestamp: 'asc' }
  })

  // Get error aggregation
  const errorAggregates = await prisma.errorAggregate.findMany({
    where: {
      lastOccurrence: {
        gte: startDate,
        lte: endDate
      }
    },
    orderBy: { count: 'desc' },
    take: 10
  })

  return {
    systemHealth: systemHealth.map(health => ({
      timestamp: health.timestamp,
      status: health.status,
      memoryUsage: health.memoryUsage,
      cpuUsage: health.cpuUsage,
      responseTime: health.responseTime,
      errorRate: health.errorRate,
      uptime: health.uptime
    })),
    errorSummary: errorAggregates.map(error => ({
      fingerprint: error.fingerprint,
      message: error.message,
      count: error.count,
      lastOccurrence: error.lastOccurrence,
      resolved: error.resolved
    })),
    summary: {
      averageCpuUsage: calculateAverageCpuUsage(systemHealth),
      averageMemoryUsage: calculateAverageMemoryUsage(systemHealth),
      totalErrors: errorAggregates.reduce((sum, error) => sum + error.count, 0),
      systemUptime: systemHealth.length > 0 ? systemHealth[systemHealth.length - 1].uptime : 0
    }
  }
}

async function calculateTrends(storeId: string, startDate: Date, endDate: Date, granularity: string) {
  const previousPeriodStart = new Date(startDate.getTime() - (endDate.getTime() - startDate.getTime()))
  const previousPeriodEnd = new Date(startDate.getTime())

  // Calculate trends for key metrics
  const [currentPeriod, previousPeriod] = await Promise.all([
    getPeriodMetrics(storeId, startDate, endDate),
    getPeriodMetrics(storeId, previousPeriodStart, previousPeriodEnd)
  ])

  return {
    revenue: {
      current: currentPeriod.revenue,
      previous: previousPeriod.revenue,
      change: calculatePercentageChange(currentPeriod.revenue, previousPeriod.revenue),
      trend: getTrendDirection(currentPeriod.revenue, previousPeriod.revenue)
    },
    orders: {
      current: currentPeriod.orders,
      previous: previousPeriod.orders,
      change: calculatePercentageChange(currentPeriod.orders, previousPeriod.orders),
      trend: getTrendDirection(currentPeriod.orders, previousPeriod.orders)
    },
    responseTime: {
      current: currentPeriod.avgResponseTime,
      previous: previousPeriod.avgResponseTime,
      change: calculatePercentageChange(currentPeriod.avgResponseTime, previousPeriod.avgResponseTime),
      trend: getTrendDirection(previousPeriod.avgResponseTime, currentPeriod.avgResponseTime) // Inverted for response time
    }
  }
}

async function getBenchmarks(storeId: string, metricType: string) {
  // In a real implementation, these would come from industry benchmarks or historical data
  return {
    performance: {
      averageResponseTime: { target: 200, unit: 'ms' },
      errorRate: { target: 2, unit: '%' },
      throughput: { target: 100, unit: 'requests/minute' }
    },
    financial: {
      averageOrderValue: { target: 500, unit: 'currency' },
      customerRetentionRate: { target: 80, unit: '%' }
    },
    operational: {
      orderProcessingTime: { target: 30, unit: 'minutes' },
      collaborationRate: { target: 15, unit: '%' }
    }
  }
}

async function getPeriodMetrics(storeId: string, startDate: Date, endDate: Date) {
  const [orders, performance] = await Promise.all([
    prisma.heldOrder.aggregate({
      where: {
        storeId,
        createdAt: { gte: startDate, lte: endDate }
      },
      _sum: { total: true },
      _count: true
    }),
    prisma.performanceMetric.aggregate({
      where: {
        timestamp: { gte: startDate, lte: endDate }
      },
      _avg: { duration: true }
    })
  ])

  return {
    revenue: orders._sum.total || 0,
    orders: orders._count,
    avgResponseTime: performance._avg.duration || 0
  }
}

// Calculation helper functions
function calculateAverageResponseTime(data: any[]): number {
  if (data.length === 0) return 0
  const total = data.reduce((sum, item) => sum + (item.avg_duration || 0), 0)
  return total / data.length
}

function calculateOverallSuccessRate(data: any[]): number {
  if (data.length === 0) return 100
  const totalRequests = data.reduce((sum, item) => sum + (item.total_requests || 0), 0)
  const successfulRequests = data.reduce((sum, item) => sum + (item.successful_requests || 0), 0)
  return totalRequests > 0 ? (successfulRequests / totalRequests) * 100 : 100
}

function calculatePeakResponseTime(data: any[]): number {
  if (data.length === 0) return 0
  return Math.max(...data.map(item => item.max_duration || 0))
}

function calculateTotalRevenue(data: any[]): number {
  return data.reduce((sum, item) => sum + (item.total_revenue || 0), 0)
}

function calculateTotalOrders(data: any[]): number {
  return data.reduce((sum, item) => sum + (item.order_count || 0), 0)
}

function calculateAverageOrderValue(data: any[]): number {
  const totalRevenue = calculateTotalRevenue(data)
  const totalOrders = calculateTotalOrders(data)
  return totalOrders > 0 ? totalRevenue / totalOrders : 0
}

function calculateAverageProcessingTime(data: any[]): number {
  if (data.length === 0) return 0
  const total = data.reduce((sum, item) => sum + (item.avg_processing_time_minutes || 0), 0)
  return total / data.length
}

function calculateCollaborationRate(operationalData: any[], collaborationData: any[]): number {
  const totalOrders = calculateTotalOrders(operationalData)
  const totalCollaborations = collaborationData.reduce((sum, item) => sum + (item.collaboration_events || 0), 0)
  return totalOrders > 0 ? (totalCollaborations / totalOrders) * 100 : 0
}

function calculateAverageCpuUsage(data: any[]): number {
  if (data.length === 0) return 0
  const total = data.reduce((sum, item) => sum + (item.cpuUsage || 0), 0)
  return total / data.length
}

function calculateAverageMemoryUsage(data: any[]): number {
  if (data.length === 0) return 0
  const total = data.reduce((sum, item) => sum + (item.memoryUsage || 0), 0)
  return total / data.length
}

async function calculateRevenueGrowth(storeId: string, startDate: Date, endDate: Date): Promise<number> {
  const previousPeriodStart = new Date(startDate.getTime() - (endDate.getTime() - startDate.getTime()))
  const previousPeriodEnd = new Date(startDate.getTime())

  const [current, previous] = await Promise.all([
    prisma.heldOrder.aggregate({
      where: {
        storeId,
        status: { in: ['retrieved', 'completed'] },
        createdAt: { gte: startDate, lte: endDate }
      },
      _sum: { total: true }
    }),
    prisma.heldOrder.aggregate({
      where: {
        storeId,
        status: { in: ['retrieved', 'completed'] },
        createdAt: { gte: previousPeriodStart, lte: previousPeriodEnd }
      },
      _sum: { total: true }
    })
  ])

  const currentRevenue = current._sum.total || 0
  const previousRevenue = previous._sum.total || 0

  return previousRevenue > 0 ? ((currentRevenue - previousRevenue) / previousRevenue) * 100 : 0
}

function calculatePercentageChange(current: number, previous: number): number {
  if (previous === 0) return current > 0 ? 100 : 0
  return ((current - previous) / previous) * 100
}

function getTrendDirection(current: number, previous: number): 'up' | 'down' | 'stable' {
  const change = calculatePercentageChange(current, previous)
  if (Math.abs(change) < 5) return 'stable'
  return change > 0 ? 'up' : 'down'
}

function generateMetricsSummary(metrics: any, trends: any) {
  return {
    overallHealth: 'good', // This would be calculated based on all metrics
    keyInsights: [
      'Revenue trends show positive growth',
      'System performance within acceptable parameters',
      'Collaboration features being actively used'
    ],
    recommendations: [
      'Monitor response times during peak hours',
      'Consider optimizing frequently accessed endpoints',
      'Implement alerts for performance degradation'
    ]
  }
}