'use client'

import { ArrowLeft, Pencil, Camera, ImagePlus, Loader2 } from 'lucide-react'
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
  getUpdatedRect?: () => DOMRect | null
}

export default function ImageViewer({
  imageUrl,
  productName,
  productId,
  onClose,
  onImageUpdate,
  originRect,
  getUpdatedRect
}: ImageViewerProps) {
  const [isClosing, setIsClosing] = useState(false)
  const [showOptions, setShowOptions] = useState(false)
  const [showCropModal, setShowCropModal] = useState(false)
  const [uploading, setUploading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [currentImage, setCurrentImage] = useState(imageUrl)
  const [tempImageUrl, setTempImageUrl] = useState<string | null>(null)
  const [hasOpenedOnce, setHasOpenedOnce] = useState(false)
  const [closingRect, setClosingRect] = useState<DOMRect | null>(null)

  // Estados para zoom y pan
  const [scale, setScale] = useState(1)
  const [position, setPosition] = useState({ x: 0, y: 0 })
  const [isPanning, setIsPanning] = useState(false)
  const [startPos, setStartPos] = useState({ x: 0, y: 0 })
  const [lastPinchDistance, setLastPinchDistance] = useState<number | null>(null)

  const fileInputRef = useRef<HTMLInputElement>(null)
  const cameraInputRef = useRef<HTMLInputElement>(null)
  const imageContainerRef = useRef<HTMLDivElement>(null)
  const lastWheelTimeRef = useRef<number>(0)
  const wheelFocalPointRef = useRef<{ x: number; y: number } | null>(null)
  const accumulatedDeltaRef = useRef(0)
  const wheelAnimationFrameRef = useRef<number | null>(null)
  const isMountedRef = useRef(true)

  // Rastrear si el componente está montado
  useEffect(() => {
    isMountedRef.current = true
    return () => {
      isMountedRef.current = false
    }
  }, [])

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
      
      // Limpiar animación pendiente
      if (wheelAnimationFrameRef.current) {
        cancelAnimationFrame(wheelAnimationFrameRef.current)
      }

      window.scrollTo(scrollX, scrollY)
    }
  }, [])

  // Marcar que ya se abrió después de la animación inicial
  useEffect(() => {
    const timer = setTimeout(() => {
      setHasOpenedOnce(true)
    }, 250) // Después de la animación de entrada (200ms)
    
    return () => clearTimeout(timer)
  }, [])
  useEffect(() => {
    const handleEsc = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && !showOptions && !showCropModal) handleClose()
    }
    window.addEventListener('keydown', handleEsc)
    return () => window.removeEventListener('keydown', handleEsc)
  }, [showOptions, showCropModal])

  const handleClose = () => {
    if (uploading) return

    // Capturar el rect actualizado justo antes de cerrar
    const updatedRect = getUpdatedRect ? getUpdatedRect() : null
    if (updatedRect) {
      setClosingRect(updatedRect)
    }

    // Usar requestAnimationFrame para asegurar que el reset y el cierre ocurran en el mismo frame
    requestAnimationFrame(() => {
      // Resetear zoom antes de cerrar para la animación (exactamente 1 para activar animación)
      setScale(1)
      setPosition({ x: 0, y: 0 })
      setIsClosing(true)
    })

    setTimeout(() => {
      onClose()
    }, 250)
  }

  const handleFileSelect = async (e: React.ChangeEvent<HTMLInputElement>) => {
    e.stopPropagation()
    e.preventDefault()
    const file = e.target.files?.[0]
    if (!file) return

    // Crear URL temporal para el crop
    const tempUrl = URL.createObjectURL(file)
    setTempImageUrl(tempUrl)
    setShowOptions(false)
    setShowCropModal(true)
  }

  const handleCropComplete = async (croppedBlob: Blob) => {
    setError(null)
    setShowCropModal(false)

    // ✨ MAGIA: Mostrar spinner por 1s, luego la imagen (mientras sube en segundo plano)
    const localUrl = URL.createObjectURL(croppedBlob)
    setUploading(true)

    // Esperar 1 segundo para crear la ilusión de carga rápida
    setTimeout(() => {
      // Solo actualizar si el componente sigue montado
      if (isMountedRef.current) {
        setCurrentImage(localUrl)
        setUploading(false)

        // 🎯 Actualizar la lista con la imagen local (solo si el visor sigue abierto)
        if (onImageUpdate && productId) {
          onImageUpdate(localUrl)
        }
      }
    }, 1000)

    // Mientras tanto, subir en segundo plano
    try {
      const formData = new FormData()
      formData.append('file', croppedBlob, 'product.webp')

      const uploadResult = await uploadProductImage(formData)

      if (uploadResult.success && uploadResult.url) {
        // Reemplazar URL local con URL del servidor silenciosamente
        URL.revokeObjectURL(localUrl)

        // Solo actualizar estado si el componente sigue montado
        if (isMountedRef.current) {
          setCurrentImage(uploadResult.url)

          // Actualizar la lista con la URL del servidor (solo si el visor sigue abierto)
          if (onImageUpdate && productId) {
            onImageUpdate(uploadResult.url)
          }
        }

        // Si NO hay productId, solo actualizar localmente (para formulario de agregar)
        if (!productId) {
          // No hacer nada más, ya está actualizado localmente
        } else {
          // Si hay productId, actualizar en la base de datos (producto existente)
          const updateResult = await updateProductImage(productId, uploadResult.url)

          if (updateResult.success) {
            // Actualización exitosa en el servidor
          } else {
            // Solo actualizar estado si el componente sigue montado
            if (isMountedRef.current) {
              setError(updateResult.error || 'Error al actualizar producto')
              // Revertir a la imagen original si falla
              URL.revokeObjectURL(localUrl)
              setCurrentImage(imageUrl)
            }
          }
        }
      } else {
        // Solo actualizar estado si el componente sigue montado
        if (isMountedRef.current) {
          setError(uploadResult.error || 'Error al subir imagen')
          // Revertir a la imagen original si falla
          URL.revokeObjectURL(localUrl)
          setCurrentImage(imageUrl)
        }
      }
    } catch (err) {
      console.error('Error processing image:', err)
      // Solo actualizar estado si el componente sigue montado
      if (isMountedRef.current) {
        setError('Error al procesar imagen')
        // Revertir a la imagen original si falla
        URL.revokeObjectURL(localUrl)
        setCurrentImage(imageUrl)
      }
    } finally {
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

  // Función para calcular límites de pan
  const calculatePanLimits = () => {
    if (!imageContainerRef.current || scale <= 1) {
      return { minX: 0, maxX: 0, minY: 0, maxY: 0 }
    }

    const container = imageContainerRef.current
    const rect = container.getBoundingClientRect()
    
    const containerWidth = rect.width
    const containerHeight = rect.height
    
    const maxX = (containerWidth * (scale - 1)) / 2
    const maxY = (containerHeight * (scale - 1)) / 2
    
    return {
      minX: -maxX,
      maxX: maxX,
      minY: -maxY,
      maxY: maxY
    }
  }

  const applyPanLimits = (newPosition: { x: number; y: number }) => {
    if (scale <= 1) return { x: 0, y: 0 }
    
    const limits = calculatePanLimits()
    
    return {
      x: Math.max(limits.minX, Math.min(limits.maxX, newPosition.x)),
      y: Math.max(limits.minY, Math.min(limits.maxY, newPosition.y))
    }
  }

  // Manejar zoom con rueda del mouse
  const handleWheel = (e: React.WheelEvent) => {
    e.preventDefault()
    
    const now = Date.now()
    const timeSinceLastWheel = now - lastWheelTimeRef.current
    
    // Si han pasado más de 150ms desde el último wheel, es un nuevo gesto de zoom
    if (timeSinceLastWheel > 150 || !wheelFocalPointRef.current) {
      // Guardar el punto focal SOLO al inicio del gesto
      if (imageContainerRef.current) {
        const rect = imageContainerRef.current.getBoundingClientRect()
        wheelFocalPointRef.current = {
          x: e.clientX - rect.left - rect.width / 2,
          y: e.clientY - rect.top - rect.height / 2
        }
      }
      accumulatedDeltaRef.current = 0
    }
    
    lastWheelTimeRef.current = now
    
    // Acumular el delta para suavizar
    accumulatedDeltaRef.current += e.deltaY
    
    // Cancelar animación anterior si existe
    if (wheelAnimationFrameRef.current) {
      cancelAnimationFrame(wheelAnimationFrameRef.current)
    }
    
    // Aplicar zoom en el siguiente frame para mejor rendimiento
    wheelAnimationFrameRef.current = requestAnimationFrame(() => {
      const delta = accumulatedDeltaRef.current * -0.001
      
      // Resetear acumulador
      accumulatedDeltaRef.current = 0
      
      // Solo aplicar si el cambio es significativo
      if (Math.abs(delta) < 0.01) return
      
      const previousScale = scale
      const newScale = Math.min(Math.max(1, scale + delta), 5)
      
      // Solo actualizar si hay un cambio real de escala
      if (Math.abs(newScale - previousScale) < 0.02) return
      
      // Usar el punto focal guardado SOLO para zoom IN
      if (wheelFocalPointRef.current && newScale > previousScale) {
        const { x, y } = wheelFocalPointRef.current
        const factor = (newScale - previousScale) / previousScale
        const newPosition = {
          x: position.x - x * factor,
          y: position.y - y * factor
        }
        setPosition(applyPanLimits(newPosition))
      } else if (newScale < previousScale) {
        // Para zoom OUT, solo ajustar límites sin cambiar el centro
        const scaleFactor = newScale / previousScale
        const newPosition = {
          x: position.x * scaleFactor,
          y: position.y * scaleFactor
        }
        setPosition(applyPanLimits(newPosition))
      }
      
      setScale(newScale)

      if (newScale <= 1.01) {
        setScale(1.0000001)
        setPosition({ x: 0, y: 0 })
        wheelFocalPointRef.current = null
      }
    })
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
      const newPosition = {
        x: e.clientX - startPos.x,
        y: e.clientY - startPos.y
      }
      setPosition(applyPanLimits(newPosition))
    }
  }

  // Manejar fin de pan (mouse)
  const handleMouseUp = () => {
    setIsPanning(false)
  }

  // Manejar pinch-to-zoom y pan (touch)
  const handleTouchStart = (e: React.TouchEvent) => {
    if (e.touches.length > 1) {
      e.preventDefault()
      e.stopPropagation()
    }

    if (e.touches.length === 2) {
      const distance = getDistance(e.touches[0], e.touches[1])
      setLastPinchDistance(distance)
    } else if (e.touches.length === 1 && scale > 1) {
      setIsPanning(true)
      setStartPos({
        x: e.touches[0].clientX - position.x,
        y: e.touches[0].clientY - position.y
      })
    }
  }

  const handleTouchMove = (e: React.TouchEvent) => {
    if (e.touches.length === 2 && lastPinchDistance !== null) {
      e.preventDefault()
      e.stopPropagation()

      const distance = getDistance(e.touches[0], e.touches[1])
      const delta = (distance - lastPinchDistance) * 0.015
      const newScale = Math.min(Math.max(1, scale + delta), 5)
      
      if (imageContainerRef.current && newScale !== scale) {
        const rect = imageContainerRef.current.getBoundingClientRect()
        const centerX = (e.touches[0].clientX + e.touches[1].clientX) / 2
        const centerY = (e.touches[0].clientY + e.touches[1].clientY) / 2
        const x = centerX - rect.left - rect.width / 2
        const y = centerY - rect.top - rect.height / 2
        
        const factor = (newScale - scale) / scale
        const newPosition = {
          x: position.x - x * factor,
          y: position.y - y * factor
        }
        setPosition(applyPanLimits(newPosition))
      } else {
        setPosition(applyPanLimits(position))
      }
      
      setScale(newScale)
      setLastPinchDistance(distance)

      if (newScale === 1) {
        setPosition({ x: 0, y: 0 })
      }
    } else if (e.touches.length === 1 && isPanning && scale > 1) {
      e.preventDefault()
      e.stopPropagation()

      const newPosition = {
        x: e.touches[0].clientX - startPos.x,
        y: e.touches[0].clientY - startPos.y
      }
      setPosition(applyPanLimits(newPosition))
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
      e.preventDefault()
      e.stopPropagation()
      
      if (scale <= 1.001) {
        if (imageContainerRef.current) {
          const rect = imageContainerRef.current.getBoundingClientRect()
          let clientX, clientY
          
          if ('touches' in e) {
            clientX = e.changedTouches[0].clientX
            clientY = e.changedTouches[0].clientY
          } else {
            clientX = e.clientX
            clientY = e.clientY
          }
          
          const x = clientX - rect.left - rect.width / 2
          const y = clientY - rect.top - rect.height / 2
          
          const targetScale = 2.5
          const factor = (targetScale - 1)

          setScale(targetScale)
          
          const newPosition = {
            x: -x * factor,
            y: -y * factor
          }
          setPosition(applyPanLimits(newPosition))
        }
      } else {
        // Quitar zoom con un valor ligeramente diferente de 1 para evitar animación de entrada
        setScale(1.0000001)
        setPosition({ x: 0, y: 0 })
      }
    }
    lastTapRef.current = now
  }

  // 🎬 ANIMACIONES VERSIÓN 1 - SIN CAMBIOS EN EL CONTENEDOR
  const getImageStyle = () => {
    // Solo aplicar animación cuando NO hay zoom activo (scale debe ser exactamente 1)
    if (scale > 1.001 || scale < 0.999) return {}
    
    // Si ya se abrió una vez, no aplicar animación de entrada
    if (hasOpenedOnce && !isClosing) return {}
    
    if (!originRect) return {}

    const windowWidth = window.innerWidth
    const windowHeight = window.innerHeight

    const centerX = windowWidth / 2
    const centerY = windowHeight / 2

    if (isClosing) {
      // Usar closingRect si está disponible, sino usar originRect
      const targetRect = closingRect || originRect
      const targetX = targetRect.left + targetRect.width / 2
      const targetY = targetRect.top + targetRect.height / 2
      const targetSize = targetRect.width || 80
      const targetScale = targetSize / Math.min(windowWidth, windowHeight)

      return {
        transform: `translate(${targetX - centerX}px, ${targetY - centerY}px) scale(${targetScale})`,
        transition: 'transform 0.22s cubic-bezier(0.4, 0, 0.2, 1)',
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

    // Usar el tamaño real del thumbnail del origen
    const thumbnailSize = originRect.width || 80
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
        onClick={(e) => {
          e.stopPropagation()
          handleClose()
        }}
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
          onClick={(e) => {
            e.stopPropagation()
            handleClose()
          }}
          disabled={uploading}
          className="flex items-center gap-2 p-2 hover:bg-white/10 rounded-full transition-colors"
          aria-label="Volver"
        >
          <ArrowLeft className="w-6 h-6 text-white" strokeWidth={2.5} />
          <span className="text-white font-medium text-sm">Imagen del producto</span>
        </button>

        {/* Right: Pencil edit button */}
        <button
          onClick={(e) => {
            e.stopPropagation()
            setShowOptions(true)
          }}
          disabled={uploading}
          className="md:hidden p-4 hover:bg-white/10 rounded-full transition-all"
          aria-label="Editar imagen"
        >
          <Pencil className="w-6 h-6 text-white" />
        </button>
      </div>

      <div
        className="fixed inset-0 z-111 flex items-center justify-center p-4"
        onClick={(e) => {
          // Cerrar si el clic fue directamente en este contenedor (no en la imagen)
          if (e.target === e.currentTarget) {
            e.stopPropagation()
            handleClose()
          }
        }}
      >
        <div
          ref={imageContainerRef}
          className="relative max-w-4xl max-h-full overflow-hidden"
          style={{
            ...getImageStyle(),
            touchAction: 'none'
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

          {/* Mostrar imagen solo si NO está subiendo */}
          {!uploading && (
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
          )}

          {/* Spinner mientras sube - ilusión de carga rápida */}
          {uploading && (
            <div className="flex items-center justify-center w-full h-full min-h-[400px]">
              <Loader2 className="w-12 h-12 text-white animate-spin" />
            </div>
          )}

          {error && (
            <div className="absolute top-4 left-1/2 transform -translate-x-1/2 bg-red-500 text-white px-4 py-2 rounded-full shadow-lg max-w-xs text-center text-sm">
              {error}
            </div>
          )}
        </div>
      </div>

      {showOptions && !uploading && (
        <>
          <div
            className="fixed inset-0 bg-black/50 z-112"
            onClick={(e) => {
              e.stopPropagation()
              setShowOptions(false)
            }}
          />
          
          <div className="fixed bottom-0 left-0 right-0 bg-white rounded-t-2xl z-113 animate-slideUp shadow-2xl">
            <div className="flex justify-center pt-2 pb-3">
              <div className="w-10 h-1 bg-gray-300 rounded-full"></div>
            </div>

            <div className="px-2 pb-6">
              <div className="grid grid-cols-2 gap-4 px-4">
                <button
                  type="button"
                  onClick={(e) => {
                    e.stopPropagation()
                    handleTakePhoto()
                  }}
                  className="flex flex-col items-center gap-2 py-3 hover:bg-gray-50 rounded-xl transition-colors"
                >
                  <div className="w-14 h-14 bg-gray-100 rounded-2xl flex items-center justify-center">
                    <Camera className="w-6 h-6 text-gray-700" />
                  </div>
                  <span className="text-xs text-gray-600 font-medium">Foto</span>
                </button>

                <button
                  type="button"
                  onClick={(e) => {
                    e.stopPropagation()
                    handleChooseFromGallery()
                  }}
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
        onClick={(e) => e.stopPropagation()}
        className="hidden"
      />

      <input
        ref={fileInputRef}
        type="file"
        accept="image/jpeg,image/png,image/webp"
        onChange={handleFileSelect}
        onClick={(e) => e.stopPropagation()}
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