'use client'

import { X } from 'lucide-react'
import { useEffect, useRef, useState } from 'react'

interface BarcodeScannerModalProps {
  onClose: () => void
  onProductNotFound?: (barcode: string) => void
  onStockUpdated?: () => void
}

interface ScannedProduct {
  id: string
  name: string
  barcode: string
  timestamp: Date
  stockBefore: number
  stockAfter: number
}

export default function BarcodeScannerModal({ onClose, onProductNotFound, onStockUpdated }: BarcodeScannerModalProps) {
  const scannerRef = useRef<HTMLDivElement>(null)
  const [scannedCode, setScannedCode] = useState<string>('')
  const [isCameraReady, setIsCameraReady] = useState(false)
  const [isProcessing, setIsProcessing] = useState(false)
  const [message, setMessage] = useState<{ type: 'success' | 'error' | 'info', text: string } | null>(null)
  const [scanHistory, setScanHistory] = useState<ScannedProduct[]>([])
  const html5QrCodeRef = useRef<any>(null)
  const isProcessingRef = useRef<boolean>(false)
  const lastScanTimeRef = useRef<number>(0)
  const scanCountRef = useRef<number>(0)

  useEffect(() => {
    let isMounted = true

    const initScanner = async () => {
      try {
        const { Html5Qrcode } = await import('html5-qrcode')
        
        if (!isMounted || !scannerRef.current) return

        const html5QrCode = new Html5Qrcode('reader')
        html5QrCodeRef.current = html5QrCode

        const config = {
          fps: 30,
          qrbox: { width: 250, height: 250 },
          aspectRatio: 1.0,
          disableFlip: false,
          formatsToSupport: [
            0, 1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12, 13, 14, 15, 16
          ],
        }

        const qrCodeSuccessCallback = async (decodedText: string) => {
          if (isProcessingRef.current) return
          
          const now = Date.now()
          if (now - lastScanTimeRef.current < 1000) {
            console.log('Cooldown activo, esperando...')
            return
          }
          lastScanTimeRef.current = now
          
          isProcessingRef.current = true
          scanCountRef.current += 1
          setScannedCode(decodedText)
          
          if (navigator.vibrate) {
            navigator.vibrate(200)
          }

          console.log(`Código escaneado #${scanCountRef.current}:`, decodedText)
          
          await handleBarcodeScanned(decodedText)
          
          setTimeout(() => {
            isProcessingRef.current = false
            setScannedCode('')
            setMessage(null)
          }, 800)
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
      isProcessingRef.current = false
      lastScanTimeRef.current = 0
      scanCountRef.current = 0
      
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
      const { findProductByBarcode, incrementProductStock } = await import('@/app/actions/products')

      const findResult = await findProductByBarcode(barcode)

      if (findResult.error) {
        console.error('❌ Error buscando producto:', findResult.error)
        setMessage({
          type: 'error',
          text: `✗ Error: ${findResult.error}`
        })
        return
      }

      if (findResult.data) {
        const stockBefore = findResult.data.stock_quantity
        
        const updateResult = await incrementProductStock(findResult.data.id)

        if (updateResult.error) {
          console.error('❌ Error actualizando stock:', updateResult.error)
          setMessage({
            type: 'error',
            text: `✗ Error actualizando: ${updateResult.error}`
          })
          return
        }

        const stockAfter = updateResult.data?.stock_quantity || stockBefore + 1

        // Agregar al historial
        setScanHistory(prev => [{
          id: findResult.data.id,
          name: findResult.data.name,
          barcode: barcode,
          timestamp: new Date(),
          stockBefore: stockBefore,
          stockAfter: stockAfter
        }, ...prev])

        setMessage({
          type: 'success',
          text: `✓ Stock actualizado: ${updateResult.data?.name || findResult.data.name}`
        })

        if (navigator.vibrate) {
          navigator.vibrate([100, 50, 100])
        }

        if (onStockUpdated) {
          onStockUpdated()
        }
      } else {
        setMessage({
          type: 'info',
          text: '⚠ Producto no encontrado. Abriendo formulario...'
        })

        setTimeout(() => {
          if (onProductNotFound) {
            onProductNotFound(barcode)
          }
        }, 800)
      }
    } catch (error) {
      console.error('Error procesando código:', error)
      setMessage({
        type: 'error',
        text: '✗ Error al procesar el código. Intenta nuevamente.'
      })
    } finally {
      setIsProcessing(false)
    }
  }

  const handleClose = async () => {
    isProcessingRef.current = false
    lastScanTimeRef.current = 0
    scanCountRef.current = 0

    if (scanCountRef.current > 0) {
      try {
        const { revalidateInventory } = await import('@/app/actions/products')
        await revalidateInventory()
      } catch (err) {
        console.error('Error revalidando inventario:', err)
      }
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
        <div className="grid grid-cols-4 sm:grid-cols-6 md:grid-cols-8 grid-rows-8 sm:grid-rows-10 md:grid-rows-12 h-full w-full">
          {[...Array(96)].map((_, i) => (
            <div key={i} className="border border-white/20 rounded-lg m-0.5 sm:m-1"></div>
          ))}
        </div>
      </div>

      {/* Botón cerrar */}
      <button
        onClick={handleClose}
        className="absolute top-4 right-4 sm:top-6 sm:right-6 p-1.5 sm:p-2 bg-white/90 rounded-full z-10 shadow-lg hover:bg-white transition-all"
        style={{ zIndex: 70 }}
      >
        <X className="w-5 h-5 sm:w-6 sm:h-6 text-gray-800" />
      </button>

      {/* Área del escáner - Responsive */}
      <div className="absolute top-[20%] sm:top-[25%] md:top-[28%] left-1/2 transform -translate-x-1/2 -translate-y-1/2 w-64 h-64 sm:w-72 sm:h-72 md:w-80 md:h-80 z-20">
        <div 
          id="reader" 
          ref={scannerRef}
          className="w-full h-full rounded-2xl overflow-hidden"
        ></div>
      </div>

      {/* Marco del escáner - Esquinas amarillas responsive */}
      <div className="absolute top-[20%] sm:top-[25%] md:top-[28%] left-1/2 transform -translate-x-1/2 -translate-y-1/2 w-64 h-64 sm:w-72 sm:h-72 md:w-80 md:h-80 z-30 pointer-events-none">
        <div className="absolute top-0 left-0 w-10 h-10 sm:w-12 sm:h-12 border-l-3 border-t-3 sm:border-l-4 sm:border-t-4 border-yellow-400 rounded-tl-2xl"></div>
        <div className="absolute top-0 right-0 w-10 h-10 sm:w-12 sm:h-12 border-r-3 border-t-3 sm:border-r-4 sm:border-t-4 border-yellow-400 rounded-tr-2xl"></div>
        <div className="absolute bottom-0 left-0 w-10 h-10 sm:w-12 sm:h-12 border-l-3 border-b-3 sm:border-l-4 sm:border-b-4 border-yellow-400 rounded-bl-2xl"></div>
        <div className="absolute bottom-0 right-0 w-10 h-10 sm:w-12 sm:h-12 border-r-3 border-b-3 sm:border-r-4 sm:border-b-4 border-yellow-400 rounded-br-2xl"></div>
      </div>

      {/* Panel inferior blanco con Historial */}
      <div className="absolute bottom-0 left-0 right-0 h-[55vh] sm:h-96 md:h-96 bg-white rounded-t-3xl z-10 shadow-2xl">
        <div className="flex flex-col h-full px-4 sm:px-6 py-4">
          {/* Mensaje de escaneo actual */}
          {isCameraReady && scannedCode && (
            <div className={`border-2 rounded-xl p-3 sm:p-4 w-full mb-4 ${
              message?.type === 'success' ? 'bg-green-50 border-green-500' :
              message?.type === 'error' ? 'bg-red-50 border-red-500' :
              message?.type === 'info' ? 'bg-blue-50 border-blue-500' :
              'bg-green-50 border-green-500'
            }`}>
              {isProcessing ? (
                <div className="text-center">
                  <div className="w-6 h-6 sm:w-7 sm:h-7 border-3 border-gray-600 border-t-transparent rounded-full animate-spin mx-auto mb-2"></div>
                  <p className="text-gray-700 text-xs sm:text-sm font-medium">Procesando...</p>
                </div>
              ) : message ? (
                <>
                  <p className={`text-xs font-semibold mb-1 text-center ${
                    message.type === 'success' ? 'text-green-700' :
                    message.type === 'error' ? 'text-red-700' :
                    'text-blue-700'
                  }`}>
                    {message.text}
                  </p>
                  <p className="text-gray-900 text-sm sm:text-base font-bold text-center tracking-wider break-all">
                    {scannedCode}
                  </p>
                </>
              ) : null}
            </div>
          )}

          {/* Historial */}
          <div className="flex-1 overflow-hidden flex flex-col">
            <h3 className="text-lg sm:text-xl font-bold text-gray-900 mb-3 flex items-center justify-between">
              Historial
              {scanHistory.length > 0 && (
                <span className="text-sm font-normal text-gray-500">
                  {scanHistory.length} {scanHistory.length === 1 ? 'producto' : 'productos'}
                </span>
              )}
            </h3>
            
            {scanHistory.length === 0 ? (
              <div className="flex-1 flex items-center justify-center text-gray-400">
                <div className="text-center">
                  <svg className="w-16 h-16 mx-auto mb-2 opacity-50" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2" />
                  </svg>
                  <p className="text-sm">No hay productos escaneados</p>
                </div>
              </div>
            ) : (
              <div className="flex-1 overflow-y-auto space-y-2 pr-2">
                {scanHistory.map((item, index) => (
                  <div 
                    key={`${item.id}-${index}`}
                    className="bg-gray-50 rounded-lg p-3 border border-gray-200 hover:bg-gray-100 transition-colors"
                  >
                    <div className="flex items-start justify-between mb-1">
                      <h4 className="font-semibold text-gray-900 text-sm">{item.name}</h4>
                      <span className="text-xs text-gray-500">
                        {item.timestamp.toLocaleTimeString('es-CO', { 
                          hour: '2-digit', 
                          minute: '2-digit',
                          second: '2-digit'
                        })}
                      </span>
                    </div>
                    <p className="text-xs text-gray-600 mb-2 font-mono">{item.barcode}</p>
                    <div className="flex items-center gap-2 text-xs">
                      <span className="text-gray-600">Stock:</span>
                      <span className="font-semibold text-gray-700">{item.stockBefore}</span>
                      <svg className="w-3 h-3 text-green-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 7l5 5m0 0l-5 5m5-5H6" />
                      </svg>
                      <span className="font-bold text-green-600">{item.stockAfter}</span>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  )
}