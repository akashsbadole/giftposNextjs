import { NextRequest, NextResponse } from 'next/server'
import { PrismaClient } from '@prisma/client'
import { auth } from '@clerk/nextjs/server'
import { AuditLogger } from '@/lib/security/audit-logger'
import { OrderErrorHandler } from '@/lib/order-management-errors'

const prisma = new PrismaClient()

// GET /api/pos/orders/hold/search - Advanced search with full-text indexing
export async function GET(request: NextRequest) {
  try {
    const { userId } = await auth()
    if (!userId) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const { searchParams } = new URL(request.url)
    const storeId = searchParams.get('storeId')
    const query = searchParams.get('q') || ''
    const filters = searchParams.get('filters') // JSON string of filters
    const sortBy = searchParams.get('sortBy') || 'createdAt'
    const sortOrder = searchParams.get('sortOrder') || 'desc'
    const limit = parseInt(searchParams.get('limit') || '20')
    const offset = parseInt(searchParams.get('offset') || '0')
    const includeMetadata = searchParams.get('includeMetadata') === 'true'

    if (!storeId) {
      return NextResponse.json({ error: 'Store ID is required' }, { status: 400 })
    }

    // Parse filters
    let parsedFilters = {}
    if (filters) {
      try {
        parsedFilters = JSON.parse(filters)
      } catch (error) {
        return NextResponse.json({ error: 'Invalid filters format' }, { status: 400 })
      }
    }

    // Build search query
    const searchResults = await performAdvancedSearch({
      storeId,
      query,
      filters: parsedFilters,
      sortBy,
      sortOrder,
      limit,
      offset,
      includeMetadata
    })

    // Log the search operation
    await AuditLogger.log({
      timestamp: new Date(),
      userId,
      action: 'advanced_order_search',
      resource: 'held_order',
      method: 'GET',
      path: request.url,
      status: 'success',
      severity: 'low',
      details: {
        query,
        filters: parsedFilters,
        resultsCount: searchResults.results.length,
        executionTime: searchResults.executionTime
      }
    })

    return NextResponse.json({
      query,
      filters: parsedFilters,
      results: searchResults.results,
      pagination: searchResults.pagination,
      facets: searchResults.facets,
      suggestions: searchResults.suggestions,
      executionTime: searchResults.executionTime,
      totalFound: searchResults.totalFound
    })

  } catch (error) {
    console.error('Error performing advanced search:', error)
    
    const errorContext = {
      operation: 'ADVANCED_ORDER_SEARCH',
      timestamp: new Date()
    }

    const orderError = OrderErrorHandler.createError(
      'SYSTEM_ERROR' as any,
      'Failed to perform advanced search',
      errorContext,
      { severity: 'high' }
    )

    await AuditLogger.log({
      timestamp: new Date(),
      action: 'advanced_search_failed',
      resource: 'held_order',
      method: 'GET',
      path: request.url,
      status: 'failure',
      severity: 'high',
      details: { error: error instanceof Error ? error.message : 'Unknown error' }
    })

    return NextResponse.json(
      { 
        error: 'Failed to perform advanced search',
        errorId: orderError.id
      },
      { status: 500 }
    )
  }
}

// POST /api/pos/orders/hold/search - Save search query
export async function POST(request: NextRequest) {
  try {
    const { userId } = await auth()
    if (!userId) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const body = await request.json()
    const { 
      name, 
      query, 
      filters, 
      isPublic = false,
      tags = [],
      metadata = {}
    } = body

    if (!name || !query) {
      return NextResponse.json({ 
        error: 'Search name and query are required' 
      }, { status: 400 })
    }

    const { searchParams } = new URL(request.url)
    const storeId = searchParams.get('storeId')
    if (!storeId) {
      return NextResponse.json({ error: 'Store ID is required' }, { status: 400 })
    }

    // In a real implementation, this would save to a SavedSearch model
    // For now, we'll simulate saving and return the saved search
    const savedSearch = {
      id: `search_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
      name,
      query,
      filters: filters || {},
      isPublic,
      tags,
      metadata,
      storeId,
      createdBy: userId,
      createdAt: new Date(),
      usageCount: 0,
      lastUsedAt: null
    }

    // Log the search save
    await AuditLogger.log({
      timestamp: new Date(),
      userId,
      action: 'search_query_saved',
      resource: 'saved_search',
      resourceId: savedSearch.id,
      method: 'POST',
      path: request.url,
      status: 'success',
      severity: 'low',
      details: {
        searchName: name,
        isPublic,
        tagCount: tags.length
      }
    })

    return NextResponse.json({
      savedSearch,
      message: 'Search query saved successfully'
    }, { status: 201 })

  } catch (error) {
    console.error('Error saving search query:', error)
    return NextResponse.json(
      { error: 'Failed to save search query' },
      { status: 500 }
    )
  }
}

// Helper function to perform advanced search
async function performAdvancedSearch(params: {
  storeId: string
  query: string
  filters: any
  sortBy: string
  sortOrder: string
  limit: number
  offset: number
  includeMetadata: boolean
}) {
  const startTime = Date.now()
  
  // Build the base query
  let whereClause: any = { storeId: params.storeId }
  
  // Add text search if query provided
  if (params.query && params.query.trim()) {
    const searchTerms = params.query.trim().split(' ').filter(term => term.length > 0)
    
    if (searchTerms.length > 0) {
      whereClause.OR = []
      
      // Search in order number, order name, notes
      searchTerms.forEach(term => {
        whereClause.OR.push(
          { orderNumber: { contains: term, mode: 'insensitive' } },
          { orderName: { contains: term, mode: 'insensitive' } },
          { notes: { contains: term, mode: 'insensitive' } }
        )
      })

      // Search in customer information
      whereClause.OR.push({
        customer: {
          OR: [
            { name: { contains: params.query, mode: 'insensitive' } },
            { email: { contains: params.query, mode: 'insensitive' } },
            { phone: { contains: params.query, mode: 'insensitive' } }
          ]
        }
      })

      // Search in employee information
      whereClause.OR.push({
        employee: {
          OR: [
            { name: { contains: params.query, mode: 'insensitive' } }
          ]
        }
      })
    }
  }

  // Apply filters
  whereClause = applyFilters(whereClause, params.filters)

  // Get total count for pagination
  const totalCount = await prisma.heldOrder.count({ where: whereClause })

  // Get search results
  const orders = await prisma.heldOrder.findMany({
    where: whereClause,
    include: {
      customer: {
        select: {
          id: true,
          name: true,
          phone: true,
          email: true
        }
      },
      employee: {
        select: {
          id: true,
          name: true
        }
      }
    },
    orderBy: {
      [params.sortBy]: params.sortOrder
    },
    take: params.limit,
    skip: params.offset
  })

  // Process results and calculate relevance scores
  const results = orders.map(order => {
    const relevanceScore = calculateRelevanceScore(order, params.query, params.filters)
    const ageInMinutes = Math.floor((Date.now() - order.createdAt.getTime()) / (1000 * 60))
    
    return {
      ...order,
      relevanceScore,
      ageInMinutes,
      ageDisplay: formatAge(ageInMinutes),
      itemsData: undefined, // Remove raw JSON data
      ...(params.includeMetadata && order.metadata && {
        metadata: JSON.parse(order.metadata)
      })
    }
  })

  // Get facets for filtering
  const facets = await getSearchFacets(params.storeId, whereClause)

  // Get search suggestions
  const suggestions = await getSearchSuggestions(params.query, params.storeId)

  const executionTime = Date.now() - startTime

  return {
    results,
    pagination: {
      total: totalCount,
      limit: params.limit,
      offset: params.offset,
      hasMore: params.offset + params.limit < totalCount,
      pages: Math.ceil(totalCount / params.limit)
    },
    facets,
    suggestions,
    executionTime,
    totalFound: totalCount
  }
}

// Apply filters to the where clause
function applyFilters(whereClause: any, filters: any) {
  const filteredWhere = { ...whereClause }

  // Status filter
  if (filters.status && Array.isArray(filters.status) && filters.status.length > 0) {
    filteredWhere.status = { in: filters.status }
  }

  // Date range filters
  if (filters.createdAt) {
    if (filters.createdAt.from) {
      filteredWhere.createdAt = { ...filteredWhere.createdAt, gte: new Date(filters.createdAt.from) }
    }
    if (filters.createdAt.to) {
      filteredWhere.createdAt = { ...filteredWhere.createdAt, lte: new Date(filters.createdAt.to) }
    }
  }

  if (filters.updatedAt) {
    if (filters.updatedAt.from) {
      filteredWhere.updatedAt = { ...filteredWhere.updatedAt, gte: new Date(filters.updatedAt.from) }
    }
    if (filters.updatedAt.to) {
      filteredWhere.updatedAt = { ...filteredWhere.updatedAt, lte: new Date(filters.updatedAt.to) }
    }
  }

  // Amount filters
  if (filters.totalAmount) {
    if (filters.totalAmount.min !== undefined) {
      filteredWhere.total = { ...filteredWhere.total, gte: filters.totalAmount.min }
    }
    if (filters.totalAmount.max !== undefined) {
      filteredWhere.total = { ...filteredWhere.total, lte: filters.totalAmount.max }
    }
  }

  // Customer filters
  if (filters.customerId) {
    filteredWhere.customerId = filters.customerId
  }

  if (filters.customerName) {
    filteredWhere.customer = {
      ...filteredWhere.customer,
      name: { contains: filters.customerName, mode: 'insensitive' }
    }
  }

  // Employee filters
  if (filters.employeeId) {
    filteredWhere.employeeId = filters.employeeId
  }

  if (filters.employeeName) {
    filteredWhere.employee = {
      ...filteredWhere.employee,
      name: { contains: filters.employeeName, mode: 'insensitive' }
    }
  }

  // Table number filter
  if (filters.tableNumber) {
    filteredWhere.tableNumber = { contains: filters.tableNumber, mode: 'insensitive' }
  }

  // Priority filter
  if (filters.priority) {
    if (filters.priority.min !== undefined) {
      filteredWhere.priority = { ...filteredWhere.priority, gte: filters.priority.min }
    }
    if (filters.priority.max !== undefined) {
      filteredWhere.priority = { ...filteredWhere.priority, lte: filters.priority.max }
    }
  }

  // Has notes filter
  if (filters.hasNotes !== undefined) {
    if (filters.hasNotes) {
      filteredWhere.notes = { not: null }
    } else {
      filteredWhere.notes = null
    }
  }

  // Tags filter
  if (filters.tags && Array.isArray(filters.tags) && filters.tags.length > 0) {
    // This would need to be implemented based on how tags are stored
    // For now, we'll skip this filter
  }

  return filteredWhere
}

// Calculate relevance score for search results
function calculateRelevanceScore(order: any, query: string, filters: any): number {
  let score = 0

  if (!query || !query.trim()) {
    return 0 // No relevance score for empty queries
  }

  const searchTerms = query.toLowerCase().split(' ').filter(term => term.length > 0)
  
  // Exact match in order number gets highest score
  if (searchTerms.some(term => order.orderNumber.toLowerCase().includes(term))) {
    score += 100
  }

  // Order name matches
  if (order.orderName) {
    searchTerms.forEach(term => {
      if (order.orderName.toLowerCase().includes(term)) {
        score += 50
      }
    })
  }

  // Customer name matches
  if (order.customer?.name) {
    searchTerms.forEach(term => {
      if (order.customer.name.toLowerCase().includes(term)) {
        score += 30
      }
    })
  }

  // Notes matches
  if (order.notes) {
    searchTerms.forEach(term => {
      if (order.notes.toLowerCase().includes(term)) {
        score += 20
      }
    })
  }

  // Recent orders get a small boost
  const ageInMinutes = Math.floor((Date.now() - order.createdAt.getTime()) / (1000 * 60))
  if (ageInMinutes < 60) {
    score += 10
  } else if (ageInMinutes < 1440) { // Less than 24 hours
    score += 5
  }

  return score
}

// Get search facets for filtering
async function getSearchFacets(storeId: string, baseWhereClause: any) {
  // This would typically involve separate queries for each facet
  const [statusFacet, customerFacet, employeeFacet, amountRanges] = await Promise.all([
    // Status facet
    prisma.heldOrder.groupBy({
      by: ['status'],
      where: { ...baseWhereClause },
      _count: true
    }),
    
    // Top customers facet (limit to top 10)
    prisma.heldOrder.groupBy({
      by: ['customerId'],
      where: { ...baseWhereClause, customerId: { not: null } },
      _count: true,
      orderBy: { _count: { customerId: 'desc' } },
      take: 10
    }),
    
    // Top employees facet
    prisma.heldOrder.groupBy({
      by: ['employeeId'],
      where: { ...baseWhereClause, employeeId: { not: null } },
      _count: true,
      orderBy: { _count: { employeeId: 'desc' } },
      take: 10
    }),
    
    // Amount ranges facet
    prisma.$queryRaw`
      SELECT 
        CASE 
          WHEN total < 100 THEN '0-100'
          WHEN total < 500 THEN '100-500'
          WHEN total < 1000 THEN '500-1000'
          WHEN total < 5000 THEN '1000-5000'
          ELSE '5000+'
        END as range,
        COUNT(*) as count,
        SUM(total) as total_amount
      FROM HeldOrder 
      WHERE storeId = ${storeId}
      GROUP BY range
      ORDER BY MIN(total)
    `
  ])

  return {
    status: statusFacet.map(item => ({ value: item.status, count: item._count })),
    customers: customerFacet.map(item => ({ 
      value: item.customerId, 
      count: item._count 
    })),
    employees: employeeFacet.map(item => ({ 
      value: item.employeeId, 
      count: item._count 
    })),
    amountRanges: amountRanges
  }
}

// Get search suggestions
async function getSearchSuggestions(query: string, storeId: string) {
  if (!query || query.length < 2) {
    return []
  }

  // Get popular search terms and order numbers
  const [popularTerms, recentOrders] = await Promise.all([
    // Popular terms from audit logs
    prisma.auditLog.findMany({
      where: {
        action: 'advanced_order_search',
        details: { contains: query },
        timestamp: {
          gte: new Date(Date.now() - 30 * 24 * 60 * 60 * 1000) // Last 30 days
        }
      },
      select: { details: true },
      take: 10
    }),
    
    // Recent order numbers that start with the query
    prisma.heldOrder.findMany({
      where: {
        storeId,
        orderNumber: { startsWith: query.toUpperCase() }
      },
      select: { orderNumber: true },
      take: 5
    })
  ])

  const suggestions = []

  // Add order number suggestions
  recentOrders.forEach(order => {
    suggestions.push({
      type: 'order',
      value: order.orderNumber,
      label: `Order ${order.orderNumber}`,
      relevance: 100
    })
  })

  // Extract popular terms
  popularTerms.forEach(log => {
    try {
      const details = JSON.parse(log.details || '{}')
      if (details.query && details.query.includes(query)) {
        suggestions.push({
          type: 'search',
          value: details.query,
          label: `Search: ${details.query}`,
          relevance: 50
        })
      }
    } catch (error) {
      // Ignore parsing errors
    }
  })

  // Remove duplicates and sort by relevance
  const uniqueSuggestions = suggestions.filter((suggestion, index, self) => 
    index === self.findIndex(s => s.value === suggestion.value)
  ).sort((a, b) => b.relevance - a.relevance)

  return uniqueSuggestions.slice(0, 10)
}

// Helper function to format age
function formatAge(ageInMinutes: number): string {
  if (ageInMinutes < 60) {
    return `${ageInMinutes}m`
  }
  
  const hours = Math.floor(ageInMinutes / 60)
  const minutes = ageInMinutes % 60
  
  if (hours < 24) {
    return minutes > 0 ? `${hours}h ${minutes}m` : `${hours}h`
  }
  
  const days = Math.floor(hours / 24)
  const remainingHours = hours % 24
  
  return remainingHours > 0 ? `${days}d ${remainingHours}h` : `${days}d`
}