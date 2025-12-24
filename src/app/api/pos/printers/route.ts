// Printer Management API Routes
import { NextRequest, NextResponse } from 'next/server';
import { PrismaClient } from '@prisma/client';
import { printersService } from '@/lib/printers-service';

const prisma = new PrismaClient();

// GET /api/pos/printers - Get all printers
export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const storeId = searchParams.get('storeId');

    if (!storeId) {
      return NextResponse.json(
        { error: 'Store ID is required' }, 
        { status: 400 }
      );
    }

    const printers = await printersService.getPrinters(storeId);
    
    return NextResponse.json({
      success: true,
      data: printers
    });

  } catch (error) {
    console.error('Error fetching printers:', error);
    return NextResponse.json(
      { 
        success: false,
        error: error instanceof Error ? error.message : 'Failed to fetch printers' 
      },
      { status: 500 }
    );
  }
}

// POST /api/pos/printers - Add new printer
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const {
      name,
      type,
      brand,
      model,
      connection,
      isDefault,
      storeId,
      settings
    } = body;

    // Validation
    if (!name || !type || !brand || !model || !connection || !storeId) {
      return NextResponse.json(
        { error: 'Missing required fields' },
        { status: 400 }
      );
    }

    // If setting as default, unset other defaults of same type
    if (isDefault) {
      await prisma.printer.updateMany({
        where: {
          storeId,
          type,
          isDefault: true
        },
        data: { isDefault: false }
      });
    }

    // Create printer record
    const printer = await prisma.printer.create({
      data: {
        name,
        type,
        brand,
        model,
        connection,
        isDefault: isDefault || false,
        status: 'offline',
        settings: settings ? JSON.stringify(settings) : null,
        storeId
      }
    });

    // Try to load and connect the adapter
    try {
      await printersService.loadAdapter(printer);
    } catch (error) {
      console.warn(`Failed to connect adapter for ${printer.name}:`, error);
    }

    return NextResponse.json({
      success: true,
      data: printer,
      message: 'Printer added successfully'
    }, { status: 201 });

  } catch (error) {
    console.error('Error adding printer:', error);
    return NextResponse.json(
      { 
        success: false,
        error: error instanceof Error ? error.message : 'Failed to add printer' 
      },
      { status: 500 }
    );
  }
}

// PUT /api/pos/printers - Update printer
export async function PUT(request: NextRequest) {
  try {
    const body = await request.json();
    const {
      id,
      name,
      type,
      brand,
      model,
      connection,
      isDefault,
      storeId,
      settings
    } = body;

    // Validation
    if (!id || !name || !type || !brand || !model || !connection || !storeId) {
      return NextResponse.json(
        { error: 'Missing required fields' },
        { status: 400 }
      );
    }

    // Check if printer exists
    const existingPrinter = await prisma.printer.findUnique({
      where: { id }
    });

    if (!existingPrinter) {
      return NextResponse.json(
        { error: 'Printer not found' },
        { status: 404 }
      );
    }

    // If setting as default, unset other defaults of same type
    if (isDefault && !existingPrinter.isDefault) {
      await prisma.printer.updateMany({
        where: {
          storeId,
          type,
          isDefault: true
        },
        data: { isDefault: false }
      });
    }

    // Update printer record
    const printer = await prisma.printer.update({
      where: { id },
      data: {
        name,
        type,
        brand,
        model,
        connection,
        isDefault: isDefault || false,
        settings: settings ? JSON.stringify(settings) : undefined,
        updatedAt: new Date()
      }
    });

    // Reload adapter with new configuration
    try {
      await printersService.unloadAdapter(id);
      await printersService.loadAdapter(printer);
    } catch (error) {
      console.warn(`Failed to reload adapter for ${printer.name}:`, error);
    }

    return NextResponse.json({
      success: true,
      data: printer,
      message: 'Printer updated successfully'
    });

  } catch (error) {
    console.error('Error updating printer:', error);
    return NextResponse.json(
      { 
        success: false,
        error: error instanceof Error ? error.message : 'Failed to update printer' 
      },
      { status: 500 }
    );
  }
}

// DELETE /api/pos/printers - Delete printer
export async function DELETE(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const id = searchParams.get('id');

    if (!id) {
      return NextResponse.json(
        { error: 'Printer ID is required' },
        { status: 400 }
      );
    }

    // Check if printer exists
    const existingPrinter = await prisma.printer.findUnique({
      where: { id }
    });

    if (!existingPrinter) {
      return NextResponse.json(
        { error: 'Printer not found' },
        { status: 404 }
      );
    }

    // Unload adapter first
    await printersService.unloadAdapter(id);

    // Delete printer record
    await prisma.printer.delete({
      where: { id }
    });

    return NextResponse.json({
      success: true,
      message: 'Printer deleted successfully'
    });

  } catch (error) {
    console.error('Error deleting printer:', error);
    return NextResponse.json(
      { 
        success: false,
        error: error instanceof Error ? error.message : 'Failed to delete printer' 
      },
      { status: 500 }
    );
  }
}