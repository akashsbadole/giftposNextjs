import { NextRequest, NextResponse } from 'next/server'
import { paymentService } from '@/lib/payment-service'
import { PrismaClient } from '@prisma/client'

const prisma = new PrismaClient()

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url)
    const providerId = searchParams.get('providerId')
    const status = searchParams.get('status')

    // Build where clause
    const where: any = {}
    if (providerId) where.providerId = providerId
    if (status) where.status = status

    const terminals = await prisma.terminalIntegration.findMany({
      where,
      include: {
        provider: {
          select: {
            id: true,
            name: true,
            displayName: true,
            type: true,
          },
        },
      },
      orderBy: { createdAt: 'desc' },
    })

    // Get real-time status for each terminal
    const terminalsWithStatus = await Promise.all(
      terminals.map(async (terminal) => {
        try {
          const terminalStatus = await paymentService.getTerminalStatus(
            terminal.providerId,
            terminal.terminalId
          )
          const statusData = terminalStatus.find(t => t.terminalId === terminal.terminalId)
          
          return {
            ...terminal,
            statusInfo: statusData ? {
              online: statusData.status === 'online',
              status: statusData.status,
              lastHeartbeat: statusData.lastHeartbeat,
              capabilities: statusData.capabilities,
            } : null,
          }
        } catch (error) {
          console.error(`Error getting status for terminal ${terminal.id}:`, error)
          return terminal
        }
      })
    )

    return NextResponse.json({
      success: true,
      data: terminalsWithStatus,
      total: terminalsWithStatus.length,
    })
  } catch (error) {
    console.error('Terminal list error:', error)
    return NextResponse.json(
      { 
        success: false, 
        error: 'Failed to fetch terminals',
        details: error instanceof Error ? error.message : 'Unknown error'
      },
      { status: 500 }
    )
  }
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json()
    const {
      name,
      serialNumber,
      terminalId,
      model,
      providerId,
      capabilities,
      settings,
    } = body

    // Validation
    if (!name || !terminalId || !providerId) {
      return NextResponse.json(
        { 
          success: false, 
          error: 'Missing required fields: name, terminalId, providerId' 
        },
        { status: 400 }
      )
    }

    // Check if provider exists and is active
    const provider = await prisma.paymentProvider.findUnique({
      where: { id: providerId },
    })

    if (!provider || !provider.isActive) {
      return NextResponse.json(
        { 
          success: false, 
          error: 'Payment provider not found or inactive' 
        },
        { status: 404 }
      )
    }

    // Check if terminal ID already exists
    const existingTerminal = await prisma.terminalIntegration.findFirst({
      where: {
        terminalId,
        providerId,
      },
    })

    if (existingTerminal) {
      return NextResponse.json(
        { 
          success: false, 
          error: 'Terminal with this ID already exists for this provider' 
        },
        { status: 400 }
      )
    }

    // Create terminal
    const terminal = await prisma.terminalIntegration.create({
      data: {
        name,
        serialNumber,
        terminalId,
        model,
        status: 'offline',
        capabilities: capabilities ? JSON.stringify(capabilities) : null,
        settings: settings ? JSON.stringify(settings) : null,
        providerId,
      },
      include: {
        provider: {
          select: {
            name: true,
            displayName: true,
            type: true,
          },
        },
      },
    })

    // Test terminal connection if possible
    try {
      const terminalStatus = await paymentService.getTerminalStatus(providerId, terminalId)
      if (terminalStatus.length > 0) {
        await prisma.terminalIntegration.update({
          where: { id: terminal.id },
          data: {
            status: terminalStatus[0].status,
            lastHeartbeat: terminalStatus[0].lastHeartbeat,
          },
        })
      }
    } catch (error) {
      console.error('Terminal status check failed:', error)
      // Don't fail the creation if status check fails
    }

    return NextResponse.json({
      success: true,
      data: terminal,
      message: 'Terminal added successfully',
    })
  } catch (error) {
    console.error('Terminal creation error:', error)
    return NextResponse.json(
      { 
        success: false, 
        error: 'Failed to create terminal',
        details: error instanceof Error ? error.message : 'Unknown error'
      },
      { status: 500 }
    )
  }
}

export async function PATCH(request: NextRequest) {
  try {
    const body = await request.json()
    const { action, terminalId, providerId, settings, name } = body

    // Validation
    if (!action || !terminalId || !providerId) {
      return NextResponse.json(
        { 
          success: false, 
          error: 'Missing required fields: action, terminalId, providerId' 
        },
        { status: 400 }
      )
    }

    const validActions = ['update_settings', 'test_connection', 'update_status', 'rename']

    if (!validActions.includes(action)) {
      return NextResponse.json(
        { 
          success: false, 
          error: `Invalid action. Must be one of: ${validActions.join(', ')}` 
        },
        { status: 400 }
      )
    }

    // Find terminal
    const terminal = await prisma.terminalIntegration.findFirst({
      where: {
        terminalId,
        providerId,
      },
    })

    if (!terminal) {
      return NextResponse.json(
        { 
          success: false, 
          error: 'Terminal not found' 
        },
        { status: 404 }
      )
    }

    let result

    switch (action) {
      case 'update_settings':
        if (!settings) {
          return NextResponse.json(
            { success: false, error: 'Settings data required for update_settings action' },
            { status: 400 }
          )
        }

        result = await prisma.terminalIntegration.update({
          where: { id: terminal.id },
          data: {
            settings: JSON.stringify(settings),
            updatedAt: new Date(),
          },
        })
        break

      case 'rename':
        if (!name) {
          return NextResponse.json(
            { success: false, error: 'Name required for rename action' },
            { status: 400 }
          )
        }

        result = await prisma.terminalIntegration.update({
          where: { id: terminal.id },
          data: {
            name,
            updatedAt: new Date(),
          },
        })
        break

      case 'test_connection':
        // Test terminal connection
        try {
          const terminalStatus = await paymentService.getTerminalStatus(providerId, terminalId)
          
          if (terminalStatus.length > 0) {
            const status = terminalStatus[0]
            result = await prisma.terminalIntegration.update({
              where: { id: terminal.id },
              data: {
                status: status.status,
                lastHeartbeat: status.lastHeartbeat,
                updatedAt: new Date(),
              },
            })
          } else {
            return NextResponse.json({
              success: false,
              error: 'Unable to get terminal status',
            }, { status: 400 })
          }
        } catch (error) {
          return NextResponse.json({
            success: false,
            error: `Connection test failed: ${error instanceof Error ? error.message : 'Unknown error'}`,
          }, { status: 400 })
        }
        break

      case 'update_status':
        // Manual status update (admin override)
        const { status } = body
        if (!status || !['online', 'offline', 'error', 'busy'].includes(status)) {
          return NextResponse.json(
            { success: false, error: 'Valid status required (online, offline, error, busy)' },
            { status: 400 }
          )
        }

        result = await prisma.terminalIntegration.update({
          where: { id: terminal.id },
          data: {
            status,
            lastHeartbeat: new Date(),
            updatedAt: new Date(),
          },
        })
        break

      default:
        return NextResponse.json(
          { success: false, error: 'Invalid action' },
          { status: 400 }
        )
    }

    return NextResponse.json({
      success: true,
      data: result,
      message: `Terminal ${action.replace('_', ' ')} completed successfully`,
    })
  } catch (error) {
    console.error('Terminal action error:', error)
    return NextResponse.json(
      { 
        success: false, 
        error: 'Terminal action failed',
        details: error instanceof Error ? error.message : 'Unknown error'
      },
      { status: 500 }
    )
  }
}

export async function DELETE(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url)
    const terminalId = searchParams.get('terminalId')
    const providerId = searchParams.get('providerId')

    if (!terminalId || !providerId) {
      return NextResponse.json(
        { 
          success: false, 
          error: 'Missing required parameters: terminalId, providerId' 
        },
        { status: 400 }
      )
    }

    // Find and delete terminal
    const terminal = await prisma.terminalIntegration.findFirst({
      where: {
        terminalId,
        providerId,
      },
    })

    if (!terminal) {
      return NextResponse.json(
        { 
          success: false, 
          error: 'Terminal not found' 
        },
        { status: 404 }
      )
    }

    // Check for active transactions
    const activeTransactions = await prisma.paymentTransaction.count({
      where: {
        terminalId: terminal.id,
        status: { in: ['pending', 'processing'] },
      },
    })

    if (activeTransactions > 0) {
      return NextResponse.json(
        { 
          success: false, 
          error: `Cannot delete terminal with ${activeTransactions} active transactions` 
        },
        { status: 400 }
      )
    }

    await prisma.terminalIntegration.delete({
      where: { id: terminal.id },
    })

    return NextResponse.json({
      success: true,
      message: 'Terminal deleted successfully',
    })
  } catch (error) {
    console.error('Terminal deletion error:', error)
    return NextResponse.json(
      { 
        success: false, 
        error: 'Failed to delete terminal',
        details: error instanceof Error ? error.message : 'Unknown error'
      },
      { status: 500 }
    )
  }
}