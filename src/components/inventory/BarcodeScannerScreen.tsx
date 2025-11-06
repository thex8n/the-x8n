'use client'

import { useState, useEffect, useRef } from 'react'
import { Html5Qrcode } from 'html5-qrcode'
import { X, Scan, AlertCircle } from 'lucide-react'
import toast from 'react-hot-toast'
import { findProductByCode, incrementProductStock } from '@/app/actions/products'
import { ProductWithCategory } from '@/types/product'

interface BarcodeScannerScreenProps {
  onClose: () => void
  onProductNotFound: (code: string) => void
}

export default function BarcodeScannerScreen({
  onClose,
  onProductNotFound
}: BarcodeScannerScreenProps) {
  const [isScanning, setIsScanning] = useState(true)
  const [lastScannedCode, setLastScannedCode] = useState<string | null>(null)
  const [isInitialized, setIsInitialized] = useState(false)
  const [scannerError, setScannerError] = useState<string | null>(null)
  const scannerRef = useRef<Html5Qrcode | null>(null)
  const qrCodeRegionId = 'qr-reader'

  const handleScan = async (decodedText: string) => {
    if (!isScanning || decodedText === lastScannedCode) return

    setLastScannedCode(decodedText)
    setIsScanning(false)

    try {
      const response = await findProductByCode(decodedText)

      if (response.error) {
        toast.error('Error al buscar el producto')
        setIsScanning(true)
        setTimeout(() => setLastScannedCode(null), 1000)
        return
      }

      if (!response.data) {
        toast('Producto nuevo detectado', {
          icon: '📦',
          duration: 2000,
        })
        if (scannerRef.current) {
          await scannerRef.current.stop()
        }
        onProductNotFound(decodedText)
        return
      }

      const product = response.data as ProductWithCategory

      const stockResponse = await incrementProductStock(product.id)

      if (stockResponse.error) {
        toast.error('Error al actualizar el stock')
        setIsScanning(true)
        setTimeout(() => setLastScannedCode(null), 1000)
        return
      }

      const updatedProduct = stockResponse.data as ProductWithCategory

      toast.success(
        `✓ ${updatedProduct.name} +1 (Stock: ${updatedProduct.stock_quantity})`,
        {
          duration: 2000,
          style: {
            background: '#10b981',
            color: '#fff',
            fontWeight: '600',
          },
        }
      )

      setTimeout(() => {
        setLastScannedCode(null)
        setIsScanning(true)
      }, 800)

    } catch (error) {
      console.error('Error processing barcode:', error)
      toast.error('Error al procesar el código')
      setIsScanning(true)
      setTimeout(() => setLastScannedCode(null), 1000)
    }
  }

  useEffect(() => {
    const initScanner = async () => {
      try {
        const html5QrCode = new Html5Qrcode(qrCodeRegionId)
        scannerRef.current = html5QrCode

        await html5QrCode.start(
          { facingMode: 'environment' },
          {
            fps: 10,
            qrbox: { width: 250, height: 250 },
            aspectRatio: 1.0
          },
          (decodedText) => {
            handleScan(decodedText)
          },
          (errorMessage) => {
            console.log('Scanning...', errorMessage)
          }
        )

        setIsInitialized(true)
      } catch (error: any) {
        console.error('Error starting scanner:', error)
        if (error.name === 'NotAllowedError') {
          setScannerError('Debes permitir el acceso a la cámara para escanear códigos de barras.')
        } else if (error.name === 'NotFoundError') {
          setScannerError('No se encontró ninguna cámara en tu dispositivo.')
        } else {
          setScannerError('Error al iniciar la cámara. Verifica los permisos en tu navegador.')
        }
      }
    }

    initScanner()

    return () => {
      if (scannerRef.current) {
        scannerRef.current.stop().catch((err) => console.error('Error stopping scanner:', err))
      }
    }
  }, [])

  const handleClose = async () => {
    if (scannerRef.current) {
      try {
        await scannerRef.current.stop()
      } catch (err) {
        console.error('Error stopping scanner:', err)
      }
    }
    onClose()
  }

  if (scannerError) {
    return (
      <div className="fixed inset-0 z-50 bg-black">
        <div className="flex flex-col h-full">
          <div className="bg-gradient-to-r from-blue-600 to-blue-500 text-white px-4 py-4 flex items-center justify-between">
            <h2 className="text-lg font-semibold">Error de Cámara</h2>
            <button
              onClick={handleClose}
              className="p-2 hover:bg-white/20 rounded-full transition-colors"
            >
              <X className="w-6 h-6" />
            </button>
          </div>

          <div className="flex-1 flex items-center justify-center p-6">
            <div className="text-center max-w-md">
              <AlertCircle className="w-16 h-16 text-red-500 mx-auto mb-4" />
              <h3 className="text-xl font-semibold text-white mb-3">
                No se puede acceder a la cámara
              </h3>
              <p className="text-gray-300 mb-6">
                {scannerError}
              </p>
              <div className="bg-gray-800 rounded-lg p-4 text-left text-sm text-gray-300 mb-6">
                <p className="font-semibold mb-2">Para habilitar la cámara:</p>
                <ol className="list-decimal list-inside space-y-1">
                  <li>Verifica que estés usando HTTPS</li>
                  <li>Ve a configuración del navegador</li>
                  <li>Busca permisos de cámara</li>
                  <li>Permite acceso para este sitio</li>
                </ol>
              </div>
              <button
                onClick={handleClose}
                className="px-6 py-3 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors"
              >
                Cerrar
              </button>
            </div>
          </div>
        </div>
      </div>
    )
  }

  if (!isInitialized) {
    return (
      <div className="fixed inset-0 z-50 bg-black flex items-center justify-center">
        <div className="text-center text-white">
          <div className="animate-spin rounded-full h-16 w-16 border-b-2 border-blue-500 mx-auto mb-4"></div>
          <p className="text-lg">Iniciando cámara...</p>
        </div>
      </div>
    )
  }

  return (
    <div className="fixed inset-0 z-50 bg-black">
      <div className="flex flex-col h-full">
        <div className="bg-gradient-to-r from-blue-600 to-blue-500 text-white px-4 py-4 flex items-center justify-between">
          <h2 className="text-lg font-semibold">Escanear Productos</h2>
          <button
            onClick={handleClose}
            className="p-2 hover:bg-white/20 rounded-full transition-colors"
          >
            <X className="w-6 h-6" />
          </button>
        </div>

        <div className="flex-1 relative bg-black overflow-hidden flex items-center justify-center">
          <div id={qrCodeRegionId} className="w-full"></div>
        </div>

        <div className="bg-gray-900 text-white px-6 py-8 text-center">
          <div className="flex items-center justify-center mb-3">
            <Scan className="w-8 h-8 text-blue-500" />
          </div>
          <p className="text-lg font-medium mb-1">
            {isScanning ? 'Acerca el código de barras' : 'Procesando...'}
          </p>
          <p className="text-sm text-gray-400">
            {isScanning ? 'El escáner detectará automáticamente el código' : 'Espera un momento'}
          </p>
        </div>
      </div>

      <style jsx global>{`
        #${qrCodeRegionId} {
          display: flex;
          justify-content: center;
          align-items: center;
        }
        #${qrCodeRegionId} > div {
          width: 100% !important;
          border: none !important;
        }
        #${qrCodeRegionId} video {
          width: 100% !important;
          height: auto !important;
          object-fit: cover !important;
        }
        #qr-shaded-region {
          border-color: rgba(59, 130, 246, 0.5) !important;
        }
      `}</style>
    </div>
  )
}
