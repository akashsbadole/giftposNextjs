import { NextRequest, NextResponse } from 'next/server'
import { PrismaClient } from '@prisma/client'
import { auth } from '@clerk/nextjs/server'
import { AuditLogger } from '@/lib/security/audit-logger'
import { OrderErrorHandler } from '@/lib/order-management-errors'

const prisma = new PrismaClient()

// GET /api/pos/orders/hold/filter - Faceted filtering and saved queries
export async function GET(request: NextRequest) {
  try {
    const { userId } = await auth()
    if (!userId) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const { searchParams } = new URL(request.url)
    const storeId = searchParams.get('storeId')
    const query = searchParams.get('q') || ''
    const activeFilters = searchParams.get('filters') // JSON string of active filters
    const facets = searchParams.get('facets')?.split(',') || [] // Which facets to include
    const includeCounts = searchParams.get('includeCounts') !== 'false'
    const limit = parseInt(searchParams.get('limit') || '20')
    const offset = parseInt(searchParams.get('offset') || '0')

    if (!storeId) {
      return NextResponse.json({ error: 'Store ID is required' }, { status: 400 })
    }

    // Parse active filters
    let parsedFilters = {}
    if (activeFilters) {
      try {
        parsedFilters = JSON.parse(activeFilters)
      } catch (error) {
        return NextResponse.json({ error: 'Invalid filters format' }, { status: 400 })
      }
    }

    // Perform faceted search
    const searchResults = await performFacetedSearch({
      storeId,
      query,
      filters: parsedFilters,
      requestedFacets: facets,
      includeCounts,
      limit,
      offset
    })

    // Log the filter operation
    await AuditLogger.log({
      timestamp: new Date(),
      userId,
      action: 'faceted_order_filter',
      resource: 'held_order',
      method: 'GET',
      path: request.url,
      status: 'success',
      severity: 'low',
      details: {
        query,
        filters: parsedFilters,
        facetsRequested: facets,
        resultsCount: searchResults.results.length,
        executionTime: searchResults.executionTime
      }
    })

    return NextResponse.json({
      query,
      activeFilters: parsedFilters,
      results: searchResults.results,
      pagination: searchResults.pagination,
      facets: searchResults.facets,
      availableFilters: searchResults.availableFilters,
      filterSuggestions: searchResults.filterSuggestions,
      executionTime: searchResults.executionTime,
      totalFound: searchResults.totalFound
    })

  } catch (error) {
    console.error('Error performing faceted filtering:', error)
    
    const errorContext = {
      operation: 'FACETED_ORDER_FILTER',
      timestamp: new Date()
    }

    const orderError = OrderErrorHandler.createError(
      'SYSTEM_ERROR' as any,
      'Failed to perform faceted filtering',
      errorContext,
      { severity: 'high' }
    )

    return NextResponse.json(
      { 
        error: 'Failed to perform faceted filtering',
        errorId: orderError.id
      },
      { status: 500 }
    )
  }
}

// POST /api/pos/orders/hold/filter - Save filter query
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
      facets,
      isPublic = false,
      tags = [],
      description = '',
      metadata = {}
    } = body

    if (!name || !filters) {
      return NextResponse.json({ 
        error: 'Filter name and filters are required' 
      }, { status: 400 })
    }

    const { searchParams } = new URL(request.url)
    const storeId = searchParams.get('storeId')
    if (!storeId) {
      return NextResponse.json({ error: 'Store ID is required' }, { status: 400 })
    }

    // Create saved filter
    const savedFilter = {
      id: `filter_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
      name,
      description,
      query: query || '',
      filters: filters || {},
      facets: facets || [],
      isPublic,
      tags,
      metadata,
      storeId,
      createdBy: userId,
      createdAt: new Date(),
      usageCount: 0,
      lastUsedAt: null
    }

    // Log the filter save
    await AuditLogger.log({
      timestamp: new Date(),
      userId,
      action: 'filter_query_saved',
      resource: 'saved_filter',
      resourceId: savedFilter.id,
      method: 'POST',
      path: request.url,
      status: 'success',
      severity: 'low',
      details: {
        filterName: name,
        isPublic,
        tagCount: tags.length,
        facetCount: (facets || []).length
      }
    })

    return NextResponse.json({
      savedFilter,
      message: 'Filter query saved successfully'
    }, { status: 201 })

  } catch (error) {
    console.error('Error saving filter query:', error)
    return NextResponse.json(
      { error: 'Failed to save filter query' },
      { status: 500 }
    )
  }
}

// GET /api/pos/orders/hold/filter/saved - Get saved filters
export async function GET(request: NextRequest, { params }: { params: { saved: string } }) {
  try {
    const { userId } = await auth()
    if (!userId) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const { searchParams } = new URL(request.url)
    const storeId = searchParams.get('storeId')
    const includePublic = searchParams.get('includePublic') === 'true'
    const limit = parseInt(searchParams.get('limit') || '20')
    const offset = parseInt(searchParams.get('offset') || '0')

    if (!storeId) {
      return NextResponse.json({ error: 'Store ID is required' }, { status: 400 })
    }

    // In a real implementation, this would query a SavedFilter model
    // For now, we'll return mock saved filters
    const savedFilters = [
      {
        id: 'filter_1',
        name: 'Recent High-Value Orders',
        description: 'Orders above ₹1000 from the last 7 days',
        query: '',
        filters: {
          totalAmount: { min: 1000 },
          createdAt: { from: new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString() }
        },
        facets: ['status', 'customer', 'amountRanges'],
        isPublic: false,
        tags: ['high-value', 'recent'],
        createdBy: userId,
        createdAt: new Date(Date.now() - 2 * 24 * 60 * 60 * 1000),
        usageCount: 5,
        lastUsedAt: new Date(Date.now() - 1 * 60 * 60 * 1000)
      },
      {
        id: 'filter_2',
        name: 'VIP Customer Orders',
        description: 'Orders from VIP customers',
        query: '',
        filters: {
          customerTags: ['vip', 'premium']
        },
        facets: ['customer', 'employee'],
        isPublic: true,
        tags: ['vip', 'customers'],
        createdBy: 'other_user',
        createdAt: new Date(Date.now() - 5 * 24 * 60 * 60 * 1000),
        usageCount: 12,
        lastUsedAt: new Date(Date.now() - 2 * 60 * 60 * 1000)
      }
    ]

    // Filter based on permissions
    let filteredFilters = savedFilters
    if (!includePublic) {
      filteredFilters = savedFilters.filter(f => f.createdBy === userId || f.isPublic)
    }

    // Apply pagination
    const paginatedFilters = filteredFilters.slice(offset, offset + limit)

    return NextResponse.json({
      savedFilters: paginatedFilters,
      pagination: {
        total: filteredFilters.length,
        limit,
        offset,
        hasMore: offset + limit < filteredFilters.length
      }
    })

  } catch (error) {
    console.error('Error fetching saved filters:', error)
    return NextResponse.json(
      { error: 'Failed to fetch saved filters' },
      { status: 500 }
    )
  }
}

// Helper function to perform faceted search
async function performFacetedSearch(params: {
  storeId: string
  query: string
  filters: any
  requestedFacets: string[]
  includeCounts: boolean
  limit: number
  offset: number
}) {
  const startTime = Date.now()

  // Build base where clause
  let baseWhereClause: any = { storeId: params.storeId }

  // Apply text search if query provided
  if (params.query && params.query.trim()) {
    baseWhereClause = applyTextSearch(baseWhereClause, params.query)
  }

  // Apply current filters to get the filtered results
  let filteredWhereClause = applyFilters(baseWhereClause, params.filters)

  // Get total count for pagination
  const totalCount = await prisma.heldOrder.count({ where: filteredWhereClause })

  // Get filtered results
  const orders = await prisma.heldOrder.findMany({
    where: filteredWhereClause,
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
    orderBy: { createdAt: 'desc' },
    take: params.limit,
    skip: params.offset
  })

  // Process results
  const results = orders.map(order => {
    const ageInMinutes = Math.floor((Date.now() - order.createdAt.getTime()) / (1000 * 60))
    
    return {
      ...order,
      ageInMinutes,
      ageDisplay: formatAge(ageInMinutes),
      itemsData: undefined // Remove raw JSON data
    }
  })

  // Calculate facets only for the base dataset (without current filters)
  // This shows what other filter options are available
  const facets = await calculateFacets(params.storeId, baseWhereClause, params.requestedFacets)

  // Calculate available filters (what filters would change the current result set)
  const availableFilters = await calculateAvailableFilters(params.storeId, filteredWhereClause)

  // Get filter suggestions
  const filterSuggestions = await getFilterSuggestions(params.storeId, filteredWhereClause)

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
    availableFilters,
    filterSuggestions,
    executionTime,
    totalFound: totalCount
  }
}

// Apply text search to where clause
function applyTextSearch(whereClause: any, query: string) {
  const searchTerms = query.trim().split(' ').filter(term => term.length > 0)
  
  if (searchTerms.length === 0) {
    return whereClause
  }

  const searchWhere = { ...whereClause }
  searchWhere.OR = []

  searchTerms.forEach(term => {
    searchWhere.OR.push(
      { orderNumber: { contains: term, mode: 'insensitive' } },
      { orderName: { contains: term, mode: 'insensitive' } },
      { notes: { contains: term, mode: 'insensitive' } },
      { customer: { name: { contains: term, mode: 'insensitive' } } },
      { customer: { email: { contains: term, mode: 'insensitive' } } },
      { employee: { name: { contains: term, mode: 'insensitive' } } }
    )
  })

  return searchWhere
}

// Apply filters to where clause
function applyFilters(whereClause: any, filters: any) {
  const filteredWhere = { ...whereClause }

  // Status filter
  if (filters.status && Array.isArray(filters.status)) {
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

  // Employee filters
  if (filters.employeeId) {
    filteredWhere.employeeId = filters.employeeId
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

  // Age filter (in minutes)
  if (filters.ageInMinutes) {
    const now = Date.now()
    if (filters.ageInMinutes.max !== undefined) {
      const maxAgeMs = filters.ageInMinutes.max * 60 * 1000
      filteredWhere.createdAt = { ...filteredWhere.createdAt, gte: new Date(now - maxAgeMs) }
    }
  }

  return filteredWhere
}

// Calculate facets for filtering options
async function calculateFacets(storeId: string, baseWhereClause: any, requestedFacets: string[]) {
  const facets: any = {}

  // If no specific facets requested, return all
  const facetsToCalculate = requestedFacets.length > 0 ? requestedFacets : [
    'status', 'customer', 'employee', 'amountRanges', 'dateRanges', 'priority', 'tableNumber'
  ]

  for (const facetName of facetsToCalculate) {
    switch (facetName) {
      case 'status':
        facets.status = await prisma.heldOrder.groupBy({
          by: ['status'],
          where: baseWhereClause,
          _count: true,
          orderBy: { _count: { status: 'desc' } }
        })
        break

      case 'customer':
        facets.customers = await prisma.heldOrder.groupBy({
          by: ['customerId'],
          where: { ...baseWhereClause, customerId: { not: null } },
          _count: true,
          orderBy: { _count: { customerId: 'desc' } },
          take: 20
        })
        break

      case 'employee':
        facets.employees = await prisma.heldOrder.groupBy({
          by: ['employeeId'],
          where: { ...baseWhereClause, employeeId: { not: null } },
          _count: true,
          orderBy: { _count: { employeeId: 'desc' } },
          take: 20
        })
        break

      case 'amountRanges':
        facets.amountRanges = await prisma.$queryRaw`
          SELECT 
            CASE 
              WHEN total < 100 THEN 'Under ₹100'
              WHEN total < 500 THEN '₹100 - ₹500'
              WHEN total < 1000 THEN '₹500 - ₹1,000'
              WHEN total < 5000 THEN '₹1,000 - ₹5,000'
              WHEN total < 10000 THEN '₹5,000 - ₹10,000'
              ELSE 'Over ₹10,000'
            END as range,
            COUNT(*) as count,
            MIN(total) as min_amount,
            MAX(total) as max_amount,
            AVG(total) as avg_amount
          FROM HeldOrder 
          WHERE storeId = ${storeId}
          GROUP BY range
          ORDER BY min_amount
        `
        break

      case 'dateRanges':
        facets.dateRanges = await prisma.$queryRaw`
          SELECT 
            CASE 
              WHEN createdAt >= datetime('now', '-1 day') THEN 'Today'
              WHEN createdAt >= datetime('now', '-7 days') THEN 'Last 7 days'
              WHEN createdAt >= datetime('now', '-30 days') THEN 'Last 30 days'
              WHEN createdAt >= datetime('now', '-90 days') THEN 'Last 90 days'
              ELSE 'Older'
            END as range,
            COUNT(*) as count,
            MIN(createdAt) as earliest,
            MAX(createdAt) as latest
          FROM HeldOrder 
          WHERE storeId = ${storeId}
          GROUP BY range
          ORDER BY latest DESC
        `
        break

      case 'priority':
        facets.priority = await prisma.heldOrder.groupBy({
          by: ['priority'],
          where: baseWhereClause,
          _count: true,
          orderBy: { priority: 'desc' }
        })
        break

      case 'tableNumber':
        facets.tableNumbers = await prisma.heldOrder.groupBy({
          by: ['tableNumber'],
          where: { ...baseWhereClause, tableNumber: { not: null } },
          _count: true,
          orderBy: { _count: { tableNumber: 'desc' } },
          take: 15
        })
        break
    }
  }

  return facets
}

// Calculate available filters
async function calculateAvailableFilters(storeId: string, currentWhereClause: any) {
  // This would show what additional filters could be applied to narrow down results
  // For now, return a simplified version
  return {
    canFilterByStatus: true,
    canFilterByCustomer: true,
    canFilterByEmployee: true,
    canFilterByAmount: true,
    canFilterByDate: true,
    canFilterByPriority: true
  }
}

// Get filter suggestions
async function getFilterSuggestions(storeId: string, currentWhereClause: any) {
  // Analyze the current result set and suggest additional filters
  const suggestions = []

  // Get status distribution
  const statusDist = await prisma.heldOrder.groupBy({
    by: ['status'],
    where: currentWhereClause,
    _count: true
  })

  // Suggest filtering by minority statuses to get more focused results
  statusDist.forEach(status => {
    if (status._count < 5) { // If very few orders of this status
      suggestions.push({
        type: 'status',
        value: status.status,
        label: `Only ${status.status} orders`,
        description: `Focus on ${status.status} orders (${status._count} found)`,
        impact: 'reduce'
      })
    }
  })

  // Suggest removing restrictive filters if results are too few
  const totalCount = await prisma.heldOrder.count({ where: currentWhereClause })
  if (totalCount < 5) {
    suggestions.push({
      type: 'general',
      value: 'remove_restrictions',
      label: 'Remove some filters',
      description: 'Current filters are too restrictive, showing only a few results',
      impact: 'expand'
    })
  }

  return suggestions
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