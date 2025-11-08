'use client'

import { X, ScanBarcode, Check } from 'lucide-react'
import { useEffect, useRef, useState } from 'react'

interface BarcodeScannerModalProps {
  onClose: () => void
  onProductNotFound?: (barcode: string) => void
  onStockUpdated?: () => void
}

export default function BarcodeScannerModal({ onClose, onProductNotFound, onStockUpdated }: BarcodeScannerModalProps) {
  const scannerRef = useRef<HTMLDivElement>(null)
  const [scannedCode, setScannedCode] = useState<string>('')
  const [isScanning, setIsScanning] = useState(false)
  const [isCameraReady, setIsCameraReady] = useState(false)
  const [isProcessing, setIsProcessing] = useState(false)
  const [message, setMessage] = useState<{ type: 'success' | 'error' | 'info', text: string } | null>(null)
  const html5QrCodeRef = useRef<any>(null)
  const scanTimeoutRef = useRef<NodeJS.Timeout | null>(null)
  const isScanningRef = useRef<boolean>(false)

  useEffect(() => {
    let isMounted = true

    const initScanner = async () => {
      try {
        // Importar html5-qrcode dinámicamente
        const { Html5Qrcode } = await import('html5-qrcode')
        
        if (!isMounted || !scannerRef.current) return

        const html5QrCode = new Html5Qrcode('reader')
        html5QrCodeRef.current = html5QrCode

        const config = {
          fps: 30,
          qrbox: { width: 280, height: 280 },
          aspectRatio: 1.0,
          disableFlip: false,
          formatsToSupport: [
            0,  // QR_CODE
            1,  // AZTEC
            2,  // CODABAR
            3,  // CODE_39
            4,  // CODE_93
            5,  // CODE_128
            6,  // DATA_MATRIX
            7,  // MAXICODE
            8,  // ITF
            9,  // EAN_13
            10, // EAN_8
            11, // PDF_417
            12, // RSS_14
            13, // RSS_EXPANDED
            14, // UPC_A
            15, // UPC_E
            16, // UPC_EAN_EXTENSION
          ],
        }

        const qrCodeSuccessCallback = async (decodedText: string) => {
          // Usar ref en lugar de state para tener el valor actualizado
          if (!isScanningRef.current) return
          
          // Cancelar el timeout de 2 segundos ya que se escaneó un código
          if (scanTimeoutRef.current) {
            clearTimeout(scanTimeoutRef.current)
            scanTimeoutRef.current = null
          }
          
          setScannedCode(decodedText)
          setIsScanning(false)
          isScanningRef.current = false
          
          // Vibración si está disponible
          if (navigator.vibrate) {
            navigator.vibrate(200)
          }

          console.log('Código escaneado:', decodedText)
          
          // Procesar el código escaneado
          await handleBarcodeScanned(decodedText)
        }

        await html5QrCode.start(
          { facingMode: 'environment' },
          config,
          qrCodeSuccessCallback,
          undefined
        )

        setIsCameraReady(true)
      } catch (err) {
        console.error('Error iniciando escáner:', err)
      }
    }

    initScanner()

    return () => {
      isMounted = false
      if (scanTimeoutRef.current) {
        clearTimeout(scanTimeoutRef.current)
      }
      if (html5QrCodeRef.current) {
        html5QrCodeRef.current.stop().catch((err: any) => {
          console.error('Error deteniendo escáner:', err)
        })
      }
    }
  }, [])

  const handleBarcodeScanned = async (barcode: string) => {
    setIsProcessing(true)
    setMessage(null)

    try {
      // Importar las funciones necesarias
      const { findProductByBarcode, incrementProductStock } = await import('@/app/actions/products')
      
      // Buscar el producto por código de barras
      const result = await findProductByBarcode(barcode)
      
      if ('error' in result) {
        throw new Error(result.error)
      }

      if (result.data) {
        // Producto encontrado - Incrementar stock
        const product = result.data
        const incrementResult = await incrementProductStock(product.id)

        if ('error' in incrementResult) {
          throw new Error(incrementResult.error)
        }

        const updatedProduct = incrementResult.data
        
        setMessage({
          type: 'success',
          text: `✓ Stock actualizado: ${product.name} (${product.stock_quantity} → ${updatedProduct.stock_quantity})`
        })
        
        // Vibración de éxito
        if (navigator.vibrate) {
          navigator.vibrate([100, 50, 100])
        }

        // Notificar que el stock fue actualizado
        if (onStockUpdated) {
          onStockUpdated()
        }

        // Limpiar después de 3 segundos
        setTimeout(() => {
          setScannedCode('')
          setMessage(null)
        }, 3000)
      } else {
        // Producto no encontrado - Abrir formulario
        setMessage({
          type: 'info',
          text: '⚠ Producto no encontrado. Abriendo formulario...'
        })

        setTimeout(() => {
          if (onProductNotFound) {
            onProductNotFound(barcode)
          }
        }, 1500)
      }
    } catch (error) {
      console.error('Error procesando código:', error)
      setMessage({
        type: 'error',
        text: '✗ Error al procesar el código. Intenta nuevamente.'
      })

      setTimeout(() => {
        setScannedCode('')
        setMessage(null)
      }, 3000)
    } finally {
      setIsProcessing(false)
    }
  }

  const handleClose = () => {
    if (scanTimeoutRef.current) {
      clearTimeout(scanTimeoutRef.current)
    }
    if (html5QrCodeRef.current) {
      html5QrCodeRef.current.stop().then(() => {
        onClose()
      }).catch((err: any) => {
        console.error('Error al cerrar:', err)
        onClose()
      })
    } else {
      onClose()
    }
  }

  const handleScan = () => {
    setIsScanning(true)
    isScanningRef.current = true
    setScannedCode('')
    setMessage(null)
    
    // Timeout de 2 segundos: si no se escanea nada, apagar el escaneo
    scanTimeoutRef.current = setTimeout(() => {
      setIsScanning(false)
      isScanningRef.current = false
      scanTimeoutRef.current = null
    }, 2000) // 2 segundos
  }

  return (
    <div 
      className="fixed inset-0 overflow-y-auto" 
      style={{ 
        zIndex: 60,
        background: 'linear-gradient(to bottom right, rgb(79, 70, 229), rgb(147, 51, 234), rgb(37, 99, 235))'
      }}
    >
      {/* Patrón de fondo decorativo */}
      <div className="absolute inset-0 opacity-10">
        <div className="grid grid-cols-8 grid-rows-12 h-full w-full">
          {[...Array(96)].map((_, i) => (
            <div key={i} className="border border-white/20 rounded-lg m-1"></div>
          ))}
        </div>
      </div>

      {/* Botón cerrar */}
      <button
        onClick={handleClose}
        className="absolute top-6 right-6 p-2 bg-white/90 rounded-full z-10 shadow-lg hover:bg-white transition-all"
        style={{ zIndex: 70 }}
      >
        <X className="w-6 h-6 text-gray-800" />
      </button>

      {/* Área del escáner */}
      <div className="absolute top-[28%] left-1/2 transform -translate-x-1/2 -translate-y-1/2 w-72 h-72 z-20">
        <div 
          id="reader" 
          ref={scannerRef}
          className="w-full h-full rounded-2xl overflow-hidden"
        ></div>
      </div>

      {/* Marco del escáner - Esquinas amarillas */}
      <div className="absolute top-[28%] left-1/2 transform -translate-x-1/2 -translate-y-1/2 w-72 h-72 z-30 pointer-events-none">
        <div className="absolute top-0 left-0 w-12 h-12 border-l-4 border-t-4 border-yellow-400 rounded-tl-2xl"></div>
        <div className="absolute top-0 right-0 w-12 h-12 border-r-4 border-t-4 border-yellow-400 rounded-tr-2xl"></div>
        <div className="absolute bottom-0 left-0 w-12 h-12 border-l-4 border-b-4 border-yellow-400 rounded-bl-2xl"></div>
        <div className="absolute bottom-0 right-0 w-12 h-12 border-r-4 border-b-4 border-yellow-400 rounded-br-2xl"></div>
      </div>

      {/* Indicador de escaneo activo */}
      {isScanning && (
        <div className="absolute top-[28%] left-1/2 transform -translate-x-1/2 -translate-y-1/2 w-72 h-72 z-25 pointer-events-none">
          <div className="absolute inset-0 border-4 border-green-400 rounded-2xl animate-pulse"></div>
        </div>
      )}

      {/* Panel inferior blanco */}
      <div className="absolute bottom-0 left-0 right-0 h-96 bg-white rounded-t-3xl z-10 shadow-2xl">
        <div className="flex flex-col items-center justify-center h-full px-6">
          {!isCameraReady ? (
            <div className="text-center">
              <div className="w-16 h-16 border-4 border-indigo-600 border-t-transparent rounded-full animate-spin mx-auto mb-4"></div>
              <p className="text-gray-600 text-sm">Iniciando cámara...</p>
            </div>
          ) : (
            <>
              {/* Código escaneado o mensaje */}
              {scannedCode ? (
                <div className={`border-2 rounded-xl p-6 w-full max-w-sm mb-6 ${
                  message?.type === 'success' ? 'bg-green-50 border-green-500' :
                  message?.type === 'error' ? 'bg-red-50 border-red-500' :
                  message?.type === 'info' ? 'bg-blue-50 border-blue-500' :
                  'bg-green-50 border-green-500'
                }`}>
                  {isProcessing ? (
                    <div className="text-center">
                      <div className="w-8 h-8 border-3 border-gray-600 border-t-transparent rounded-full animate-spin mx-auto mb-2"></div>
                      <p className="text-gray-700 text-sm font-medium">Procesando...</p>
                    </div>
                  ) : message ? (
                    <>
                      <p className={`text-xs font-semibold mb-2 text-center ${
                        message.type === 'success' ? 'text-green-700' :
                        message.type === 'error' ? 'text-red-700' :
                        'text-blue-700'
                      }`}>
                        {message.text}
                      </p>
                      <p className="text-gray-900 text-xl font-bold text-center tracking-wider break-all">
                        {scannedCode}
                      </p>
                    </>
                  ) : (
                    <>
                      <p className="text-green-700 text-xs font-semibold mb-2 text-center">
                        ✓ CÓDIGO ESCANEADO
                      </p>
                      <p className="text-gray-900 text-2xl font-bold text-center tracking-wider break-all">
                        {scannedCode}
                      </p>
                    </>
                  )}
                </div>
              ) : (
                <div className="bg-gray-50 border-2 border-gray-200 rounded-xl p-6 w-full max-w-sm mb-6">
                  <p className="text-gray-400 text-center text-sm">
                    {isScanning ? 'Escaneando...' : 'Presiona el botón para escanear'}
                  </p>
                </div>
              )}

              <p className="text-gray-400 text-xs mt-6">
                {scannedCode ? 'Toca el botón para escanear otro código' : 'FPS: 30 | Alta Precisión | Todos los formatos'}
              </p>
            </>
          )}
        </div>
      </div>

      {/* Botón de escaneo flotante - Misma posición que en page.tsx */}
      {isCameraReady && (
        <button
          onClick={handleScan}
          disabled={isScanning || isProcessing}
          className={`fixed w-16 h-16 rounded-2xl shadow-2xl transition-all flex items-center justify-center z-40 active:scale-95 ${
            isScanning || isProcessing
              ? 'bg-gray-400 cursor-not-allowed'
              : 'bg-black text-white hover:bg-gray-900'
          }`}
          style={{ 
            bottom: '6rem',
            right: '1.5rem'
          }}
          aria-label={scannedCode ? 'Escanear nuevo código' : 'Escanear código'}
        >
          <ScanBarcode className="w-8 h-8 text-white" strokeWidth={2.5} />
        </button>
      )}
    </div>
  )
}