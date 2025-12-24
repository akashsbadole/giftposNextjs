'use client'

import { useState, useEffect, useCallback, useRef } from 'react'
import { useToast } from '@/hooks/use-toast'

export type ScannerType = 'usb' | 'bluetooth' | 'camera' | 'unknown'

export interface ScanResult {
  code: string
  type: ScannerType
  format?: string
  timestamp: number
}

export interface BarcodeFormats {
  ean13: RegExp
  ean8: RegExp
  upcA: RegExp
  upcE: RegExp
  code128: RegExp
  code39: RegExp
  itf14: RegExp
  codabar: RegExp
}

export interface ScannerConfig {
  debounceMs: number
  autoDetection: boolean
  cameraEnabled: boolean
  soundFeedback: boolean
  visualFeedback: boolean
  formats: BarcodeFormats
}

const DEFAULT_CONFIG: ScannerConfig = {
  debounceMs: 100,
  autoDetection: true,
  cameraEnabled: true,
  soundFeedback: true,
  visualFeedback: true,
  formats: {
    ean13: /^\d{13}$/,
    ean8: /^\d{8}$/,
    upcA: /^\d{12}$/,
    upcE: /^\d{8}$/,
    code128: /^[\x00-\x7F]+$/,
    code39: /^[0-9A-Z\-\.\$\/\+\%\*\s]+$/,
    itf14: /^\d{14}$/,
    codabar: /^[0-9\-\$\:\.\/\+ABCD]+$/,
  }
}

export interface UseBarcodeScanner {
  // Scanner state
  isScanning: boolean
  lastScan: ScanResult | null
  scannerType: ScannerType
  isCameraActive: boolean
  error: string | null
  
  // Controls
  startScan: () => void
  stopScan: () => void
  clearLastScan: () => void
  toggleCamera: () => void
  
  // Configuration
  config: ScannerConfig
  updateConfig: (config: Partial<ScannerConfig>) => void
  
  // Manual input
  manualInput: (code: string) => void
}

export function useBarcodeScanner(
  onScan: (result: ScanResult) => void,
  config: Partial<ScannerConfig> = {}
): UseBarcodeScanner {
  const { toast } = useToast()
  const [isScanning, setIsScanning] = useState(false)
  const [lastScan, setLastScan] = useState<ScanResult | null>(null)
  const [scannerType, setScannerType] = useState<ScannerType>('unknown')
  const [isCameraActive, setIsCameraActive] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [currentConfig, setCurrentConfig] = useState<ScannerConfig>({
    ...DEFAULT_CONFIG,
    ...config
  })

  // Refs
  const inputBuffer = useRef<string>('')
  const lastInputTime = useRef<number>(0)
  const debounceTimer = useRef<NodeJS.Timeout>()
  const cameraStream = useRef<MediaStream | null>(null)
  const barcodeDetector = useRef<any>(null)

  // Detect barcode format
  const detectFormat = useCallback((code: string): string | undefined => {
    for (const [formatName, pattern] of Object.entries(currentConfig.formats)) {
      if (pattern.test(code)) {
        return formatName.toUpperCase()
      }
    }
    return undefined
  }, [currentConfig.formats])

  // Auto-detect scanner type
  const detectScannerType = useCallback((inputMethod: 'keyboard' | 'camera'): ScannerType => {
    if (inputMethod === 'camera') return 'camera'
    return 'unknown'
  }, [])

  // Handle keyboard input (USB/Bluetooth scanners)
  const handleKeyPress = useCallback((event: KeyboardEvent) => {
    if (!isScanning || currentConfig.autoDetection === false) return

    // Ignore modifier keys and function keys
    if (event.ctrlKey || event.altKey || event.metaKey || event.key.length > 1) {
      return
    }

    event.preventDefault()
    
    const currentTime = Date.now()
    const timeDiff = currentTime - lastInputTime.current
    
    // Reset buffer if too much time has passed (debounce)
    if (timeDiff > currentConfig.debounceMs) {
      inputBuffer.current = ''
    }
    
    inputBuffer.current += event.key
    lastInputTime.current = currentTime
    
    // Clear existing timer
    if (debounceTimer.current) {
      clearTimeout(debounceTimer.current)
    }
    
    // Set new timer to process the input
    debounceTimer.current = setTimeout(() => {
      const code = inputBuffer.current.trim()
      inputBuffer.current = ''
      
      if (code.length > 3) { // Minimum barcode length
        const format = detectFormat(code)
        const result: ScanResult = {
          code,
          type: detectScannerType('keyboard'),
          format,
          timestamp: Date.now()
        }
        
        setLastScan(result)
        onScan(result)
        
        // Visual feedback
        if (currentConfig.visualFeedback) {
          toast({
            title: 'Barcode Scanned',
            description: `${code} (${format || 'Unknown format'})`,
          })
        }
        
        // Sound feedback (if supported)
        if (currentConfig.soundFeedback && 'AudioContext' in window) {
          try {
            const audioContext = new AudioContext()
            const oscillator = audioContext.createOscillator()
            const gainNode = audioContext.createGain()
            
            oscillator.connect(gainNode)
            gainNode.connect(audioContext.destination)
            
            oscillator.frequency.value = 800
            oscillator.type = 'square'
            
            gainNode.gain.setValueAtTime(0.3, audioContext.currentTime)
            gainNode.gain.exponentialRampToValueAtTime(0.01, audioContext.currentTime + 0.1)
            
            oscillator.start(audioContext.currentTime)
            oscillator.stop(audioContext.currentTime + 0.1)
          } catch (error) {
            console.warn('Could not play scan sound:', error)
          }
        }
      }
    }, currentConfig.debounceMs + 50)
  }, [isScanning, currentConfig, onScan, detectFormat, detectScannerType, toast])

  // Handle camera scanning
  const scanWithCamera = useCallback(async () => {
    if (!currentConfig.cameraEnabled || !('BarcodeDetector' in window)) {
      setError('Camera scanning not supported')
      return
    }

    try {
      if (!barcodeDetector.current) {
        // @ts-ignore - BarcodeDetector is not in TypeScript definitions yet
        barcodeDetector.current = new BarcodeDetector({
          formats: ['ean_13', 'ean_8', 'upc_a', 'upc_e', 'code_128', 'code_39', 'itf_14', 'codabar']
        })
      }

      const video = document.createElement('video')
      video.setAttribute('playsinline', 'true')
      
      cameraStream.current = await navigator.mediaDevices.getUserMedia({
        video: {
          facingMode: 'environment', // Use back camera
          width: { ideal: 1280 },
          height: { ideal: 720 }
        }
      })
      
      video.srcObject = cameraStream.current
      await video.play()

      const scanFrame = async () => {
        if (!isCameraActive || !video.srcObject) return

        try {
          const canvas = document.createElement('canvas')
          const context = canvas.getContext('2d')
          
          if (context) {
            canvas.width = video.videoWidth
            canvas.height = video.videoHeight
            context.drawImage(video, 0, 0, canvas.width, canvas.height)
            
            const imageBitmap = await createImageBitmap(canvas)
            const barcodes = await barcodeDetector.current.detect(imageBitmap)
            
            if (barcodes.length > 0) {
              const barcode = barcodes[0]
              const result: ScanResult = {
                code: barcode.rawValue,
                type: detectScannerType('camera'),
                format: barcode.format,
                timestamp: Date.now()
              }
              
              setLastScan(result)
              onScan(result)
              
              if (currentConfig.visualFeedback) {
                toast({
                  title: 'Barcode Scanned',
                  description: `${barcode.rawValue} (${barcode.format})`,
                })
              }
              
              stopCamera()
              return
            }
          }
        } catch (error) {
          console.warn('Camera scan error:', error)
        }
        
        // Continue scanning
        if (isCameraActive) {
          requestAnimationFrame(scanFrame)
        }
      }
      
      scanFrame()
    } catch (error) {
      console.error('Camera initialization error:', error)
      setError('Failed to initialize camera')
      setIsCameraActive(false)
    }
  }, [currentConfig.cameraEnabled, isCameraActive, onScan, detectScannerType, toast])

  // Stop camera
  const stopCamera = useCallback(() => {
    if (cameraStream.current) {
      cameraStream.current.getTracks().forEach(track => track.stop())
      cameraStream.current = null
    }
    setIsCameraActive(false)
  }, [])

  // Start scanning
  const startScan = useCallback(() => {
    setIsScanning(true)
    setError(null)
    inputBuffer.current = ''
    setLastScan(null)
  }, [])

  // Stop scanning
  const stopScan = useCallback(() => {
    setIsScanning(false)
    inputBuffer.current = ''
    if (debounceTimer.current) {
      clearTimeout(debounceTimer.current)
    }
    stopCamera()
  }, [stopCamera])

  // Toggle camera
  const toggleCamera = useCallback(async () => {
    if (isCameraActive) {
      stopCamera()
    } else {
      if (!currentConfig.cameraEnabled) {
        setError('Camera scanning is disabled')
        return
      }
      setIsCameraActive(true)
      setError(null)
      await scanWithCamera()
    }
  }, [isCameraActive, currentConfig.cameraEnabled, stopCamera, scanWithCamera])

  // Clear last scan
  const clearLastScan = useCallback(() => {
    setLastScan(null)
  }, [])

  // Update configuration
  const updateConfig = useCallback((newConfig: Partial<ScannerConfig>) => {
    setCurrentConfig(prev => ({ ...prev, ...newConfig }))
  }, [])

  // Manual input
  const manualInput = useCallback((code: string) => {
    const trimmed = code.trim()
    if (trimmed.length > 0) {
      const format = detectFormat(trimmed)
      const result: ScanResult = {
        code: trimmed,
        type: 'unknown',
        format,
        timestamp: Date.now()
      }
      
      setLastScan(result)
      onScan(result)
      
      if (currentConfig.visualFeedback) {
        toast({
          title: 'Manual Input',
          description: `${trimmed} (${format || 'Unknown format'})`,
        })
      }
    }
  }, [detectFormat, onScan, currentConfig.visualFeedback, toast])

  // Keyboard event listeners
  useEffect(() => {
    if (isScanning) {
      document.addEventListener('keypress', handleKeyPress)
      return () => {
        document.removeEventListener('keypress', handleKeyPress)
      }
    }
  }, [isScanning, handleKeyPress])

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      if (debounceTimer.current) {
        clearTimeout(debounceTimer.current)
      }
      stopCamera()
    }
  }, [stopCamera])

  return {
    isScanning,
    lastScan,
    scannerType,
    isCameraActive,
    error,
    startScan,
    stopScan,
    clearLastScan,
    toggleCamera,
    config: currentConfig,
    updateConfig,
    manualInput
  }
}