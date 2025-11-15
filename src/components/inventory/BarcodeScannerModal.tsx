'use client'

import { X, ScrollText, ClipboardClock } from 'lucide-react'
import { useEffect, useRef, useState } from 'react'
import { ImagePlus } from 'lucide-react'
import ImageViewer from './ImageViewer'

interface BarcodeScannerModalProps {
  onClose: () => void
  onProductNotFound?: (barcode: string, onHistoryAdd: (item: ScannedProduct) => void) => void
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
  imageUrl?: string | null
}

interface GroupedProduct {
  id: string
  name: string
  barcode: string
  imageUrl?: string | null
  firstTimestamp: Date
  lastTimestamp: Date
  initialStock: number
  currentStock: number
  incrementCount: number
}

export default function BarcodeScannerModal({ onClose, onProductNotFound, onStockUpdated, initialHistory = [], isPaused = false }: BarcodeScannerModalProps) {
  const scannerRef = useRef<HTMLDivElement>(null)
  const [scannedCode, setScannedCode] = useState<string>('')
  const [isCameraReady, setIsCameraReady] = useState(false)
  const [isProcessing, setIsProcessing] = useState(false)
  const [message, setMessage] = useState<{ type: 'success' | 'error' | 'info', text: string } | null>(null)
  const [scanHistory, setScanHistory] = useState<ScannedProduct[]>(initialHistory)
  
  const [groupedProducts, setGroupedProducts] = useState<Map<string, GroupedProduct>>(new Map())
  
  const [showConfirmClose, setShowConfirmClose] = useState(false)
  const [isManuallyLocked, setIsManuallyLocked] = useState(true)
  const [scanSuccess, setScanSuccess] = useState(false)
  const [scannedProductIds, setScannedProductIds] = useState<Set<string>>(new Set())
  const [newProductBarcodes, setNewProductBarcodes] = useState<Set<string>>(new Set())

  const [isImageViewerOpen, setIsImageViewerOpen] = useState(false)
  const [viewingImage, setViewingImage] = useState<{
    url: string
    name: string
    productId: string
    originRect: DOMRect | null
  } | null>(null)
  const [lockStateBeforeImage, setLockStateBeforeImage] = useState(false)
  const imageRefs = useRef<Record<string, HTMLDivElement | null>>({})

  const html5QrCodeRef = useRef<any>(null)
  const isProcessingRef = useRef<boolean>(false)
  const lastScanTimeRef = useRef<number>(0)
  const scanCountRef = useRef<number>(0)
  const isPausedRef = useRef<boolean>(isPaused)
  const isManuallyLockedRef = useRef<boolean>(true)
  const isClosingRef = useRef<boolean>(false)

  useEffect(() => {
    isPausedRef.current = isPaused
  }, [isPaused])

  useEffect(() => {
    isManuallyLockedRef.current = isManuallyLocked
  }, [isManuallyLocked])

  useEffect(() => {
    if (initialHistory.length > 0) {
      setScanHistory(initialHistory)
    }
  }, [initialHistory])

  useEffect(() => {
    const handleBeforeUnload = (e: BeforeUnloadEvent) => {
      if (scanHistory.length > 0) {
        e.preventDefault()
        e.returnValue = ''
      }
    }

    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && !showConfirmClose) {
        handleClose()
      }
    }

    window.addEventListener('beforeunload', handleBeforeUnload)
    window.addEventListener('keydown', handleKeyDown)

    return () => {
      window.removeEventListener('beforeunload', handleBeforeUnload)
      window.removeEventListener('keydown', handleKeyDown)
      if (isClosingRef.current && scanHistory.length > 0) {
        localStorage.removeItem('scanner_history')
      }
    }
  }, [scanHistory, showConfirmClose])

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
          if (isManuallyLockedRef.current) {
            console.log('Escáner bloqueado manualmente, ignorando escaneo...')
            return
          }

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
          setScanSuccess(true)

          if (navigator.vibrate) {
            navigator.vibrate(50)
          }

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

    const cleanBarcode = barcode.trim()

    try {
      const { findProductByBarcode, incrementProductStock } = await import('@/app/actions/products')
      const { saveInventoryHistoryD1 } = await import('@/app/actions/inventory-history-d1')

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

        await saveInventoryHistoryD1(
          findResult.data.id,
          findResult.data.name,
          cleanBarcode,
          stockBefore,
          stockAfter,
          findResult.data.image_url
        )

        setScanHistory(prev => {
          const newHistory = [{
            id: findResult.data.id,
            name: findResult.data.name,
            barcode: cleanBarcode,
            timestamp: new Date(),
            stockBefore: stockBefore,
            stockAfter: stockAfter,
            imageUrl: findResult.data.image_url
          }, ...prev]

          localStorage.setItem('scanner_history', JSON.stringify(newHistory))

          return newHistory
        })

        setGroupedProducts(prev => {
          const newMap = new Map(prev)
          const productId = findResult.data.id
          const existing = newMap.get(productId)

          if (existing) {
            newMap.set(productId, {
              ...existing,
              lastTimestamp: new Date(),
              currentStock: stockAfter,
              incrementCount: existing.incrementCount + 1
            })
          } else {
            newMap.set(productId, {
              id: productId,
              name: findResult.data.name,
              barcode: cleanBarcode,
              imageUrl: findResult.data.image_url,
              firstTimestamp: new Date(),
              lastTimestamp: new Date(),
              initialStock: stockBefore,
              currentStock: stockAfter,
              incrementCount: 1
            })
          }

          return newMap
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

        setScannedProductIds(prev => new Set(prev).add(findResult.data.id))
      } else {
        setMessage({
          type: 'info',
          text: '⚠ Producto no encontrado. Abriendo formulario...'
        })

        setTimeout(() => {
          if (onProductNotFound) {
            const handleHistoryAdd = (newItem: ScannedProduct) => {
              setScanHistory(prev => {
                const newHistory = [newItem, ...prev]
                localStorage.setItem('scanner_history', JSON.stringify(newHistory))
                return newHistory
              })

              setGroupedProducts(prev => {
                const newMap = new Map(prev)
                const existing = newMap.get(newItem.id)

                if (existing) {
                  existing.lastTimestamp = newItem.timestamp
                  existing.currentStock = newItem.stockAfter
                  existing.incrementCount += 1
                } else {
                  newMap.set(newItem.id, {
                    id: newItem.id,
                    name: newItem.name,
                    barcode: newItem.barcode,
                    imageUrl: newItem.imageUrl,
                    firstTimestamp: newItem.timestamp,
                    lastTimestamp: newItem.timestamp,
                    initialStock: newItem.stockBefore,
                    currentStock: newItem.stockAfter,
                    incrementCount: 1
                  })
                }

                return newMap
              })
            }

            onProductNotFound(cleanBarcode, handleHistoryAdd)
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
    if (scanHistory.length > 0) {
      const uniqueScanned = new Set<string>()
      const uniqueNew = new Set<string>()
      
      scanHistory.forEach(item => {
        if (item.stockBefore === 0) {
          uniqueNew.add(item.id)
        } else {
          uniqueScanned.add(item.id)
        }
      })
      
      setScannedProductIds(uniqueScanned)
      setNewProductBarcodes(uniqueNew)
      setShowConfirmClose(true)
      setIsManuallyLocked(true)
      return
    }

    await closeScanner()
  }

  const closeScanner = async () => {
    isClosingRef.current = true

    const hadScans = scanCountRef.current > 0

    isProcessingRef.current = false
    lastScanTimeRef.current = 0
    scanCountRef.current = 0
    setScannedProductIds(new Set())
    setNewProductBarcodes(new Set())

    localStorage.removeItem('scanner_history')

    if (hadScans) {
      try {
        const { revalidateInventory } = await import('@/app/actions/products')
        await revalidateInventory()
      } catch (err) {
        console.error('Error revalidando inventario:', err)
      }
    }

    onClose()
  }

  const toggleLock = () => {
    if (isProcessingRef.current || isPausedRef.current) {
      return
    }

    setIsManuallyLocked(!isManuallyLocked)

    if (navigator.vibrate) {
      navigator.vibrate(40)
    }
  }

  const handleImageClick = (productId: string, imageUrl: string | null, productName: string) => {
    const imgElement = imageRefs.current[productId]
    const rect = imgElement?.getBoundingClientRect() || null

    // Guardar el estado actual del bloqueo antes de abrir la imagen
    setLockStateBeforeImage(isManuallyLocked)
    setIsManuallyLocked(true)

    setViewingImage({
      url: imageUrl || '', // Permite URL vacía para productos sin imagen
      name: productName,
      productId: productId,
      originRect: rect
    })
    setIsImageViewerOpen(true)
  }

  // ✅ SOLUCIÓN APLICADA: Actualizar imagen en el estado agrupado
  const handleImageUpdate = (productId: string, newImageUrl: string) => {
    setGroupedProducts(prev => {
      const newMap = new Map(prev)
      const product = newMap.get(productId)
      if (product) {
        newMap.set(productId, { ...product, imageUrl: newImageUrl })
      }
      return newMap
    })
  }

  const groupedProductsArray = Array.from(groupedProducts.values()).sort(
    (a, b) => b.lastTimestamp.getTime() - a.lastTimestamp.getTime()
  )

  return (
    <div 
      className="fixed inset-0 overflow-y-auto" 
      style={{ 
        zIndex: 60,
        background: 'radial-gradient(ellipse at center, rgb(59, 130, 246), rgb(29, 78, 216), rgb(15, 23, 42), rgb(0, 0, 0))'
      }}
    >
      <style jsx>{`
        @font-face {
          font-family: 'MomoTrust';
          src: url('/fonts/Momo_Trust_Display/MomoTrustDisplay-Regular.ttf') format('truetype');
          font-weight: normal;
          font-style: normal;
        }
      `}</style>

      <div className="absolute inset-0 opacity-10">
        <div className="grid grid-cols-4 sm:grid-cols-6 md:grid-cols-8 grid-rows-8 sm:grid-rows-10 md:grid-rows-12 h-full w-full">
          {[...Array(96)].map((_, i) => (
            <div key={i} className="border border-white/20 rounded-lg m-0.5 sm:m-1"></div>
          ))}
        </div>
      </div>

      <button
        onClick={handleClose}
        className="absolute top-4 right-4 sm:top-6 sm:right-6 p-1.5 sm:p-2 transition-all"
        style={{ zIndex: 70 }}
      >
        <X className="w-8 h-8 sm:w-10 sm:h-10 text-white" strokeWidth={2.5} />
      </button>

      {showConfirmClose && (
        <div
          className="fixed inset-0 bg-black/50 flex items-center justify-center z-80 p-4"
          onClick={() => {
            setShowConfirmClose(false)
            setIsManuallyLocked(false)
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
                  setIsManuallyLocked(false)
                }}
                className="flex-1 px-4 py-2.5 bg-gray-100 hover:bg-gray-200 text-gray-700 font-semibold rounded-lg transition-colors"
                style={{ fontFamily: 'MomoTrust, sans-serif' }}
              >
                Cancelar
              </button>
              <button
                onClick={closeScanner}
                className="flex-1 px-4 py-2.5 text-white font-semibold rounded-lg transition-all"
                style={{ 
                  background: 'linear-gradient(135deg, #3b82f6 0%, #1d4ed8 100%)',
                  fontFamily: 'MomoTrust, sans-serif'
                }}
                onMouseEnter={(e) => e.currentTarget.style.background = 'linear-gradient(135deg, #2563eb 0%, #1e40af 100%)'}
                onMouseLeave={(e) => e.currentTarget.style.background = 'linear-gradient(135deg, #3b82f6 0%, #1d4ed8 100%)'}
              >
                Aceptar
              </button>
            </div>
          </div>
        </div>
      )}

      <div className="absolute top-[20%] sm:top-[25%] md:top-[28%] left-1/2 transform -translate-x-1/2 -translate-y-1/2 w-64 h-64 sm:w-72 sm:h-72 md:w-80 md:h-80 z-20">
        <div
          id="reader"
          ref={scannerRef}
          className="w-full h-full rounded-3xl overflow-hidden"
        ></div>

        <button
          onClick={toggleLock}
          disabled={isProcessing || isPaused}
          className={`absolute inset-0 rounded-3xl flex flex-col items-center justify-center transition-all duration-150 ease-out ${
            isProcessing || isPaused
              ? 'cursor-not-allowed'
              : 'cursor-pointer active:scale-[0.98]'
          } ${
            isManuallyLocked
              ? 'bg-black'
              : 'bg-transparent'
          }`}
        >
          <img
            src="/imagen/scanner.png"
            alt="Scanner locked"
            className={`w-3/4 h-3/4 object-contain absolute transition-opacity duration-150 ease-out ${
              isManuallyLocked ? 'opacity-10' : 'opacity-0'
            }`}
          />
          <span
            className={`text-white text-xl sm:text-2xl font-bold z-10 transition-all duration-150 ease-out ${
              isManuallyLocked
                ? 'opacity-100 scale-100'
                : 'opacity-0 scale-95 pointer-events-none'
            }`}
          >
            Desbloquear
          </span>
        </button>
      </div>

      <div className="absolute top-[20%] sm:top-[25%] md:top-[28%] left-1/2 transform -translate-x-1/2 -translate-y-1/2 w-64 h-64 sm:w-72 sm:h-72 md:w-80 md:h-80 z-30 pointer-events-none">
        <div className="absolute top-0 left-0 w-10 h-10 sm:w-12 sm:h-12 border-l-4 border-t-4 border-white rounded-tl-3xl"></div>
        <div className="absolute top-0 right-0 w-10 h-10 sm:w-12 sm:h-12 border-r-4 border-t-4 border-white rounded-tr-3xl"></div>
        <div className="absolute bottom-0 left-0 w-10 h-10 sm:w-12 sm:h-12 border-l-4 border-b-4 border-white rounded-bl-3xl"></div>
        <div className="absolute bottom-0 right-0 w-10 h-10 sm:w-12 sm:h-12 border-r-4 border-b-4 border-white rounded-br-3xl"></div>

        <div
          className={`absolute top-0 left-1/2 transform -translate-x-1/2 w-32 sm:w-40 h-1 transition-colors duration-300 ${
            scanSuccess ? 'bg-green-500' : 'bg-black'
          }`}
        ></div>
        <div
          className={`absolute bottom-0 left-1/2 transform -translate-x-1/2 w-32 sm:w-40 h-1 transition-colors duration-300 ${
            scanSuccess ? 'bg-green-500' : 'bg-black'
          }`}
        ></div>
        <div
          className={`absolute left-0 top-1/2 transform -translate-y-1/2 h-32 sm:h-40 w-1 transition-colors duration-300 ${
            scanSuccess ? 'bg-green-500' : 'bg-black'
          }`}
        ></div>
        <div
          className={`absolute right-0 top-1/2 transform -translate-y-1/2 h-32 sm:h-40 w-1 transition-colors duration-300 ${
            scanSuccess ? 'bg-green-500' : 'bg-black'
          }`}
        ></div>
      </div>

      <div className="absolute bottom-0 left-0 right-0 h-[55vh] sm:h-96 md:h-96 bg-white rounded-t-3xl z-10 shadow-2xl">
        <div className="flex flex-col h-full px-4 sm:px-6 py-4">
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
                {groupedProductsArray.length > 0 && (
                  <span className="text-sm font-normal text-gray-500">
                    {groupedProductsArray.length} {groupedProductsArray.length === 1 ? 'producto' : 'productos'}
                  </span>
                )}
              </h3>
              <div className="h-px bg-gray-200 mt-3"></div>
            </div>

            {groupedProductsArray.length === 0 ? (
              <div className="flex-1 flex items-center justify-center text-gray-400">
                <div className="text-center">
                  <ScrollText className="w-24 h-24 mx-auto mb-4 opacity-50" />
                  <p className="text-base font-medium">No hay productos escaneados</p>
                </div>
              </div>
            ) : (
              <div className="flex-1 overflow-y-auto space-y-2 pr-2 scrollbar-hide">
                {groupedProductsArray.map((item) => (
                  <div 
                    key={item.id}
                    className="bg-gray-50 rounded-lg p-3 border border-gray-200 hover:bg-gray-100 transition-colors"
                  >
                    <div className="flex items-start gap-3">
                      <div
                        ref={(el) => {
                          imageRefs.current[item.id] = el
                        }}
                        onClick={() => handleImageClick(item.id, item.imageUrl || null, item.name)}
                        className="shrink-0 w-16 h-16 bg-gray-100 rounded-lg border-2 border-gray-200 flex items-center justify-center overflow-hidden cursor-pointer hover:border-blue-400 transition-colors"
                      >
                        {item.imageUrl ? (
                          <img
                            key={item.imageUrl}
                            src={item.imageUrl}
                            alt={item.name}
                            className="w-full h-full object-cover"
                          />
                        ) : (
                          <ImagePlus className="w-8 h-8 text-gray-400" />
                        )}
                      </div>

                      <div className="flex-1 min-w-0">
                        <div className="flex items-start justify-between mb-1">
                          <h4 className="font-semibold text-gray-900 text-sm">{item.name}</h4>
                          <span className="text-xs text-gray-500">
                            {item.lastTimestamp.toLocaleTimeString('es-CO', { 
                              hour: '2-digit', 
                              minute: '2-digit',
                              second: '2-digit'
                            })}
                          </span>
                        </div>
                        <p className="text-xs text-gray-600 mb-2 font-mono">{item.barcode}</p>
                        
                        <div className="flex items-center gap-3 text-sm">
                          <div className="flex items-center gap-1.5">
                            <span className="text-gray-600">Stock:</span>
                            <span className="font-bold text-green-600 text-base">
                              +{item.incrementCount}
                            </span>
                          </div>
                          <div className="h-4 w-px bg-gray-300"></div>
                          <div className="flex items-center gap-1.5">
                            <span className="text-gray-600">Total:</span>
                            <span className="font-bold text-blue-600 text-base">
                              {item.currentStock}
                            </span>
                          </div>
                        </div>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      </div>

      {isImageViewerOpen && viewingImage && (
        <ImageViewer
          imageUrl={viewingImage.url}
          productName={viewingImage.name}
          productId={viewingImage.productId}
          originRect={viewingImage.originRect}
          onClose={() => {
            setIsImageViewerOpen(false)
            setViewingImage(null)
            // Restaurar el estado de bloqueo que había antes de abrir la imagen
            setIsManuallyLocked(lockStateBeforeImage)
          }}
          onImageUpdate={(newUrl) => handleImageUpdate(viewingImage.productId, newUrl)}
          getUpdatedRect={() => imageRefs.current[viewingImage.productId]?.getBoundingClientRect() || null}
        />
      )}
    </div>
  )
}