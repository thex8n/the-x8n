'use client'

import { useState, useRef } from 'react'
import { uploadProductImage } from '@/app/actions/upload'
import { Camera, Upload, X, Loader2, ImagePlus } from 'lucide-react'

interface ImageUploadProps {
  currentImageUrl: string | null
  onImageChange: (url: string | null) => void
  onOldImageDelete?: (oldUrl: string) => void
}

export default function ImageUpload({
  currentImageUrl,
  onImageChange,
  onOldImageDelete
}: ImageUploadProps) {
  const [uploading, setUploading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [showOptions, setShowOptions] = useState(false)
  const fileInputRef = useRef<HTMLInputElement>(null)
  const cameraInputRef = useRef<HTMLInputElement>(null)

  const handleFileSelect = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file) return

    await processImage(file)
    setShowOptions(false)
  }

  const processImage = async (file: File) => {
    setError(null)
    setUploading(true)

    try {
      // Comprimir imagen antes de subir
      const compressedFile = await compressImage(file)
      
      const formData = new FormData()
      formData.append('file', compressedFile)

      const result = await uploadProductImage(formData)

      if (result.success && result.url) {
        // Si hay una imagen anterior, marcarla para eliminación
        if (currentImageUrl) {
          onOldImageDelete?.(currentImageUrl)
        }
        onImageChange(result.url)
      } else {
        setError(result.error || 'Error al subir imagen')
      }
    } catch (err) {
      console.error('Error processing image:', err)
      setError('Error al procesar imagen')
    } finally {
      setUploading(false)
    }
  }

  const compressImage = async (file: File): Promise<File> => {
    return new Promise((resolve, reject) => {
      const reader = new FileReader()
      
      reader.onload = (e) => {
        const img = new Image()
        
        img.onload = () => {
          const canvas = document.createElement('canvas')
          const ctx = canvas.getContext('2d')
          
          if (!ctx) {
            reject(new Error('No se pudo crear contexto de canvas'))
            return
          }

          // Dimensiones fijas: 800x800
          const SIZE = 800
          canvas.width = SIZE
          canvas.height = SIZE

          // Calcular dimensiones para centrar la imagen
          let sourceX = 0
          let sourceY = 0
          let sourceSize = Math.min(img.width, img.height)

          if (img.width > img.height) {
            sourceX = (img.width - img.height) / 2
          } else {
            sourceY = (img.height - img.width) / 2
          }

          // Fondo blanco
          ctx.fillStyle = '#FFFFFF'
          ctx.fillRect(0, 0, SIZE, SIZE)

          // Dibujar imagen centrada y recortada
          ctx.drawImage(
            img,
            sourceX, sourceY, sourceSize, sourceSize,
            0, 0, SIZE, SIZE
          )

          // Convertir a WebP con calidad 0.85
          canvas.toBlob(
            (blob) => {
              if (blob) {
                const compressedFile = new File([blob], 'product.webp', {
                  type: 'image/webp',
                  lastModified: Date.now(),
                })
                resolve(compressedFile)
              } else {
                reject(new Error('Error al comprimir imagen'))
              }
            },
            'image/webp',
            0.85
          )
        }

        img.onerror = () => reject(new Error('Error al cargar imagen'))
        img.src = e.target?.result as string
      }

      reader.onerror = () => reject(new Error('Error al leer archivo'))
      reader.readAsDataURL(file)
    })
  }

  const handleRemoveImage = () => {
    if (currentImageUrl) {
      onOldImageDelete?.(currentImageUrl)
    }
    onImageChange(null)
    setError(null)
  }

  const handleTakePhoto = () => {
    cameraInputRef.current?.click()
    setShowOptions(false)
  }

  const handleChooseFromGallery = () => {
    fileInputRef.current?.click()
    setShowOptions(false)
  }

  return (
    <div className="space-y-2">
      <label className="block text-xs font-medium text-gray-500 mb-2 uppercase">
        Imagen del Producto
      </label>

      {/* Vista previa de la imagen */}
      {currentImageUrl && !uploading && (
        <div className="relative inline-block">
          {/* Imagen clickeable para cambiar */}
          <button
            type="button"
            onClick={() => setShowOptions(true)}
            className="relative group"
          >
            <img
              src={currentImageUrl}
              alt="Vista previa"
              className="w-32 h-32 object-cover rounded-lg border-2 border-gray-200 group-hover:border-gray-300 transition-colors"
            />
            {/* Overlay al hacer hover */}
            <div className="absolute inset-0 bg-black/40 rounded-lg opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center">
              <ImagePlus className="w-8 h-8 text-white" />
            </div>
          </button>
          
          {/* Botón X para eliminar */}
          <button
            type="button"
            onClick={handleRemoveImage}
            className="absolute -top-2 -right-2 bg-red-500 text-white rounded-full p-1 hover:bg-red-600 transition-colors shadow-lg z-10"
            aria-label="Eliminar imagen"
          >
            <X className="w-4 h-4" />
          </button>
        </div>
      )}

      {/* Estado de carga */}
      {uploading && (
        <div className="flex items-center justify-center w-32 h-32 bg-gray-100 rounded-lg border-2 border-gray-200">
          <Loader2 className="w-8 h-8 text-gray-400 animate-spin" />
        </div>
      )}

      {/* Cuadro para agregar imagen */}
      {!currentImageUrl && !uploading && (
        <div className="relative">
          {/* Cuadro clickeable */}
          <button
            type="button"
            onClick={() => setShowOptions(!showOptions)}
            className="w-32 h-32 bg-gray-50 rounded-lg border-2 border-dashed border-gray-300 hover:border-gray-400 hover:bg-gray-100 transition-all flex flex-col items-center justify-center gap-2 group"
          >
            <ImagePlus className="w-8 h-8 text-gray-400 group-hover:text-gray-600 transition-colors" />
            <span className="text-xs text-gray-500 group-hover:text-gray-700 font-medium">Agregar</span>
          </button>

          {/* Bottom Sheet Modal */}
          {showOptions && (
            <>
              {/* Overlay oscuro */}
              <div
                className="fixed inset-0 bg-black/50 z-100 animate-fadeIn"
                onClick={() => setShowOptions(false)}
              />
              
              {/* Bottom Sheet - Más compacto */}
              <div className="fixed bottom-0 left-0 right-0 bg-white rounded-t-2xl z-101 animate-slideUp shadow-2xl">
                {/* Handle bar */}
                <div className="flex justify-center pt-2 pb-3">
                  <div className="w-10 h-1 bg-gray-300 rounded-full"></div>
                </div>

                {/* Opciones - Sin título, más compacto */}
                <div className="px-2 pb-6">
                  <div className="grid grid-cols-2 gap-4 px-4">
                    {/* Tomar Foto */}
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

                    {/* Galería */}
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
        </div>
      )}

      {/* Bottom Sheet Modal - Unificado para agregar o cambiar */}
      {showOptions && (
        <>
          {/* Overlay oscuro */}
          <div
            className="fixed inset-0 bg-black/50 z-100 animate-fadeIn"
            onClick={() => setShowOptions(false)}
          />
          
          {/* Bottom Sheet - Más compacto */}
          <div className="fixed bottom-0 left-0 right-0 bg-white rounded-t-2xl z-101 animate-slideUp shadow-2xl">
            {/* Handle bar */}
            <div className="flex justify-center pt-2 pb-3">
              <div className="w-10 h-1 bg-gray-300 rounded-full"></div>
            </div>

            {/* Opciones - Sin título, más compacto */}
            <div className="px-2 pb-6">
              <div className="grid grid-cols-2 gap-4 px-4">
                {/* Tomar Foto */}
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

                {/* Galería */}
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

      {/* Input oculto para cámara */}
      <input
        ref={cameraInputRef}
        type="file"
        accept="image/*"
        capture="environment"
        onChange={handleFileSelect}
        className="hidden"
      />

      {/* Input oculto para galería */}
      <input
        ref={fileInputRef}
        type="file"
        accept="image/jpeg,image/png,image/webp"
        onChange={handleFileSelect}
        className="hidden"
      />

      {/* Mensaje de error */}
      {error && (
        <div className="mt-2 p-3 bg-red-50 border border-red-200 rounded-lg">
          <p className="text-red-800 text-sm">{error}</p>
        </div>
      )}

      {/* Información */}
      <p className="text-xs text-gray-500 mt-2">
        Formatos: JPG, PNG, WebP • Tamaño máximo: 5MB • Se optimizará a 800×800px
      </p>

      {/* Estilos para animaciones */}
      <style jsx>{`
        @keyframes fadeIn {
          from {
            opacity: 0;
          }
          to {
            opacity: 1;
          }
        }

        @keyframes slideUp {
          from {
            transform: translateY(100%);
          }
          to {
            transform: translateY(0);
          }
        }

        .animate-fadeIn {
          animation: fadeIn 0.2s ease-out;
        }

        .animate-slideUp {
          animation: slideUp 0.3s ease-out;
        }
      `}</style>
    </div>
  )
} 