'use client'

import { ArrowLeft, Pencil, Camera, ImagePlus, Loader2, CheckCircle } from 'lucide-react'
import { useEffect, useState, useRef } from 'react'
import { uploadProductImage } from '@/app/actions/upload'
import { updateProductImage } from '@/app/actions/products'
import ImageCropModal from '@/components/inventory/ImageCropModal'

interface ImageViewerProps {
  imageUrl: string
  productName: string
  productId?: string
  onClose: () => void
  onImageUpdate?: (newImageUrl: string) => void
  originRect?: DOMRect | null
}

export default function ImageViewer({ 
  imageUrl, 
  productName, 
  productId,
  onClose, 
  onImageUpdate,
  originRect 
}: ImageViewerProps) {
  const [isClosing, setIsClosing] = useState(false)
  const [showOptions, setShowOptions] = useState(false)
  const [showCropModal, setShowCropModal] = useState(false)
  const [uploading, setUploading] = useState(false)
  const [updated, setUpdated] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [currentImage, setCurrentImage] = useState(imageUrl)
  const [tempImageUrl, setTempImageUrl] = useState<string | null>(null)

  // Estados para zoom y pan
  const [scale, setScale] = useState(1)
  const [position, setPosition] = useState({ x: 0, y: 0 })
  const [isPanning, setIsPanning] = useState(false)
  const [startPos, setStartPos] = useState({ x: 0, y: 0 })
  const [lastPinchDistance, setLastPinchDistance] = useState<number | null>(null)

  const fileInputRef = useRef<HTMLInputElement>(null)
  const cameraInputRef = useRef<HTMLInputElement>(null)
  const imageContainerRef = useRef<HTMLDivElement>(null)

  // Bloquear scroll y zoom del viewport
  useEffect(() => {
    const scrollY = window.scrollY
    const scrollX = window.scrollX

    document.body.style.overflow = 'hidden'

    const mainElement = document.querySelector('main')
    const htmlElement = document.documentElement

    if (mainElement) {
      mainElement.style.overflow = 'hidden'
    }

    htmlElement.style.overflow = 'hidden'
    htmlElement.style.position = 'fixed'
    htmlElement.style.width = '100%'
    htmlElement.style.height = '100%'
    htmlElement.style.top = `-${scrollY}px`
    htmlElement.style.left = `-${scrollX}px`

    // Prevenir zoom del viewport en móvil
    let viewportMeta = document.querySelector('meta[name="viewport"]') as HTMLMetaElement
    const originalContent = viewportMeta?.content || ''

    if (viewportMeta) {
      viewportMeta.content = 'width=device-width, initial-scale=1.0, maximum-scale=1.0, user-scalable=no'
    }

    // Prevenir gestos de zoom en iOS
    const preventZoom = (e: TouchEvent) => {
      if (e.touches.length > 1) {
        e.preventDefault()
      }
    }

    document.addEventListener('touchmove', preventZoom, { passive: false })

    return () => {
      document.body.style.overflow = 'unset'
      htmlElement.style.overflow = 'unset'
      htmlElement.style.position = 'static'
      htmlElement.style.width = 'auto'
      htmlElement.style.height = 'auto'
      htmlElement.style.top = '0'
      htmlElement.style.left = '0'

      if (mainElement) {
        mainElement.style.overflow = 'unset'
      }

      // Restaurar viewport original
      if (viewportMeta && originalContent) {
        viewportMeta.content = originalContent
      }

      document.removeEventListener('touchmove', preventZoom)

      window.scrollTo(scrollX, scrollY)
    }
  }, [])

  // Cerrar con ESC
  useEffect(() => {
    const handleEsc = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && !showOptions && !showCropModal) handleClose()
    }
    window.addEventListener('keydown', handleEsc)
    return () => window.removeEventListener('keydown', handleEsc)
  }, [showOptions, showCropModal])

  const handleClose = () => {
    if (uploading) return
    
    setIsClosing(true)
    setTimeout(() => {
      onClose()
    }, 220)
  }

  const handleFileSelect = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file || !productId) return

    // Crear URL temporal para el crop
    const tempUrl = URL.createObjectURL(file)
    setTempImageUrl(tempUrl)
    setShowOptions(false)
    setShowCropModal(true)
  }

  const handleCropComplete = async (croppedBlob: Blob) => {
    setError(null)
    setUploading(true)
    setShowCropModal(false)

    try {
      const formData = new FormData()
      formData.append('file', croppedBlob, 'product.webp')

      const uploadResult = await uploadProductImage(formData)

      if (uploadResult.success && uploadResult.url) {
        const updateResult = await updateProductImage(productId!, uploadResult.url)
        
        if (updateResult.success) {
          setCurrentImage(uploadResult.url)
          setUpdated(true)
          
          if (onImageUpdate) {
            onImageUpdate(uploadResult.url)
          }
          
          setTimeout(() => {
            handleClose()
          }, 1500)
        } else {
          setError(updateResult.error || 'Error al actualizar producto')
        }
      } else {
        setError(uploadResult.error || 'Error al subir imagen')
      }
    } catch (err) {
      console.error('Error processing image:', err)
      setError('Error al procesar imagen')
    } finally {
      setUploading(false)
      if (tempImageUrl) {
        URL.revokeObjectURL(tempImageUrl)
        setTempImageUrl(null)
      }
    }
  }

  const handleTakePhoto = () => {
    cameraInputRef.current?.click()
  }

  const handleChooseFromGallery = () => {
    fileInputRef.current?.click()
  }

  // Resetear zoom cuando cambia la imagen
  useEffect(() => {
    setScale(1)
    setPosition({ x: 0, y: 0 })
  }, [currentImage])

  // Función para obtener la distancia entre dos puntos táctiles
  const getDistance = (touch1: React.Touch, touch2: React.Touch) => {
    const dx = touch1.clientX - touch2.clientX
    const dy = touch1.clientY - touch2.clientY
    return Math.sqrt(dx * dx + dy * dy)
  }

  // Manejar zoom con rueda del mouse
  const handleWheel = (e: React.WheelEvent) => {
    e.preventDefault()
    const delta = e.deltaY * -0.001
    const newScale = Math.min(Math.max(1, scale + delta), 4)
    setScale(newScale)

    // Si vuelve a escala 1, resetear posición
    if (newScale === 1) {
      setPosition({ x: 0, y: 0 })
    }
  }

  // Manejar inicio de pan (mouse)
  const handleMouseDown = (e: React.MouseEvent) => {
    if (scale > 1) {
      setIsPanning(true)
      setStartPos({ x: e.clientX - position.x, y: e.clientY - position.y })
    }
  }

  // Manejar movimiento de pan (mouse)
  const handleMouseMove = (e: React.MouseEvent) => {
    if (isPanning && scale > 1) {
      setPosition({
        x: e.clientX - startPos.x,
        y: e.clientY - startPos.y
      })
    }
  }

  // Manejar fin de pan (mouse)
  const handleMouseUp = () => {
    setIsPanning(false)
  }

  // Manejar pinch-to-zoom y pan (touch)
  const handleTouchStart = (e: React.TouchEvent) => {
    // Prevenir comportamiento por defecto solo cuando hay múltiples toques
    if (e.touches.length > 1) {
      e.preventDefault()
      e.stopPropagation()
    }

    if (e.touches.length === 2) {
      // Inicio de pinch
      const distance = getDistance(e.touches[0], e.touches[1])
      setLastPinchDistance(distance)
    } else if (e.touches.length === 1 && scale > 1) {
      // Inicio de pan
      setIsPanning(true)
      setStartPos({
        x: e.touches[0].clientX - position.x,
        y: e.touches[0].clientY - position.y
      })
    }
  }

  const handleTouchMove = (e: React.TouchEvent) => {
    if (e.touches.length === 2 && lastPinchDistance !== null) {
      // Pinch zoom - prevenir zoom del navegador
      e.preventDefault()
      e.stopPropagation()

      const distance = getDistance(e.touches[0], e.touches[1])
      const delta = (distance - lastPinchDistance) * 0.01
      const newScale = Math.min(Math.max(1, scale + delta), 4)
      setScale(newScale)
      setLastPinchDistance(distance)

      // Si vuelve a escala 1, resetear posición
      if (newScale === 1) {
        setPosition({ x: 0, y: 0 })
      }
    } else if (e.touches.length === 1 && isPanning && scale > 1) {
      // Pan - solo prevenir cuando hay zoom activo
      e.preventDefault()
      e.stopPropagation()

      setPosition({
        x: e.touches[0].clientX - startPos.x,
        y: e.touches[0].clientY - startPos.y
      })
    }
  }

  const handleTouchEnd = (e: React.TouchEvent) => {
    if (e.touches.length === 0) {
      setIsPanning(false)
      setLastPinchDistance(null)
    }
  }

  // Doble tap para zoom
  const lastTapRef = useRef<number>(0)
  const handleDoubleTap = (e: React.MouseEvent | React.TouchEvent) => {
    const now = Date.now()
    const DOUBLE_TAP_DELAY = 300

    if (now - lastTapRef.current < DOUBLE_TAP_DELAY) {
      // Doble tap detectado
      if (scale === 1) {
        setScale(2)
      } else {
        setScale(1)
        setPosition({ x: 0, y: 0 })
      }
    }
    lastTapRef.current = now
  }

  const getImageStyle = () => {
    if (!originRect) return {}

    const windowWidth = window.innerWidth
    const windowHeight = window.innerHeight
    
    const centerX = windowWidth / 2
    const centerY = windowHeight / 2
    
    const originX = originRect.left + originRect.width / 2
    const originY = originRect.top + originRect.height / 2
    
    const thumbnailSize = 80
    const finalScale = thumbnailSize / Math.min(windowWidth, windowHeight)
    
    if (isClosing) {
      return {
        transform: `translate(${originX - centerX}px, ${originY - centerY}px) scale(${finalScale})`,
        transition: 'transform 0.22s cubic-bezier(0.4, 0, 0.2, 1), opacity 0.22s ease-out',
        opacity: 1
      }
    }
    
    return {
      transform: 'translate(0, 0) scale(1)',
      transition: 'transform 0.2s cubic-bezier(0.4, 0, 0.2, 1)',
      animation: originRect ? 'expandFromOrigin 0.2s cubic-bezier(0.4, 0, 0.2, 1)' : 'fadeIn 0.15s ease-out'
    }
  }

  const getInitialTransform = () => {
    if (!originRect) return 'scale(0.95)'
    
    const windowWidth = window.innerWidth
    const windowHeight = window.innerHeight
    const centerX = windowWidth / 2
    const centerY = windowHeight / 2
    const originX = originRect.left + originRect.width / 2
    const originY = originRect.top + originRect.height / 2
    
    const thumbnailSize = 80
    const initialScale = thumbnailSize / Math.min(windowWidth, windowHeight)
    
    return `translate(${originX - centerX}px, ${originY - centerY}px) scale(${initialScale})`
  }

  return (
    <>
      <style jsx>{`
        @keyframes fadeIn {
          from { opacity: 0; }
          to { opacity: 1; }
        }
        
        @keyframes fadeOut {
          from { opacity: 1; }
          to { opacity: 0; }
        }

        @keyframes expandFromOrigin {
          from {
            transform: ${getInitialTransform()};
          }
          to {
            transform: translate(0, 0) scale(1);
          }
        }

        @keyframes slideUp {
          from { transform: translateY(100%); }
          to { transform: translateY(0); }
        }

        .animate-slideUp {
          animation: slideUp 0.3s ease-out;
        }
      `}</style>

      <div 
        className="fixed inset-0 bg-black/90 z-110 overscroll-none touch-none"
        style={{
          opacity: isClosing ? 0 : 1,
          transition: 'opacity 0.15s ease-out'
        }}
        onClick={handleClose}
        onTouchMove={(e) => e.preventDefault()}
      />

      {/* Header fijo - fuera del contenedor de zoom */}
      <div
        className="fixed top-4 left-4 right-4 z-112 flex items-center justify-between"
        style={{
          opacity: isClosing ? 0 : 1,
          transition: 'opacity 0.15s ease-out'
        }}
      >
        {/* Left: Back arrow + texto */}
        <button
          onClick={handleClose}
          disabled={uploading}
          className="flex items-center gap-2 p-2 hover:bg-white/10 rounded-full transition-colors disabled:opacity-50"
          aria-label="Volver"
        >
          <ArrowLeft className="w-6 h-6 text-white" strokeWidth={2.5} />
          <span className="text-white font-medium text-sm">Imagen del producto</span>
        </button>

        {/* Right: Pencil edit button */}
        {productId && (
          <button
            onClick={() => setShowOptions(true)}
            disabled={uploading || updated}
            className="md:hidden p-2 hover:bg-white/10 rounded-full transition-all disabled:opacity-50 disabled:cursor-not-allowed"
            aria-label="Editar imagen"
          >
            {uploading ? (
              <Loader2 className="w-6 h-6 text-white animate-spin" />
            ) : updated ? (
              <CheckCircle className="w-6 h-6 text-green-400" />
            ) : (
              <Pencil className="w-6 h-6 text-white" />
            )}
          </button>
        )}
      </div>

      <div
        className="fixed inset-0 z-111 flex items-center justify-center p-4"
        onClick={(e) => {
          if (scale === 1) handleClose()
        }}
      >
        <div
          ref={imageContainerRef}
          className="relative max-w-4xl max-h-full overflow-hidden"
          style={{
            ...getImageStyle(),
            touchAction: 'none' // Prevenir zoom del navegador en móvil
          }}
          onClick={(e) => {
            e.stopPropagation()
            handleDoubleTap(e)
          }}
          onWheel={handleWheel}
          onMouseDown={handleMouseDown}
          onMouseMove={handleMouseMove}
          onMouseUp={handleMouseUp}
          onMouseLeave={handleMouseUp}
          onTouchStart={handleTouchStart}
          onTouchMove={handleTouchMove}
          onTouchEnd={handleTouchEnd}
        >

          <img
            src={currentImage}
            alt={productName}
            className="w-full h-auto object-contain rounded-lg pointer-events-none select-none"
            style={{
              maxHeight: 'calc(100vh - 8rem)',
              transform: `scale(${scale}) translate(${position.x / scale}px, ${position.y / scale}px)`,
              transition: isPanning ? 'none' : 'transform 0.2s ease-out',
              cursor: scale > 1 ? (isPanning ? 'grabbing' : 'grab') : 'default'
            }}
            draggable={false}
          />

          {updated && (
            <div className="absolute top-4 left-1/2 transform -translate-x-1/2 bg-green-500 text-white px-4 py-2 rounded-full shadow-lg flex items-center gap-2">
              <CheckCircle className="w-5 h-5" />
              <span className="font-medium">¡Actualizado!</span>
            </div>
          )}

          {error && (
            <div className="absolute top-4 left-1/2 transform -translate-x-1/2 bg-red-500 text-white px-4 py-2 rounded-full shadow-lg max-w-xs text-center text-sm">
              {error}
            </div>
          )}
        </div>
      </div>

      {showOptions && !uploading && !updated && (
        <>
          <div
            className="fixed inset-0 bg-black/50 z-112"
            onClick={() => setShowOptions(false)}
          />
          
          <div className="fixed bottom-0 left-0 right-0 bg-white rounded-t-2xl z-113 animate-slideUp shadow-2xl">
            <div className="flex justify-center pt-2 pb-3">
              <div className="w-10 h-1 bg-gray-300 rounded-full"></div>
            </div>

            <div className="px-2 pb-6">
              <div className="grid grid-cols-2 gap-4 px-4">
                <button
                  type="button"
                  onClick={handleTakePhoto}
                  className="flex flex-col items-center gap-2 py-3 hover:bg-gray-50 rounded-xl transition-colors"
                >
                  <div className="w-14 h-14 bg-gray-100 rounded-2xl flex items-center justify-center">
                    <Camera className="w-6 h-6 text-gray-700" />
                  </div>
                  <span className="text-xs text-gray-600 font-medium">Foto</span>
                </button>

                <button
                  type="button"
                  onClick={handleChooseFromGallery}
                  className="flex flex-col items-center gap-2 py-3 hover:bg-gray-50 rounded-xl transition-colors"
                >
                  <div className="w-14 h-14 bg-gray-100 rounded-2xl flex items-center justify-center">
                    <ImagePlus className="w-6 h-6 text-gray-700" />
                  </div>
                  <span className="text-xs text-gray-600 font-medium">Galería</span>
                </button>
              </div>
            </div>
          </div>
        </>
      )}

      <input
        ref={cameraInputRef}
        type="file"
        accept="image/*"
        capture="environment"
        onChange={handleFileSelect}
        className="hidden"
      />

      <input
        ref={fileInputRef}
        type="file"
        accept="image/jpeg,image/png,image/webp"
        onChange={handleFileSelect}
        className="hidden"
      />

      {/* MODAL DE CROP - ESTILO WHATSAPP */}
      {showCropModal && tempImageUrl && (
        <ImageCropModal
          imageUrl={tempImageUrl}
          onClose={() => {
            setShowCropModal(false)
            if (tempImageUrl) {
              URL.revokeObjectURL(tempImageUrl)
              setTempImageUrl(null)
            }
          }}
          onCropComplete={handleCropComplete}
        />
      )}
    </>
  )
}