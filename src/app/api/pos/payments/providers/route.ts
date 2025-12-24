import { NextRequest, NextResponse } from 'next/server'
import { PrismaClient } from '@prisma/client'

const prisma = new PrismaClient()

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url)
    const storeId = searchParams.get('storeId')
    const activeOnly = searchParams.get('activeOnly') === 'true'

    // Build where clause
    const where: any = {}
    if (storeId) where.storeId = storeId
    if (activeOnly) where.isActive = true

    const providers = await prisma.paymentProvider.findMany({
      where,
      include: {
        _count: {
          select: {
            terminals: true,
            transactions: true,
          },
        },
      },
      orderBy: { createdAt: 'desc' },
    })

    return NextResponse.json({
      success: true,
      data: providers,
      total: providers.length,
    })
  } catch (error) {
    console.error('Payment providers list error:', error)
    return NextResponse.json(
      { 
        success: false, 
        error: 'Failed to fetch payment providers',
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
      displayName,
      type,
      isActive = true,
      config,
      capabilities,
      storeId,
    } = body

    // Validation
    if (!name || !displayName || !type || !storeId) {
      return NextResponse.json(
        { 
          success: false, 
          error: 'Missing required fields: name, displayName, type, storeId' 
        },
        { status: 400 }
      )
    }

    // Validate provider type
    const validTypes = ['terminal', 'api', 'hybrid']
    if (!validTypes.includes(type)) {
      return NextResponse.json(
        { 
          success: false, 
          error: `Invalid provider type. Must be one of: ${validTypes.join(', ')}` 
        },
        { status: 400 }
      )
    }

    // Check if store exists
    const store = await prisma.store.findUnique({
      where: { id: storeId },
    })

    if (!store) {
      return NextResponse.json(
        { 
          success: false, 
          error: 'Store not found' 
        },
        { status: 404 }
      )
    }

    // Check if provider name already exists for this store
    const existingProvider = await prisma.paymentProvider.findFirst({
      where: {
        name: name.toLowerCase(),
        storeId,
      },
    })

    if (existingProvider) {
      return NextResponse.json(
        { 
          success: false, 
          error: 'Payment provider with this name already exists for this store' 
        },
        { status: 400 }
      )
    }

    // Create provider
    const provider = await prisma.paymentProvider.create({
      data: {
        name: name.toLowerCase(),
        displayName,
        type,
        isActive,
        config: config ? JSON.stringify(config) : null,
        capabilities: capabilities ? JSON.stringify(capabilities) : null,
        storeId,
      },
    })

    return NextResponse.json({
      success: true,
      data: provider,
      message: 'Payment provider created successfully',
    })
  } catch (error) {
    console.error('Payment provider creation error:', error)
    return NextResponse.json(
      { 
        success: false, 
        error: 'Failed to create payment provider',
        details: error instanceof Error ? error.message : 'Unknown error'
      },
      { status: 500 }
    )
  }
}

export async function PATCH(request: NextRequest) {
  try {
    const body = await request.json()
    const { id, name, displayName, type, isActive, config, capabilities } = body

    // Validation
    if (!id) {
      return NextResponse.json(
        { 
          success: false, 
          error: 'Provider ID is required' 
        },
        { status: 400 }
      )
    }

    // Check if provider exists
    const existingProvider = await prisma.paymentProvider.findUnique({
      where: { id },
    })

    if (!existingProvider) {
      return NextResponse.json(
        { 
          success: false, 
          error: 'Payment provider not found' 
        },
        { status: 404 }
      )
    }

    // Validate type if provided
    if (type) {
      const validTypes = ['terminal', 'api', 'hybrid']
      if (!validTypes.includes(type)) {
        return NextResponse.json(
          { 
            success: false, 
            error: `Invalid provider type. Must be one of: ${validTypes.join(', ')}` 
          },
          { status: 400 }
        )
      }
    }

    // Check name uniqueness if changing name
    if (name && name !== existingProvider.name) {
      const nameExists = await prisma.paymentProvider.findFirst({
        where: {
          name: name.toLowerCase(),
          storeId: existingProvider.storeId,
          id: { not: id },
        },
      })

      if (nameExists) {
        return NextResponse.json(
          { 
            success: false, 
            error: 'Payment provider with this name already exists for this store' 
          },
          { status: 400 }
        )
      }
    }

    // Update provider
    const updateData: any = {}
    if (name !== undefined) updateData.name = name.toLowerCase()
    if (displayName !== undefined) updateData.displayName = displayName
    if (type !== undefined) updateData.type = type
    if (isActive !== undefined) updateData.isActive = isActive
    if (config !== undefined) updateData.config = config ? JSON.stringify(config) : null
    if (capabilities !== undefined) updateData.capabilities = capabilities ? JSON.stringify(capabilities) : null
    updateData.updatedAt = new Date()

    const provider = await prisma.paymentProvider.update({
      where: { id },
      data: updateData,
    })

    return NextResponse.json({
      success: true,
      data: provider,
      message: 'Payment provider updated successfully',
    })
  } catch (error) {
    console.error('Payment provider update error:', error)
    return NextResponse.json(
      { 
        success: false, 
        error: 'Failed to update payment provider',
        details: error instanceof Error ? error.message : 'Unknown error'
      },
      { status: 500 }
    )
  }
}

export async function DELETE(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url)
    const id = searchParams.get('id')

    if (!id) {
      return NextResponse.json(
        { 
          success: false, 
          error: 'Provider ID is required' 
        },
        { status: 400 }
      )
    }

    // Check if provider exists
    const provider = await prisma.paymentProvider.findUnique({
      where: { id },
      include: {
        _count: {
          select: {
            terminals: true,
            transactions: true,
          },
        },
      },
    })

    if (!provider) {
      return NextResponse.json(
        { 
          success: false, 
          error: 'Payment provider not found' 
        },
        { status: 404 }
      )
    }

    // Check for dependencies
    if (provider._count.terminals > 0) {
      return NextResponse.json(
        { 
          success: false, 
          error: `Cannot delete provider with ${provider._count.terminals} associated terminals` 
        },
        { status: 400 }
      )
    }

    if (provider._count.transactions > 0) {
      return NextResponse.json(
        { 
          success: false, 
          error: `Cannot delete provider with ${provider._count.transactions} associated transactions` 
        },
        { status: 400 }
      )
    }

    await prisma.paymentProvider.delete({
      where: { id },
    })

    return NextResponse.json({
      success: true,
      message: 'Payment provider deleted successfully',
    })
  } catch (error) {
    console.error('Payment provider deletion error:', error)
    return NextResponse.json(
      { 
        success: false, 
        error: 'Failed to delete payment provider',
        details: error instanceof Error ? error.message : 'Unknown error'
      },
      { status: 500 }
    )
  }
}