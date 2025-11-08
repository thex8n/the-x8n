'use client'

import { X, ScrollText, ClipboardClock } from 'lucide-react'
import { useEffect, useRef, useState } from 'react'

interface BarcodeScannerModalProps {
  onClose: () => void
  onProductNotFound?: (barcode: string) => void
  onStockUpdated?: () => void
  initialHistory?: ScannedProduct[]
  isPaused?: boolean
}

interface ScannedProduct {
  id: string
  name: string
  barcode: string
  timestamp: Date
  stockBefore: number
  stockAfter: number
}

export default function BarcodeScannerModal({ onClose, onProductNotFound, onStockUpdated, initialHistory = [], isPaused = false }: BarcodeScannerModalProps) {
  const scannerRef = useRef<HTMLDivElement>(null)
  const [scannedCode, setScannedCode] = useState<string>('')
  const [isCameraReady, setIsCameraReady] = useState(false)
  const [isProcessing, setIsProcessing] = useState(false)
  const [message, setMessage] = useState<{ type: 'success' | 'error' | 'info', text: string } | null>(null)
  const [scanHistory, setScanHistory] = useState<ScannedProduct[]>(initialHistory)
  const [showConfirmClose, setShowConfirmClose] = useState(false)
  const [isManuallyLocked, setIsManuallyLocked] = useState(true) // Iniciar bloqueado por seguridad
  const [scanSuccess, setScanSuccess] = useState(false) // Para animación de bordes verdes
  const [scannedProductIds, setScannedProductIds] = useState<Set<string>>(new Set()) // IDs únicos de productos escaneados
  const [newProductBarcodes, setNewProductBarcodes] = useState<Set<string>>(new Set()) // Barcodes únicos de productos nuevos
  const html5QrCodeRef = useRef<any>(null)
  const isProcessingRef = useRef<boolean>(false)
  const lastScanTimeRef = useRef<number>(0)
  const scanCountRef = useRef<number>(0)
  const isPausedRef = useRef<boolean>(isPaused)
  const isManuallyLockedRef = useRef<boolean>(true) // Iniciar bloqueado por seguridad

  // Actualizar ref cuando isPaused cambia
  useEffect(() => {
    isPausedRef.current = isPaused
  }, [isPaused])

  // Actualizar ref cuando isManuallyLocked cambia
  useEffect(() => {
    isManuallyLockedRef.current = isManuallyLocked
  }, [isManuallyLocked])

  // Sincronizar con initialHistory cuando cambie (por ejemplo, cuando se agrega un producto)
  useEffect(() => {
    if (initialHistory.length > 0) {
      setScanHistory(initialHistory)
    }
  }, [initialHistory])

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
          // Si el escáner está bloqueado manualmente, ignorar escaneos
          if (isManuallyLockedRef.current) {
            console.log('Escáner bloqueado manualmente, ignorando escaneo...')
            return
          }

          // Si el escáner está pausado (formulario abierto), ignorar escaneos
          if (isPausedRef.current) {
            console.log('Escáner pausado, ignorando escaneo...')
            return
          }

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
          setScanSuccess(true) // Activar animación verde

          if (navigator.vibrate) {
            navigator.vibrate(50)
          }

          // Desactivar animación verde después de 200ms
          setTimeout(() => {
            setScanSuccess(false)
          }, 200)

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

    // Limpiar espacios en blanco del código de barras
    const cleanBarcode = barcode.trim()

    try {
      const { findProductByBarcode, incrementProductStock, saveInventoryHistory } = await import('@/app/actions/products')

      const findResult = await findProductByBarcode(cleanBarcode)

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

        // 📦 Guardar en el historial de la base de datos
        await saveInventoryHistory(
          findResult.data.id,
          findResult.data.name,
          cleanBarcode,
          stockBefore,
          stockAfter
        )

        // Agregar al historial visual del modal
        setScanHistory(prev => {
          const newHistory = [{
            id: findResult.data.id,
            name: findResult.data.name,
            barcode: cleanBarcode,
            timestamp: new Date(),
            stockBefore: stockBefore,
            stockAfter: stockAfter
          }, ...prev]

          // Guardar en localStorage
          localStorage.setItem('scanner_history', JSON.stringify(newHistory))

          return newHistory
        })

        setMessage({
          type: 'success',
          text: `✓ Stock actualizado: ${updateResult.data?.name || findResult.data.name}`
        })

        if (navigator.vibrate) {
          navigator.vibrate(50)
        }

        if (onStockUpdated) {
          onStockUpdated()
        }

        // Agregar ID único de producto escaneado
        setScannedProductIds(prev => new Set(prev).add(findResult.data.id))
      } else {
        setMessage({
          type: 'info',
          text: '⚠ Producto no encontrado. Abriendo formulario...'
        })

        setTimeout(() => {
          if (onProductNotFound) {
            onProductNotFound(cleanBarcode)
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
    // Si hay escaneos en el historial, mostrar confirmación
    if (scanHistory.length > 0) {
      // Calcular productos únicos escaneados y nuevos desde el historial
      const uniqueScanned = new Set<string>()
      const uniqueNew = new Set<string>()
      
      scanHistory.forEach(item => {
        if (item.stockBefore === 0) {
          // Producto nuevo (primera vez escaneado/agregado)
          uniqueNew.add(item.id)
        } else {
          // Producto existente
          uniqueScanned.add(item.id)
        }
      })
      
      setScannedProductIds(uniqueScanned)
      setNewProductBarcodes(uniqueNew)
      setShowConfirmClose(true)
      setIsManuallyLocked(true) // Bloquear escáner cuando aparece el modal
      return
    }

    // Si no hay escaneos, cerrar directamente
    await closeScanner()
  }

  const closeScanner = async () => {
    // Guardar si hubo escaneos ANTES de resetear
    const hadScans = scanCountRef.current > 0

    // Resetear refs y contadores
    isProcessingRef.current = false
    lastScanTimeRef.current = 0
    scanCountRef.current = 0
    setScannedProductIds(new Set())
    setNewProductBarcodes(new Set())

    // Limpiar localStorage al cerrar
    localStorage.removeItem('scanner_history')

    // Revalidar inventario si hubo escaneos
    if (hadScans) {
      try {
        const { revalidateInventory } = await import('@/app/actions/products')
        await revalidateInventory()
      } catch (err) {
        console.error('Error revalidando inventario:', err)
      }
    }

    // NO intentar detener la cámara manualmente
    // El useEffect cleanup (línea 120-132) se encargará cuando se desmonte
    // Simplemente cerrar el modal
    onClose()
  }

  const toggleLock = () => {
    // No permitir cambiar el bloqueo si está procesando
    if (isProcessingRef.current || isPausedRef.current) {
      return
    }

    setIsManuallyLocked(!isManuallyLocked)

    if (navigator.vibrate) {
      navigator.vibrate(40)
    }
  }

  return (
    <div 
      className="fixed inset-0 overflow-y-auto" 
      style={{ 
        zIndex: 60,
        background: 'radial-gradient(ellipse at center, rgb(59, 130, 246), rgb(29, 78, 216), rgb(15, 23, 42), rgb(0, 0, 0))'
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
        className="absolute top-4 right-4 sm:top-6 sm:right-6 p-1.5 sm:p-2 transition-all"
        style={{ zIndex: 70 }}
      >
        <X className="w-8 h-8 sm:w-10 sm:h-10 text-white" strokeWidth={2.5} />
      </button>

      {/* Modal de confirmación */}
      {showConfirmClose && (
        <div 
          className="fixed inset-0 bg-black/50 flex items-center justify-center z-80 p-4"
          onClick={() => {
            setShowConfirmClose(false)
            setIsManuallyLocked(false) // Desbloquear escáner al hacer clic fuera
          }}
        >
          <div 
            className="bg-white rounded-xl shadow-2xl max-w-md w-full p-6"
            onClick={(e) => e.stopPropagation()}
          >
            <h3 className="text-xl font-bold text-gray-900 mb-3">¿Cerrar escáner?</h3>
            <p className="text-gray-600 mb-6">
              {scannedProductIds.size > 0 && newProductBarcodes.size > 0 && (
                <>
                  Se ha{scannedProductIds.size === 1 ? '' : 'n'} aumentado el stock de {scannedProductIds.size} {scannedProductIds.size === 1 ? 'producto' : 'productos'} y se registr{newProductBarcodes.size === 1 ? 'ó' : 'aron'} {newProductBarcodes.size} {newProductBarcodes.size === 1 ? 'nuevo producto' : 'nuevos productos'}. Todos los cambios se han guardado correctamente.
                </>
              )}
              {scannedProductIds.size > 0 && newProductBarcodes.size === 0 && (
                <>
                  Se ha aumentado el stock de {scannedProductIds.size} {scannedProductIds.size === 1 ? 'producto' : 'productos'}. Todos los cambios se han guardado correctamente.
                </>
              )}
              {scannedProductIds.size === 0 && newProductBarcodes.size > 0 && (
                <>
                  Se ha{newProductBarcodes.size === 1 ? '' : 'n'} registrado {newProductBarcodes.size} {newProductBarcodes.size === 1 ? 'nuevo producto' : 'nuevos productos'}. Todos los cambios se han guardado correctamente.
                </>
              )}
              {scannedProductIds.size === 0 && newProductBarcodes.size === 0 && (
                <>
                  No se realizaron cambios.
                </>
              )}
            </p>
            <div className="flex gap-3">
              <button
                onClick={() => {
                  setShowConfirmClose(false)
                  setIsManuallyLocked(false) // Desbloquear escáner al cancelar
                }}
                className="flex-1 px-4 py-2.5 bg-gray-100 hover:bg-gray-200 text-gray-700 font-semibold rounded-lg transition-colors"
              >
                Cancelar
              </button>
              <button
                onClick={closeScanner}
                className="flex-1 px-4 py-2.5 text-black font-semibold rounded-lg transition-colors"
                style={{ backgroundColor: '#88E788' }}
                onMouseEnter={(e) => e.currentTarget.style.backgroundColor = '#70d970'}
                onMouseLeave={(e) => e.currentTarget.style.backgroundColor = '#88E788'}
              >
                Aceptar
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Área del escáner - Responsive */}
      <div className="absolute top-[20%] sm:top-[25%] md:top-[28%] left-1/2 transform -translate-x-1/2 -translate-y-1/2 w-64 h-64 sm:w-72 sm:h-72 md:w-80 md:h-80 z-20">
        <div
          id="reader"
          ref={scannerRef}
          className="w-full h-full rounded-3xl overflow-hidden"
        ></div>

        {/* Overlay de bloqueo (imagen con fondo negro cuando está bloqueado) */}
        <button
          onClick={toggleLock}
          disabled={isProcessing || isPaused}
          className={`absolute inset-0 rounded-3xl transition-all flex flex-col items-center justify-center ${
            isProcessing || isPaused
              ? 'cursor-not-allowed'
              : 'cursor-pointer active:scale-[0.98]'
          } ${
            isManuallyLocked
              ? 'bg-black'
              : 'bg-transparent'
          }`}
        >
          {isManuallyLocked && (
            <>
              <img
                src="/imagen/scanner.png"
                alt="Scanner locked"
                className="w-3/4 h-3/4 object-contain opacity-10 absolute"
              />
              <span className="text-white text-xl sm:text-2xl font-bold z-10">Desbloquear</span>
            </>
          )}
        </button>
      </div>

      {/* Marco del escáner - Esquinas blancas redondeadas */}
      <div className="absolute top-[20%] sm:top-[25%] md:top-[28%] left-1/2 transform -translate-x-1/2 -translate-y-1/2 w-64 h-64 sm:w-72 sm:h-72 md:w-80 md:h-80 z-30 pointer-events-none">
        {/* Esquina superior izquierda */}
        <div className="absolute top-0 left-0 w-10 h-10 sm:w-12 sm:h-12 border-l-4 border-t-4 border-white rounded-tl-3xl"></div>
        {/* Esquina superior derecha */}
        <div className="absolute top-0 right-0 w-10 h-10 sm:w-12 sm:h-12 border-r-4 border-t-4 border-white rounded-tr-3xl"></div>
        {/* Esquina inferior izquierda */}
        <div className="absolute bottom-0 left-0 w-10 h-10 sm:w-12 sm:h-12 border-l-4 border-b-4 border-white rounded-bl-3xl"></div>
        {/* Esquina inferior derecha */}
        <div className="absolute bottom-0 right-0 w-10 h-10 sm:w-12 sm:h-12 border-r-4 border-b-4 border-white rounded-br-3xl"></div>

        {/* Bordes negros internos que cambian a verde al escanear */}
        {/* Borde superior */}
        <div
          className={`absolute top-0 left-1/2 transform -translate-x-1/2 w-32 sm:w-40 h-1 transition-colors duration-300 ${
            scanSuccess ? 'bg-green-500' : 'bg-black'
          }`}
        ></div>
        {/* Borde inferior */}
        <div
          className={`absolute bottom-0 left-1/2 transform -translate-x-1/2 w-32 sm:w-40 h-1 transition-colors duration-300 ${
            scanSuccess ? 'bg-green-500' : 'bg-black'
          }`}
        ></div>
        {/* Borde izquierdo */}
        <div
          className={`absolute left-0 top-1/2 transform -translate-y-1/2 h-32 sm:h-40 w-1 transition-colors duration-300 ${
            scanSuccess ? 'bg-green-500' : 'bg-black'
          }`}
        ></div>
        {/* Borde derecho */}
        <div
          className={`absolute right-0 top-1/2 transform -translate-y-1/2 h-32 sm:h-40 w-1 transition-colors duration-300 ${
            scanSuccess ? 'bg-green-500' : 'bg-black'
          }`}
        ></div>
      </div>

      {/* Panel inferior blanco con Historial */}
      <div className="absolute bottom-0 left-0 right-0 h-[55vh] sm:h-96 md:h-96 bg-white rounded-t-3xl z-10 shadow-2xl">
        <div className="flex flex-col h-full px-4 sm:px-6 py-4">
          {/* Historial */}
          <div className="flex-1 overflow-hidden flex flex-col">
            <div className="mb-3">
              <h3 className="text-lg sm:text-xl font-bold text-gray-900 flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <ClipboardClock className="w-5 h-5 sm:w-6 sm:h-6" />
                  <span>Historial</span>
                  {isProcessing && (
                    <div className="w-4 h-4 border-2 border-gray-400 border-t-transparent rounded-full animate-spin"></div>
                  )}
                </div>
                {scanHistory.length > 0 && (
                  <span className="text-sm font-normal text-gray-500">
                    {scanHistory.length} {scanHistory.length === 1 ? 'producto' : 'productos'}
                  </span>
                )}
              </h3>
              <div className="h-px bg-gray-200 mt-3"></div>
            </div>

            {scanHistory.length === 0 ? (
              <div className="flex-1 flex items-center justify-center text-gray-400">
                <div className="text-center">
                  <ScrollText className="w-24 h-24 mx-auto mb-4 opacity-50" />
                  <p className="text-base font-medium">No hay productos escaneados</p>
                </div>
              </div>
            ) : (
              <div className="flex-1 overflow-y-auto space-y-2 pr-2 scrollbar-hide">
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