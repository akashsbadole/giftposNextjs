// Print to Specific Printer API Route
import { NextRequest, NextResponse } from 'next/server';
import { printersService } from '@/lib/printers-service';

export async function POST(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const { id } = params;
    const body = await request.json();
    const {
      type,
      content,
      priority,
      options
    } = body;

    if (!type || !content) {
      return NextResponse.json(
        { error: 'Type and content are required' },
        { status: 400 }
      );
    }

    const result = await printersService.printToPrinter({
      printerId: id,
      type,
      content,
      priority: priority || 0,
      options
    });

    return NextResponse.json({
      success: result.success,
      message: result.success ? 'Print job submitted successfully' : 'Print job failed',
      data: {
        jobId: result.jobId,
        duration: result.duration,
        error: result.error
      }
    });

  } catch (error) {
    console.error('Error printing to printer:', error);
    return NextResponse.json(
      { 
        success: false,
        error: error instanceof Error ? error.message : 'Failed to print' 
      },
      { status: 500 }
    );
  }
}