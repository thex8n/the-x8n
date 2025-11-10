'use client'

import { useState, useRef } from 'react'
import Image from 'next/image'
import { Upload, X, ImageIcon, Loader2 } from 'lucide-react'
import { uploadProductImage, deleteProductImage } from '@/app/actions/upload'
import toast from 'react-hot-toast'
import imageCompression from 'browser-image-compression'

interface ImageUploadProps {
  currentImageUrl?: string | null
  onImageChange: (url: string | null) => void
  onImageRemove?: () => void
}

/**
 * Crea una imagen cuadrada 800×800 con estrategia híbrida:
 * - Si ratio entre 0.75 y 1.33 → CROP (recortar al centro)
 * - Si fuera de ese rango → CONTAIN (fondo blanco, imagen completa)
 * 
 * @param file - Archivo de imagen ya comprimido
 * @returns Blob de 800×800 en formato WebP
 */
async function createSquareImage(file: File): Promise<Blob> {
  return new Promise((resolve, reject) => {
    const img = document.createElement('img')
    const canvas = document.createElement('canvas')
    const ctx = canvas.getContext('2d')

    if (!ctx) {
      reject(new Error('No se pudo obtener contexto del canvas'))
      return
    }

    img.onload = () => {
      const originalWidth = img.width
      const originalHeight = img.height
      const aspectRatio = originalWidth / originalHeight

      // Dimensiones finales
      const targetSize = 800
      canvas.width = targetSize
      canvas.height = targetSize

      console.log('📐 Dimensiones originales:', `${originalWidth}×${originalHeight}`)
      console.log('📊 Aspect ratio:', aspectRatio.toFixed(2))

      // Decidir estrategia basada en aspect ratio
      // 0.75 = 3:4 (vertical)
      // 1.33 = 4:3 (horizontal)
      const shouldCrop = aspectRatio >= 0.75 && aspectRatio <= 1.33

      if (shouldCrop) {
        // ✂️ ESTRATEGIA CROP: Recortar al centro
        console.log('✂️ Estrategia: CROP (recortar al centro)')

        // Calcular qué dimensión es la limitante
        let sourceSize, sourceX, sourceY

        if (aspectRatio > 1) {
          // Imagen horizontal - recortar los lados
          sourceSize = originalHeight
          sourceX = (originalWidth - originalHeight) / 2
          sourceY = 0
        } else {
          // Imagen vertical - recortar arriba/abajo
          sourceSize = originalWidth
          sourceX = 0
          sourceY = (originalHeight - originalWidth) / 2
        }

        // Dibujar la parte central recortada
        ctx.drawImage(
          img,
          sourceX, sourceY,           // Posición de origen (centrado)
          sourceSize, sourceSize,     // Tamaño de origen (cuadrado)
          0, 0,                       // Posición en canvas
          targetSize, targetSize      // Tamaño en canvas
        )
      } else {
        // 🎨 ESTRATEGIA CONTAIN: Fondo blanco + imagen completa
        console.log('🎨 Estrategia: CONTAIN (fondo blanco)')

        // Fondo blanco
        ctx.fillStyle = '#FFFFFF'
        ctx.fillRect(0, 0, targetSize, targetSize)

        // Calcular dimensiones para que quepa completa
        let drawWidth, drawHeight, offsetX, offsetY

        if (aspectRatio > 1) {
          // Imagen horizontal - ancho completo, centrar verticalmente
          drawWidth = targetSize
          drawHeight = targetSize / aspectRatio
          offsetX = 0
          offsetY = (targetSize - drawHeight) / 2
        } else {
          // Imagen vertical - alto completo, centrar horizontalmente
          drawWidth = targetSize * aspectRatio
          drawHeight = targetSize
          offsetX = (targetSize - drawWidth) / 2
          offsetY = 0
        }

        // Dibujar imagen centrada
        ctx.drawImage(
          img,
          offsetX, offsetY,
          drawWidth, drawHeight
        )
      }

      console.log('📐 Dimensiones finales:', `${targetSize}×${targetSize}`)

      // Convertir a WebP con buena calidad
      canvas.toBlob(
        (blob) => {
          if (blob) {
            console.log('💾 Tamaño final:', (blob.size / 1024).toFixed(2), 'KB')
            resolve(blob)
          } else {
            reject(new Error('Error al crear blob'))
          }
        },
        'image/webp',
        0.85 // 85% de calidad
      )
    }

    img.onerror = () => {
      reject(new Error('Error al cargar imagen'))
    }

    img.src = URL.createObjectURL(file)
  })
}

export default function ImageUpload({
  currentImageUrl,
  onImageChange,
  onImageRemove,
}: ImageUploadProps) {
  const [preview, setPreview] = useState<string | null>(
    currentImageUrl || null
  )
  const [uploading, setUploading] = useState(false)
  const fileInputRef = useRef<HTMLInputElement>(null)

  const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file) return

    // Validación de tipo en cliente
    if (!file.type.startsWith('image/')) {
      toast.error('Solo se permiten archivos de imagen')
      return
    }

    // Validación de tamaño en cliente (10MB antes de comprimir)
    if (file.size > 10 * 1024 * 1024) {
      toast.error('La imagen es muy grande. Máximo 10MB')
      return
    }

    setUploading(true)

    try {
      console.log('🔄 Iniciando procesamiento de imagen...')

      // PASO 1: Compresión inicial
      const toastId = toast.loading('Optimizando imagen...')

      const compressionOptions = {
        maxSizeMB: 2,           // Máximo 2MB (luego se reducirá más con 800×800)
        maxWidthOrHeight: 800,  // ⬅️ CAMBIO CLAVE: 800px máximo
        useWebWorker: true,
        fileType: 'image/webp',
        initialQuality: 0.9,
      }

      const compressedFile = await imageCompression(file, compressionOptions)

      console.log('📊 Compresión inicial completada')
      console.log('   Original:', (file.size / 1024 / 1024).toFixed(2), 'MB')
      console.log('   Comprimida:', (compressedFile.size / 1024 / 1024).toFixed(2), 'MB')

      // PASO 2: Crear imagen cuadrada 800×800
      const squareBlob = await createSquareImage(compressedFile)

      // Convertir blob a File para subirlo
      const squareFile = new File(
        [squareBlob],
        `${Date.now()}-800x800.webp`,
        { type: 'image/webp' }
      )

      // Calcular estadísticas finales
      const originalSizeMB = (file.size / 1024 / 1024).toFixed(2)
      const finalSizeMB = (squareFile.size / 1024 / 1024).toFixed(2)
      const savings = ((1 - squareFile.size / file.size) * 100).toFixed(1)

      console.log('✅ Procesamiento completo:')
      console.log(`   Original: ${originalSizeMB} MB`)
      console.log(`   Final: ${finalSizeMB} MB (800×800)`)
      console.log(`   Ahorro: ${savings}%`)

      // Mostrar preview local
      const reader = new FileReader()
      reader.onloadend = () => {
        setPreview(reader.result as string)
      }
      reader.readAsDataURL(squareFile)

      toast.dismiss(toastId)

      // PASO 3: Subir a R2
      const uploadToast = toast.loading('Subiendo imagen...')

      const formData = new FormData()
      formData.append('file', squareFile)

      const result = await uploadProductImage(formData)

      toast.dismiss(uploadToast)

      if (result.success && result.url) {
        onImageChange(result.url)
        toast.success(`✅ Imagen optimizada (${savings}% más pequeña)`)
      } else {
        toast.error(result.error || 'Error al subir imagen')
        setPreview(currentImageUrl || null)
        if (fileInputRef.current) {
          fileInputRef.current.value = ''
        }
      }
    } catch (error) {
      console.error('❌ Error procesando imagen:', error)
      toast.error('Error al procesar imagen')
      setPreview(currentImageUrl || null)
      if (fileInputRef.current) {
        fileInputRef.current.value = ''
      }
    } finally {
      setUploading(false)
    }
  }

  const handleRemove = async () => {
    if (currentImageUrl) {
      try {
        const result = await deleteProductImage(currentImageUrl)
        if (result.success) {
          toast.success('Imagen eliminada')
        } else {
          toast.error(result.error || 'Error al eliminar imagen')
          return
        }
      } catch (error) {
        console.error('Error deleting image:', error)
        toast.error('Error al eliminar imagen')
        return
      }
    }

    setPreview(null)
    onImageChange(null)
    onImageRemove?.()

    if (fileInputRef.current) {
      fileInputRef.current.value = ''
    }
  }

  const handleClick = () => {
    fileInputRef.current?.click()
  }

  return (
    <div className="space-y-2">
      <div className="flex items-center justify-between">
        <label className="block text-sm font-medium text-gray-700 dark:text-gray-300">
          Imagen del Producto
        </label>
        <span className="text-xs text-gray-500 dark:text-gray-400">
          800×800px
        </span>
      </div>

      {preview ? (
        <div className="flex flex-col items-center gap-3">
          {/* Preview con tamaño real 800×800 */}
          <div className="relative w-[300px] h-[300px] md:w-[400px] md:h-[400px] border-2 border-gray-300 dark:border-gray-600 rounded-lg overflow-hidden group shadow-lg">
            <Image
              src={preview}
              alt="Preview"
              fill
              className="object-cover bg-white"
              unoptimized={preview.startsWith('data:')}
            />

            {uploading && (
              <div className="absolute inset-0 bg-black bg-opacity-50 flex items-center justify-center">
                <div className="flex flex-col items-center gap-2 text-white">
                  <Loader2 className="w-6 h-6 animate-spin" />
                  <span className="text-sm">Optimizando a 800×800...</span>
                </div>
              </div>
            )}

            {!uploading && (
              <button
                type="button"
                onClick={handleRemove}
                className="absolute top-2 right-2 bg-red-500 hover:bg-red-600 text-white rounded-full p-2 opacity-0 group-hover:opacity-100 transition-opacity shadow-lg"
                title="Eliminar imagen"
              >
                <X size={20} />
              </button>
            )}
          </div>

          {/* Información de la imagen */}
          <div className="flex items-center gap-2 text-xs text-gray-500">
            <div className="flex items-center gap-1 px-2 py-1 bg-gray-100 dark:bg-gray-800 rounded">
              <ImageIcon size={12} />
              <span>800×800px</span>
            </div>
            <div className="px-2 py-1 bg-green-100 dark:bg-green-900 text-green-700 dark:text-green-300 rounded font-medium">
              ✓ Optimizada
            </div>
          </div>
        </div>
) : (
  <div className="flex flex-col items-center gap-2">
    {/* Zona de drop CUADRADA - Mismo tamaño que el preview */}
          <div
            onClick={handleClick}
            className="relative w-[300px] h-[300px] md:w-[400px] md:h-[400px] border-2 border-dashed border-gray-300 dark:border-gray-600 rounded-lg cursor-pointer hover:border-blue-400 hover:bg-blue-50/50 dark:hover:bg-blue-900/10 transition-all flex flex-col items-center justify-center"
          >
            {uploading ? (
              <div className="flex flex-col items-center gap-3">
                <Loader2 className="w-12 h-12 text-blue-500 animate-spin" />
                <p className="text-sm font-medium text-gray-700 dark:text-gray-300">
                  Procesando imagen...
                </p>
                <p className="text-xs text-blue-500">
                  Redimensionando a 800×800
                </p>
              </div>
            ) : (
              <div className="flex flex-col items-center gap-3 px-6 text-center">
                <div className="w-16 h-16 rounded-full bg-gray-100 dark:bg-gray-800 flex items-center justify-center">
                  <Upload className="w-8 h-8 text-gray-400" />
                </div>
                <div>
                  <p className="text-sm font-semibold text-gray-700 dark:text-gray-300 mb-1">
                    Click para subir imagen
                  </p>
                  <p className="text-xs text-gray-500 dark:text-gray-400">
                    o arrastra y suelta aquí
                  </p>
                </div>
                <div className="space-y-1">
                  <p className="text-xs text-gray-500 dark:text-gray-400">
                    JPG, PNG o WebP
                  </p>
                  <p className="text-xs text-gray-400">
                    Máximo 10MB
                  </p>
                </div>
                <div className="px-3 py-1.5 bg-green-50 dark:bg-green-900/20 rounded-md border border-green-200 dark:border-green-800">
                  <p className="text-xs text-green-700 dark:text-green-300 font-medium">
                    ✨ Se optimizará a 800×800 WebP
                  </p>
                </div>
              </div>
            )}
            
            {/* Badge de dimensiones en la esquina */}
            <div className="absolute top-2 right-2 px-2 py-1 bg-gray-900/80 text-white text-xs font-medium rounded backdrop-blur-sm">
              800×800px
            </div>
          </div>
        </div>
      )}

      <input
        ref={fileInputRef}
        type="file"
        className="hidden"
        accept="image/jpeg,image/png,image/webp"
        onChange={handleFileChange}
        disabled={uploading}
      />
    </div>
  )
}