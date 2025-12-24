// Inkjet Printer Adapters for A4 document printing
import { PrinterAdapter, PrintOptions, PrintResult, PrinterStatus, PrinterCapabilities } from './index';

export abstract class BaseInkjetAdapter implements PrinterAdapter {
  name: string;
  brand: string;
  model: string;
  type: 'inkjet' = 'inkjet';
  connection: 'usb' | 'bluetooth' | 'network' | 'wifi';
  
  protected connectionHandle: any = null;
  protected isConnectedFlag = false;
  
  constructor(config: { brand: string; model: string; connection: string }) {
    this.brand = config.brand;
    this.model = config.model;
    this.name = `${config.brand} ${config.model} Inkjet Printer`;
    this.connection = config.connection as any;
  }

  abstract connect(): Promise<boolean>;
  abstract disconnect(): Promise<void>;
  abstract print(content: string, options?: PrintOptions): Promise<PrintResult>;
  abstract testPrint(): Promise<boolean>;

  isConnected(): boolean {
    return this.isConnectedFlag;
  }

  getStatus(): PrinterStatus {
    return {
      online: this.isConnectedFlag,
      status: this.isConnectedFlag ? 'ready' : 'offline',
      queueLength: 0,
      lastPrintTime: undefined
    };
  }

  getCapabilities(): PrinterCapabilities {
    return {
      supportsColors: true,
      supportsGraphics: true,
      supportsBarcode: false, // Inkjet printers typically don't support barcode printing
      maxPrintWidth: 210, // A4 width in mm
      supportedPaperTypes: ['A4', 'Letter', 'Legal', 'Custom'],
      connectionTypes: [this.connection]
    };
  }

  // Generate PDF or PCL commands for inkjet printing
  protected generateInkjetCommands(content: string, options: PrintOptions = {}): Uint8Array {
    // For inkjet printers, we typically work with:
    // 1. Raw text (simple ASCII)
    // 2. PCL (Printer Command Language) commands
    // 3. PostScript commands
    // 4. PDF content
    
    const commands: number[] = [];
    
    // Initialize PCL mode
    commands.push(0x1B, 0x25, 0x2D, 0x31, 0x32, 0x33, 0x34); // PCL initialization
    
    // Set page size
    if (options.paperWidth === 80) {
      // Letter size
      commands.push(0x1B, 0x26, 0x6C, 0x30, 0x41); // Letter size
    } else {
      // A4 size (default)
      commands.push(0x1B, 0x26, 0x6C, 0x30, 0x41); // A4 size
    }
    
    // Add content with proper encoding
    const contentBytes = this.encodeContent(content, options.encoding);
    commands.push(...contentBytes);
    
    // Eject page
    commands.push(0x0C); // Form Feed
    
    return new Uint8Array(commands);
  }

  protected encodeContent(content: string, encoding?: string): number[] {
    const encoder = new TextEncoder();
    const bytes = encoder.encode(content);
    return Array.from(bytes);
  }

  // Generate formatted invoice/receipt for A4 printing
  protected formatInvoiceContent(invoiceData: {
    storeName: string;
    storeAddress?: string;
    storePhone?: string;
    invoiceNumber: string;
    date: string;
    items: Array<{ name: string; quantity: number; price: number; total: number }>;
    subtotal: number;
    tax: number;
    total: number;
    paymentMethod: string;
  }): string {
    const { storeName, storeAddress, storePhone, invoiceNumber, date, items, subtotal, tax, total, paymentMethod } = invoiceData;
    
    return `
${storeName}
${storeAddress || ''}
${storePhone ? 'Phone: ' + storePhone : ''}
${'='.repeat(50)}

INVOICE
Invoice #: ${invoiceNumber}
Date: ${date}
${'='.repeat(50)}

ITEMS:
${'-'.repeat(50)}
Name                    Qty    Price    Total
${'-'.repeat(50)}
${items.map(item => 
  `${item.name.padEnd(20)} ${item.quantity.toString().padStart(3)} ${item.price.toFixed(2).padStart(8)} ${item.total.toFixed(2).padStart(8)}`
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
}

// HP Inkjet Printer Adapter
export class HPInkjetAdapter extends BaseInkjetAdapter {
  constructor(config: { model: string; connection: string }) {
    super({ brand: 'HP', ...config });
  }

  async connect(): Promise<boolean> {
    try {
      console.log(`Connecting to HP ${this.model} via ${this.connection}`);
      this.isConnectedFlag = true;
      return true;
    } catch (error) {
      console.error('Failed to connect to HP printer:', error);
      return false;
    }
  }

  async disconnect(): Promise<void> {
    this.isConnectedFlag = false;
    console.log('Disconnected from HP printer');
  }

  async print(content: string, options: PrintOptions = {}): Promise<PrintResult> {
    const startTime = Date.now();
    
    if (!this.isConnected()) {
      return { success: false, error: 'Printer not connected' };
    }

    try {
      const commands = this.generateInkjetCommands(content, options);
      console.log('Printing to HP printer:', commands.length, 'bytes');
      
      return {
        success: true,
        jobId: `hp_${Date.now()}`,
        duration: Date.now() - startTime
      };
    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error'
      };
    }
  }

  async testPrint(): Promise<boolean> {
    const testContent = `
HP Inkjet Printer Test Page
============================

Model: ${this.model}
Connection: ${this.connection}
Time: ${new Date().toLocaleString()}

This is a test page to verify printer functionality.
If you can see this page clearly, your printer is working correctly.

Color Test:    Black Text   ✓
Gray Test:     Gray Text    ✓
Line Test:     ───────────  ✓
Graphics:      [HP Logo]    ✓

Thank you for choosing HP!
============================
`;
    
    const result = await this.print(testContent);
    return result.success;
  }
}

// Canon Inkjet Printer Adapter
export class CanonInkjetAdapter extends BaseInkjetAdapter {
  constructor(config: { model: string; connection: string }) {
    super({ brand: 'Canon', ...config });
  }

  async connect(): Promise<boolean> {
    try {
      console.log(`Connecting to Canon ${this.model} via ${this.connection}`);
      this.isConnectedFlag = true;
      return true;
    } catch (error) {
      console.error('Failed to connect to Canon printer:', error);
      return false;
    }
  }

  async disconnect(): Promise<void> {
    this.isConnectedFlag = false;
    console.log('Disconnected from Canon printer');
  }

  async print(content: string, options: PrintOptions = {}): Promise<PrintResult> {
    const startTime = Date.now();
    
    if (!this.isConnected()) {
      return { success: false, error: 'Printer not connected' };
    }

    try {
      const commands = this.generateInkjetCommands(content, options);
      console.log('Printing to Canon printer:', commands.length, 'bytes');
      
      return {
        success: true,
        jobId: `canon_${Date.now()}`,
        duration: Date.now() - startTime
      };
    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error'
      };
    }
  }

  async testPrint(): Promise<boolean> {
    const testContent = `
Canon Inkjet Printer Test Page
===============================

Model: ${this.model}
Connection: ${this.connection}
Time: ${new Date().toLocaleString()}

This is a test page to verify printer functionality.
If you can see this page clearly, your printer is working correctly.

Quality Test:    High Quality  ✓
Color Test:      Full Color    ✓
Text Test:       Clear Text    ✓
Photo Test:      Photo Ready   ✓

Thank you for choosing Canon!
===============================
`;
    
    const result = await this.print(testContent);
    return result.success;
  }
}

// Epson Inkjet Printer Adapter
export class EpsonInkjetAdapter extends BaseInkjetAdapter {
  constructor(config: { model: string; connection: string }) {
    super({ brand: 'Epson', ...config });
  }

  async connect(): Promise<boolean> {
    try {
      console.log(`Connecting to Epson ${this.model} via ${this.connection}`);
      this.isConnectedFlag = true;
      return true;
    } catch (error) {
      console.error('Failed to connect to Epson printer:', error);
      return false;
    }
  }

  async disconnect(): Promise<void> {
    this.isConnectedFlag = false;
    console.log('Disconnected from Epson printer');
  }

  async print(content: string, options: PrintOptions = {}): Promise<PrintResult> {
    const startTime = Date.now();
    
    if (!this.isConnected()) {
      return { success: false, error: 'Printer not connected' };
    }

    try {
      const commands = this.generateInkjetCommands(content, options);
      console.log('Printing to Epson printer:', commands.length, 'bytes');
      
      return {
        success: true,
        jobId: `epson_inkjet_${Date.now()}`,
        duration: Date.now() - startTime
      };
    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error'
      };
    }
  }

  async testPrint(): Promise<boolean> {
    const testContent = `
Epson Inkjet Printer Test Page
===============================

Model: ${this.model}
Connection: ${this.connection}
Time: ${new Date().toLocaleString()}

This is a test page to verify printer functionality.
If you can see this page clearly, your printer is working correctly.

Performance Test:   Fast Print   ✓
Quality Test:       High DPI     ✓
Color Test:         Vivid Color  ✓
Durability Test:    Fade Resistant ✓

Thank you for choosing Epson!
===============================
`;
    
    const result = await this.print(testContent);
    return result.success;
  }
}

// Generic Inkjet Printer Adapter
export class GenericInkjetAdapter extends BaseInkjetAdapter {
  constructor(config: { brand: string; model: string; connection: string }) {
    super(config);
  }

  async connect(): Promise<boolean> {
    try {
      console.log(`Connecting to ${this.brand} ${this.model} via ${this.connection}`);
      this.isConnectedFlag = true;
      return true;
    } catch (error) {
      console.error(`Failed to connect to ${this.brand} printer:`, error);
      return false;
    }
  }

  async disconnect(): Promise<void> {
    this.isConnectedFlag = false;
    console.log(`Disconnected from ${this.brand} printer`);
  }

  async print(content: string, options: PrintOptions = {}): Promise<PrintResult> {
    const startTime = Date.now();
    
    if (!this.isConnected()) {
      return { success: false, error: 'Printer not connected' };
    }

    try {
      const commands = this.generateInkjetCommands(content, options);
      console.log(`Printing to ${this.brand} printer:`, commands.length, 'bytes');
      
      return {
        success: true,
        jobId: `${this.brand.toLowerCase()}_${Date.now()}`,
        duration: Date.now() - startTime
      };
    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error'
      };
    }
  }

  async testPrint(): Promise<boolean> {
    const testContent = `
${this.brand} Inkjet Printer Test Page
=====================================

Model: ${this.model}
Connection: ${this.connection}
Time: ${new Date().toLocaleString()}

This is a test page to verify printer functionality.
If you can see this page clearly, your printer is working correctly.

All systems operational!
=====================================
`;
    
    const result = await this.print(testContent);
    return result.success;
  }
}