'use client'

import { useState, useRef, useEffect } from 'react'
import { RotateCw } from 'lucide-react'

interface ImageCropModalProps {
  imageUrl: string
  onClose: () => void
  onCropComplete: (croppedImageBlob: Blob) => Promise<void>
}

interface CropArea {
  x: number
  y: number
  width: number
  height: number
}

export default function ImageCropModal({ imageUrl, onClose, onCropComplete }: ImageCropModalProps) {
  const [rotation, setRotation] = useState(0)
  const [uploading, setUploading] = useState(false)
  const [imageDimensions, setImageDimensions] = useState({ width: 0, height: 0 })
  const [cropArea, setCropArea] = useState<CropArea>({ x: 50, y: 50, width: 300, height: 300 })
  const [isDragging, setIsDragging] = useState(false)
  const [isResizing, setIsResizing] = useState<string | null>(null)
  const [dragStart, setDragStart] = useState({ x: 0, y: 0, cropX: 0, cropY: 0 })

  const containerRef = useRef<HTMLDivElement>(null)
  const imageRef = useRef<HTMLImageElement>(null)

  // Guardar dimensiones para cada orientación (horizontal y vertical)
  const savedDimensionsRef = useRef<{
    horizontal: { width: number; height: number } | null
    vertical: { width: number; height: number } | null
  }>({
    horizontal: null,
    vertical: null
  })

  // Declarar scaledWidth y scaledHeight AQUÍ ARRIBA
  const scaledWidth = imageDimensions.width
  const scaledHeight = imageDimensions.height

  // Cargar dimensiones de la imagen SOLO UNA VEZ al inicio
  useEffect(() => {
    const img = new Image()
    img.src = imageUrl
    img.onload = () => {
      const container = containerRef.current
      if (!container) return

      // Solo calcular una vez al cargar la imagen
      if (imageDimensions.width !== 0) return

      const containerWidth = container.clientWidth
      const containerHeight = container.clientHeight

      const naturalWidth = img.naturalWidth
      const naturalHeight = img.naturalHeight

      // Calcular dimensiones para que la imagen quepa en el contenedor
      let displayWidth = naturalWidth
      let displayHeight = naturalHeight

      const widthRatio = containerWidth / displayWidth
      const heightRatio = containerHeight / displayHeight

      // Usar Math.min para que la imagen quepa completamente sin salirse
      // Ratio de 1.0 significa que tocará los bordes pero nunca se saldrá
      let ratio = Math.min(widthRatio, heightRatio)

      displayWidth = displayWidth * ratio
      displayHeight = displayHeight * ratio

      setImageDimensions({ width: displayWidth, height: displayHeight })

      // Guardar dimensiones iniciales para orientación horizontal (0° y 180°)
      savedDimensionsRef.current.horizontal = { width: displayWidth, height: displayHeight }

      // Calcular la posición de la imagen en el contenedor
      const imgLeft = (containerWidth - displayWidth) / 2
      const imgTop = (containerHeight - displayHeight) / 2

      // Área de crop inicial - usar el 100% del espacio disponible
      const initialCropSize = Math.min(displayWidth, displayHeight)

      // Centrar la cuadrícula dentro de la imagen
      const cropX = imgLeft + (displayWidth - initialCropSize) / 2
      const cropY = imgTop + (displayHeight - initialCropSize) / 2

      setCropArea({
        x: cropX,
        y: cropY,
        width: initialCropSize,
        height: initialCropSize
      })
    }
  }, [imageUrl])

  // Helper function para obtener los límites reales de la imagen considerando rotación
  const getImageBounds = () => {
    if (!imageRef.current || !containerRef.current) return null

    const containerRect = containerRef.current.getBoundingClientRect()

    // Calcular dimensiones efectivas considerando rotación
    const normalizedRotation = ((rotation % 360) + 360) % 360
    let effectiveWidth = scaledWidth
    let effectiveHeight = scaledHeight

    // Si está rotada 90° o 270°, intercambiar dimensiones
    if (normalizedRotation === 90 || normalizedRotation === 270) {
      effectiveWidth = scaledHeight
      effectiveHeight = scaledWidth
    }

    const imgLeft = (containerRect.width - effectiveWidth) / 2
    const imgTop = (containerRect.height - effectiveHeight) / 2

    return {
      left: imgLeft,
      top: imgTop,
      right: imgLeft + effectiveWidth,
      bottom: imgTop + effectiveHeight,
      width: effectiveWidth,
      height: effectiveHeight
    }
  }

  // Re-escalar imagen cuando gira usando dimensiones guardadas
  useEffect(() => {
    if (imageDimensions.width === 0 || !containerRef.current) return

    const container = containerRef.current
    const containerWidth = container.clientWidth
    const containerHeight = container.clientHeight

    // Determinar orientación: 0°/180° = horizontal, 90°/270° = vertical
    const normalizedRotation = ((rotation % 360) + 360) % 360
    const isVertical = normalizedRotation === 90 || normalizedRotation === 270

    if (isVertical) {
      // Orientación vertical (90° o 270°)
      if (savedDimensionsRef.current.vertical) {
        // Ya tenemos dimensiones guardadas para vertical, reutilizarlas
        setImageDimensions(savedDimensionsRef.current.vertical)
      } else {
        // Primera vez en vertical, calcular y guardar
        const horizontal = savedDimensionsRef.current.horizontal
        if (!horizontal) return

        // Calcular dimensiones efectivas (invertidas)
        const effectiveWidth = horizontal.height
        const effectiveHeight = horizontal.width

        // Verificar si necesita reescalar
        const widthRatio = containerWidth / effectiveWidth
        const heightRatio = containerHeight / effectiveHeight
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
          // No necesita reescalar, usar dimensiones horizontales
          savedDimensionsRef.current.vertical = horizontal
          setImageDimensions(horizontal)
        }
      }
    } else {
      // Orientación horizontal (0° o 180°)
      if (savedDimensionsRef.current.horizontal) {
        // Volver a las dimensiones horizontales originales
        setImageDimensions(savedDimensionsRef.current.horizontal)
      }
    }
  }, [rotation])

  // Ajustar cuadrícula cuando cambian las dimensiones de la imagen o la rotación
  useEffect(() => {
    if (imageDimensions.width === 0) return

    const bounds = getImageBounds()
    if (!bounds) return

    // SIEMPRE recalcular el tamaño óptimo basado en los bounds actuales
    // Esto garantiza que funcione con cualquier imagen, sin importar su tamaño
    const cropSize = Math.min(bounds.width, bounds.height)

    // Centrar la cuadrícula perfectamente en la imagen
    const newX = bounds.left + (bounds.width - cropSize) / 2
    const newY = bounds.top + (bounds.height - cropSize) / 2

    setCropArea({
      x: newX,
      y: newY,
      width: cropSize,
      height: cropSize
    })
  }, [rotation, imageDimensions, scaledWidth, scaledHeight])

  const handleMouseDown = (e: React.MouseEvent, type: string) => {
    e.preventDefault()
    e.stopPropagation()

    if (type === 'move') {
      setIsDragging(true)
    } else {
      setIsResizing(type)
    }

    setDragStart({
      x: e.clientX,
      y: e.clientY,
      cropX: cropArea.x,
      cropY: cropArea.y
    })
  }

  const handleTouchStart = (e: React.TouchEvent, type: string) => {
    e.stopPropagation()
    const touch = e.touches[0]

    if (type === 'move') {
      setIsDragging(true)
    } else {
      setIsResizing(type)
    }

    setDragStart({
      x: touch.clientX,
      y: touch.clientY,
      cropX: cropArea.x,
      cropY: cropArea.y
    })
  }

  useEffect(() => {
    const handleMove = (clientX: number, clientY: number) => {
      if (!isDragging && !isResizing) return

      const bounds = getImageBounds()
      if (!bounds) return

      const deltaX = clientX - dragStart.x
      const deltaY = clientY - dragStart.y

      if (isDragging) {
        // Mover la cuadrícula con límites
        setCropArea(prev => {
          let newX = dragStart.cropX + deltaX
          let newY = dragStart.cropY + deltaY

          // Limitar para que no salga de la imagen
          newX = Math.max(bounds.left, Math.min(newX, bounds.right - prev.width))
          newY = Math.max(bounds.top, Math.min(newY, bounds.bottom - prev.height))

          return { ...prev, x: newX, y: newY }
        })
      } else if (isResizing) {
        // Redimensionar la cuadrícula con límites y más precisión
        setCropArea(prev => {
          const minSize = 100
          let newWidth = prev.width
          let newHeight = prev.height
          let newX = prev.x
          let newY = prev.y

          // Sensibilidad de 1px por cada 50px de movimiento
          const RESIZE_SENSITIVITY = 0.02
          const adjustedDeltaX = deltaX * RESIZE_SENSITIVITY
          const adjustedDeltaY = deltaY * RESIZE_SENSITIVITY

          switch (isResizing) {
            case 'nw':
              // Esquina superior izquierda: achica/agranda desde arriba-izquierda
              newWidth = prev.width - adjustedDeltaX
              newHeight = prev.height - adjustedDeltaY
              newX = dragStart.cropX + adjustedDeltaX
              newY = dragStart.cropY + adjustedDeltaY
              break
            case 'ne':
              // Esquina superior derecha: achica/agranda desde arriba-derecha
              newWidth = prev.width + adjustedDeltaX
              newHeight = prev.height - adjustedDeltaY
              newX = dragStart.cropX
              newY = dragStart.cropY + adjustedDeltaY
              break
            case 'sw':
              // Esquina inferior izquierda: achica/agranda desde abajo-izquierda
              newWidth = prev.width - adjustedDeltaX
              newHeight = prev.height + adjustedDeltaY
              newX = dragStart.cropX + adjustedDeltaX
              newY = dragStart.cropY
              break
            case 'se':
              // Esquina inferior derecha: achica/agranda desde abajo-derecha
              newWidth = prev.width + adjustedDeltaX
              newHeight = prev.height + adjustedDeltaY
              newX = dragStart.cropX
              newY = dragStart.cropY
              break
          }

          // Mantener aspecto cuadrado - usar el MENOR cambio para más control y suavidad
          let size = Math.min(Math.abs(newWidth), Math.abs(newHeight))
          size = Math.max(minSize, size)

          // Limitar el tamaño para que no salga de la imagen
          const maxWidthFromLeft = bounds.right - newX
          const maxHeightFromTop = bounds.bottom - newY
          const maxWidthFromRight = prev.x + prev.width - bounds.left
          const maxHeightFromBottom = prev.y + prev.height - bounds.top

          switch (isResizing) {
            case 'nw':
              size = Math.min(size, maxWidthFromRight, maxHeightFromBottom)
              // Ajustar posición si el tamaño cambió
              newX = prev.x + prev.width - size
              newY = prev.y + prev.height - size
              // Asegurar que no salga por la izquierda/arriba
              newX = Math.max(bounds.left, newX)
              newY = Math.max(bounds.top, newY)
              break
            case 'ne':
              size = Math.min(size, maxWidthFromLeft, maxHeightFromBottom)
              newY = prev.y + prev.height - size
              newY = Math.max(bounds.top, newY)
              break
            case 'sw':
              size = Math.min(size, maxWidthFromRight, maxHeightFromTop)
              newX = prev.x + prev.width - size
              newX = Math.max(bounds.left, newX)
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

    if (isDragging || isResizing) {
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
    }
  }, [isDragging, isResizing, dragStart, scaledWidth, scaledHeight, rotation])

  const createCroppedImage = async (): Promise<Blob> => {
    return new Promise((resolve, reject) => {
      const image = new Image()
      image.src = imageUrl

      image.onload = () => {
        const canvas = document.createElement('canvas')
        const ctx = canvas.getContext('2d')

        if (!ctx || !containerRef.current) {
          reject(new Error('No se pudo crear el canvas'))
          return
        }

        const SIZE = 800
        canvas.width = SIZE
        canvas.height = SIZE

        ctx.fillStyle = '#FFFFFF'
        ctx.fillRect(0, 0, SIZE, SIZE)

        // Normalizar rotación
        const normalizedRotation = ((rotation % 360) + 360) % 360

        // Obtener las dimensiones de referencia según la orientación
        const horizontalDims = savedDimensionsRef.current.horizontal
        if (!horizontalDims) {
          reject(new Error('No se encontraron dimensiones originales'))
          return
        }

        // Obtener los límites actuales de la imagen mostrada
        const bounds = getImageBounds()
        if (!bounds) {
          reject(new Error('No se pudieron calcular los límites de la imagen'))
          return
        }

        // Calcular coordenadas de recorte en el espacio de la imagen MOSTRADA
        const displayCropX = cropArea.x - bounds.left
        const displayCropY = cropArea.y - bounds.top
        const displayCropSize = cropArea.width

        // PASO 1: Crear canvas temporal con la imagen completamente rotada
        const tempCanvas = document.createElement('canvas')
        const tempCtx = tempCanvas.getContext('2d')

        if (!tempCtx) {
          reject(new Error('No se pudo crear el canvas temporal'))
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

        // Rotar la imagen completa en el canvas temporal
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

        // PASO 2: Calcular el factor de escala basado en el canvas rotado y las dimensiones mostradas
        // El canvas rotado tiene ancho = tempCanvas.width y la imagen mostrada tiene ancho = bounds.width
        const scaleToOriginal = tempCanvas.width / bounds.width

        // PASO 3: Recortar del canvas rotado usando las coordenadas escaladas
        const scaledCropX = displayCropX * scaleToOriginal
        const scaledCropY = displayCropY * scaleToOriginal
        const scaledCropSize = displayCropSize * scaleToOriginal

        // PASO 3: Dibujar el recorte en el canvas final
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

        canvas.toBlob(
          (blob) => {
            if (blob) {
              resolve(blob)
            } else {
              reject(new Error('Error al crear imagen'))
            }
          },
          'image/webp',
          0.85
        )
      }

      image.onerror = () => reject(new Error('Error al cargar imagen'))
    })
  }

  const handleSave = async () => {
    setUploading(true)
    try {
      const croppedBlob = await createCroppedImage()
      await onCropComplete(croppedBlob)
    } catch (error) {
      console.error('Error al procesar imagen:', error)
      alert('Error al procesar la imagen')
    } finally {
      setUploading(false)
    }
  }

  const handleRotate = () => {
    setRotation((prev) => prev + 90)
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
        <div
          ref={containerRef}
          className="flex-1 relative bg-black flex items-center justify-center overflow-hidden"
          onClick={(e) => e.stopPropagation()}
        >
          <img
            ref={imageRef}
            src={imageUrl}
            alt="Imagen a recortar"
            className="absolute pointer-events-none"
            style={{
              width: `${scaledWidth}px`,
              height: `${scaledHeight}px`,
              transform: `rotate(${rotation}deg)`,
              transition: 'transform 0.3s ease',
              objectFit: 'contain'
            }}
          />

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
            <svg className="absolute inset-0 pointer-events-none" width="100%" height="100%">
              <line x1="33.33%" y1="0" x2="33.33%" y2="100%" stroke="white" strokeWidth="1" opacity="0.2" />
              <line x1="66.66%" y1="0" x2="66.66%" y2="100%" stroke="white" strokeWidth="1" opacity="0.2" />
              <line x1="0" y1="33.33%" x2="100%" y2="33.33%" stroke="white" strokeWidth="1" opacity="0.2" />
              <line x1="0" y1="66.66%" x2="100%" y2="66.66%" stroke="white" strokeWidth="1" opacity="0.2" />
            </svg>

            <div className="absolute -inset-0.5 pointer-events-none">
              <div className="absolute top-0 left-0">
                <div className="absolute top-0 left-0 w-[30px] h-[3px] bg-white" />
                <div className="absolute top-0 left-0 w-[3px] h-[30px] bg-white" />
              </div>
              <div className="absolute top-0 right-0">
                <div className="absolute top-0 right-0 w-[30px] h-[3px] bg-white" />
                <div className="absolute top-0 right-0 w-[3px] h-[30px] bg-white" />
              </div>
              <div className="absolute bottom-0 left-0">
                <div className="absolute bottom-0 left-0 w-[30px] h-[3px] bg-white" />
                <div className="absolute bottom-0 left-0 w-[3px] h-[30px] bg-white" />
              </div>
              <div className="absolute bottom-0 right-0">
                <div className="absolute bottom-0 right-0 w-[30px] h-[3px] bg-white" />
                <div className="absolute bottom-0 right-0 w-[3px] h-[30px] bg-white" />
              </div>
            </div>

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
        </div>

        <div className="bg-black px-6 pb-6 pt-4">
          <div className="flex items-center justify-between">
            <button
              onClick={(e) => {
                e.stopPropagation()
                onClose()
              }}
              disabled={uploading}
              className="text-white text-[17px] font-normal disabled:opacity-50 min-w-[90px] text-left"
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
                <RotateCw className="w-7 h-7 text-white" strokeWidth={2.5} />
              </div>
            </button>

            <button
              onClick={(e) => {
                e.stopPropagation()
                handleSave()
              }}
              disabled={uploading}
              className="text-white text-[17px] font-normal disabled:opacity-50 min-w-[90px] text-right"
            >
              {uploading ? 'Subiendo...' : 'OK'}
            </button>
          </div>
        </div>
      </div>
    </>
  )
}