'use client'

import { useEffect, useRef, useState } from 'react'
import { BrowserMultiFormatReader, NotFoundException } from '@zxing/library'
import { X, AlertCircle } from 'lucide-react'
import { CiCircleCheck } from 'react-icons/ci'
import { findProductByBarcode, incrementProductStock } from '@/app/actions/products'

interface BarcodeScannerModalProps {
  onClose: () => void
  onProductNotFound: (barcode: string) => void
  onStockUpdated?: () => void
}

type ErrorType = 'camera' | 'network' | 'processing' | 'permission' | null

export default function BarcodeScannerModalZXing({ onClose, onProductNotFound, onStockUpdated }: BarcodeScannerModalProps) {
  const [error, setError] = useState<string | null>(null)
  const [errorType, setErrorType] = useState<ErrorType>(null)
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
  const SCAN_COOLDOWN_MS = 500

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

  const handleError = (message: string, type: ErrorType) => {
    setError(message)
    setErrorType(type)
    setIsProcessing(false)
    isProcessingRef.current = false
    scanLockRef.current = false

    if (navigator.vibrate) {
      navigator.vibrate([200, 100, 200])
    }
  }

  const clearError = () => {
    setError(null)
    setErrorType(null)
  }

  const startScanner = async () => {
    try {
      clearError()
      setIsScannerReady(false)

      // Detener y limpiar el escáner anterior si existe
      if (codeReaderRef.current) {
        try {
          codeReaderRef.current.reset()
        } catch (err) {
          console.log('Limpiando escáner anterior:', err)
        }
        codeReaderRef.current = null
      }

      const codeReader = new BrowserMultiFormatReader()
      codeReaderRef.current = codeReader

      // Obtener dispositivos de video
      const videoInputDevices = await codeReader.listVideoInputDevices()

      if (videoInputDevices.length === 0) {
        handleError('No se encontró ninguna cámara disponible', 'camera')
        return
      }

      // Buscar cámara trasera
      const backCamera = videoInputDevices.find(device =>
        device.label.toLowerCase().includes('back') ||
        device.label.toLowerCase().includes('rear') ||
        device.label.toLowerCase().includes('trasera')
      )

      const selectedDeviceId = backCamera?.deviceId || videoInputDevices[0].deviceId

      if (videoRef.current) {
        await codeReader.decodeFromVideoDevice(
          selectedDeviceId,
          videoRef.current,
          (result, error) => {
            if (result) {
              const decodedText = result.getText()
              const now = Date.now()
              const timeSinceLastScan = now - lastScanTimeRef.current

              if (
                !scanLockRef.current &&
                !isProcessingRef.current &&
                timeSinceLastScan >= SCAN_COOLDOWN_MS &&
                decodedText !== lastScannedRef.current
              ) {
                scanLockRef.current = true
                isProcessingRef.current = true
                lastScanTimeRef.current = now
                handleBarcodeScanned(decodedText)
              }
            }

            // Ignorar errores de NotFoundException (normal durante el escaneo)
            if (error && !(error instanceof NotFoundException)) {
              console.error('ZXing scan error:', error)
            }
          }
        )

        setIsScannerReady(true)
      }
    } catch (err: any) {
      console.error('Error al iniciar escáner:', err)
      setIsScannerReady(false)

      const errorMessage = err?.message || ''
      const errorName = err?.name || ''

      if (errorName === 'NotAllowedError' || errorMessage.includes('Permission')) {
        handleError('Se necesitan permisos de cámara para escanear códigos', 'permission')
      } else if (errorName === 'NotFoundError' || errorMessage.includes('NotFoundError')) {
        handleError('No se encontró ninguna cámara disponible', 'camera')
      } else {
        handleError('No se pudo iniciar la cámara. Intenta recargar la página.', 'camera')
      }
    }
  }

  const stopScanner = () => {
    if (codeReaderRef.current) {
      try {
        codeReaderRef.current.reset()
        codeReaderRef.current = null
      } catch (err) {
        console.error('Error al detener escáner:', err)
        // Forzar limpieza incluso si hay error
        codeReaderRef.current = null
      }
    }
  }

  const handleBarcodeScanned = async (barcode: string) => {
    setIsScannerActive(false)
    setIsProcessing(true)
    setScannedCode(barcode)
    lastScannedRef.current = barcode

    if (navigator.vibrate) navigator.vibrate(50)

    try {
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
        const incrementResult = await incrementProductStock(result.data.id)

        if (incrementResult.error) {
          handleError(
            `No se pudo actualizar el stock de "${result.data.name}". Intenta nuevamente.`,
            'processing'
          )
          setIsScannerActive(true)
        } else {
          setNotification(`+1 ${result.data.name}`)

          if (navigator.vibrate) navigator.vibrate([100, 50, 100])

          if (onStockUpdated) {
            onStockUpdated()
          }

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
        isProcessingRef.current = false
        scanLockRef.current = false
        lastScannedRef.current = null

        stopScanner()

        setTimeout(() => {
          onProductNotFound(barcode)
        }, 100)
      }
    } catch (err: any) {
      console.error('Error al procesar código:', err)

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
    // Solo permitir pausar cuando está activamente escaneando
    // No permitir si está procesando, mostrando notificación, o ya está pausado
    if (isScannerReady && isScannerActive && !isProcessing && !notification) {
      setIsScannerActive(false)
    }
  }

  return (
    <div className="fixed inset-0 bg-[linear-gradient(to_bottom_right,#4f46e5,#9333ea,#2563eb)] overflow-y-auto" style={{ zIndex: 60 }}>
      <div className="absolute inset-0 opacity-10">
        <div className="grid grid-cols-8 grid-rows-12 h-full w-full">
          {[...Array(96)].map((_, i) => (
            <div key={i} className="border border-white/20 rounded-lg m-1"></div>
          ))}
        </div>
      </div>

      <button
        onClick={handleClose}
        className="absolute top-6 right-6 p-2 bg-white/90 rounded-full z-10 shadow-lg hover:bg-white transition-all"
        style={{ zIndex: 70 }}
      >
        <X className="w-6 h-6 text-gray-800" />
      </button>

      <div
        onClick={toggleScanner}
        className="absolute top-[28%] left-1/2 transform -translate-x-1/2 -translate-y-1/2 w-72 h-72 z-20 cursor-pointer"
      >
        <div className="absolute top-0 left-0 w-12 h-12 border-l-4 border-t-4 border-yellow-400 rounded-tl-2xl"></div>
        <div className="absolute top-0 right-0 w-12 h-12 border-r-4 border-t-4 border-yellow-400 rounded-tr-2xl"></div>
        <div className="absolute bottom-0 left-0 w-12 h-12 border-l-4 border-b-4 border-yellow-400 rounded-bl-2xl"></div>
        <div className="absolute bottom-0 right-0 w-12 h-12 border-r-4 border-b-4 border-yellow-400 rounded-br-2xl"></div>
      </div>

      {scannedCode && !notification && (
        <div className="absolute bottom-32 left-1/2 transform -translate-x-1/2 bg-blue-500 text-white px-6 py-3 rounded-xl z-20 shadow-2xl">
          <p className="text-lg font-bold">{scannedCode}</p>
        </div>
      )}

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
                ZXing Scanner | Alta Precisión
              </p>
            </div>
          )}
        </div>
      </div>

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
        <div className="absolute top-[28%] left-1/2 transform -translate-x-1/2 -translate-y-1/2 w-72 h-72 bg-black/50 backdrop-blur-sm rounded-2xl flex items-center justify-center p-4" style={{ zIndex: 15 }}>
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
