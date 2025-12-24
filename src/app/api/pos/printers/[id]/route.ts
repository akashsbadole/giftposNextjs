// Individual Printer Operations API Route
import { NextRequest, NextResponse } from 'next/server';
import { PrismaClient } from '@prisma/client';
import { printersService } from '@/lib/printers-service';

const prisma = new PrismaClient();

// GET /api/pos/printers/[id] - Get specific printer
export async function GET(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const { id } = params;

    const printer = await prisma.printer.findUnique({
      where: { id },
      include: {
        printJobs: {
          orderBy: { createdAt: 'desc' },
          take: 10
        }
      }
    });

    if (!printer) {
      return NextResponse.json(
        { error: 'Printer not found' },
        { status: 404 }
      );
    }

    // Get current status
    const printerStatus = await printersService.getPrinters(printer.storeId);
    const currentStatus = printerStatus.find(p => p.id === id);

    return NextResponse.json({
      success: true,
      data: {
        ...printer,
        statusInfo: currentStatus?.statusInfo || {
          online: false,
          status: 'offline',
          queueLength: 0
        }
      }
    });

  } catch (error) {
    console.error('Error fetching printer:', error);
    return NextResponse.json(
      { 
        success: false,
        error: error instanceof Error ? error.message : 'Failed to fetch printer' 
      },
      { status: 500 }
    );
  }
}

// PUT /api/pos/printers/[id] - Update specific printer
export async function PUT(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const { id } = params;
    const body = await request.json();
    const {
      name,
      type,
      brand,
      model,
      connection,
      isDefault,
      settings
    } = body;

    // Validation
    if (!name || !type || !brand || !model || !connection) {
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
          storeId: existingPrinter.storeId,
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

// DELETE /api/pos/printers/[id] - Delete specific printer
export async function DELETE(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const { id } = params;

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

