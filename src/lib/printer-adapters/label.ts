// Label/Barcode Printer Adapters for shipping and product labels
import { PrinterAdapter, PrintOptions, PrintResult, PrinterStatus, PrinterCapabilities } from './index';

export abstract class BaseLabelAdapter implements PrinterAdapter {
  name: string;
  brand: string;
  model: string;
  type: 'label' = 'label';
  connection: 'usb' | 'bluetooth' | 'network' | 'wifi';
  
  protected connectionHandle: any = null;
  protected isConnectedFlag = false;
  
  constructor(config: { brand: string; model: string; connection: string }) {
    this.brand = config.brand;
    this.model = config.model;
    this.name = `${config.brand} ${config.model} Label Printer`;
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
      supportsColors: false, // Most label printers are monochrome
      supportsGraphics: true,
      supportsBarcode: true, // Label printers excel at barcodes
      maxPrintWidth: 104, // 4-inch label width in mm (common for shipping labels)
      supportedPaperTypes: ['2x1', '3x1', '4x6', '4x8', 'A6', 'Custom'],
      connectionTypes: [this.connection]
    };
  }

  // Generate ZPL (Zebra Programming Language) or EPL commands for label printing
  protected generateLabelCommands(content: string, options: PrintOptions = {}): Uint8Array {
    const commands: number[] = [];
    
    // For label printers, we typically use:
    // 1. ZPL (Zebra Programming Language) - most common
    // 2. EPL (Eltron Programming Language)
    // 3. CPCL (CPCL Programming Language)
    
    // Start with ZPL commands (most widely supported)
    // ZPL initialization
    const zplHeader = `^XA^CI28^CW0,E:SIMSUN.FNT^FO0,0^A0N,30,30^FD${this.brand} ${this.model}^FS^XZ`;
    
    // Add content
    commands.push(...this.encodeContent(zplHeader + content));
    
    return new Uint8Array(commands);
  }

  protected encodeContent(content: string, encoding?: string): number[] {
    const encoder = new TextEncoder();
    const bytes = encoder.encode(content);
    return Array.from(bytes);
  }

  // Generate shipping label content
  protected generateShippingLabel(data: {
    fromAddress: {
      name: string;
      address: string;
      city: string;
      state: string;
      zip: string;
    };
    toAddress: {
      name: string;
      address: string;
      city: string;
      state: string;
      zip: string;
    };
    trackingNumber: string;
    weight?: string;
    service?: string;
  }): string {
    const { fromAddress, toAddress, trackingNumber, weight, service } = data;
    
    // ZPL format for shipping label
    return `
^XA
^CI28
^PW609
^LL1218
^FO50,50^A0N,20,20^FDFrom:^FS
^FO50,80^A0N,18,18^FD${fromAddress.name}^FS
^FO50,110^A0N,18,18^FD${fromAddress.address}^FS
^FO50,140^A0N,18,18^FD${fromAddress.city}, ${fromAddress.state} ${fromAddress.zip}^FS

^FO50,200^A0N,20,20^FDTo:^FS
^FO50,230^A0N,18,18^FD${toAddress.name}^FS
^FO50,260^A0N,18,18^FD${toAddress.address}^FS
^FO50,290^A0N,18,18^FD${toAddress.city}, ${toAddress.state} ${toAddress.zip}^FS

^FO50,370^A0N,24,24^FDTracking: ${trackingNumber}^FS
${weight ? `^FO50,410^A0N,18,18^FDWeight: ${weight}^FS` : ''}
${service ? `^FO50,440^A0N,18,18^FDService: ${service}^FS` : ''}

^FO50,500^BY2
^BCN,100,Y,N,N
^FD${trackingNumber}^FS

^FO350,50^A0N,30,30^FD${service || 'PRIORITY'}^FS
^FO350,90^A0N,20,20^FD${trackingNumber}^FS
^FO350,120^A0N,15,15^FD${weight || 'STANDARD'}^FS

^FO350,650^BY1
^BCN,80,Y,N,N
^FD${trackingNumber}^FS

^XZ
`;
  }

  // Generate product label content
  protected generateProductLabel(data: {
    productName: string;
    sku: string;
    price?: string;
    barcode?: string;
    expiryDate?: string;
  }): string {
    const { productName, sku, price, barcode, expiryDate } = data;
    
    return `
^XA
^CI28
^PW304
^LL200
^FO10,10^A0N,15,15^FD${productName}^FS
^FO10,40^A0N,12,12^FDSKU: ${sku}^FS
${price ? `^FO10,65^A0N,12,12^FDPrice: ${price}^FS` : ''}
${expiryDate ? `^FO10,85^A0N,10,10^FDExp: ${expiryDate}^FS` : ''}

^FO50,120^BY1
^BCN,70,Y,N,N
${barcode ? `^FD${barcode}^FS` : `^FD${sku}^FS`}

^XZ
`;
  }
}

// Generic Label Printer Adapter (works with most ZPL-compatible printers)
export class GenericLabelAdapter extends BaseLabelAdapter {
  constructor(config: { brand: string; model: string; connection: string }) {
    super(config);
  }

  async connect(): Promise<boolean> {
    try {
      console.log(`Connecting to ${this.brand} ${this.model} via ${this.connection}`);
      this.isConnectedFlag = true;
      return true;
    } catch (error) {
      console.error(`Failed to connect to ${this.brand} label printer:`, error);
      return false;
    }
  }

  async disconnect(): Promise<void> {
    this.isConnectedFlag = false;
    console.log(`Disconnected from ${this.brand} label printer`);
  }

  async print(content: string, options: PrintOptions = {}): Promise<PrintResult> {
    const startTime = Date.now();
    
    if (!this.isConnected()) {
      return { success: false, error: 'Printer not connected' };
    }

    try {
      const commands = this.generateLabelCommands(content, options);
      console.log(`Printing to ${this.brand} label printer:`, commands.length, 'bytes');
      
      return {
        success: true,
        jobId: `${this.brand.toLowerCase()}_label_${Date.now()}`,
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
^XA
^CI28
^PW304
^LL200
^FO10,10^A0N,20,20^FD${this.brand} Label Printer^FS
^FO10,40^A0N,15,15^FDModel: ${this.model}^FS
^FO10,65^A0N,15,15^FDConnection: ${this.connection}^FS
^FO10,90^A0N,15,15^FDTime: ${new Date().toLocaleString()}^FS

^FO10,130^BY2
^BCN,50,Y,N,N
^FDTEST-LABEL-12345^FS

^FO10,190^A0N,10,10^FDTest successful!^FS
^XZ
`;
    
    const result = await this.print(testContent);
    return result.success;
  }

  // Helper method for printing shipping labels
  async printShippingLabel(shippingData: Parameters<BaseLabelAdapter['generateShippingLabel']>[0]): Promise<PrintResult> {
    const content = this.generateShippingLabel(shippingData);
    return this.print(content);
  }

  // Helper method for printing product labels
  async printProductLabel(productData: Parameters<BaseLabelAdapter['generateProductLabel']>[0]): Promise<PrintResult> {
    const content = this.generateProductLabel(productData);
    return this.print(content);
  }
}

// Specialized adapters for common label printer brands

export class ZebraLabelAdapter extends BaseLabelAdapter {
  constructor(config: { model: string; connection: string }) {
    super({ brand: 'Zebra', ...config });
  }

  async connect(): Promise<boolean> {
    try {
      console.log(`Connecting to Zebra ${this.model} via ${this.connection}`);
      this.isConnectedFlag = true;
      return true;
    } catch (error) {
      console.error('Failed to connect to Zebra printer:', error);
      return false;
    }
  }

  async disconnect(): Promise<void> {
    this.isConnectedFlag = false;
    console.log('Disconnected from Zebra printer');
  }

  async print(content: string, options: PrintOptions = {}): Promise<PrintResult> {
    const startTime = Date.now();
    
    if (!this.isConnected()) {
      return { success: false, error: 'Printer not connected' };
    }

    try {
      // Zebra printers use optimized ZPL
      const commands = this.generateLabelCommands(content, options);
      console.log('Printing to Zebra printer:', commands.length, 'bytes');
      
      return {
        success: true,
        jobId: `zebra_${Date.now()}`,
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
^XA
^CI28
^PW304
^LL200
^FO10,10^A0N,25,25^FDZEBRA LABEL PRINTER^FS
^FO10,45^A0N,15,15^FDModel: ${this.model}^FS
^FO10,70^A0N,15,15^FDConnection: ${this.connection}^FS
^FO10,95^A0N,15,15^FDTime: ${new Date().toLocaleString()}^FS

^FO10,130^BY3
^BCN,60,Y,N,N
^FDZEBRA-TEST-12345^FS

^FO10,200^A0N,12,12^FDPowered by ZPL Technology^FS
^XZ
`;
    
    const result = await this.print(testContent);
    return result.success;
  }
}

export class DymoLabelAdapter extends BaseLabelAdapter {
  constructor(config: { model: string; connection: string }) {
    super({ brand: 'Dymo', ...config });
  }

  async connect(): Promise<boolean> {
    try {
      console.log(`Connecting to Dymo ${this.model} via ${this.connection}`);
      this.isConnectedFlag = true;
      return true;
    } catch (error) {
      console.error('Failed to connect to Dymo printer:', error);
      return false;
    }
  }

  async disconnect(): Promise<void> {
    this.isConnectedFlag = false;
    console.log('Disconnected from Dymo printer');
  }

  async print(content: string, options: PrintOptions = {}): Promise<PrintResult> {
    const startTime = Date.now();
    
    if (!this.isConnected()) {
      return { success: false, error: 'Printer not connected' };
    }

    try {
      // Dymo printers use their own command set
      const commands = this.generateLabelCommands(content, options);
      console.log('Printing to Dymo printer:', commands.length, 'bytes');
      
      return {
        success: true,
        jobId: `dymo_${Date.now()}`,
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
^XA
^CI28
^PW304
^LL200
^FO10,10^A0N,25,25^FDDYMO LABEL PRINTER^FS
^FO10,45^A0N,15,15^FDModel: ${this.model}^FS
^FO10,70^A0N,15,15^FDConnection: ${this.connection}^FS
^FO10,95^A0N,15,15^FDTime: ${new Date().toLocaleString()}^FS

^FO10,130^BY3
^BCN,60,Y,N,N
^FDDYMO-TEST-12345^FS

^FO10,200^A0N,12,12^FDOffice Label Printing^FS
^XZ
`;
    
    const result = await this.print(testContent);
    return result.success;
  }
}