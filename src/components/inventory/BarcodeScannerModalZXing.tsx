'use client'

import { useEffect, useRef, useState, useCallback } from 'react'
import { BrowserMultiFormatReader, BarcodeFormat } from '@zxing/browser'
import { DecodeHintType } from '@zxing/library'
import type { IScannerControls } from '@zxing/browser'
import { X, AlertCircle } from 'lucide-react'
import { CiCircleCheck } from 'react-icons/ci'
import { findProductByBarcode, incrementProductStock } from '@/app/actions/products'
import { SCAN_COOLDOWN_MS } from '@/constants/ui'
import { SCANNER_MESSAGES, PRODUCT_MESSAGES } from '@/constants/validation'
import type { ScannerErrorType } from '@/types'

interface BarcodeScannerModalProps {
  onClose: () => void
  onProductNotFound: (barcode: string) => void
  onStockUpdated?: () => void
}

/**
 * Advanced Barcode Scanner Modal using ZXing with Optimized Configuration
 *
 * Features:
 * - High-precision barcode detection with multiple format support
 * - Optimized hints for better accuracy (TRY_HARDER mode)
 * - Smart error handling and retry logic
 * - Cooldown mechanism to prevent duplicate scans
 * - Automatic rear camera selection
 * - Visual and haptic feedback
 * - Proper resource cleanup to prevent memory leaks
 *
 * Performance optimizations:
 * - Configurable hints for faster and more accurate decoding
 * - Efficient duplicate prevention
 * - Optimized camera selection
 */
export default function BarcodeScannerModalZXing({ onClose, onProductNotFound, onStockUpdated }: BarcodeScannerModalProps) {
  const [error, setError] = useState<string | null>(null)
  const [errorType, setErrorType] = useState<ScannerErrorType>(null)
  const [scannedCode, setScannedCode] = useState<string | null>(null)
  const [isScannerActive, setIsScannerActive] = useState(true)
  const [notification, setNotification] = useState<string | null>(null)
  const [isProcessing, setIsProcessing] = useState(false)
  const [isScannerReady, setIsScannerReady] = useState(false)
  const lastScannedRef = useRef<string | null>(null)
  const lastScanTimeRef = useRef<number>(0)
  const scanLockRef = useRef<boolean>(false)
  const isProcessingRef = useRef<boolean>(false)
  const videoRef = useRef<HTMLVideoElement>(null)
  const codeReaderRef = useRef<BrowserMultiFormatReader | null>(null)
  const scannerControlsRef = useRef<IScannerControls | null>(null)

  useEffect(() => {
    if (isScannerActive) {
      startScanner()
    } else {
      stopScanner()
    }
    return () => {
      stopScanner()
      lastScannedRef.current = null
      lastScanTimeRef.current = 0
      scanLockRef.current = false
      isProcessingRef.current = false
    }
  }, [isScannerActive])

  /**
   * Handles scanner errors with proper categorization
   */
  const handleError = useCallback((message: string, type: ScannerErrorType) => {
    setError(message)
    setErrorType(type)
    setIsProcessing(false)
    isProcessingRef.current = false
    scanLockRef.current = false

    // Haptic feedback for errors
    if (navigator.vibrate) {
      navigator.vibrate([200, 100, 200])
    }
  }, [])

  const clearError = useCallback(() => {
    setError(null)
    setErrorType(null)
  }, [])

  /**
   * Selects the best camera device (prefers rear camera for barcode scanning)
   */
  const selectBestCamera = useCallback(async (): Promise<string | null> => {
    try {
      const videoInputDevices = await BrowserMultiFormatReader.listVideoInputDevices()

      if (videoInputDevices.length === 0) {
        return null
      }

      // Priority 1: Look for rear/back camera
      const rearCamera = videoInputDevices.find(device => {
        const label = device.label.toLowerCase()
        return label.includes('back') ||
               label.includes('rear') ||
               label.includes('trasera') ||
               label.includes('environment') ||
               label.includes('facing back')
      })

      if (rearCamera) {
        console.log('✓ Using rear camera:', rearCamera.label)
        return rearCamera.deviceId
      }

      // Priority 2: Use the last camera (often the main camera on mobile)
      if (videoInputDevices.length > 1) {
        console.log('✓ Using last camera:', videoInputDevices[videoInputDevices.length - 1].label)
        return videoInputDevices[videoInputDevices.length - 1].deviceId
      }

      // Fallback: Use first available camera
      console.log('✓ Using first camera:', videoInputDevices[0].label)
      return videoInputDevices[0].deviceId
    } catch (err) {
      console.error('Error selecting camera:', err)
      return null
    }
  }, [])

  /**
   * Starts the barcode scanner with optimized configuration
   */
  const startScanner = async () => {
    try {
      clearError()
      setIsScannerReady(false)

      // Clean up existing scanner
      if (scannerControlsRef.current) {
        try {
          scannerControlsRef.current.stop()
        } catch (err) {
          console.log('Cleaning previous scanner:', err)
        }
        scannerControlsRef.current = null
      }

      // Configure hints for better accuracy and performance
      const hints = new Map()

      // Specify barcode formats to scan (improves speed and accuracy)
      const formats = [
        BarcodeFormat.EAN_13,      // European Article Number (most common in retail)
        BarcodeFormat.EAN_8,       // Short EAN
        BarcodeFormat.UPC_A,       // Universal Product Code (US/Canada)
        BarcodeFormat.UPC_E,       // Short UPC
        BarcodeFormat.CODE_128,    // Common in logistics
        BarcodeFormat.CODE_39,     // Common in inventory
        BarcodeFormat.CODE_93,     // Extended version of CODE 39
        BarcodeFormat.ITF,         // Interleaved 2 of 5
        BarcodeFormat.CODABAR,     // Used in libraries, blood banks
        BarcodeFormat.QR_CODE,     // QR codes support
        BarcodeFormat.DATA_MATRIX, // Data Matrix codes
      ]
      hints.set(DecodeHintType.POSSIBLE_FORMATS, formats)

      // Enable TRY_HARDER mode for better accuracy (slightly slower but much more accurate)
      hints.set(DecodeHintType.TRY_HARDER, true)

      // Additional optimizations
      hints.set(DecodeHintType.ASSUME_GS1, false) // Disable GS1 unless needed

      // Create reader with optimized hints
      const codeReader = new BrowserMultiFormatReader(hints)
      codeReaderRef.current = codeReader

      // Select best camera
      const selectedDeviceId = await selectBestCamera()

      if (!selectedDeviceId) {
        handleError('No se encontró ninguna cámara disponible', 'camera')
        return
      }

      if (!videoRef.current) {
        handleError('Error al inicializar el video', 'camera')
        return
      }

      // Start decoding with optimized settings
      const controls = await codeReader.decodeFromVideoDevice(
        selectedDeviceId,
        videoRef.current,
        (result, error) => {
          if (result) {
            const decodedText = result.getText()
            const now = Date.now()
            const timeSinceLastScan = now - lastScanTimeRef.current

            // Enhanced duplicate prevention logic
            const isDuplicate = decodedText === lastScannedRef.current &&
                               timeSinceLastScan < SCAN_COOLDOWN_MS

            if (!scanLockRef.current &&
                !isProcessingRef.current &&
                !isDuplicate) {

              // Lock scanning to prevent duplicates
              scanLockRef.current = true
              isProcessingRef.current = true
              lastScanTimeRef.current = now
              lastScannedRef.current = decodedText

              console.log('✓ Barcode detected:', decodedText, 'Format:', result.getBarcodeFormat())
              handleBarcodeScanned(decodedText)
            }
          }

          // Only log errors that are not NotFoundException
          // NotFoundException is normal during scanning (no barcode in frame)
          if (error) {
            const errorName = error.constructor?.name || 'Unknown'
            if (errorName !== 'NotFoundException') {
              console.warn('ZXing scan error:', errorName, error.message)
            }
          }
        }
      )

      // Store scanner controls for cleanup
      scannerControlsRef.current = controls

      setIsScannerReady(true)
      console.log('✓ Scanner ready with optimized @zxing/browser configuration')

    } catch (err: any) {
      console.error('Error starting scanner:', err)
      setIsScannerReady(false)

      const errorMessage = err?.message || ''
      const errorName = err?.name || ''

      // Categorize errors for better user feedback
      if (errorName === 'NotAllowedError' || errorMessage.includes('Permission')) {
        handleError(
          'Se necesitan permisos de cámara para escanear códigos. Por favor, permite el acceso a la cámara en tu navegador.',
          'permission'
        )
      } else if (errorName === 'NotFoundError' || errorMessage.includes('NotFoundError')) {
        handleError(
          'No se encontró ninguna cámara disponible en tu dispositivo.',
          'camera'
        )
      } else if (errorName === 'NotReadableError' || errorMessage.includes('NotReadableError')) {
        handleError(
          'La cámara está siendo utilizada por otra aplicación. Cierra otras apps que usen la cámara.',
          'camera'
        )
      } else if (errorMessage.includes('SSL') || errorMessage.includes('secure')) {
        handleError(
          'La cámara requiere una conexión segura (HTTPS). Asegúrate de estar en una conexión segura.',
          'camera'
        )
      } else {
        handleError(
          'No se pudo iniciar la cámara. Intenta recargar la página o usar otro navegador.',
          'camera'
        )
      }
    }
  }

  /**
   * Stops the scanner and cleans up resources
   */
  const stopScanner = useCallback(() => {
    if (scannerControlsRef.current) {
      try {
        scannerControlsRef.current.stop()
        scannerControlsRef.current = null
        codeReaderRef.current = null
        console.log('✓ Scanner stopped and cleaned up')
      } catch (err) {
        console.error('Error stopping scanner:', err)
        scannerControlsRef.current = null
        codeReaderRef.current = null
      }
    }
  }, [])

  /**
   * Handles a scanned barcode with product lookup and stock increment
   */
  const handleBarcodeScanned = async (barcode: string) => {
    setIsScannerActive(false)
    setIsProcessing(true)
    setScannedCode(barcode)

    // Light haptic feedback for scan
    if (navigator.vibrate) {
      navigator.vibrate(50)
    }

    try {
      // Look up product by barcode
      const result = await findProductByBarcode(barcode)

      if (result.error) {
        handleError(
          'No se pudo buscar el producto. Verifica tu conexión e intenta nuevamente.',
          'network'
        )
        setIsScannerActive(true)
        return
      }

      if (result.data) {
        // Product found - increment stock
        const incrementResult = await incrementProductStock(result.data.id)

        if (incrementResult.error) {
          handleError(
            `No se pudo actualizar el stock de "${result.data.name}". Intenta nuevamente.`,
            'processing'
          )
          setIsScannerActive(true)
        } else {
          // Success! Show notification
          setNotification(`+1 ${result.data.name}`)

          // Success haptic feedback
          if (navigator.vibrate) {
            navigator.vibrate([100, 50, 100])
          }

          if (onStockUpdated) {
            onStockUpdated()
          }

          // Auto-resume scanning after 1 second
          setTimeout(() => {
            setNotification(null)
            setScannedCode(null)
            lastScannedRef.current = null
            scanLockRef.current = false
            isProcessingRef.current = false
            setIsScannerActive(true)
          }, 1000)
        }
      } else {
        // Product not found - allow user to add it
        isProcessingRef.current = false
        scanLockRef.current = false
        lastScannedRef.current = null

        stopScanner()

        setTimeout(() => {
          onProductNotFound(barcode)
        }, 100)
      }
    } catch (err: any) {
      console.error('Error processing barcode:', err)

      const isNetworkError = err?.message?.includes('fetch') ||
                           err?.message?.includes('network') ||
                           !navigator.onLine

      handleError(
        isNetworkError
          ? 'Sin conexión a internet. Verifica tu red e intenta nuevamente.'
          : 'Error inesperado al procesar el código. Intenta nuevamente.',
        isNetworkError ? 'network' : 'processing'
      )
      setIsScannerActive(true)
    }

    setIsProcessing(false)
  }

  const handleClose = () => {
    stopScanner()
    onClose()
  }

  const toggleScanner = () => {
    // Only allow pausing when actively scanning
    if (isScannerReady && isScannerActive && !isProcessing && !notification) {
      setIsScannerActive(false)
    }
  }

  return (
    <div className="fixed inset-0 bg-[linear-gradient(to_bottom_right,#4f46e5,#9333ea,#2563eb)] overflow-y-auto" style={{ zIndex: 60 }}>
      {/* Decorative grid background */}
      <div className="absolute inset-0 opacity-10">
        <div className="grid grid-cols-8 grid-rows-12 h-full w-full">
          {[...Array(96)].map((_, i) => (
            <div key={i} className="border border-white/20 rounded-lg m-1"></div>
          ))}
        </div>
      </div>

      {/* Close button */}
      <button
        onClick={handleClose}
        className="absolute top-6 right-6 p-2 bg-white/90 rounded-full z-10 shadow-lg hover:bg-white transition-all"
        style={{ zIndex: 70 }}
        aria-label="Cerrar escáner"
      >
        <X className="w-6 h-6 text-gray-800" />
      </button>

      {/* Scan frame corners */}
      <div
        onClick={toggleScanner}
        className={`absolute top-[28%] left-1/2 transform -translate-x-1/2 -translate-y-1/2 w-72 h-72 ${isScannerActive && isScannerReady && !isProcessing && !notification ? 'z-20 cursor-pointer' : 'z-10 pointer-events-none'}`}
      >
        <div className="absolute top-0 left-0 w-12 h-12 border-l-4 border-t-4 border-yellow-400 rounded-tl-2xl"></div>
        <div className="absolute top-0 right-0 w-12 h-12 border-r-4 border-t-4 border-yellow-400 rounded-tr-2xl"></div>
        <div className="absolute bottom-0 left-0 w-12 h-12 border-l-4 border-b-4 border-yellow-400 rounded-bl-2xl"></div>
        <div className="absolute bottom-0 right-0 w-12 h-12 border-r-4 border-b-4 border-yellow-400 rounded-br-2xl"></div>
      </div>

      {/* Scanned code display */}
      {scannedCode && !notification && (
        <div className="absolute bottom-32 left-1/2 transform -translate-x-1/2 bg-blue-500 text-white px-6 py-3 rounded-xl z-20 shadow-2xl">
          <p className="text-lg font-bold">{scannedCode}</p>
        </div>
      )}

      {/* Bottom info panel */}
      <div className="absolute bottom-0 left-0 right-0 h-96 bg-white rounded-t-3xl z-10 shadow-2xl">
        <div className="flex flex-col items-center justify-center h-full px-6">
          {isProcessing ? (
            <div className="flex flex-col items-center gap-2">
              <div className="w-8 h-8 border-4 border-indigo-600 border-t-transparent rounded-full animate-spin"></div>
              <p className="text-gray-600 text-center text-sm">Procesando...</p>
            </div>
          ) : notification ? (
            <div className="text-center animate-in fade-in duration-300">
              <p className="text-gray-800 font-bold text-2xl mb-2">{notification}</p>
              <p className="text-green-600 font-semibold text-lg mb-1">Stock actualizado</p>
              <p className="text-gray-500 text-sm">Reactivando escáner...</p>
            </div>
          ) : (
            <div className="text-center">
              <p className="text-gray-600 text-center text-sm mb-2">
                Coloca el código de barras dentro del marco
              </p>
              <p className="text-gray-400 text-xs">
                @zxing/browser | TRY_HARDER | 11 Formatos
              </p>
            </div>
          )}
        </div>
      </div>

      {/* Scanner content area */}
      {isProcessing || notification ? (
        <div className="absolute top-[28%] left-1/2 transform -translate-x-1/2 -translate-y-1/2 w-72 h-72 bg-black/50 backdrop-blur-sm rounded-2xl flex flex-col items-center justify-center gap-4 p-4" style={{ zIndex: 15 }}>
          {notification ? (
            <>
              <div className="animate-in zoom-in duration-300">
                <CiCircleCheck className="w-16 h-16 text-green-400 animate-pulse" strokeWidth={1} />
              </div>
              <span className="text-white text-lg font-semibold tracking-wide animate-in fade-in duration-500">¡Agregado!</span>
            </>
          ) : (
            <>
              <div className="w-16 h-16 border-4 border-yellow-400 border-t-transparent rounded-full animate-spin"></div>
              <span className="text-white text-lg font-semibold tracking-wide">Verificando...</span>
            </>
          )}
        </div>
      ) : isScannerActive ? (
        <div className="absolute top-[28%] left-1/2 transform -translate-x-1/2 -translate-y-1/2 w-72 h-72 overflow-hidden rounded-2xl" style={{ zIndex: 15 }}>
          <video
            ref={videoRef}
            className="w-full h-full object-cover"
            playsInline
            autoPlay
            muted
          />
        </div>
      ) : isScannerReady ? (
        <div
          onClick={() => setIsScannerActive(true)}
          className="absolute top-[28%] left-1/2 transform -translate-x-1/2 -translate-y-1/2 w-72 h-72 bg-black/50 backdrop-blur-sm rounded-2xl flex items-center justify-center p-4 cursor-pointer hover:bg-black/60 transition-all"
          style={{ zIndex: 15 }}
        >
          <div className="relative flex items-center justify-center">
            <img
              src="/imagen/scanner.png"
              alt="QR Scanner"
              className="w-56 h-56 object-contain opacity-20"
            />
            <span className="absolute text-white text-xl font-bold tracking-wider">TAP TO SCAN</span>
          </div>
        </div>
      ) : (
        <div className="absolute top-[28%] left-1/2 transform -translate-x-1/2 -translate-y-1/2 w-72 h-72 bg-black/50 backdrop-blur-sm rounded-2xl flex flex-col items-center justify-center gap-4 p-4" style={{ zIndex: 15 }}>
          <div className="w-12 h-12 border-4 border-yellow-400 border-t-transparent rounded-full animate-spin"></div>
          <span className="text-white text-sm font-medium tracking-wide">Iniciando cámara...</span>
        </div>
      )}

      {/* Error modal */}
      {error && (
        <div className="absolute inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center p-4 z-30">
          <div className="bg-white rounded-2xl shadow-2xl max-w-sm w-full mx-4 overflow-hidden animate-in fade-in zoom-in duration-200">
            <div className={`p-6 ${
              errorType === 'camera' ? 'bg-orange-50' :
              errorType === 'permission' ? 'bg-yellow-50' :
              errorType === 'network' ? 'bg-blue-50' :
              'bg-red-50'
            }`}>
              <div className="flex items-center justify-center mb-3">
                <div className={`w-16 h-16 rounded-full flex items-center justify-center ${
                  errorType === 'camera' ? 'bg-orange-100' :
                  errorType === 'permission' ? 'bg-yellow-100' :
                  errorType === 'network' ? 'bg-blue-100' :
                  'bg-red-100'
                }`}>
                  {errorType === 'camera' ? (
                    <svg className="w-8 h-8 text-orange-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 10l4.553-2.276A1 1 0 0121 8.618v6.764a1 1 0 01-1.447.894L15 14M5 18h8a2 2 0 002-2V8a2 2 0 00-2-2H5a2 2 0 00-2 2v8a2 2 0 002 2z" />
                    </svg>
                  ) : errorType === 'permission' ? (
                    <svg className="w-8 h-8 text-yellow-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z" />
                    </svg>
                  ) : errorType === 'network' ? (
                    <svg className="w-8 h-8 text-blue-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8.111 16.404a5.5 5.5 0 017.778 0M12 20h.01m-7.08-7.071c3.904-3.905 10.236-3.905 14.141 0M1.394 9.393c5.857-5.857 15.355-5.857 21.213 0" />
                    </svg>
                  ) : (
                    <AlertCircle className="w-8 h-8 text-red-600" />
                  )}
                </div>
              </div>
              <h3 className={`text-xl font-bold text-center mb-2 ${
                errorType === 'camera' ? 'text-orange-900' :
                errorType === 'permission' ? 'text-yellow-900' :
                errorType === 'network' ? 'text-blue-900' :
                'text-red-900'
              }`}>
                {errorType === 'camera' ? 'Error de Cámara' :
                 errorType === 'permission' ? 'Permisos Requeridos' :
                 errorType === 'network' ? 'Sin Conexión' :
                 'Error al Procesar'}
              </h3>
            </div>

            <div className="p-6">
              <p className="text-gray-700 text-center mb-6 leading-relaxed">
                {error}
              </p>

              <div className="flex flex-col gap-3">
                <button
                  onClick={() => {
                    clearError()
                    setIsProcessing(false)
                    lastScannedRef.current = null
                    scanLockRef.current = false
                    isProcessingRef.current = false
                    setIsScannerActive(true)
                  }}
                  className={`w-full px-4 py-3 text-white rounded-xl font-semibold transition-all active:scale-95 ${
                    errorType === 'camera' ? 'bg-orange-600 hover:bg-orange-700' :
                    errorType === 'permission' ? 'bg-yellow-600 hover:bg-yellow-700' :
                    errorType === 'network' ? 'bg-blue-600 hover:bg-blue-700' :
                    'bg-red-600 hover:bg-red-700'
                  }`}
                >
                  {errorType === 'permission' ? 'Conceder Permisos' : 'Reintentar'}
                </button>

                <button
                  onClick={handleClose}
                  className="w-full px-4 py-3 bg-gray-100 text-gray-700 rounded-xl font-semibold hover:bg-gray-200 transition-all active:scale-95"
                >
                  Cerrar Escáner
                </button>
              </div>

              {errorType === 'permission' && (
                <div className="mt-4 p-3 bg-yellow-50 border border-yellow-200 rounded-lg">
                  <p className="text-xs text-yellow-800 text-center">
                    Ve a la configuración de tu navegador y permite el acceso a la cámara
                  </p>
                </div>
              )}
              {errorType === 'network' && (
                <div className="mt-4 p-3 bg-blue-50 border border-blue-200 rounded-lg">
                  <p className="text-xs text-blue-800 text-center">
                    Verifica tu conexión WiFi o datos móviles
                  </p>
                </div>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
