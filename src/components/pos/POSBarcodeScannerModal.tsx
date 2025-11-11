'use client'

import { useEffect, useRef, useState } from 'react'
import { Html5Qrcode } from 'html5-qrcode'
import { X, ShoppingCart, Check, Trash2, AlertCircle, ImageIcon } from 'lucide-react'
import { findProductByBarcode, decrementProductStock } from '@/app/actions/products'
import { CartItem } from '@/types/cart'
import { SCAN_COOLDOWN_MS } from '@/constants/ui'
import { POS_MESSAGES, getPOSCartSummaryMessage } from '@/constants/validation'

interface POSBarcodeScannerModalProps {
  onClose: () => void
  cart: CartItem[]
  onUpdateCart: (cart: CartItem[]) => void
}

export default function POSBarcodeScannerModal({ onClose, cart, onUpdateCart }: POSBarcodeScannerModalProps) {
  const [isScannerActive, setIsScannerActive] = useState(true)
  const [isCheckingOut, setIsCheckingOut] = useState(false)
  const [isManuallyLocked, setIsManuallyLocked] = useState(true)
  const [scanSuccess, setScanSuccess] = useState(false)
  const [isProcessing, setIsProcessing] = useState(false)
  const [showConfirmClose, setShowConfirmClose] = useState(false)
  const lastScannedRef = useRef<string | null>(null)
  const lastScanTimeRef = useRef<number>(0)
  const scanLockRef = useRef<boolean>(false)
  const isProcessingRef = useRef<boolean>(false)
  const isManuallyLockedRef = useRef<boolean>(true)
  const isClosingRef = useRef<boolean>(false)
  const cartRef = useRef<CartItem[]>(cart)
  const html5QrCodeRef = useRef<Html5Qrcode | null>(null)
  const scannerIdRef = useRef('pos-barcode-scanner')

  const cartTotal = cart.reduce((total, item) => {
    return total + (item.product.sale_price || 0) * item.quantity
  }, 0)

  // Persistir carrito en localStorage
  useEffect(() => {
    if (cart.length > 0) {
      localStorage.setItem('pos_cart', JSON.stringify(cart))
    } else {
      localStorage.removeItem('pos_cart')
    }
  }, [cart])

  // Cargar carrito desde localStorage al montar
  useEffect(() => {
    const savedCart = localStorage.getItem('pos_cart')
    if (savedCart) {
      try {
        const parsedCart = JSON.parse(savedCart)
        if (parsedCart.length > 0) {
          onUpdateCart(parsedCart)
        }
      } catch (error) {
        console.error('Error loading cart from localStorage:', error)
        localStorage.removeItem('pos_cart')
      }
    }
  }, [])

  // Confirmación al recargar/cerrar página si hay carrito
  useEffect(() => {
    const handleBeforeUnload = (e: BeforeUnloadEvent) => {
      if (cart.length > 0) {
        e.preventDefault()
        e.returnValue = ''
      }
    }

    window.addEventListener('beforeunload', handleBeforeUnload)

    return () => {
      window.removeEventListener('beforeunload', handleBeforeUnload)
      // Limpiar localStorage solo si está cerrando definitivamente
      if (isClosingRef.current && cart.length > 0) {
        localStorage.removeItem('pos_cart')
      }
    }
  }, [cart])

  // Mantener cartRef sincronizado con cart
  useEffect(() => {
    cartRef.current = cart
  }, [cart])

  const toggleLock = () => {
    if (isProcessingRef.current || isCheckingOut) {
      return
    }

    setIsManuallyLocked(!isManuallyLocked)

    if (navigator.vibrate) {
      navigator.vibrate(40)
    }
  }

  useEffect(() => {
    isManuallyLockedRef.current = isManuallyLocked
  }, [isManuallyLocked])

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
      console.error('Error iniciando escáner:', err)
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
    if (isManuallyLockedRef.current) {
      console.log('Escáner bloqueado manualmente')
      return
    }

    lastScannedRef.current = barcode
    setIsProcessing(true)
    isProcessingRef.current = true

    if (navigator.vibrate) navigator.vibrate(100)

    setScanSuccess(true)
    setTimeout(() => setScanSuccess(false), 200)

    try {
      const result = await findProductByBarcode(barcode)

      if (result.error) {
        if (navigator.vibrate) navigator.vibrate(200)
        setIsProcessing(false)
        isProcessingRef.current = false
        scanLockRef.current = false
        return
      }

      if (result.data) {
        const product = result.data
        const stockAvailable = product.stock_quantity

        // Usar cartRef.current para obtener el estado más reciente del carrito
        const currentCart = cartRef.current
        const existingItem = currentCart.find(item => item.product.id === product.id)

        if (existingItem) {
          // Producto ya está en el carrito
          if (existingItem.quantity < stockAvailable) {
            // Aún hay stock disponible, agregar al carrito
            const newQuantity = existingItem.quantity + 1

            const updatedCart = currentCart.map(item =>
              item.product.id === product.id
                ? { ...item, quantity: newQuantity }
                : item
            )

            onUpdateCart(updatedCart)

            if (navigator.vibrate) navigator.vibrate([100, 50, 100])
          } else {
            // Ya alcanzó el stock máximo
            // Vibración de rechazo
            if (navigator.vibrate) navigator.vibrate([200, 100, 200])
          }
        } else {
          // Producto nuevo en el carrito
          if (stockAvailable > 0) {
            const updatedCart = [...currentCart, { product: product, quantity: 1 }]
            onUpdateCart(updatedCart)

            if (navigator.vibrate) navigator.vibrate([100, 50, 100])
          } else {
            // Sin stock disponible
            if (navigator.vibrate) navigator.vibrate([200, 100, 200])
          }
        }

        // Detener el procesamiento inmediatamente
        setIsProcessing(false)
        isProcessingRef.current = false

        setTimeout(() => {
          lastScannedRef.current = null
          scanLockRef.current = false
        }, 800)
      } else {
        if (navigator.vibrate) navigator.vibrate(200)
        setIsProcessing(false)
        isProcessingRef.current = false
        scanLockRef.current = false
      }
    } catch (err) {
      if (navigator.vibrate) navigator.vibrate(200)
      setIsProcessing(false)
      isProcessingRef.current = false
      scanLockRef.current = false
    }
  }

  const handleClose = async () => {
    // Si hay productos en el carrito, mostrar confirmación
    if (cart.length > 0) {
      setShowConfirmClose(true)
      setIsManuallyLocked(true)
      return
    }

    // Si no hay productos, cerrar directamente
    await closeScanner()
  }

  const closeScanner = async () => {
    // Marcar que está cerrando definitivamente
    isClosingRef.current = true

    // Limpiar localStorage
    localStorage.removeItem('pos_cart')

    // Detener el escáner
    await stopScanner()

    // Cerrar el modal
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
          setIsCheckingOut(false)
          setIsScannerActive(true)
          return
        }
      }

      if (navigator.vibrate) navigator.vibrate([200, 100, 200])

      // Limpiar carrito y localStorage
      localStorage.removeItem('pos_cart')
      onUpdateCart([])

      // Marcar que está cerrando después de checkout exitoso
      isClosingRef.current = true

      setTimeout(() => {
        closeScanner()
      }, 1000)

    } catch (error) {
      console.error(error)
      setIsScannerActive(true)
    } finally {
      setIsCheckingOut(false)
    }
  }

  return (
    <div
      className="fixed inset-0 overflow-y-auto"
      style={{
        zIndex: 60,
        background: 'radial-gradient(ellipse at center, rgb(16, 185, 129), rgb(5, 150, 105), rgb(6, 78, 59), rgb(0, 0, 0))'
      }}
    >
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

      {/* Scanner container with lock overlay and corners */}
      <div className="absolute top-[20%] sm:top-[25%] md:top-[28%] left-1/2 transform -translate-x-1/2 -translate-y-1/2 w-64 h-64 sm:w-72 sm:h-72 md:w-80 md:h-80 z-20">
        <div id={scannerIdRef.current} className="w-full h-full rounded-3xl overflow-hidden" />

        <button
          onClick={toggleLock}
          disabled={isProcessing || isCheckingOut}
          className={`absolute inset-0 rounded-3xl transition-all flex flex-col items-center justify-center ${
            isProcessing || isCheckingOut
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

      {/* Corner borders - WHITE THEME */}
      <div className="absolute top-[20%] sm:top-[25%] md:top-[28%] left-1/2 transform -translate-x-1/2 -translate-y-1/2 w-64 h-64 sm:w-72 sm:h-72 md:w-80 md:h-80 z-30 pointer-events-none">
        <div className="absolute top-0 left-0 w-10 h-10 sm:w-12 sm:h-12 border-l-4 border-t-4 border-white rounded-tl-3xl"></div>
        <div className="absolute top-0 right-0 w-10 h-10 sm:w-12 sm:h-12 border-r-4 border-t-4 border-white rounded-tr-3xl"></div>
        <div className="absolute bottom-0 left-0 w-10 h-10 sm:w-12 sm:h-12 border-l-4 border-b-4 border-white rounded-bl-3xl"></div>
        <div className="absolute bottom-0 right-0 w-10 h-10 sm:w-12 sm:h-12 border-r-4 border-b-4 border-white rounded-br-3xl"></div>

        {/* Scan success indicators - GREEN */}
        <div
          className={`absolute top-0 left-1/2 transform -translate-x-1/2 w-32 sm:w-40 h-1 transition-colors duration-300 ${
            scanSuccess ? 'bg-green-400' : 'bg-black'
          }`}
        ></div>
        <div
          className={`absolute bottom-0 left-1/2 transform -translate-x-1/2 w-32 sm:w-40 h-1 transition-colors duration-300 ${
            scanSuccess ? 'bg-green-400' : 'bg-black'
          }`}
        ></div>
        <div
          className={`absolute left-0 top-1/2 transform -translate-y-1/2 h-32 sm:h-40 w-1 transition-colors duration-300 ${
            scanSuccess ? 'bg-green-400' : 'bg-black'
          }`}
        ></div>
        <div
          className={`absolute right-0 top-1/2 transform -translate-y-1/2 h-32 sm:h-40 w-1 transition-colors duration-300 ${
            scanSuccess ? 'bg-green-400' : 'bg-black'
          }`}
        ></div>
      </div>

      <div className="absolute bottom-0 left-0 right-0 h-[55vh] sm:h-96 md:h-96 bg-white rounded-t-3xl z-10 shadow-2xl overflow-hidden">
        <div className="flex flex-col h-full px-6 py-4">
          <div className="flex items-center justify-between mb-3 pb-2 border-b border-gray-200">
            <h3 className="font-bold text-gray-900 flex items-center gap-2">
              <ShoppingCart className="w-5 h-5 text-green-600" />
              <span>Carrito ({cart.length})</span>
              {isProcessing && (
                <div className="w-4 h-4 border-2 border-gray-400 border-t-transparent rounded-full animate-spin"></div>
              )}
            </h3>
            <span className="text-sm font-semibold text-green-600">
              ${cartTotal.toLocaleString()}
            </span>
          </div>

          <div className="flex-1 overflow-y-auto mb-3">
            {cart.length === 0 ? (
              <div className="text-center py-8">
                <p className="text-gray-400 text-sm">Escanea productos para agregar</p>
              </div>
            ) : (
              <div className="space-y-2">
                {cart.map((item) => {
                  const stockPercentage = (item.quantity / item.product.stock_quantity) * 100
                  const isNearLimit = stockPercentage >= 80
                  const isAtLimit = item.quantity >= item.product.stock_quantity

                  return (
                    <div
                      key={item.product.id}
                      className={`rounded-lg p-3 flex items-center gap-3 transition-colors ${
                        isAtLimit
                          ? 'bg-red-50 border border-red-200'
                          : isNearLimit
                          ? 'bg-yellow-50 border border-yellow-200'
                          : 'bg-gray-50'
                      }`}
                    >
                      {/* Imagen del producto */}
                      <div className="w-16 h-16 shrink-0 rounded-lg overflow-hidden bg-white border border-gray-200">
                        {item.product.image_url ? (
                          <img
                            src={item.product.image_url}
                            alt={item.product.name}
                            className="w-full h-full object-cover"
                          />
                        ) : (
                          <div className="w-full h-full flex items-center justify-center bg-gray-100">
                            <ImageIcon className="w-6 h-6 text-gray-400" />
                          </div>
                        )}
                      </div>

                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2 mb-1">
                          <p className="font-semibold text-gray-900 text-sm truncate">
                            {item.product.name}
                          </p>
                          {isAtLimit && (
                            <AlertCircle className="w-4 h-4 text-red-500 shrink-0" />
                          )}
                        </div>
                        <p className="text-xs text-gray-500 mb-1">
                          ${item.product.sale_price?.toLocaleString()} x {item.quantity}
                        </p>
                        <div className="flex items-center gap-2">
                          <span className={`text-xs font-medium px-2 py-0.5 rounded ${
                            isAtLimit
                              ? 'bg-red-100 text-red-700'
                              : isNearLimit
                              ? 'bg-yellow-100 text-yellow-700'
                              : 'bg-gray-200 text-gray-700'
                          }`}>
                            {item.quantity}/{item.product.stock_quantity} disponibles
                          </span>
                          {isAtLimit && (
                            <span className="text-xs text-red-600 font-medium">Stock máximo</span>
                          )}
                        </div>
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
                  )
                })}
              </div>
            )}
          </div>

          {cart.length > 0 && (
            <button
              onClick={handleCheckout}
              disabled={isCheckingOut}
              className="w-full bg-green-600 text-white font-bold py-3 px-6 rounded-xl shadow-lg hover:bg-green-700 hover:shadow-xl transition-all flex items-center justify-center gap-2 disabled:opacity-50"
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

      {/* Modal de confirmación al cerrar */}
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
            <h3 className="text-xl font-bold text-gray-900 mb-3">
              {POS_MESSAGES.CONFIRM_EXIT_TITLE}
            </h3>
            <p className="text-gray-600 mb-6">
              {getPOSCartSummaryMessage(cart.length, cartTotal)}
            </p>
            <p className="text-sm text-gray-500 mb-6">
              Si cierras ahora, los productos permanecerán en el carrito para cuando regreses.
            </p>
            <div className="flex gap-3">
              <button
                onClick={() => {
                  setShowConfirmClose(false)
                  setIsManuallyLocked(false)
                }}
                className="flex-1 px-4 py-2.5 bg-gray-100 hover:bg-gray-200 text-gray-700 font-semibold rounded-lg transition-colors"
              >
                Cancelar
              </button>
              <button
                onClick={closeScanner}
                className="flex-1 px-4 py-2.5 bg-green-600 hover:bg-green-700 text-white font-semibold rounded-lg transition-all"
              >
                Salir
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}