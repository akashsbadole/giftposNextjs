import { NextRequest, NextResponse } from 'next/server'
import { PrismaClient } from '@prisma/client'
import { auth } from '@clerk/nextjs/server'
import { AuditLogger } from '@/lib/security/audit-logger'
import { OrderErrorHandler } from '@/lib/order-management-errors'

const prisma = new PrismaClient()

// GET /api/pos/orders/analytics/dashboard - Get real-time operational insights
export async function GET(request: NextRequest) {
  try {
    const { userId } = await auth()
    if (!userId) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const { searchParams } = new URL(request.url)
    const storeId = searchParams.get('storeId')
    const timeRange = searchParams.get('timeRange') || '24h' // 1h, 24h, 7d, 30d
    const refreshInterval = searchParams.get('refreshInterval') || '30s'

    if (!storeId) {
      return NextResponse.json({ error: 'Store ID is required' }, { status: 400 })
    }

    // Calculate time range
    const timeRangeMs = getTimeRangeInMs(timeRange)
    const startDate = new Date(Date.now() - timeRangeMs)
    const endDate = new Date()

    // Get dashboard data in parallel
    const [
      activeOrders,
      orderMetrics,
      collaborationStats,
      systemHealth,
      recentActivity,
      performanceMetrics,
      workflowStats
    ] = await Promise.all([
      getActiveOrders(storeId, startDate, endDate),
      getOrderMetrics(storeId, startDate, endDate),
      getCollaborationStats(storeId, startDate, endDate),
      getSystemHealth(),
      getRecentActivity(storeId, startDate, endDate),
      getPerformanceMetrics(storeId, startDate, endDate),
      getWorkflowStats(storeId, startDate, endDate)
    ])

    // Calculate additional metrics
    const dashboard = {
      timestamp: new Date().toISOString(),
      timeRange,
      refreshInterval,
      
      // Real-time operational insights
      operationalStatus: calculateOperationalStatus(activeOrders, systemHealth),
      
      // Order statistics
      orders: {
        active: activeOrders.activeCount,
        held: activeOrders.heldCount,
        retrieved: activeOrders.retrievedCount,
        expired: activeOrders.expiredCount,
        cancelled: activeOrders.cancelledCount,
        total: activeOrders.totalCount,
        trends: orderMetrics.trends
      },

      // Financial metrics
      financials: {
        totalRevenue: orderMetrics.totalRevenue,
        averageOrderValue: orderMetrics.averageOrderValue,
        revenueGrowth: orderMetrics.revenueGrowth,
        topRevenueHours: orderMetrics.topRevenueHours
      },

      // Collaboration metrics
      collaboration: {
        activeSessions: collaborationStats.activeSessions,
        totalCollaborations: collaborationStats.totalCollaborations,
        averageSessionDuration: collaborationStats.averageSessionDuration,
        mostCollaborativeOrders: collaborationStats.mostCollaborativeOrders
      },

      // Performance metrics
      performance: {
        averageResponseTime: performanceMetrics.averageResponseTime,
        errorRate: performanceMetrics.errorRate,
        throughput: performanceMetrics.throughput,
        systemLoad: systemHealth.cpuUsage
      },

      // Workflow automation
      automation: {
        activeRules: workflowStats.activeRules,
        executedRules: workflowStats.executedRules,
        automationRate: workflowStats.automationRate,
        timeSaved: workflowStats.timeSaved
      },

      // Recent activity feed
      recentActivity: recentActivity.slice(0, 10),

      // Alerts and notifications
      alerts: generateAlerts(activeOrders, performanceMetrics, systemHealth),

      // Predictions and insights
      insights: generateInsights(activeOrders, orderMetrics, collaborationStats)
    }

    return NextResponse.json(dashboard)

  } catch (error) {
    console.error('Error fetching analytics dashboard:', error)
    
    const errorContext = {
      operation: 'FETCH_ANALYTICS_DASHBOARD',
      timestamp: new Date()
    }

    const orderError = OrderErrorHandler.createError(
      'SYSTEM_ERROR' as any,
      'Failed to fetch analytics dashboard',
      errorContext,
      { severity: 'high' }
    )

    return NextResponse.json(
      { 
        error: 'Failed to fetch analytics dashboard',
        errorId: orderError.id
      },
      { status: 500 }
    )
  }
}

// Helper functions
function getTimeRangeInMs(timeRange: string): number {
  switch (timeRange) {
    case '1h': return 60 * 60 * 1000
    case '24h': return 24 * 60 * 60 * 1000
    case '7d': return 7 * 24 * 60 * 60 * 1000
    case '30d': return 30 * 24 * 60 * 60 * 1000
    default: return 24 * 60 * 60 * 1000
  }
}

async function getActiveOrders(storeId: string, startDate: Date, endDate: Date) {
  // Get orders by status
  const ordersByStatus = await prisma.heldOrder.groupBy({
    by: ['status'],
    where: {
      storeId,
      createdAt: {
        gte: startDate,
        lte: endDate
      }
    },
    _count: true,
    _sum: { total: true }
  })

  // Calculate age distribution for active orders
  const activeOrders = await prisma.heldOrder.findMany({
    where: {
      storeId,
      status: 'held',
      createdAt: {
        gte: startDate,
        lte: endDate
      }
    },
    select: {
      id: true,
      createdAt: true,
      total: true,
      priority: true
    }
  })

  const ageDistribution = {
    '0-15m': 0,
    '15-30m': 0,
    '30-60m': 0,
    '1-2h': 0,
    '2h+': 0
  }

  activeOrders.forEach(order => {
    const ageMinutes = Math.floor((Date.now() - order.createdAt.getTime()) / (1000 * 60))
    if (ageMinutes <= 15) ageDistribution['0-15m']++
    else if (ageMinutes <= 30) ageDistribution['15-30m']++
    else if (ageMinutes <= 60) ageDistribution['30-60m']++
    else if (ageMinutes <= 120) ageDistribution['1-2h']++
    else ageDistribution['2h+']++
  })

  return {
    activeCount: activeOrders.length,
    heldCount: ordersByStatus.find(o => o.status === 'held')?._count || 0,
    retrievedCount: ordersByStatus.find(o => o.status === 'retrieved')?._count || 0,
    expiredCount: ordersByStatus.find(o => o.status === 'expired')?._count || 0,
    cancelledCount: ordersByStatus.find(o => o.status === 'cancelled')?._count || 0,
    totalCount: ordersByStatus.reduce((sum, o) => sum + o._count, 0),
    ageDistribution
  }
}

async function getOrderMetrics(storeId: string, startDate: Date, endDate: Date) {
  // Get revenue metrics
  const revenueData = await prisma.heldOrder.aggregate({
    where: {
      storeId,
      status: { in: ['retrieved', 'completed'] },
      createdAt: {
        gte: startDate,
        lte: endDate
      }
    },
    _sum: { total: true },
    _avg: { total: true },
    _count: true
  })

  // Calculate trends (compare with previous period)
  const previousPeriodStart = new Date(startDate.getTime() - (endDate.getTime() - startDate.getTime()))
  const previousRevenue = await prisma.heldOrder.aggregate({
    where: {
      storeId,
      status: { in: ['retrieved', 'completed'] },
      createdAt: {
        gte: previousPeriodStart,
        lt: startDate
      }
    },
    _sum: { total: true }
  })

  // Get hourly revenue distribution
  const hourlyRevenue = await prisma.$queryRaw`
    SELECT 
      strftime('%H', createdAt) as hour,
      SUM(total) as revenue,
      COUNT(*) as order_count
    FROM HeldOrder 
    WHERE storeId = ${storeId}
      AND status IN ('retrieved', 'completed')
      AND createdAt >= ${startDate}
      AND createdAt <= ${endDate}
    GROUP BY hour
    ORDER BY hour
  `

  const topRevenueHours = (hourlyRevenue as any[]).slice(0, 3)

  const currentRevenue = revenueData._sum.total || 0
  const previousRevenueValue = previousRevenue._sum.total || 0
  const revenueGrowth = previousRevenueValue > 0 
    ? ((currentRevenue - previousRevenueValue) / previousRevenueValue) * 100 
    : 0

  return {
    totalRevenue: currentRevenue,
    averageOrderValue: revenueData._avg.total || 0,
    revenueGrowth,
    totalOrders: revenueData._count,
    topRevenueHours
  }
}

async function getCollaborationStats(storeId: string, startDate: Date, endDate: Date) {
  // Get collaboration sessions
  const collaborationSessions = await prisma.collaborationSession.findMany({
    where: {
      heldOrder: { storeId },
      createdAt: {
        gte: startDate,
        lte: endDate
      }
    },
    select: {
      id: true,
      createdAt: true,
      lastSeenAt: true,
      isActive: true
    }
  })

  const activeSessions = collaborationSessions.filter(s => s.isActive && 
    (Date.now() - s.lastSeenAt.getTime()) < 5 * 60 * 1000)

  // Calculate session durations
  const completedSessions = collaborationSessions.filter(s => !s.isActive)
  const averageSessionDuration = completedSessions.length > 0
    ? completedSessions.reduce((sum, s) => sum + (s.lastSeenAt.getTime() - s.createdAt.getTime()), 0) / completedSessions.length / 60000
    : 0

  // Get most collaborative orders
  const collaborativeOrders = await prisma.collaborationSession.groupBy({
    by: ['heldOrderId'],
    where: {
      heldOrder: { storeId },
      createdAt: {
        gte: startDate,
        lte: endDate
      }
    },
    _count: true,
    orderBy: {
      _count: {
        heldOrderId: 'desc'
      }
    },
    take: 5
  })

  return {
    activeSessions: activeSessions.length,
    totalCollaborations: collaborationSessions.length,
    averageSessionDuration,
    mostCollaborativeOrders: collaborativeOrders.map(o => ({
      orderId: o.heldOrderId,
      collaborationCount: o._count
    }))
  }
}

async function getSystemHealth() {
  // Mock system health data - in real implementation, this would come from monitoring systems
  return {
    status: 'healthy', // healthy, degraded, critical
    cpuUsage: Math.random() * 100,
    memoryUsage: Math.random() * 100,
    responseTime: Math.random() * 500 + 100,
    uptime: Date.now() - Date.now() + (24 * 60 * 60 * 1000), // Mock 24h uptime
    activeConnections: Math.floor(Math.random() * 50) + 10
  }
}

async function getRecentActivity(storeId: string, startDate: Date, endDate: Date) {
  // Get recent audit logs for activity feed
  const recentLogs = await prisma.auditLog.findMany({
    where: {
      path: { contains: '/api/pos/orders' },
      timestamp: {
        gte: startDate,
        lte: endDate
      }
    },
    orderBy: { timestamp: 'desc' },
    take: 20,
    select: {
      id: true,
      timestamp: true,
      userId: true,
      userEmail: true,
      action: true,
      resource: true,
      status: true,
      severity: true
    }
  })

  return recentLogs.map(log => ({
    id: log.id,
    timestamp: log.timestamp,
    user: log.userEmail || log.userId,
    action: log.action,
    resource: log.resource,
    status: log.status,
    severity: log.severity,
    description: generateActivityDescription(log)
  }))
}

async function getPerformanceMetrics(storeId: string, startDate: Date, endDate: Date) {
  // Get performance metrics
  const performanceData = await prisma.performanceMetric.findMany({
    where: {
      timestamp: {
        gte: startDate,
        lte: endDate
      }
    },
    select: {
      duration: true,
      success: true
    }
  })

  const totalRequests = performanceData.length
  const successfulRequests = performanceData.filter(p => p.success).length
  const errorRate = totalRequests > 0 ? ((totalRequests - successfulRequests) / totalRequests) * 100 : 0

  const averageResponseTime = performanceData.length > 0
    ? performanceData.reduce((sum, p) => sum + p.duration, 0) / performanceData.length
    : 0

  const throughput = totalRequests / ((endDate.getTime() - startDate.getTime()) / 1000 / 60) // requests per minute

  return {
    averageResponseTime,
    errorRate,
    throughput,
    totalRequests
  }
}

async function getWorkflowStats(storeId: string, startDate: Date, endDate: Date) {
  // Get workflow statistics
  const workflowRules = await prisma.workflowRule.findMany({
    where: { storeId },
    select: { isActive: true }
  })

  const workflowActions = await prisma.workflowAction.findMany({
    where: {
      rule: { storeId },
      startedAt: {
        gte: startDate,
        lte: endDate
      }
    },
    select: {
      status: true,
      duration: true
    }
  })

  const activeRules = workflowRules.filter(r => r.isActive).length
  const executedActions = workflowActions.length
  const successfulActions = workflowActions.filter(a => a.status === 'completed').length
  const automationRate = executedActions > 0 ? (successfulActions / executedActions) * 100 : 0

  // Estimate time saved (mock calculation)
  const timeSaved = successfulActions * 30 // Assume 30 seconds saved per automation

  return {
    activeRules,
    executedRules: executedActions,
    automationRate,
    timeSaved
  }
}

function calculateOperationalStatus(activeOrders: any, systemHealth: any) {
  const factors = []

  // Check order load
  if (activeOrders.activeCount > 100) factors.push('high_order_load')
  else if (activeOrders.activeCount > 50) factors.push('medium_order_load')
  else factors.push('normal_order_load')

  // Check system health
  if (systemHealth.cpuUsage > 80) factors.push('high_cpu_usage')
  if (systemHealth.memoryUsage > 80) factors.push('high_memory_usage')
  if (systemHealth.responseTime > 1000) factors.push('slow_response_time')

  // Determine overall status
  let status = 'optimal'
  if (factors.includes('critical_system_issues')) status = 'critical'
  else if (factors.includes('high_order_load') || factors.includes('high_cpu_usage')) status = 'degraded'
  else if (factors.includes('medium_order_load')) status = 'busy'

  return {
    status,
    factors,
    score: Math.max(0, 100 - (factors.length * 20))
  }
}

function generateAlerts(activeOrders: any, performanceMetrics: any, systemHealth: any) {
  const alerts = []

  // Order-related alerts
  if (activeOrders.expiredCount > 0) {
    alerts.push({
      type: 'warning',
      category: 'orders',
      message: `${activeOrders.expiredCount} orders have expired`,
      priority: 'medium'
    })
  }

  if (activeOrders.ageDistribution['2h+'] > 0) {
    alerts.push({
      type: 'warning',
      category: 'orders',
      message: `${activeOrders.ageDistribution['2h+']} orders are over 2 hours old`,
      priority: 'high'
    })
  }

  // Performance alerts
  if (performanceMetrics.errorRate > 5) {
    alerts.push({
      type: 'error',
      category: 'performance',
      message: `High error rate: ${performanceMetrics.errorRate.toFixed(1)}%`,
      priority: 'high'
    })
  }

  // System health alerts
  if (systemHealth.cpuUsage > 80) {
    alerts.push({
      type: 'warning',
      category: 'system',
      message: `High CPU usage: ${systemHealth.cpuUsage.toFixed(1)}%`,
      priority: 'medium'
    })
  }

  return alerts
}

function generateInsights(activeOrders: any, orderMetrics: any, collaborationStats: any) {
  const insights = []

  // Order insights
  if (activeOrders.activeCount > 0) {
    insights.push({
      type: 'operational',
      message: `Peak order processing time: ${getPeakHoursInsight(activeOrders)}`,
      confidence: 'high'
    })
  }

  // Collaboration insights
  if (collaborationStats.activeSessions > 0) {
    insights.push({
      type: 'collaboration',
      message: `${collaborationStats.activeSessions} users are actively collaborating`,
      confidence: 'high'
    })
  }

  // Revenue insights
  if (orderMetrics.revenueGrowth > 0) {
    insights.push({
      type: 'financial',
      message: `Revenue is up ${orderMetrics.revenueGrowth.toFixed(1)}% compared to last period`,
      confidence: 'medium'
    })
  }

  return insights
}

function getPeakHoursInsight(activeOrders: any) {
  const ageDist = activeOrders.ageDistribution
  if (ageDist['1-2h'] > ageDist['30-60m'] && ageDist['1-2h'] > ageDist['0-15m']) {
    return 'Orders are accumulating in the 1-2 hour range'
  } else if (ageDist['30-60m'] > ageDist['0-15m']) {
    return 'Most orders are in the 30-60 minute processing window'
  } else {
    return 'Orders are being processed quickly'
  }
}

function generateActivityDescription(log: any): string {
  const actionDescriptions: Record<string, string> = {
    'collaboration_session_created': 'Started collaboration session',
    'order_lock_acquired': 'Acquired order lock',
    'orders_merged': 'Merged orders',
    'bulk_cancel': 'Cancelled multiple orders',
    'workflow_rule_executed': 'Executed workflow rule'
  }

  return actionDescriptions[log.action] || `${log.action.replace(/_/g, ' ')}`
}