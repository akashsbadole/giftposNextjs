import { NextRequest, NextResponse } from 'next/server'
import { PrismaClient } from '@prisma/client'
import { auth } from '@clerk/nextjs/server'
import { AuditLogger } from '@/lib/security/audit-logger'

const prisma = new PrismaClient()

// GET /api/pos/batch-operations/templates - Get batch operation templates
export async function GET(request: NextRequest) {
  try {
    const { userId } = await auth()
    if (!userId) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const { searchParams } = new URL(request.url)
    const storeId = searchParams.get('storeId')
    const operationType = searchParams.get('operationType')
    const targetEntity = searchParams.get('targetEntity')
    const isActive = searchParams.get('isActive')

    if (!storeId) {
      return NextResponse.json({ error: 'Store ID is required' }, { status: 400 })
    }

    // Build where clause
    const whereClause: any = {
      storeId
    }

    if (operationType) whereClause.operationType = operationType
    if (targetEntity) whereClause.targetEntity = targetEntity
    if (isActive !== null && isActive !== undefined) {
      whereClause.isActive = isActive === 'true'
    }

    const templates = await prisma.batchOperationTemplate.findMany({
      where: whereClause,
      include: {
        _count: {
          select: {
            batchOperations: true,
            schedules: true
          }
        }
      },
      orderBy: [
        { isActive: 'desc' },
        { name: 'asc' }
      ]
    })

    // Get template usage statistics
    const templateStats = await Promise.all(
      templates.map(async (template) => {
        const operations = await prisma.batchOperation.groupBy({
          by: ['status'],
          where: {
            templateId: template.id,
            createdAt: {
              gte: new Date(Date.now() - 30 * 24 * 60 * 60 * 1000) // Last 30 days
            }
          },
          _count: { status: true }
        })

        const statusStats = operations.reduce((acc, op) => {
          acc[op.status] = op._count.status
          return acc
        }, {} as Record<string, number>)

        return {
          ...template,
          recentUsage: statusStats,
          totalOperations: Object.values(statusStats).reduce((sum, count) => sum + count, 0)
        }
      })
    )

    return NextResponse.json({
      templates: templateStats
    })

  } catch (error) {
    console.error('Error fetching batch operation templates:', error)
    return NextResponse.json(
      { error: 'Failed to fetch batch operation templates' },
      { status: 500 }
    )
  }
}

// POST /api/pos/batch-operations/templates - Create a new batch operation template
export async function POST(request: NextRequest) {
  try {
    const { userId } = await auth()
    if (!userId) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const body = await request.json()
    const {
      name,
      description,
      operationType,
      targetEntity,
      validationRules = {},
      defaultParameters = {},
      isActive = true,
      storeId
    } = body

    // Validate required fields
    if (!name || !operationType || !targetEntity || !storeId) {
      return NextResponse.json(
        { error: 'Name, operationType, targetEntity, and storeId are required' },
        { status: 400 }
      )
    }

    // Validate operation type
    const validOperationTypes = ['import', 'export', 'bulk_update', 'mass_processing']
    if (!validOperationTypes.includes(operationType)) {
      return NextResponse.json(
        { error: `Invalid operation type. Must be one of: ${validOperationTypes.join(', ')}` },
        { status: 400 }
      )
    }

    // Validate target entity
    const validTargetEntities = ['products', 'customers', 'inventory', 'orders', 'categories', 'sales', 'employees']
    if (!validTargetEntities.includes(targetEntity)) {
      return NextResponse.json(
        { error: `Invalid target entity. Must be one of: ${validTargetEntities.join(', ')}` },
        { status: 400 }
      )
    }

    // Create template
    const template = await prisma.batchOperationTemplate.create({
      data: {
        name,
        description,
        operationType,
        targetEntity,
        validationRules: JSON.stringify(validationRules),
        defaultParameters: JSON.stringify(defaultParameters),
        isActive,
        storeId
      },
      include: {
        _count: {
          select: {
            batchOperations: true,
            schedules: true
          }
        }
      }
    })

    // Log template creation
    await AuditLogger.log({
      timestamp: new Date(),
      userId,
      action: 'batch_operation_template_created',
      resource: 'batch_operation_template',
      resourceId: template.id,
      method: 'POST',
      path: request.url,
      status: 'success',
      severity: 'medium',
      details: {
        templateId: template.id,
        name: template.name,
        operationType: template.operationType,
        targetEntity: template.targetEntity,
        storeId: template.storeId
      }
    })

    return NextResponse.json({
      success: true,
      template,
      message: 'Batch operation template created successfully'
    }, { status: 201 })

  } catch (error) {
    console.error('Error creating batch operation template:', error)
    return NextResponse.json(
      { error: 'Failed to create batch operation template' },
      { status: 500 }
    )
  }
}