// Printer Adapter Interface and Factory
import * as ThermalAdapters from './thermal'
import * as InkjetAdapters from './inkjet'
import * as LabelAdapters from './label'

export interface PrinterAdapter {
  name: string;
  brand: string;
  model: string;
  type: 'thermal' | 'inkjet' | 'label' | 'laser';
  connection: 'usb' | 'bluetooth' | 'network' | 'wifi';
  
  // Connection management
  connect(): Promise<boolean>;
  disconnect(): Promise<void>;
  isConnected(): boolean;
  
  // Print functionality
  print(content: string, options?: PrintOptions): Promise<PrintResult>;
  testPrint(): Promise<boolean>;
  
  // Status and health
  getStatus(): PrinterStatus;
  getCapabilities(): PrinterCapabilities;
}

export interface PrintOptions {
  copies?: number;
  paperWidth?: number;
  encoding?: string;
  temperature?: number;
  speed?: number;
}

export interface PrintResult {
  success: boolean;
  jobId?: string;
  error?: string;
  duration?: number;
}

export interface PrinterStatus {
  online: boolean;
  status: 'ready' | 'printing' | 'error' | 'offline' | 'paper-out' | 'cover-open';
  error?: string;
  queueLength: number;
  lastPrintTime?: Date;
}

export interface PrinterCapabilities {
  supportsColors: boolean;
  supportsGraphics: boolean;
  supportsBarcode: boolean;
  maxPrintWidth: number;
  supportedPaperTypes: string[];
  connectionTypes: string[];
}

// Factory for creating printer adapters
export class PrinterAdapterFactory {
  static createAdapter(printerConfig: {
    brand: string;
    model: string;
    type: string;
    connection: string;
  }): PrinterAdapter {
    const { brand, model, type, connection } = printerConfig;
    
    // Use dynamic imports with proper ES6 imports
    if (type === 'thermal') {
      switch (brand.toLowerCase()) {
        case 'epson':
          return new ThermalAdapters.EpsonThermalAdapter({ model, connection });
        case 'star':
          return new ThermalAdapters.StarThermalAdapter({ model, connection });
        case 'tvs':
          return new ThermalAdapters.TVSThermalAdapter({ model, connection });
        default:
          return new ThermalAdapters.GenericThermalAdapter({ brand, model, connection });
      }
    }
    
    if (type === 'inkjet') {
      switch (brand.toLowerCase()) {
        case 'hp':
          return new InkjetAdapters.HPInkjetAdapter({ model, connection });
        case 'canon':
          return new InkjetAdapters.CanonInkjetAdapter({ model, connection });
        case 'epson':
          return new InkjetAdapters.EpsonInkjetAdapter({ model, connection });
        default:
          return new InkjetAdapters.GenericInkjetAdapter({ brand, model, connection });
      }
    }
    
    if (type === 'label') {
      return new LabelAdapters.GenericLabelAdapter({ brand, model, connection });
    }
    
    throw new Error(`Unsupported printer type: ${type}`);
  }
}