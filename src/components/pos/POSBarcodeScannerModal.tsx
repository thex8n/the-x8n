'use client'

import { useEffect, useRef, useState } from 'react'
import { Html5Qrcode } from 'html5-qrcode'
import { X, ShoppingCart, Check, Trash2 } from 'lucide-react'
import { findProductByBarcode, decrementProductStock } from '@/app/actions/products'
import { ProductWithCategory } from '@/types/product'
import { CartItem } from '@/types/cart'

interface POSBarcodeScannerModalProps {
  onClose: () => void
  cart: CartItem[]
  onUpdateCart: (cart: CartItem[]) => void
}

export default function POSBarcodeScannerModal({ onClose, cart, onUpdateCart }: POSBarcodeScannerModalProps) {
  const [error, setError] = useState<string | null>(null)
  const [scannedCode, setScannedCode] = useState<string | null>(null)
  const [isScannerActive, setIsScannerActive] = useState(true)
  const [notification, setNotification] = useState<string | null>(null)
  const [isProcessing, setIsProcessing] = useState(false)
  const [isCheckingOut, setIsCheckingOut] = useState(false)
  const lastScannedRef = useRef<string | null>(null)
  const lastScanTimeRef = useRef<number>(0)
  const scanLockRef = useRef<boolean>(false)
  const isProcessingRef = useRef<boolean>(false)
  const html5QrCodeRef = useRef<Html5Qrcode | null>(null)
  const scannerIdRef = useRef('pos-barcode-scanner')
  const SCAN_COOLDOWN_MS = 500

  // Calcular total
  const cartTotal = cart.reduce((total, item) => {
    return total + (item.product.sale_price || 0) * item.quantity
  }, 0)

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

  const startScanner = async () => {
    try {
      const html5QrCode = new Html5Qrcode(scannerIdRef.current)
      html5QrCodeRef.current = html5QrCode

      await html5QrCode.start(
        { facingMode: 'environment' },
        {
          fps: 10,
          qrbox: { width: 250, height: 250 },
          aspectRatio: 1.0,
          disableFlip: false,
        },
        (decodedText) => {
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
        },
        () => {}
      )
    } catch (err) {
      setError('No se pudo acceder a la cámara')
    }
  }

  const stopScanner = async () => {
    if (html5QrCodeRef.current) {
      try {
        await html5QrCodeRef.current.stop()
        html5QrCodeRef.current.clear()
      } catch (err) {
        console.error(err)
      }
    }
  }

  const handleBarcodeScanned = async (barcode: string) => {
    setIsScannerActive(false)
    setIsProcessing(true)
    setScannedCode(barcode)
    lastScannedRef.current = barcode

    if (navigator.vibrate) navigator.vibrate(100)

    try {
      const result = await findProductByBarcode(barcode)

      if (result.error) {
        setError(result.error)
        setIsProcessing(false)
        isProcessingRef.current = false
        scanLockRef.current = false
        setIsScannerActive(true)
        return
      }

      if (result.data) {
        // Agregar al carrito
        const existingItem = cart.find(item => item.product.id === result.data!.id)

        if (existingItem) {
          if (existingItem.quantity < existingItem.product.stock_quantity) {
            onUpdateCart(cart.map(item =>
              item.product.id === result.data!.id
                ? { ...item, quantity: item.quantity + 1 }
                : item
            ))
          }
        } else {
          onUpdateCart([...cart, { product: result.data, quantity: 1 }])
        }

        setNotification(`+1 ${result.data.name}`)
        if (navigator.vibrate) navigator.vibrate([100, 50, 100])

        setTimeout(() => {
          setNotification(null)
          setScannedCode(null)
          lastScannedRef.current = null
          scanLockRef.current = false
          isProcessingRef.current = false
          setIsScannerActive(true)
        }, 1500)
      } else {
        setError('Producto no encontrado')
        isProcessingRef.current = false
        scanLockRef.current = false
        setIsScannerActive(true)
      }
    } catch (err) {
      setError('Error al procesar el código')
      isProcessingRef.current = false
      scanLockRef.current = false
      setIsScannerActive(true)
    }

    setIsProcessing(false)
  }

  const handleClose = async () => {
    await stopScanner()
    onClose()
  }

  const handleRemoveItem = (productId: string) => {
    onUpdateCart(cart.filter(item => item.product.id !== productId))
  }

  const handleCheckout = async () => {
    if (cart.length === 0) {
      return
    }

    if (!confirm(`¿Finalizar venta por $${cartTotal.toLocaleString()}?`)) {
      return
    }

    setIsCheckingOut(true)
    setIsScannerActive(false)

    try {
      for (const item of cart) {
        const result = await decrementProductStock(item.product.id, item.quantity)
        if (result.error) {
          setError(result.error)
          setIsCheckingOut(false)
          return
        }
      }

      setNotification('¡Venta completada!')
      if (navigator.vibrate) navigator.vibrate([200, 100, 200])

      setTimeout(() => {
        onUpdateCart([])
        handleClose()
      }, 2000)

    } catch (error) {
      setError('Error al procesar la venta')
      console.error(error)
    } finally {
      setIsCheckingOut(false)
    }
  }

  return (
    <div className="fixed inset-0 bg-[linear-gradient(to_bottom_right,#16a34a,#22c55e,#15803d)] overflow-y-auto" style={{ zIndex: 60 }}>
      {/* Patrón de fondo */}
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

      {/* Área de escaneo */}
      <div className="absolute top-[28%] left-1/2 transform -translate-x-1/2 -translate-y-1/2 w-72 h-72 z-20 cursor-pointer">
        <div className="absolute top-0 left-0 w-12 h-12 border-l-4 border-t-4 border-yellow-400 rounded-tl-2xl"></div>
        <div className="absolute top-0 right-0 w-12 h-12 border-r-4 border-t-4 border-yellow-400 rounded-tr-2xl"></div>
        <div className="absolute bottom-0 left-0 w-12 h-12 border-l-4 border-b-4 border-yellow-400 rounded-bl-2xl"></div>
        <div className="absolute bottom-0 right-0 w-12 h-12 border-r-4 border-b-4 border-yellow-400 rounded-br-2xl"></div>
      </div>

      {/* Código escaneado */}
      {scannedCode && !notification && (
        <div className="absolute bottom-[27rem] left-1/2 transform -translate-x-1/2 bg-green-500 text-white px-6 py-3 rounded-xl z-20 shadow-2xl">
          <p className="text-lg font-bold">{scannedCode}</p>
        </div>
      )}

      {/* Notificación */}
      {notification && (
        <div className="absolute bottom-[27rem] left-1/2 transform -translate-x-1/2 bg-white text-green-600 px-6 py-3 rounded-xl z-20 shadow-2xl animate-bounce">
          <p className="text-lg font-bold">{notification}</p>
        </div>
      )}

      {/* Sección inferior blanca - CARRITO INTEGRADO */}
      <div className="absolute bottom-0 left-0 right-0 h-[26rem] bg-white rounded-t-3xl z-10 shadow-2xl overflow-hidden">
        <div className="flex flex-col h-full px-6 py-4">
          {/* Header del carrito */}
          <div className="flex items-center justify-between mb-3 pb-2 border-b border-gray-200">
            <h3 className="font-bold text-gray-900 flex items-center gap-2">
              <ShoppingCart className="w-5 h-5 text-green-600" />
              Carrito ({cart.length})
            </h3>
            <span className="text-sm font-semibold text-green-600">
              ${cartTotal.toLocaleString()}
            </span>
          </div>

          {/* Lista de productos en carrito */}
          <div className="flex-1 overflow-y-auto mb-3">
            {cart.length === 0 ? (
              <div className="text-center py-8">
                <p className="text-gray-400 text-sm">Escanea productos para agregar</p>
              </div>
            ) : (
              <div className="space-y-2">
                {cart.map((item) => (
                  <div
                    key={item.product.id}
                    className="bg-gray-50 rounded-lg p-3 flex items-center gap-3"
                  >
                    <div className="flex-1 min-w-0">
                      <p className="font-semibold text-gray-900 text-sm truncate">
                        {item.product.name}
                      </p>
                      <p className="text-xs text-gray-500">
                        ${item.product.sale_price?.toLocaleString()} x {item.quantity}
                      </p>
                    </div>
                    <div className="flex items-center gap-2">
                      <span className="font-bold text-green-600 text-sm">
                        ${((item.product.sale_price || 0) * item.quantity).toLocaleString()}
                      </span>
                      <button
                        onClick={() => handleRemoveItem(item.product.id)}
                        className="p-1 text-red-500 hover:bg-red-50 rounded"
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Botón finalizar venta */}
          {cart.length > 0 && (
            <button
              onClick={handleCheckout}
              disabled={isCheckingOut}
              className="w-full bg-gradient-to-r from-blue-600 via-blue-500 to-blue-700 text-white font-bold py-3 px-6 rounded-xl shadow-lg hover:shadow-xl transition-all flex items-center justify-center gap-2 disabled:opacity-50"
            >
              {isCheckingOut ? (
                <>
                  <div className="w-5 h-5 border-2 border-white border-t-transparent rounded-full animate-spin"></div>
                  <span>Procesando...</span>
                </>
              ) : (
                <>
                  <Check className="w-5 h-5" />
                  <span>Finalizar Venta</span>
                </>
              )}
            </button>
          )}
        </div>
      </div>

      {/* Cámara */}
      {isScannerActive ? (
        <div className="absolute top-[28%] left-1/2 transform -translate-x-1/2 -translate-y-1/2 w-72 h-72 overflow-hidden rounded-2xl" style={{ zIndex: 15 }}>
          <div id={scannerIdRef.current} className="w-full h-full" />
        </div>
      ) : (
        <div className="absolute top-[28%] left-1/2 transform -translate-x-1/2 -translate-y-1/2 w-72 h-72 bg-black rounded-2xl flex items-center justify-center" style={{ zIndex: 15 }}>
          <span className="text-white text-2xl font-bold">Pausado</span>
        </div>
      )}

      {/* Error */}
      {error && (
        <div className="absolute top-1/2 left-1/2 transform -translate-x-1/2 -translate-y-1/2 bg-white p-6 rounded-2xl z-30 shadow-2xl max-w-sm mx-4">
          <p className="text-red-600 mb-4 text-center font-semibold">{error}</p>
          <button
            onClick={() => {
              setError(null)
              setIsProcessing(false)
              lastScannedRef.current = null
              scanLockRef.current = false
              isProcessingRef.current = false
              setIsScannerActive(true)
            }}
            className="w-full px-4 py-3 bg-green-600 text-white rounded-xl hover:bg-green-700 transition-all font-semibold"
          >
            Reintentar
          </button>
        </div>
      )}
    </div>
  )
}
