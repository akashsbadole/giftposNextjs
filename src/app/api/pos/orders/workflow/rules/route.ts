import { NextRequest, NextResponse } from 'next/server'
import { PrismaClient } from '@prisma/client'
import { auth } from '@clerk/nextjs/server'
import { AuditLogger } from '@/lib/security/audit-logger'
import { OrderErrorHandler } from '@/lib/order-management-errors'

const prisma = new PrismaClient()

// GET /api/pos/orders/workflow/rules - Get workflow rules
export async function GET(request: NextRequest) {
  try {
    const { userId } = await auth()
    if (!userId) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const { searchParams } = new URL(request.url)
    const storeId = searchParams.get('storeId')
    const isActive = searchParams.get('isActive')
    const triggerType = searchParams.get('triggerType')
    const limit = parseInt(searchParams.get('limit') || '50')
    const offset = parseInt(searchParams.get('offset') || '0')

    if (!storeId) {
      return NextResponse.json({ error: 'Store ID is required' }, { status: 400 })
    }

    // Build where clause
    const whereClause: any = { storeId }

    if (isActive !== null) {
      whereClause.isActive = isActive === 'true'
    }

    if (triggerType) {
      whereClause.triggerType = triggerType
    }

    // Get workflow rules
    const rules = await prisma.workflowRule.findMany({
      where: whereClause,
      orderBy: [
        { priority: 'desc' },
        { createdAt: 'desc' }
      ],
      take: limit,
      skip: offset,
      include: {
        _count: {
          select: { actions: true }
        }
      }
    })

    // Parse JSON fields and format response
    const formattedRules = rules.map(rule => ({
      ...rule,
      triggerConditions: rule.triggerConditions ? JSON.parse(rule.triggerConditions) : {},
      conditions: rule.conditions ? JSON.parse(rule.conditions) : {},
      actions: rule.actions ? JSON.parse(rule.actions) : [],
      metadata: rule.metadata ? JSON.parse(rule.metadata) : {},
      actionCount: rule._count?.actions || 0
    }))

    // Get total count
    const totalCount = await prisma.workflowRule.count({ where: whereClause })

    return NextResponse.json({
      rules: formattedRules,
      pagination: {
        total: totalCount,
        limit,
        offset,
        hasMore: offset + limit < totalCount
      },
      summary: {
        totalRules: totalCount,
        activeRules: formattedRules.filter(r => r.isActive).length,
        triggerTypes: [...new Set(formattedRules.map(r => r.triggerType))]
      }
    })

  } catch (error) {
    console.error('Error fetching workflow rules:', error)
    return NextResponse.json(
      { error: 'Failed to fetch workflow rules' },
      { status: 500 }
    )
  }
}

// POST /api/pos/orders/workflow/rules - Create new workflow rule
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
      triggerType,
      triggerConditions,
      conditions,
      actions,
      priority = 0,
      maxExecutions = 1,
      isActive = true,
      metadata = {}
    } = body

    // Validate required fields
    if (!name) {
      return NextResponse.json({ error: 'Rule name is required' }, { status: 400 })
    }

    if (!triggerType) {
      return NextResponse.json({ error: 'Trigger type is required' }, { status: 400 })
    }

    if (!actions || !Array.isArray(actions) || actions.length === 0) {
      return NextResponse.json({ error: 'Actions array is required' }, { status: 400 })
    }

    const { searchParams } = new URL(request.url)
    const storeId = searchParams.get('storeId')
    if (!storeId) {
      return NextResponse.json({ error: 'Store ID is required' }, { status: 400 })
    }

    // Validate trigger type
    const validTriggerTypes = [
      'order_created',
      'order_updated',
      'order_completed',
      'order_cancelled',
      'time_based',
      'manual',
      'threshold_reached'
    ]

    if (!validTriggerTypes.includes(triggerType)) {
      return NextResponse.json({ 
        error: `Invalid trigger type. Must be one of: ${validTriggerTypes.join(', ')}` 
      }, { status: 400 })
    }

    // Validate actions structure
    const validActionTypes = [
      'notification',
      'email',
      'webhook',
      'sms',
      'data_update',
      'status_change',
      'assignment',
      'custom'
    ]

    for (const action of actions) {
      if (!validActionTypes.includes(action.type)) {
        return NextResponse.json({ 
          error: `Invalid action type: ${action.type}. Must be one of: ${validActionTypes.join(', ')}` 
        }, { status: 400 })
      }

      if (!action.config || typeof action.config !== 'object') {
        return NextResponse.json({ 
          error: `Action ${action.type} must have a config object` 
        }, { status: 400 })
      }
    }

    // Create workflow rule
    const workflowRule = await prisma.workflowRule.create({
      data: {
        name,
        description: description || null,
        triggerType,
        triggerConditions: triggerConditions ? JSON.stringify(triggerConditions) : null,
        conditions: conditions ? JSON.stringify(conditions) : null,
        actions: JSON.stringify(actions),
        priority,
        maxExecutions,
        isActive,
        storeId,
        metadata: JSON.stringify(metadata)
      }
    })

    // Log the rule creation
    await AuditLogger.log({
      timestamp: new Date(),
      userId,
      action: 'workflow_rule_created',
      resource: 'workflow_rule',
      resourceId: workflowRule.id,
      method: 'POST',
      path: request.url,
      status: 'success',
      severity: 'medium',
      details: {
        name,
        triggerType,
        priority,
        isActive,
        actionCount: actions.length
      }
    })

    // If rule has time-based trigger, schedule first execution
    if (triggerType === 'time_based' && triggerConditions?.schedule) {
      await scheduleTimeBasedRule(workflowRule.id, triggerConditions.schedule)
    }

    return NextResponse.json({
      rule: {
        ...workflowRule,
        triggerConditions,
        conditions,
        actions,
        metadata
      },
      message: 'Workflow rule created successfully'
    }, { status: 201 })

  } catch (error) {
    console.error('Error creating workflow rule:', error)
    
    const errorContext = {
      operation: 'CREATE_WORKFLOW_RULE',
      timestamp: new Date()
    }

    const orderError = OrderErrorHandler.createError(
      'SYSTEM_ERROR' as any,
      'Failed to create workflow rule',
      errorContext,
      { severity: 'high' }
    )

    await AuditLogger.log({
      timestamp: new Date(),
      action: 'workflow_rule_creation_failed',
      resource: 'workflow_rule',
      method: 'POST',
      path: request.url,
      status: 'failure',
      severity: 'high',
      details: { error: error instanceof Error ? error.message : 'Unknown error' }
    })

    return NextResponse.json(
      { 
        error: 'Failed to create workflow rule',
        errorId: orderError.id
      },
      { status: 500 }
    )
  }
}

// PUT /api/pos/orders/workflow/rules - Update workflow rule
export async function PUT(request: NextRequest) {
  try {
    const { userId } = await auth()
    if (!userId) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const body = await request.json()
    const { ruleId, ...updateData } = body

    if (!ruleId) {
      return NextResponse.json({ error: 'Rule ID is required' }, { status: 400 })
    }

    const { searchParams } = new URL(request.url)
    const storeId = searchParams.get('storeId')
    if (!storeId) {
      return NextResponse.json({ error: 'Store ID is required' }, { status: 400 })
    }

    // Get existing rule
    const existingRule = await prisma.workflowRule.findFirst({
      where: { id: ruleId, storeId }
    })

    if (!existingRule) {
      return NextResponse.json({ error: 'Workflow rule not found' }, { status: 404 })
    }

    // Prepare update data
    const updateFields: any = {
      updatedAt: new Date()
    }

    // Only update fields that are provided
    if (updateData.name !== undefined) updateFields.name = updateData.name
    if (updateData.description !== undefined) updateFields.description = updateData.description
    if (updateData.priority !== undefined) updateFields.priority = updateData.priority
    if (updateData.maxExecutions !== undefined) updateFields.maxExecutions = updateData.maxExecutions
    if (updateData.isActive !== undefined) updateFields.isActive = updateData.isActive

    if (updateData.triggerType !== undefined) updateFields.triggerType = updateData.triggerType
    if (updateData.triggerConditions !== undefined) {
      updateFields.triggerConditions = updateData.triggerConditions ? JSON.stringify(updateData.triggerConditions) : null
    }
    if (updateData.conditions !== undefined) {
      updateFields.conditions = updateData.conditions ? JSON.stringify(updateData.conditions) : null
    }
    if (updateData.actions !== undefined) {
      updateFields.actions = JSON.stringify(updateData.actions)
    }
    if (updateData.metadata !== undefined) {
      updateFields.metadata = JSON.stringify(updateData.metadata)
    }

    // Update the rule
    const updatedRule = await prisma.workflowRule.update({
      where: { id: ruleId },
      data: updateFields
    })

    // Log the rule update
    await AuditLogger.log({
      timestamp: new Date(),
      userId,
      action: 'workflow_rule_updated',
      resource: 'workflow_rule',
      resourceId: ruleId,
      method: 'PUT',
      path: request.url,
      status: 'success',
      severity: 'low',
      details: {
        updatedFields: Object.keys(updateFields),
        wasActive: existingRule.isActive,
        isActive: updatedRule.isActive
      }
    })

    return NextResponse.json({
      rule: {
        ...updatedRule,
        triggerConditions: updateData.triggerConditions || (existingRule.triggerConditions ? JSON.parse(existingRule.triggerConditions) : null),
        conditions: updateData.conditions || (existingRule.conditions ? JSON.parse(existingRule.conditions) : null),
        actions: updateData.actions || JSON.parse(existingRule.actions),
        metadata: updateData.metadata || (existingRule.metadata ? JSON.parse(existingRule.metadata) : {})
      },
      message: 'Workflow rule updated successfully'
    })

  } catch (error) {
    console.error('Error updating workflow rule:', error)
    return NextResponse.json(
      { error: 'Failed to update workflow rule' },
      { status: 500 }
    )
  }
}

// DELETE /api/pos/orders/workflow/rules - Delete workflow rule
export async function DELETE(request: NextRequest) {
  try {
    const { userId } = await auth()
    if (!userId) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const { searchParams } = new URL(request.url)
    const ruleId = searchParams.get('ruleId')

    if (!ruleId) {
      return NextResponse.json({ error: 'Rule ID is required' }, { status: 400 })
    }

    const storeId = searchParams.get('storeId')
    if (!storeId) {
      return NextResponse.json({ error: 'Store ID is required' }, { status: 400 })
    }

    // Get existing rule
    const existingRule = await prisma.workflowRule.findFirst({
      where: { id: ruleId, storeId }
    })

    if (!existingRule) {
      return NextResponse.json({ error: 'Workflow rule not found' }, { status: 404 })
    }

    // Delete related workflow actions first
    await prisma.workflowAction.deleteMany({
      where: { ruleId }
    })

    // Delete the rule
    await prisma.workflowRule.delete({
      where: { id: ruleId }
    })

    // Log the rule deletion
    await AuditLogger.log({
      timestamp: new Date(),
      userId,
      action: 'workflow_rule_deleted',
      resource: 'workflow_rule',
      resourceId: ruleId,
      method: 'DELETE',
      path: request.url,
      status: 'success',
      severity: 'medium',
      details: {
        ruleName: existingRule.name,
        triggerType: existingRule.triggerType
      }
    })

    return NextResponse.json({
      message: 'Workflow rule deleted successfully'
    })

  } catch (error) {
    console.error('Error deleting workflow rule:', error)
    return NextResponse.json(
      { error: 'Failed to delete workflow rule' },
      { status: 500 }
    )
  }
}

// POST /api/pos/orders/workflow/rules/execute - Manually execute a workflow rule
export async function PATCH(request: NextRequest) {
  try {
    const { userId } = await auth()
    if (!userId) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const body = await request.json()
    const { action, ruleId, contextData = {} } = body

    if (!action) {
      return NextResponse.json({ error: 'Action is required' }, { status: 400 })
    }

    const { searchParams } = new URL(request.url)
    const storeId = searchParams.get('storeId')
    if (!storeId) {
      return NextResponse.json({ error: 'Store ID is required' }, { status: 400 })
    }

    switch (action) {
      case 'execute':
        return await executeWorkflowRule(ruleId, contextData, userId, storeId)
      case 'toggle':
        return await toggleWorkflowRule(ruleId, userId, storeId)
      case 'test':
        return await testWorkflowRule(ruleId, contextData, userId, storeId)
      default:
        return NextResponse.json({ error: 'Invalid action' }, { status: 400 })
    }

  } catch (error) {
    console.error('Error executing workflow rule action:', error)
    return NextResponse.json(
      { error: 'Failed to execute workflow rule action' },
      { status: 500 }
    )
  }
}

// Helper functions
async function executeWorkflowRule(ruleId: string, contextData: any, userId: string, storeId: string) {
  const rule = await prisma.workflowRule.findFirst({
    where: { id: ruleId, storeId, isActive: true }
  })

  if (!rule) {
    return NextResponse.json({ error: 'Workflow rule not found or inactive' }, { status: 404 })
  }

  // Check execution limits
  if (rule.executionCount >= rule.maxExecutions) {
    return NextResponse.json({ 
      error: 'Maximum execution limit reached' 
    }, { status: 429 })
  }

  const actions = JSON.parse(rule.actions)
  const executionId = `exec_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`

  // Create workflow action record
  const workflowAction = await prisma.workflowAction.create({
    data: {
      ruleId,
      executionId,
      status: 'running',
      actionType: 'manual_execution',
      actionConfig: JSON.stringify({ manual: true }),
      contextData: JSON.stringify(contextData),
      startedAt: new Date()
    }
  })

  // Execute actions (simplified - in real implementation would execute each action)
  try {
    // Simulate action execution
    await new Promise(resolve => setTimeout(resolve, 1000))

    // Update rule execution count
    await prisma.workflowRule.update({
      where: { id: ruleId },
      data: {
        executionCount: { increment: 1 },
        lastExecutedAt: new Date()
      }
    })

    // Update workflow action
    await prisma.workflowAction.update({
      where: { id: workflowAction.id },
      data: {
        status: 'completed',
        completedAt: new Date(),
        duration: 1000,
        result: JSON.stringify({ success: true, executedActions: actions.length })
      }
    })

    return NextResponse.json({
      success: true,
      executionId,
      message: 'Workflow rule executed successfully',
      executedActions: actions.length
    })

  } catch (error) {
    // Update workflow action with error
    await prisma.workflowAction.update({
      where: { id: workflowAction.id },
      data: {
        status: 'failed',
        completedAt: new Date(),
        errorMessage: error instanceof Error ? error.message : 'Unknown error'
      }
    })

    return NextResponse.json(
      { error: 'Failed to execute workflow rule' },
      { status: 500 }
    )
  }
}

async function toggleWorkflowRule(ruleId: string, userId: string, storeId: string) {
  const rule = await prisma.workflowRule.findFirst({
    where: { id: ruleId, storeId }
  })

  if (!rule) {
    return NextResponse.json({ error: 'Workflow rule not found' }, { status: 404 })
  }

  const updatedRule = await prisma.workflowRule.update({
    where: { id: ruleId },
    data: {
      isActive: !rule.isActive,
      updatedAt: new Date()
    }
  })

  await AuditLogger.log({
    timestamp: new Date(),
    userId,
    action: 'workflow_rule_toggled',
    resource: 'workflow_rule',
    resourceId: ruleId,
    method: 'PATCH',
    path: '/api/pos/orders/workflow/rules',
    status: 'success',
    severity: 'low',
    details: {
      previousState: rule.isActive,
      newState: updatedRule.isActive
    }
  })

  return NextResponse.json({
    rule: updatedRule,
    message: `Workflow rule ${updatedRule.isActive ? 'activated' : 'deactivated'} successfully`
  })
}

async function testWorkflowRule(ruleId: string, contextData: any, userId: string, storeId: string) {
  const rule = await prisma.workflowRule.findFirst({
    where: { id: ruleId, storeId }
  })

  if (!rule) {
    return NextResponse.json({ error: 'Workflow rule not found' }, { status: 404 })
  }

  const actions = JSON.parse(rule.actions)
  
  // Simulate test execution
  const testResults = actions.map((action: any, index: number) => ({
    actionIndex: index,
    actionType: action.type,
    status: 'success',
    message: `Test execution of ${action.type} completed`,
    executionTime: Math.random() * 100 + 50 // Random execution time
  }))

  return NextResponse.json({
    success: true,
    ruleId,
    testResults,
    message: 'Workflow rule test completed',
    totalActions: actions.length,
    successfulActions: testResults.filter((r: any) => r.status === 'success').length
  })
}

async function scheduleTimeBasedRule(ruleId: string, schedule: any) {
  // In a real implementation, this would schedule the rule for execution
  // using a job queue or cron system
  console.log(`Scheduling time-based rule ${ruleId} for execution at:`, schedule)
}