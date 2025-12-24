// Centralized Printer Management Service
import { PrinterAdapter, PrinterAdapterFactory, PrinterStatus, PrintResult } from './printer-adapters/index';
import { PrismaClient } from '@prisma/client';

export interface PrinterConfig {
  id: string;
  name: string;
  type: 'thermal' | 'inkjet' | 'label' | 'laser';
  brand: string;
  model: string;
  connection: 'usb' | 'bluetooth' | 'network' | 'wifi';
  status: string;
  isDefault: boolean;
  settings?: any;
  capabilities?: any;
  storeId: string;
}

export interface PrintJobRequest {
  printerId: string;
  type: 'receipt' | 'invoice' | 'label' | 'report';
  content: string;
  priority?: number;
  options?: any;
}

export class PrintersService {
  private static instance: PrintersService;
  private prisma: PrismaClient;
  private adapters: Map<string, PrinterAdapter> = new Map();
  private printQueue: Map<string, PrintJobRequest> = new Map();
  private statusCheckInterval: NodeJS.Timeout | null = null;

  constructor() {
    this.prisma = new PrismaClient();
    this.initializeAdapters();
    this.startStatusMonitoring();
  }

  public static getInstance(): PrintersService {
    if (!PrintersService.instance) {
      PrintersService.instance = new PrintersService();
    }
    return PrintersService.instance;
  }

  // Initialize all printer adapters from database
  private async initializeAdapters(): Promise<void> {
    try {
      const printers = await this.prisma.printer.findMany({
        where: { status: { not: 'offline' } }
      });

      for (const printer of printers) {
        await this.loadAdapter(printer);
      }
    } catch (error) {
      console.error('Failed to initialize printer adapters:', error);
    }
  }

  // Load and connect a specific printer adapter
  public async loadAdapter(printerConfig: any): Promise<boolean> {
    try {
      const adapter = PrinterAdapterFactory.createAdapter({
        brand: printerConfig.brand,
        model: printerConfig.model,
        type: printerConfig.type,
        connection: printerConfig.connection
      });

      // Connect the adapter
      const connected = await adapter.connect();
      
      if (connected) {
        this.adapters.set(printerConfig.id, adapter);
        console.log(`Loaded adapter for ${printerConfig.name}`);
        return true;
      }
      
      return false;
    } catch (error) {
      console.error(`Failed to load adapter for ${printerConfig.name}:`, error);
      return false;
    }
  }

  // Remove adapter
  public async unloadAdapter(printerId: string): Promise<void> {
    const adapter = this.adapters.get(printerId);
    if (adapter) {
      await adapter.disconnect();
      this.adapters.delete(printerId);
      console.log(`Unloaded adapter for printer ${printerId}`);
    }
  }

  // Get all printers with status
  public async getPrinters(storeId: string): Promise<Array<PrinterConfig & { statusInfo: PrinterStatus }>> {
    const printers = await this.prisma.printer.findMany({
      where: { storeId }
    });

    return Promise.all(printers.map(async (printer) => {
      const adapter = this.adapters.get(printer.id);
      const statusInfo = adapter ? adapter.getStatus() : {
        online: false,
        status: 'offline',
        queueLength: 0
      };

      return {
        ...printer,
        statusInfo
      } as any;
    }));
  }

  // Get default printer for a type
  public async getDefaultPrinter(storeId: string, type: string): Promise<any | null> {
    const printer = await this.prisma.printer.findFirst({
      where: {
        storeId,
        type,
        isDefault: true,
        status: { not: 'offline' }
      }
    });

    return printer;
  }

  // Test printer connection
  public async testPrinter(printerId: string): Promise<{ success: boolean; message: string }> {
    try {
      const adapter = this.adapters.get(printerId);
      if (!adapter) {
        // Try to load adapter first
        const printer = await this.prisma.printer.findUnique({ where: { id: printerId } });
        if (!printer) {
          return { success: false, message: 'Printer not found' };
        }

        const loaded = await this.loadAdapter(printer);
        if (!loaded) {
          return { success: false, message: 'Failed to connect to printer' };
        }
      }

      const reloadedAdapter = this.adapters.get(printerId);
      if (!reloadedAdapter) {
        return { success: false, message: 'Adapter not available' };
      }

      const testResult = await reloadedAdapter.testPrint();
      
      if (testResult) {
        await this.updatePrinterStatus(printerId, 'online');
        return { success: true, message: 'Test print successful' };
      } else {
        await this.updatePrinterStatus(printerId, 'error');
        return { success: false, message: 'Test print failed' };
      }
    } catch (error) {
      await this.updatePrinterStatus(printerId, 'error');
      return { 
        success: false, 
        message: error instanceof Error ? error.message : 'Unknown error' 
      };
    }
  }

  // Print to specific printer
  public async printToPrinter(request: PrintJobRequest): Promise<PrintResult> {
    const adapter = this.adapters.get(request.printerId);
    
    if (!adapter) {
      // Try to load adapter first
      const printer = await this.prisma.printer.findUnique({ 
        where: { id: request.printerId } 
      });
      
      if (!printer) {
        return { success: false, error: 'Printer not found' };
      }

      const loaded = await this.loadAdapter(printer);
      if (!loaded) {
        return { success: false, error: 'Failed to connect to printer' };
      }
    }

    const reloadedAdapter = this.adapters.get(request.printerId);
    if (!reloadedAdapter) {
      return { success: false, error: 'Adapter not available' };
    }

    try {
      // Create print job record
      const printJob = await this.prisma.printJob.create({
        data: {
          printerId: request.printerId,
          type: request.type,
          content: request.content,
          priority: request.priority || 0,
          status: 'printing'
        }
      });

      // Update printer status
      await this.updatePrinterStatus(request.printerId, 'printing');

      // Execute print
      const result = await reloadedAdapter.print(request.content, request.options);
      
      // Update job status
      await this.prisma.printJob.update({
        where: { id: printJob.id },
        data: {
          status: result.success ? 'completed' : 'failed',
          error: result.error,
          completedAt: new Date(),
          startedAt: new Date()
        }
      });

      // Update printer status
      await this.updatePrinterStatus(request.printerId, result.success ? 'online' : 'error');

      return {
        ...result,
        jobId: printJob.id
      };

    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error'
      };
    }
  }

  // Print receipt (thermal printer)
  public async printReceipt(params: {
    printerId?: string;
    storeId: string;
    saleData: {
      invoiceNumber: string;
      date: string;
      items: Array<{ name: string; quantity: number; price: number; total: number }>;
      subtotal: number;
      tax: number;
      total: number;
      paymentMethod: string;
      customerName?: string;
      clerkName?: string;
    };
  }): Promise<PrintResult> {
    const { printerId, storeId, saleData } = params;
    
    // Get printer (use default or specified)
    let targetPrinter = printerId;
    if (!targetPrinter) {
      const defaultPrinter = await this.getDefaultPrinter(storeId, 'thermal');
      targetPrinter = defaultPrinter?.id;
    }

    if (!targetPrinter) {
      return { success: false, error: 'No thermal printer available' };
    }

    // Generate receipt content
    const receiptContent = this.generateReceiptContent(saleData);

    return this.printToPrinter({
      printerId: targetPrinter,
      type: 'receipt',
      content: receiptContent
    });
  }

  // Print invoice (inkjet printer)
  public async printInvoice(params: {
    printerId?: string;
    storeId: string;
    invoiceData: {
      invoiceNumber: string;
      date: string;
      items: Array<{ name: string; quantity: number; price: number; total: number }>;
      subtotal: number;
      tax: number;
      total: number;
      paymentMethod: string;
      customerName?: string;
      customerAddress?: string;
      storeDetails?: {
        name: string;
        address?: string;
        phone?: string;
        email?: string;
      };
    };
  }): Promise<PrintResult> {
    const { printerId, storeId, invoiceData } = params;
    
    // Get printer (use default or specified)
    let targetPrinter = printerId;
    if (!targetPrinter) {
      const defaultPrinter = await this.getDefaultPrinter(storeId, 'inkjet');
      targetPrinter = defaultPrinter?.id;
    }

    if (!targetPrinter) {
      return { success: false, error: 'No inkjet printer available' };
    }

    // Generate invoice content
    const invoiceContent = this.generateInvoiceContent(invoiceData);

    return this.printToPrinter({
      printerId: targetPrinter,
      type: 'invoice',
      content: invoiceContent
    });
  }

  // Print label
  public async printLabel(params: {
    printerId?: string;
    storeId: string;
    labelType: 'shipping' | 'product';
    labelData: any;
  }): Promise<PrintResult> {
    const { printerId, storeId, labelType, labelData } = params;
    
    // Get printer (use default or specified)
    let targetPrinter = printerId;
    if (!targetPrinter) {
      const defaultPrinter = await this.getDefaultPrinter(storeId, 'label');
      targetPrinter = defaultPrinter?.id;
    }

    if (!targetPrinter) {
      return { success: false, error: 'No label printer available' };
    }

    const adapter = this.adapters.get(targetPrinter);
    if (!adapter) {
      return { success: false, error: 'Label printer adapter not loaded' };
    }

    let content = '';
    let result: PrintResult;

    try {
      if (labelType === 'shipping' && 'printShippingLabel' in adapter) {
        result = await (adapter as any).printShippingLabel(labelData);
      } else if (labelType === 'product' && 'printProductLabel' in adapter) {
        result = await (adapter as any).printProductLabel(labelData);
      } else {
        // Fallback to manual content generation
        content = JSON.stringify(labelData, null, 2);
        result = await this.printToPrinter({
          printerId: targetPrinter,
          type: 'label',
          content
        });
      }

      return result;
    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Label printing failed'
      };
    }
  }

  // Get print job history
  public async getPrintJobs(printerId?: string, limit: number = 50): Promise<any[]> {
    const where = printerId ? { printerId } : {};
    
    return await this.prisma.printJob.findMany({
      where,
      include: {
        printer: {
          select: {
            name: true,
            brand: true,
            model: true
          }
        }
      },
      orderBy: { createdAt: 'desc' },
      take: limit
    });
  }

  // Cancel print job
  public async cancelPrintJob(jobId: string): Promise<boolean> {
    try {
      const job = await this.prisma.printJob.findUnique({
        where: { id: jobId }
      });

      if (!job || job.status === 'completed') {
        return false;
      }

      await this.prisma.printJob.update({
        where: { id: jobId },
        data: { status: 'failed', error: 'Cancelled by user' }
      });

      return true;
    } catch (error) {
      console.error('Failed to cancel print job:', error);
      return false;
    }
  }

  // Update printer status in database
  private async updatePrinterStatus(printerId: string, status: string): Promise<void> {
    try {
      await this.prisma.printer.update({
        where: { id: printerId },
        data: { 
          status,
          lastConnected: status === 'online' ? new Date() : undefined
        }
      });
    } catch (error) {
      console.error('Failed to update printer status:', error);
    }
  }

  // Start status monitoring
  private startStatusMonitoring(): void {
    this.statusCheckInterval = setInterval(async () => {
      await this.checkAllPrinterStatus();
    }, 30000); // Check every 30 seconds
  }

  // Check status of all loaded adapters
  private async checkAllPrinterStatus(): Promise<void> {
    for (const [printerId, adapter] of this.adapters) {
      try {
        const status = adapter.getStatus();
        if (status.online && status.status !== 'offline') {
          await this.updatePrinterStatus(printerId, 'online');
        } else if (!status.online) {
          await this.updatePrinterStatus(printerId, 'offline');
        }
      } catch (error) {
        console.error(`Status check failed for printer ${printerId}:`, error);
      }
    }
  }

  // Generate receipt content for thermal printing
  private generateReceiptContent(saleData: any): string {
    const { 
      invoiceNumber, 
      date, 
      items, 
      subtotal, 
      tax, 
      total, 
      paymentMethod, 
      customerName, 
      clerkName 
    } = saleData;

    return `
${'='.repeat(32)}
    RECEIPT
${'='.repeat(32)}
Invoice: ${invoiceNumber}
Date: ${date}
${customerName ? `Customer: ${customerName}` : ''}
${clerkName ? `Clerk: ${clerkName}` : ''}
${'='.repeat(32)}

ITEMS:
${'-'.repeat(32)}
${items.map((item: any) => 
  `${item.name.substring(0, 15).padEnd(15)} ${item.quantity.toString().padStart(3)} ${item.price.toFixed(2).padStart(6)}`
).join('\n')}
${'-'.repeat(32)}

Subtotal:     ${subtotal.toFixed(2).padStart(8)}
Tax:          ${tax.toFixed(2).padStart(8)}
${'='.repeat(32)}
TOTAL:        ${total.toFixed(2).padStart(8)}
Payment:      ${paymentMethod}
${'='.repeat(32)}

Thank you for your business!
${' '.repeat(32)}
`;
  }

  // Generate invoice content for inkjet printing
  private generateInvoiceContent(invoiceData: any): string {
    const { 
      invoiceNumber, 
      date, 
      items, 
      subtotal, 
      tax, 
      total, 
      paymentMethod, 
      customerName,
      customerAddress,
      storeDetails
    } = invoiceData;

    const storeName = storeDetails?.name || 'Your Store';
    const storeAddress = storeDetails?.address || '';
    const storePhone = storeDetails?.phone || '';

    return `
${storeName}
${storeAddress}
${storePhone ? 'Phone: ' + storePhone : ''}
${'='.repeat(50)}

INVOICE
Invoice #: ${invoiceNumber}
Date: ${date}
${customerName ? `Customer: ${customerName}` : ''}
${customerAddress ? `Address: ${customerAddress}` : ''}
${'='.repeat(50)}

ITEMS:
${'-'.repeat(50)}
Name                    Qty    Price    Total
${'-'.repeat(50)}
${items.map((item: any) => 
  `${item.name.substring(0, 20).padEnd(20)} ${item.quantity.toString().padStart(3)} ${item.price.toFixed(2).padStart(8)} ${item.total.toFixed(2).padStart(8)}`
).join('\n')}
${'-'.repeat(50)}

Subtotal:               ${subtotal.toFixed(2)}
Tax:                    ${tax.toFixed(2)}
${'='.repeat(50)}
TOTAL:                  ${total.toFixed(2)}

Payment Method: ${paymentMethod}
${'='.repeat(50)}

Thank you for your business!
`;
  }

  // Cleanup
  public async cleanup(): Promise<void> {
    if (this.statusCheckInterval) {
      clearInterval(this.statusCheckInterval);
    }

    for (const adapter of this.adapters.values()) {
      await adapter.disconnect();
    }
    
    this.adapters.clear();
    await this.prisma.$disconnect();
  }
}

// Export singleton instance
export const printersService = PrintersService.getInstance();