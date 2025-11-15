'use client'

import { useState, useRef, useEffect, useMemo, useCallback } from 'react'
import { PiCameraRotate } from "react-icons/pi"

// ============================================================================
// TIPOS Y CONSTANTES
// ============================================================================

type ResizeHandle = 'nw' | 'ne' | 'sw' | 'se'
type Rotation = 0 | 90 | 180 | 270

interface CropArea {
  x: number
  y: number
  width: number
  height: number
}

interface ImageBounds {
  x: number
  y: number
  left: number
  top: number
  right: number
  bottom: number
  width: number
  height: number
}

interface Size {
  width: number
  height: number
}

const CROP_CONFIG = {
  OUTPUT_SIZE: 800,
  MIN_CROP_SIZE: 100,
  WEBP_QUALITY: 0.85,
  RESIZE_SENSITIVITY: 0.02,
  CORNER_SIZE: 30,
  TOUCH_TARGET_SIZE: 48,
  GRID_OPACITY: 0.2,
  IMAGE_LOAD_TIMEOUT: 10000
} as const

// ============================================================================
// UTILIDADES PURAS (Funciones matemáticas sin efectos secundarios)
// ============================================================================

/**
 * Normaliza la rotación a 0, 90, 180 o 270
 */
const normalizeRotation = (rotation: number): Rotation => {
  const normalized = ((rotation % 360) + 360) % 360
  return (Math.round(normalized / 90) * 90) as Rotation
}

/**
 * Determina si la rotación es vertical (90° o 270°)
 */
const isVerticalOrientation = (rotation: Rotation): boolean => {
  return rotation === 90 || rotation === 270
}

/**
 * Calcula dimensiones escaladas para que quepan en el contenedor
 */
const calculateScaledDimensions = (
  naturalSize: Size,
  containerSize: Size
): Size => {
  const widthRatio = containerSize.width / naturalSize.width
  const heightRatio = containerSize.height / naturalSize.height
  const ratio = Math.min(widthRatio, heightRatio, 1) // Nunca agrandar
  
  return {
    width: naturalSize.width * ratio,
    height: naturalSize.height * ratio
  }
}

/**
 * Calcula el área de crop inicial centrada
 */
const calculateInitialCropArea = (
  imageBounds: ImageBounds
): CropArea => {
  const cropSize = Math.min(imageBounds.width, imageBounds.height)
  
  return {
    x: imageBounds.left + (imageBounds.width - cropSize) / 2,
    y: imageBounds.top + (imageBounds.height - cropSize) / 2,
    width: cropSize,
    height: cropSize
  }
}

/**
 * Aplica límites al área de crop para que no salga de la imagen
 */
const applyBoundsToArea = (
  area: CropArea,
  bounds: ImageBounds,
  minSize: number = CROP_CONFIG.MIN_CROP_SIZE
): CropArea => {
  const constrainedWidth = Math.max(minSize, Math.min(area.width, bounds.width))
  const constrainedHeight = Math.max(minSize, Math.min(area.height, bounds.height))
  
  const constrainedX = Math.max(
    bounds.left,
    Math.min(area.x, bounds.right - constrainedWidth)
  )
  const constrainedY = Math.max(
    bounds.top,
    Math.min(area.y, bounds.bottom - constrainedHeight)
  )
  
  return {
    x: constrainedX,
    y: constrainedY,
    width: constrainedWidth,
    height: constrainedHeight
  }
}

// ============================================================================
// COMPONENTE PRINCIPAL
// ============================================================================

interface ImageCropModalProps {
  imageUrl: string
  onClose: () => void
  onCropComplete: (croppedImageBlob: Blob) => Promise<void>
}

export default function ImageCropModal({ 
  imageUrl, 
  onClose, 
  onCropComplete 
}: ImageCropModalProps) {
  // ============================================================================
  // ESTADO
  // ============================================================================
  
  const [rotation, setRotation] = useState<Rotation>(0)
  const [displayRotation, setDisplayRotation] = useState(0) // Para animación continua
  const [uploading, setUploading] = useState(false)
  const [imageDimensions, setImageDimensions] = useState<Size>({ width: 0, height: 0 })
  const [cropArea, setCropArea] = useState<CropArea>({ x: 50, y: 50, width: 300, height: 300 })
  const [isDragging, setIsDragging] = useState(false)
  const [isResizing, setIsResizing] = useState<ResizeHandle | null>(null)
  const [dragStart, setDragStart] = useState({ x: 0, y: 0, cropX: 0, cropY: 0 })
  const [imageLoadError, setImageLoadError] = useState<string | null>(null)

  // ============================================================================
  // REFS
  // ============================================================================
  
  const containerRef = useRef<HTMLDivElement>(null)
  const imageRef = useRef<HTMLImageElement>(null)
  const isInitializedRef = useRef(false)
  const imageLoadTimeoutRef = useRef<NodeJS.Timeout | null>(null)
  
  // Guarda dimensiones para cada orientación (evita recalcular)
  const savedDimensionsRef = useRef<{
    horizontal: Size | null
    vertical: Size | null
  }>({
    horizontal: null,
    vertical: null
  })

  // ============================================================================
  // COMPUTED VALUES (Memoizados)
  // ============================================================================
  
  /**
   * Calcula los límites actuales de la imagen considerando rotación
   */
  const imageBounds = useMemo((): ImageBounds | null => {
    if (!containerRef.current || imageDimensions.width === 0) return null

    const containerRect = containerRef.current.getBoundingClientRect()
    const normalizedRotation = normalizeRotation(rotation)
    
    // Dimensiones efectivas considerando rotación
    let effectiveWidth = imageDimensions.width
    let effectiveHeight = imageDimensions.height

    if (isVerticalOrientation(normalizedRotation)) {
      effectiveWidth = imageDimensions.height
      effectiveHeight = imageDimensions.width
    }

    const left = (containerRect.width - effectiveWidth) / 2
    const top = (containerRect.height - effectiveHeight) / 2

    return {
      left,
      top,
      right: left + effectiveWidth,
      bottom: top + effectiveHeight,
      width: effectiveWidth,
      height: effectiveHeight,
      x: left,
      y: top
    }
  }, [imageDimensions.width, imageDimensions.height, rotation])

  /**
   * Estilo de la imagen (memoizado para evitar re-renders)
   */
  const imageStyle = useMemo(() => ({
    width: `${imageDimensions.width}px`,
    height: `${imageDimensions.height}px`,
    transform: `rotate(${displayRotation}deg)`,
    transition: 'transform 0.3s ease',
    objectFit: 'contain' as const
  }), [imageDimensions.width, imageDimensions.height, displayRotation])

  // ============================================================================
  // EFECTO: Carga inicial de imagen (UNA SOLA VEZ)
  // ============================================================================
  
  useEffect(() => {
    if (isInitializedRef.current) return
    
    let cancelled = false
    const img = new Image()

    // Timeout de seguridad
    imageLoadTimeoutRef.current = setTimeout(() => {
      if (!cancelled) {
        setImageLoadError('Timeout al cargar imagen')
      }
    }, CROP_CONFIG.IMAGE_LOAD_TIMEOUT)

    img.onload = () => {
      if (cancelled || !containerRef.current) return
      
      if (imageLoadTimeoutRef.current) {
        clearTimeout(imageLoadTimeoutRef.current)
      }

      isInitializedRef.current = true

      const container = containerRef.current
      const containerSize = {
        width: container.clientWidth,
        height: container.clientHeight
      }

      const naturalSize = {
        width: img.naturalWidth,
        height: img.naturalHeight
      }

      // Calcular dimensiones escaladas
      const scaledDimensions = calculateScaledDimensions(naturalSize, containerSize)
      setImageDimensions(scaledDimensions)

      // Guardar dimensiones para orientación horizontal
      savedDimensionsRef.current.horizontal = scaledDimensions

      // Calcular bounds temporales para el crop inicial
      const tempBounds: ImageBounds = {
        left: (containerSize.width - scaledDimensions.width) / 2,
        top: (containerSize.height - scaledDimensions.height) / 2,
        right: (containerSize.width + scaledDimensions.width) / 2,
        bottom: (containerSize.height + scaledDimensions.height) / 2,
        width: scaledDimensions.width,
        height: scaledDimensions.height,
        x: (containerSize.width - scaledDimensions.width) / 2,
        y: (containerSize.height - scaledDimensions.height) / 2
      }

      // Calcular área de crop inicial
      const initialCropArea = calculateInitialCropArea(tempBounds)
      setCropArea(initialCropArea)
    }

    img.onerror = () => {
      if (cancelled) return
      
      if (imageLoadTimeoutRef.current) {
        clearTimeout(imageLoadTimeoutRef.current)
      }
      
      setImageLoadError('Error al cargar imagen')
    }

    img.src = imageUrl

    return () => {
      cancelled = true
      img.onload = null
      img.onerror = null
      
      if (imageLoadTimeoutRef.current) {
        clearTimeout(imageLoadTimeoutRef.current)
      }
    }
  }, [imageUrl])

  // ============================================================================
  // EFECTO: Re-escalar imagen al rotar
  // ============================================================================
  
  useEffect(() => {
    if (imageDimensions.width === 0 || !containerRef.current) return

    const container = containerRef.current
    const containerSize = {
      width: container.clientWidth,
      height: container.clientHeight
    }

    const normalizedRotation = normalizeRotation(rotation)
    const isVertical = isVerticalOrientation(normalizedRotation)

    if (isVertical) {
      // Orientación vertical (90° o 270°)
      if (savedDimensionsRef.current.vertical) {
        // Reutilizar dimensiones guardadas
        setImageDimensions(savedDimensionsRef.current.vertical)
      } else {
        // Primera vez en vertical, calcular
        const horizontal = savedDimensionsRef.current.horizontal
        if (!horizontal) return

        // Dimensiones efectivas (invertidas)
        const effectiveSize = {
          width: horizontal.height,
          height: horizontal.width
        }

        // Verificar si necesita reescalar
        const widthRatio = containerSize.width / effectiveSize.width
        const heightRatio = containerSize.height / effectiveSize.height
        const needsRescale = widthRatio < 1 || heightRatio < 1

        if (needsRescale) {
          const newRatio = Math.min(widthRatio, heightRatio)
          const newDimensions = {
            width: horizontal.width * newRatio,
            height: horizontal.height * newRatio
          }
          savedDimensionsRef.current.vertical = newDimensions
          setImageDimensions(newDimensions)
        } else {
          savedDimensionsRef.current.vertical = horizontal
          setImageDimensions(horizontal)
        }
      }
    } else {
      // Orientación horizontal (0° o 180°)
      if (savedDimensionsRef.current.horizontal) {
        setImageDimensions(savedDimensionsRef.current.horizontal)
      }
    }
  }, [rotation, imageDimensions.width])

  // ============================================================================
  // EFECTO: Ajustar cuadrícula al cambiar imagen/rotación
  // ============================================================================
  
  useEffect(() => {
    if (!imageBounds) return

    const newCropArea = calculateInitialCropArea(imageBounds)
    setCropArea(newCropArea)
  }, [imageBounds])

  // ============================================================================
  // HANDLERS: Drag & Resize (Memoizados)
  // ============================================================================
  
  const handleMouseDown = useCallback((e: React.MouseEvent, type: string) => {
    e.preventDefault()
    e.stopPropagation()

    if (type === 'move') {
      setIsDragging(true)
    } else {
      setIsResizing(type as ResizeHandle)
    }

    setDragStart({
      x: e.clientX,
      y: e.clientY,
      cropX: cropArea.x,
      cropY: cropArea.y
    })
  }, [cropArea.x, cropArea.y])

  const handleTouchStart = useCallback((e: React.TouchEvent, type: string) => {
    e.stopPropagation()
    const touch = e.touches[0]

    if (type === 'move') {
      setIsDragging(true)
    } else {
      setIsResizing(type as ResizeHandle)
    }

    setDragStart({
      x: touch.clientX,
      y: touch.clientY,
      cropX: cropArea.x,
      cropY: cropArea.y
    })
  }, [cropArea.x, cropArea.y])

  // ============================================================================
  // EFECTO: Manejo de movimiento (drag/resize)
  // ============================================================================
  
  useEffect(() => {
    if (!isDragging && !isResizing) return
    if (!imageBounds) return

    const handleMove = (clientX: number, clientY: number) => {
      const deltaX = clientX - dragStart.x
      const deltaY = clientY - dragStart.y

      if (isDragging) {
        // DRAG: Mover cuadrícula
        setCropArea(prev => {
          const newArea = {
            x: dragStart.cropX + deltaX,
            y: dragStart.cropY + deltaY,
            width: prev.width,
            height: prev.height
          }
          return applyBoundsToArea(newArea, imageBounds)
        })
      } else if (isResizing) {
        // RESIZE: Redimensionar cuadrícula
        setCropArea(prev => {
          const adjustedDeltaX = deltaX * CROP_CONFIG.RESIZE_SENSITIVITY
          const adjustedDeltaY = deltaY * CROP_CONFIG.RESIZE_SENSITIVITY

          let newWidth = prev.width
          let newHeight = prev.height
          let newX = prev.x
          let newY = prev.y

          switch (isResizing) {
            case 'nw':
              newWidth = prev.width - adjustedDeltaX
              newHeight = prev.height - adjustedDeltaY
              newX = dragStart.cropX + adjustedDeltaX
              newY = dragStart.cropY + adjustedDeltaY
              break
            case 'ne':
              newWidth = prev.width + adjustedDeltaX
              newHeight = prev.height - adjustedDeltaY
              newX = dragStart.cropX
              newY = dragStart.cropY + adjustedDeltaY
              break
            case 'sw':
              newWidth = prev.width - adjustedDeltaX
              newHeight = prev.height + adjustedDeltaY
              newX = dragStart.cropX + adjustedDeltaX
              newY = dragStart.cropY
              break
            case 'se':
              newWidth = prev.width + adjustedDeltaX
              newHeight = prev.height + adjustedDeltaY
              newX = dragStart.cropX
              newY = dragStart.cropY
              break
          }

          // Mantener aspecto cuadrado
          let size = Math.min(Math.abs(newWidth), Math.abs(newHeight))
          size = Math.max(CROP_CONFIG.MIN_CROP_SIZE, size)

          // Calcular límites según esquina
          const maxWidthFromLeft = imageBounds.right - newX
          const maxHeightFromTop = imageBounds.bottom - newY
          const maxWidthFromRight = prev.x + prev.width - imageBounds.left
          const maxHeightFromBottom = prev.y + prev.height - imageBounds.top

          switch (isResizing) {
            case 'nw':
              size = Math.min(size, maxWidthFromRight, maxHeightFromBottom)
              newX = prev.x + prev.width - size
              newY = prev.y + prev.height - size
              newX = Math.max(imageBounds.left, newX)
              newY = Math.max(imageBounds.top, newY)
              break
            case 'ne':
              size = Math.min(size, maxWidthFromLeft, maxHeightFromBottom)
              newY = prev.y + prev.height - size
              newY = Math.max(imageBounds.top, newY)
              break
            case 'sw':
              size = Math.min(size, maxWidthFromRight, maxHeightFromTop)
              newX = prev.x + prev.width - size
              newX = Math.max(imageBounds.left, newX)
              break
            case 'se':
              size = Math.min(size, maxWidthFromLeft, maxHeightFromTop)
              break
          }

          return { x: newX, y: newY, width: size, height: size }
        })
      }
    }

    const handleMouseMove = (e: MouseEvent) => {
      handleMove(e.clientX, e.clientY)
    }

    const handleTouchMove = (e: TouchEvent) => {
      if (e.touches.length > 0) {
        e.preventDefault()
        handleMove(e.touches[0].clientX, e.touches[0].clientY)
      }
    }

    const handleEnd = () => {
      setIsDragging(false)
      setIsResizing(null)
    }

    window.addEventListener('mousemove', handleMouseMove)
    window.addEventListener('mouseup', handleEnd)
    window.addEventListener('touchmove', handleTouchMove, { passive: false })
    window.addEventListener('touchend', handleEnd)

    return () => {
      window.removeEventListener('mousemove', handleMouseMove)
      window.removeEventListener('mouseup', handleEnd)
      window.removeEventListener('touchmove', handleTouchMove)
      window.removeEventListener('touchend', handleEnd)
    }
  }, [isDragging, isResizing, dragStart, imageBounds])

  // ============================================================================
  // HANDLER: Crear imagen recortada
  // ============================================================================
  
  const createCroppedImage = useCallback(async (): Promise<Blob> => {
    return new Promise((resolve, reject) => {
      if (!imageBounds) {
        reject(new Error('Bounds de imagen no disponibles'))
        return
      }

      const image = new Image()
      image.src = imageUrl

      const timeout = setTimeout(() => {
        reject(new Error('Timeout al procesar imagen'))
      }, CROP_CONFIG.IMAGE_LOAD_TIMEOUT)

      image.onload = () => {
        clearTimeout(timeout)

        const canvas = document.createElement('canvas')
        const ctx = canvas.getContext('2d')

        if (!ctx) {
          reject(new Error('No se pudo crear el canvas'))
          return
        }

        const SIZE = CROP_CONFIG.OUTPUT_SIZE
        canvas.width = SIZE
        canvas.height = SIZE

        // Fondo blanco
        ctx.fillStyle = '#FFFFFF'
        ctx.fillRect(0, 0, SIZE, SIZE)

        const normalizedRotation = normalizeRotation(rotation)
        const horizontalDims = savedDimensionsRef.current.horizontal

        if (!horizontalDims) {
          reject(new Error('No se encontraron dimensiones originales'))
          return
        }

        // Calcular coordenadas de recorte en espacio de imagen mostrada
        const displayCropX = cropArea.x - imageBounds.left
        const displayCropY = cropArea.y - imageBounds.top
        const displayCropSize = cropArea.width

        // PASO 1: Canvas temporal con imagen rotada
        const tempCanvas = document.createElement('canvas')
        const tempCtx = tempCanvas.getContext('2d')

        if (!tempCtx) {
          reject(new Error('No se pudo crear canvas temporal'))
          return
        }

        // Dimensiones del canvas temporal según rotación
        if (normalizedRotation === 90 || normalizedRotation === 270) {
          tempCanvas.width = image.naturalHeight
          tempCanvas.height = image.naturalWidth
        } else {
          tempCanvas.width = image.naturalWidth
          tempCanvas.height = image.naturalHeight
        }

        // Rotar imagen completa
        const tempCenterX = tempCanvas.width / 2
        const tempCenterY = tempCanvas.height / 2

        tempCtx.translate(tempCenterX, tempCenterY)
        tempCtx.rotate((rotation * Math.PI) / 180)
        tempCtx.drawImage(
          image,
          -image.naturalWidth / 2,
          -image.naturalHeight / 2,
          image.naturalWidth,
          image.naturalHeight
        )

        // PASO 2: Calcular factor de escala
        const scaleToOriginal = tempCanvas.width / imageBounds.width

        // PASO 3: Escalar coordenadas de recorte
        const scaledCropX = displayCropX * scaleToOriginal
        const scaledCropY = displayCropY * scaleToOriginal
        const scaledCropSize = displayCropSize * scaleToOriginal

        // PASO 4: Dibujar recorte en canvas final
        ctx.drawImage(
          tempCanvas,
          scaledCropX,
          scaledCropY,
          scaledCropSize,
          scaledCropSize,
          0,
          0,
          SIZE,
          SIZE
        )

        // Convertir a blob
        canvas.toBlob(
          (blob) => {
            if (blob) {
              resolve(blob)
            } else {
              reject(new Error('Error al crear imagen'))
            }
          },
          'image/webp',
          CROP_CONFIG.WEBP_QUALITY
        )
      }

      image.onerror = () => {
        clearTimeout(timeout)
        reject(new Error('Error al cargar imagen'))
      }
    })
  }, [imageUrl, rotation, cropArea, imageBounds])

  // ============================================================================
  // HANDLER: Guardar
  // ============================================================================
  
  const handleSave = useCallback(async () => {
    setUploading(true)
    setImageLoadError(null)

    try {
      const croppedBlob = await createCroppedImage()
      await onCropComplete(croppedBlob)
    } catch (error) {
      console.error('Error al procesar imagen:', error)
      setImageLoadError(error instanceof Error ? error.message : 'Error al procesar imagen')
    } finally {
      setUploading(false)
    }
  }, [createCroppedImage, onCropComplete])

  // ============================================================================
  // HANDLER: Rotar
  // ============================================================================
  
  const handleRotate = useCallback(() => {
    setDisplayRotation(prev => prev + 90) // Siempre incrementa sin resetear
    setRotation(prev => {
      const next = prev + 90
      return (next >= 360 ? next - 360 : next) as Rotation
    })
  }, [])

  // ============================================================================
  // RENDER
  // ============================================================================

  if (imageLoadError) {
    return (
      <div className="fixed inset-0 bg-black z-121 flex items-center justify-center">
        <div className="text-white text-center px-4">
          <p className="text-lg mb-4">{imageLoadError}</p>
          <button
            onClick={onClose}
            className="px-6 py-2 bg-white text-black rounded-lg"
          >
            Cerrar
          </button>
        </div>
      </div>
    )
  }

  return (
    <>
      <div
        className="fixed inset-0 bg-black z-120"
        onClick={(e) => e.stopPropagation()}
      />

      <div
        className="fixed inset-0 z-121 flex flex-col"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Canvas de visualización */}
        <div
          ref={containerRef}
          className="flex-1 relative bg-black flex items-center justify-center overflow-hidden"
          onClick={(e) => e.stopPropagation()}
        >
          {/* Imagen */}
          <img
            ref={imageRef}
            src={imageUrl}
            alt="Imagen a recortar"
            className="absolute pointer-events-none"
            style={imageStyle}
          />

          {/* Overlay oscuro con recorte */}
          {imageBounds && (
            <div
              className="absolute inset-0 pointer-events-none"
              style={{
                background: 'rgba(0, 0, 0, 0.6)',
                clipPath: `polygon(
                  0% 0%, 0% 100%, 100% 100%, 100% 0%, 0% 0%,
                  ${cropArea.x}px ${cropArea.y}px,
                  ${cropArea.x + cropArea.width}px ${cropArea.y}px,
                  ${cropArea.x + cropArea.width}px ${cropArea.y + cropArea.height}px,
                  ${cropArea.x}px ${cropArea.y + cropArea.height}px,
                  ${cropArea.x}px ${cropArea.y}px
                )`
              }}
            />
          )}

          {/* Cuadrícula de crop */}
          {imageBounds && (
            <div
              className="absolute cursor-move touch-none border border-white/20"
              style={{
                left: `${cropArea.x}px`,
                top: `${cropArea.y}px`,
                width: `${cropArea.width}px`,
                height: `${cropArea.height}px`,
              }}
              onClick={(e) => e.stopPropagation()}
              onMouseDown={(e) => handleMouseDown(e, 'move')}
              onTouchStart={(e) => handleTouchStart(e, 'move')}
            >
              {/* Grid de regla de tercios */}
              <svg className="absolute inset-0 pointer-events-none" width="100%" height="100%">
                <line x1="33.33%" y1="0" x2="33.33%" y2="100%" stroke="white" strokeWidth="1" opacity={CROP_CONFIG.GRID_OPACITY} />
                <line x1="66.66%" y1="0" x2="66.66%" y2="100%" stroke="white" strokeWidth="1" opacity={CROP_CONFIG.GRID_OPACITY} />
                <line x1="0" y1="33.33%" x2="100%" y2="33.33%" stroke="white" strokeWidth="1" opacity={CROP_CONFIG.GRID_OPACITY} />
                <line x1="0" y1="66.66%" x2="100%" y2="66.66%" stroke="white" strokeWidth="1" opacity={CROP_CONFIG.GRID_OPACITY} />
              </svg>

              {/* Esquinas decorativas */}
              <div className="absolute -inset-0.5 pointer-events-none">
                {/* Esquina superior izquierda */}
                <div className="absolute top-0 left-0">
                  <div className={`absolute top-0 left-0 w-[${CROP_CONFIG.CORNER_SIZE}px] h-[3px] bg-white`} />
                  <div className={`absolute top-0 left-0 w-[3px] h-[${CROP_CONFIG.CORNER_SIZE}px] bg-white`} />
                </div>
                {/* Esquina superior derecha */}
                <div className="absolute top-0 right-0">
                  <div className={`absolute top-0 right-0 w-[${CROP_CONFIG.CORNER_SIZE}px] h-[3px] bg-white`} />
                  <div className={`absolute top-0 right-0 w-[3px] h-[${CROP_CONFIG.CORNER_SIZE}px] bg-white`} />
                </div>
                {/* Esquina inferior izquierda */}
                <div className="absolute bottom-0 left-0">
                  <div className={`absolute bottom-0 left-0 w-[${CROP_CONFIG.CORNER_SIZE}px] h-[3px] bg-white`} />
                  <div className={`absolute bottom-0 left-0 w-[3px] h-[${CROP_CONFIG.CORNER_SIZE}px] bg-white`} />
                </div>
                {/* Esquina inferior derecha */}
                <div className="absolute bottom-0 right-0">
                  <div className={`absolute bottom-0 right-0 w-[${CROP_CONFIG.CORNER_SIZE}px] h-[3px] bg-white`} />
                  <div className={`absolute bottom-0 right-0 w-[3px] h-[${CROP_CONFIG.CORNER_SIZE}px] bg-white`} />
                </div>
              </div>

              {/* Touch targets para resize */}
              <div
                className="absolute -top-4 -left-4 w-12 h-12 cursor-nw-resize z-10"
                onMouseDown={(e) => handleMouseDown(e, 'nw')}
                onTouchStart={(e) => handleTouchStart(e, 'nw')}
              />
              <div
                className="absolute -top-4 -right-4 w-12 h-12 cursor-ne-resize z-10"
                onMouseDown={(e) => handleMouseDown(e, 'ne')}
                onTouchStart={(e) => handleTouchStart(e, 'ne')}
              />
              <div
                className="absolute -bottom-4 -left-4 w-12 h-12 cursor-sw-resize z-10"
                onMouseDown={(e) => handleMouseDown(e, 'sw')}
                onTouchStart={(e) => handleTouchStart(e, 'sw')}
              />
              <div
                className="absolute -bottom-4 -right-4 w-12 h-12 cursor-se-resize z-10"
                onMouseDown={(e) => handleMouseDown(e, 'se')}
                onTouchStart={(e) => handleTouchStart(e, 'se')}
              />
            </div>
          )}

          {/* Indicador de dimensiones durante resize */}
          {isResizing && (
            <div className="absolute top-4 left-1/2 -translate-x-1/2 bg-black/80 text-white px-3 py-1 rounded-lg text-sm font-mono pointer-events-none">
              {Math.round(cropArea.width)} × {Math.round(cropArea.height)}
            </div>
          )}

          {/* Indicador de rotación */}
          {rotation !== 0 && (
            <div className="absolute top-4 right-4 bg-black/60 text-white px-2 py-1 rounded text-xs pointer-events-none">
              {rotation}°
            </div>
          )}
        </div>

        {/* Controles inferiores */}
        <div className="bg-black px-6 pb-6 pt-4">
          <div className="flex items-center justify-between">
            <button
              onClick={(e) => {
                e.stopPropagation()
                onClose()
              }}
              disabled={uploading}
              className="text-white text-[17px] font-normal disabled:opacity-50 min-w-[90px] text-left"
              style={{ fontFamily: 'MomoTrustDisplay, sans-serif' }}
            >
              Cancelar
            </button>

            <button
              onClick={(e) => {
                e.stopPropagation()
                handleRotate()
              }}
              disabled={uploading}
              className="flex items-center justify-center disabled:opacity-50"
              aria-label="Rotar 90°"
            >
              <div className="w-12 h-12 flex items-center justify-center">
                <PiCameraRotate className="w-7 h-7 text-white" strokeWidth={2.5} />
              </div>
            </button>

            <button
              onClick={(e) => {
                e.stopPropagation()
                handleSave()
              }}
              disabled={uploading}
              className="text-white text-[17px] font-normal disabled:opacity-50 min-w-[90px] text-right"
              style={{ fontFamily: 'MomoTrustDisplay, sans-serif' }}
            >
              {uploading ? 'Subiendo...' : 'OK'}
            </button>
          </div>
        </div>
      </div>
    </>
  )
}