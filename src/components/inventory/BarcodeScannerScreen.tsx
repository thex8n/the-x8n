'use client'

import { useState, useEffect } from 'react'
import { useZxing } from 'react-zxing'
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
  const [hasPermission, setHasPermission] = useState<boolean | null>(null)
  const [permissionError, setPermissionError] = useState<string | null>(null)

  const handleScan = async (result: any) => {
    if (!isScanning) return

    const code = result.getText()

    if (code === lastScannedCode) return

    setLastScannedCode(code)
    setIsScanning(false)

    try {
      const response = await findProductByCode(code)

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
        onProductNotFound(code)
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
    const checkPermissions = async () => {
      try {
        if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) {
          setPermissionError('Tu navegador no soporta acceso a la cámara. Usa Chrome o Safari en mobile.')
          setHasPermission(false)
          return
        }

        const stream = await navigator.mediaDevices.getUserMedia({
          video: {
            facingMode: 'environment',
            width: { ideal: 1280 },
            height: { ideal: 720 }
          }
        })

        stream.getTracks().forEach(track => track.stop())
        setHasPermission(true)
      } catch (error: any) {
        console.error('Permission error:', error)
        if (error.name === 'NotAllowedError') {
          setPermissionError('Debes permitir el acceso a la cámara para escanear códigos de barras.')
        } else if (error.name === 'NotFoundError') {
          setPermissionError('No se encontró ninguna cámara en tu dispositivo.')
        } else {
          setPermissionError('Error al acceder a la cámara. Verifica los permisos en tu navegador.')
        }
        setHasPermission(false)
      }
    }

    checkPermissions()
  }, [])

  const { ref } = useZxing({
    onDecodeResult(result) {
      handleScan(result)
    },
    onError(error) {
      console.error('Scanner error:', error)
    },
    constraints: {
      video: {
        facingMode: 'environment',
        width: { ideal: 1280 },
        height: { ideal: 720 }
      }
    }
  })

  if (hasPermission === null) {
    return (
      <div className="fixed inset-0 z-50 bg-black flex items-center justify-center">
        <div className="text-center text-white">
          <div className="animate-spin rounded-full h-16 w-16 border-b-2 border-blue-500 mx-auto mb-4"></div>
          <p className="text-lg">Solicitando permisos de cámara...</p>
        </div>
      </div>
    )
  }

  if (hasPermission === false) {
    return (
      <div className="fixed inset-0 z-50 bg-black">
        <div className="flex flex-col h-full">
          <div className="bg-gradient-to-r from-blue-600 to-blue-500 text-white px-4 py-4 flex items-center justify-between">
            <h2 className="text-lg font-semibold">Error de Cámara</h2>
            <button
              onClick={onClose}
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
                {permissionError}
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
                onClick={onClose}
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

  return (
    <div className="fixed inset-0 z-50 bg-black">
      <div className="flex flex-col h-full">
        <div className="bg-gradient-to-r from-blue-600 to-blue-500 text-white px-4 py-4 flex items-center justify-between">
          <h2 className="text-lg font-semibold">Escanear Productos</h2>
          <button
            onClick={onClose}
            className="p-2 hover:bg-white/20 rounded-full transition-colors"
          >
            <X className="w-6 h-6" />
          </button>
        </div>

        <div className="flex-1 relative bg-black">
          <video
            ref={ref}
            className="w-full h-full object-cover"
          />

          <div className="absolute inset-0 pointer-events-none">
            <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-64 h-64">
              <div className="absolute top-0 left-0 w-8 h-8 border-t-4 border-l-4 border-blue-500 rounded-tl-lg"></div>
              <div className="absolute top-0 right-0 w-8 h-8 border-t-4 border-r-4 border-blue-500 rounded-tr-lg"></div>
              <div className="absolute bottom-0 left-0 w-8 h-8 border-b-4 border-l-4 border-blue-500 rounded-bl-lg"></div>
              <div className="absolute bottom-0 right-0 w-8 h-8 border-b-4 border-r-4 border-blue-500 rounded-br-lg"></div>

              {isScanning && (
                <div className="absolute top-0 left-0 right-0 h-1 bg-blue-500 animate-scan"></div>
              )}
            </div>
          </div>
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

      <style jsx>{`
        @keyframes scan {
          0% {
            top: 0;
          }
          50% {
            top: 100%;
          }
          100% {
            top: 0;
          }
        }
        .animate-scan {
          animation: scan 2s ease-in-out infinite;
        }
      `}</style>
    </div>
  )
}
