'use client'

import { Loader2 } from 'lucide-react'
import { useEffect, useState, useRef } from 'react'
import { uploadProductImage } from '@/app/actions/upload'
import { updateProductImage } from '@/app/actions/products'
import ImageCropModal from '@/components/inventory/ImageCropModal'
import { IoMdArrowRoundBack } from "react-icons/io"
import { FaPencilAlt } from "react-icons/fa"
import { FaRegTrashCan } from "react-icons/fa6"
import { LuImagePlus } from "react-icons/lu"
import { GrGallery } from "react-icons/gr"
import { PiCameraBold } from "react-icons/pi"

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
  const [isClosingOptions, setIsClosingOptions] = useState(false)
  const [showCropModal, setShowCropModal] = useState(false)
  const [showDeleteModal, setShowDeleteModal] = useState(false)
  const [uploading, setUploading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [currentImage, setCurrentImage] = useState(imageUrl)
  const [tempImageUrl, setTempImageUrl] = useState<string | null>(null)
  const [hasOpenedOnce, setHasOpenedOnce] = useState(false)
  const [closingRect, setClosingRect] = useState<DOMRect | null>(null)

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

  const hasImage = currentImage && currentImage.trim() !== ''

  useEffect(() => {
    isMountedRef.current = true
    return () => {
      isMountedRef.current = false
    }
  }, [])

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

    let viewportMeta = document.querySelector('meta[name="viewport"]') as HTMLMetaElement
    const originalContent = viewportMeta?.content || ''

    if (viewportMeta) {
      viewportMeta.content = 'width=device-width, initial-scale=1.0, maximum-scale=1.0, user-scalable=no'
    }

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

      if (viewportMeta && originalContent) {
        viewportMeta.content = originalContent
      }

      document.removeEventListener('touchmove', preventZoom)
      
      if (wheelAnimationFrameRef.current) {
        cancelAnimationFrame(wheelAnimationFrameRef.current)
      }

      window.scrollTo(scrollX, scrollY)
    }
  }, [])

  useEffect(() => {
    const timer = setTimeout(() => {
      setHasOpenedOnce(true)
    }, 250)
    
    return () => clearTimeout(timer)
  }, [])

  useEffect(() => {
    const handleEsc = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && !showOptions && !showCropModal && !showDeleteModal) handleClose()
    }
    window.addEventListener('keydown', handleEsc)
    return () => window.removeEventListener('keydown', handleEsc)
  }, [showOptions, showCropModal, showDeleteModal])

  const handleClose = () => {
    if (uploading) return

    const updatedRect = getUpdatedRect ? getUpdatedRect() : null
    if (updatedRect) {
      setClosingRect(updatedRect)
    }

    requestAnimationFrame(() => {
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

    const tempUrl = URL.createObjectURL(file)
    setTempImageUrl(tempUrl)
    setShowOptions(false)
    setShowCropModal(true)
  }

  const handleCropComplete = async (croppedBlob: Blob) => {
    setError(null)
    setShowCropModal(false)

    const localUrl = URL.createObjectURL(croppedBlob)
    
    setCurrentImage(localUrl)
    setUploading(true)

    setTimeout(() => {
      if (isMountedRef.current) {
        setUploading(false)
      }
    }, 1000)

    try {
      const formData = new FormData()
      formData.append('file', croppedBlob, 'product.webp')

      const uploadResult = await uploadProductImage(formData)

      if (uploadResult.success && uploadResult.url) {
        const cacheBustedUrl = uploadResult.url + '?t=' + Date.now()

        if (onImageUpdate) {
          onImageUpdate(cacheBustedUrl)
        }

        if (productId) {
          const updateResult = await updateProductImage(productId, uploadResult.url)

          if (!updateResult.success && isMountedRef.current) {
            setError(updateResult.error || 'Error al actualizar producto')
            setCurrentImage(imageUrl)
            if (onImageUpdate) {
              onImageUpdate(imageUrl)
            }
            URL.revokeObjectURL(localUrl)
          }
        }
      } else {
        if (isMountedRef.current) {
          setError(uploadResult.error || 'Error al subir imagen')
          setCurrentImage(imageUrl)
          if (onImageUpdate) {
            onImageUpdate(imageUrl)
          }
        }
        URL.revokeObjectURL(localUrl)
      }
    } catch (err) {
      console.error('Error processing image:', err)
      if (isMountedRef.current) {
        setError('Error al procesar imagen')
        setCurrentImage(imageUrl)
        if (onImageUpdate) {
          onImageUpdate(imageUrl)
        }
      }
      URL.revokeObjectURL(localUrl)
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

  const closeOptions = () => {
    setIsClosingOptions(true)
    setTimeout(() => {
      setShowOptions(false)
      setIsClosingOptions(false)
    }, 200)
  }

  const handleDeleteImage = async () => {
    if (!productId) return

    setShowDeleteModal(false)
    setUploading(true)

    try {
      const result = await updateProductImage(productId, '')

      if (result.success) {
        if (onImageUpdate) {
          onImageUpdate('')
        }

        handleClose()
      } else {
        setError(result.error || 'Error al eliminar imagen')
      }
    } catch (err) {
      console.error('Error deleting image:', err)
      setError('Error al eliminar imagen')
    } finally {
      setUploading(false)
    }
  }

  useEffect(() => {
    setScale(1)
    setPosition({ x: 0, y: 0 })
  }, [currentImage])

  const getDistance = (touch1: React.Touch, touch2: React.Touch) => {
    const dx = touch1.clientX - touch2.clientX
    const dy = touch1.clientY - touch2.clientY
    return Math.sqrt(dx * dx + dy * dy)
  }

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

  const handleWheel = (e: React.WheelEvent) => {
    e.preventDefault()
    
    const now = Date.now()
    const timeSinceLastWheel = now - lastWheelTimeRef.current
    
    if (timeSinceLastWheel > 150 || !wheelFocalPointRef.current) {
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
    accumulatedDeltaRef.current += e.deltaY
    
    if (wheelAnimationFrameRef.current) {
      cancelAnimationFrame(wheelAnimationFrameRef.current)
    }
    
    wheelAnimationFrameRef.current = requestAnimationFrame(() => {
      const delta = accumulatedDeltaRef.current * -0.001
      accumulatedDeltaRef.current = 0
      
      if (Math.abs(delta) < 0.01) return
      
      const previousScale = scale
      const newScale = Math.min(Math.max(1, scale + delta), 5)
      
      if (Math.abs(newScale - previousScale) < 0.02) return
      
      if (wheelFocalPointRef.current && newScale > previousScale) {
        const { x, y } = wheelFocalPointRef.current
        const factor = (newScale - previousScale) / previousScale
        const newPosition = {
          x: position.x - x * factor,
          y: position.y - y * factor
        }
        setPosition(applyPanLimits(newPosition))
      } else if (newScale < previousScale) {
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

  const handleMouseDown = (e: React.MouseEvent) => {
    if (scale > 1) {
      setIsPanning(true)
      setStartPos({ x: e.clientX - position.x, y: e.clientY - position.y })
    }
  }

  const handleMouseMove = (e: React.MouseEvent) => {
    if (isPanning && scale > 1) {
      const newPosition = {
        x: e.clientX - startPos.x,
        y: e.clientY - startPos.y
      }
      setPosition(applyPanLimits(newPosition))
    }
  }

  const handleMouseUp = () => {
    setIsPanning(false)
  }

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
        setScale(1.0000001)
        setPosition({ x: 0, y: 0 })
      }
    }
    lastTapRef.current = now
  }

  const getImageStyle = () => {
    if (!hasImage) return {}

    if (scale > 1.001 || scale < 0.999) return {}
    if (hasOpenedOnce && !isClosing) return {}
    if (!originRect) return {}

    const windowWidth = window.innerWidth
    const windowHeight = window.innerHeight

    const centerX = windowWidth / 2
    const centerY = windowHeight / 2

    if (isClosing) {
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

        @keyframes slideDown {
          from { 
            transform: translateY(0);
            opacity: 1;
          }
          to { 
            transform: translateY(100%);
            opacity: 0;
          }
        }

        .animate-slideUp {
          animation: slideUp 0.25s ease-out;
        }

        .animate-slideDown {
          animation: slideDown 0.2s ease-in forwards;
        }

        @keyframes fadeInUp {
          from {
            opacity: 0;
            transform: translateY(20px);
          }
          to {
            opacity: 1;
            transform: translateY(0);
          }
        }

        .animate-fadeInUp {
          animation: fadeInUp 0.4s ease-out;
        }

        .animate-fadeInUp-delayed {
          animation: fadeInUp 0.4s ease-out 0.1s both;
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

      <div
        className="fixed top-3 sm:top-4 left-3 sm:left-4 right-3 sm:right-4 z-112 flex items-center justify-between"
        style={{
          opacity: isClosing ? 0 : 1,
          transition: 'opacity 0.15s ease-out'
        }}
      >
        <button
          onClick={(e) => {
            e.stopPropagation()
            handleClose()
          }}
          disabled={uploading}
          className="flex items-center gap-2 p-2 rounded-full"
          aria-label="Volver"
        >
          <IoMdArrowRoundBack className="w-6 h-6 text-white" strokeWidth={2.5} />
          <span className="text-white font-medium text-sm" style={{ fontFamily: 'MomoTrustDisplay, sans-serif' }}>Imagen del producto</span>
        </button>

        {hasImage ? (
          <div className="flex items-center gap-2">
            <button
              onClick={(e) => {
                e.stopPropagation()
                setShowDeleteModal(true)
              }}
              disabled={uploading}
              className="md:hidden p-3 sm:p-4 rounded-full"
              aria-label="Eliminar imagen"
            >
              <FaRegTrashCan className="w-6 h-6 text-white" />
            </button>

            <button
              onClick={(e) => {
                e.stopPropagation()
                setShowOptions(true)
              }}
              disabled={uploading}
              className="md:hidden p-3 sm:p-4 rounded-full"
              aria-label="Editar imagen"
            >
              <FaPencilAlt className="w-6 h-6 text-white" />
            </button>
          </div>
        ) : (
          <button
            onClick={(e) => {
              e.stopPropagation()
              setShowOptions(true)
            }}
            disabled={uploading}
            className="md:hidden p-3 sm:p-4 rounded-full"
            aria-label="Agregar imagen"
          >
            <LuImagePlus className="w-6 h-6 text-white" />
          </button>
        )}
      </div>

      <div
        className="fixed inset-0 z-111 flex items-center justify-center p-4"
        onClick={(e) => {
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
            if (hasImage) {
              e.stopPropagation()
              handleDoubleTap(e)
            } else {
              e.stopPropagation()
              handleClose()
            }
          }}
          onWheel={hasImage ? handleWheel : undefined}
          onMouseDown={hasImage ? handleMouseDown : undefined}
          onMouseMove={hasImage ? handleMouseMove : undefined}
          onMouseUp={hasImage ? handleMouseUp : undefined}
          onMouseLeave={hasImage ? handleMouseUp : undefined}
          onTouchStart={hasImage ? handleTouchStart : undefined}
          onTouchMove={hasImage ? handleTouchMove : undefined}
          onTouchEnd={hasImage ? handleTouchEnd : undefined}
        >

          {!uploading && hasImage && (
            <img
              key={currentImage}
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

          {!uploading && !hasImage && (
            <div
              className="flex items-center justify-center w-full h-full min-h-[400px]"
              style={{
                opacity: isClosing ? 0 : 1,
                transition: 'opacity 0.15s ease-out'
              }}
            >
              <p className="text-white text-lg px-4 text-center" style={{ fontFamily: 'MomoTrustDisplay, sans-serif' }}>
                No hay imagen del producto
              </p>
            </div>
          )}

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
              closeOptions()
            }}
          />
          
          <div className={`fixed bottom-0 left-0 right-0 bg-white rounded-t-2xl z-113 shadow-2xl ${isClosingOptions ? 'animate-slideDown' : 'animate-slideUp'}`}>
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
                    closeOptions()
                  }}
                  className="flex flex-col items-center gap-2 py-3 rounded-xl animate-fadeInUp-delayed"
                >
                  <div className="w-14 h-14 bg-white rounded-2xl flex items-center justify-center" style={{ border: '2.5px solid black' }}>
                    <PiCameraBold className="w-7 h-7 text-gray-700" />
                  </div>
                  <span className="text-xs text-gray-600 font-medium" style={{ fontFamily: 'MomoTrustDisplay, sans-serif' }}>Foto</span>
                </button>

                <button
                  type="button"
                  onClick={(e) => {
                    e.stopPropagation()
                    handleChooseFromGallery()
                    closeOptions()
                  }}
                  className="flex flex-col items-center gap-2 py-3 rounded-xl animate-fadeInUp-delayed"
                >
                  <div className="w-14 h-14 bg-white rounded-2xl flex items-center justify-center" style={{
                    border: '3px solid transparent',
                    backgroundImage: 'linear-gradient(white, white), linear-gradient(135deg, #ff0000, #ff1a00, #ff3300, #ff4d00, #ff6600, #ff8000, #ff9900, #ffb300, #ffcc00, #ffe600, #ffff00, #e6ff00, #ccff00, #b3ff00, #99ff00, #80ff00, #66ff00, #4dff00, #33ff00, #1aff00, #00ff00, #00ff1a, #00ff33, #00ff4d, #00ff66, #00ff80, #00ff99, #00ffb3, #00ffcc, #00ffe6, #00ffff, #00e6ff, #00ccff, #00b3ff, #0099ff, #0080ff, #0066ff, #004dff, #0033ff, #001aff, #0000ff, #1a00ff, #3300ff, #4d00ff, #6600ff, #8000ff, #9900ff, #b300ff, #cc00ff, #e600ff, #ff00ff, #ff00e6, #ff00cc, #ff00b3, #ff0099, #ff0080, #ff0066, #ff004d, #ff0033, #ff001a, #ff0000)',
                    backgroundOrigin: 'border-box',
                    backgroundClip: 'padding-box, border-box'
                  }}>
                    <GrGallery className="w-7 h-7 text-gray-700" />
                  </div>
                  <span className="text-xs text-gray-600 font-medium" style={{ fontFamily: 'MomoTrustDisplay, sans-serif' }}>Galería</span>
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

      {showDeleteModal && (
        <>
          <div
            className="fixed inset-0 bg-black/50 z-120"
            onClick={() => setShowDeleteModal(false)}
          />

          <div className="fixed inset-0 z-121 flex items-center justify-center p-4" onClick={() => setShowDeleteModal(false)}>
            <div className="bg-white rounded-2xl shadow-2xl max-w-sm w-full mx-4 overflow-hidden" onClick={(e) => e.stopPropagation()}>
              <div className="p-6">
                <h3 className="text-lg font-semibold text-gray-900 mb-2">
                  ¿Eliminar imagen?
                </h3>
                <p className="text-sm text-gray-600 mb-6">
                  Esta acción eliminará la imagen del producto. ¿Deseas continuar?
                </p>

                <div className="flex gap-3">
                  <button
                    onClick={() => setShowDeleteModal(false)}
                    disabled={uploading}
                    className="flex-1 px-4 py-3 bg-gray-100 text-gray-700 rounded-xl font-medium disabled:opacity-50"
                    style={{ fontFamily: 'MomoTrustDisplay, sans-serif' }}
                  >
                    Cancelar
                  </button>
                  <button
                    onClick={handleDeleteImage}
                    disabled={uploading}
                    className="flex-1 px-4 py-3 bg-red-500 text-white rounded-xl font-medium disabled:opacity-50"
                    style={{ fontFamily: 'MomoTrustDisplay, sans-serif' }}
                  >
                    Eliminar
                  </button>
                </div>
              </div>
            </div>
          </div>
        </>
      )}
    </>
  )
}