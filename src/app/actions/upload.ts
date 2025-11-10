'use server'

import { uploadToR2, deleteFromR2, getKeyFromUrl } from '@/lib/r2/client'
import { createClient } from '@/lib/supabase/server'

// Tipos de imagen permitidos
const ALLOWED_IMAGE_TYPES = ['image/jpeg', 'image/png', 'image/webp']

// Tamaño máximo: 5MB (después de compresión en cliente, las imágenes serán ~200-500KB)
// Aumentado de 2MB a 5MB para dar margen, pero el frontend ya comprime a ~200-500KB
const MAX_FILE_SIZE = 5 * 1024 * 1024

// Dimensiones esperadas (800×800)
const EXPECTED_WIDTH = 800
const EXPECTED_HEIGHT = 800

interface UploadResult {
  success: boolean
  url?: string
  error?: string
}

interface DeleteResult {
  success: boolean
  error?: string
}

/**
 * Valida las dimensiones de una imagen usando el navegador
 * NOTA: Esta validación es LIGERA porque confiamos en el frontend
 * Si quieres validación MÁS ESTRICTA, necesitarías instalar Sharp
 * 
 * @param file - Archivo de imagen
 * @returns true si las dimensiones son correctas (o no se pueden validar)
 */
async function validateImageDimensions(file: File): Promise<{ valid: boolean; width?: number; height?: number; error?: string }> {
  try {
    // Convertir File a ArrayBuffer
    const arrayBuffer = await file.arrayBuffer()
    const buffer = Buffer.from(arrayBuffer)

    // Detectar tipo de imagen y extraer dimensiones
    // Esto es una validación BÁSICA sin dependencias externas
    
    if (file.type === 'image/webp') {
      // WebP: Buscar chunk VP8/VP8L
      // Esto es una validación simplificada, no 100% precisa
      console.log('⚠️ Validación de dimensiones WebP: Confiando en frontend')
      return { valid: true } // Confiar en el frontend para WebP
    }

    if (file.type === 'image/png') {
      // PNG: Las dimensiones están en el chunk IHDR (bytes 16-23)
      if (buffer.length >= 24) {
        const width = buffer.readUInt32BE(16)
        const height = buffer.readUInt32BE(20)
        
        console.log(`📐 Dimensiones PNG detectadas: ${width}×${height}`)
        
        if (width === EXPECTED_WIDTH && height === EXPECTED_HEIGHT) {
          return { valid: true, width, height }
        } else {
          return {
            valid: false,
            width,
            height,
            error: `Dimensiones incorrectas: ${width}×${height}. Se esperaba ${EXPECTED_WIDTH}×${EXPECTED_HEIGHT}`
          }
        }
      }
    }

    if (file.type === 'image/jpeg') {
      // JPEG: Buscar marcador SOF (Start of Frame)
      // Esto es complejo, así que confiaremos en el frontend
      console.log('⚠️ Validación de dimensiones JPEG: Confiando en frontend')
      return { valid: true }
    }

    // Para otros tipos, confiar en el frontend
    console.log('⚠️ Tipo de imagen desconocido, confiando en frontend')
    return { valid: true }

  } catch (error) {
    console.error('Error validando dimensiones:', error)
    // Si hay error en la validación, permitir la subida (confiar en frontend)
    return { valid: true }
  }
}

/**
 * Sube una imagen de producto a Cloudflare R2
 * 
 * VALIDACIONES:
 * 1. Usuario autenticado ✅
 * 2. Archivo presente y no vacío ✅
 * 3. Tipo de archivo permitido ✅
 * 4. Tamaño máximo (5MB) ✅
 * 5. Dimensiones 800×800 (validación ligera) ⚠️
 * 
 * NOTA: La validación de dimensiones es OPCIONAL y LIGERA.
 * El frontend ya garantiza que las imágenes sean 800×800.
 * Si quieres validación ESTRICTA, instala Sharp:
 * npm install sharp
 * 
 * @param formData - FormData con el archivo en el campo 'file'
 * @returns Resultado con URL pública si es exitoso
 */
export async function uploadProductImage(
  formData: FormData
): Promise<UploadResult> {
  try {
    // ========================================
    // 1. VALIDACIÓN: Usuario autenticado
    // ========================================
    const supabase = await createClient()
    const {
      data: { user },
    } = await supabase.auth.getUser()

    if (!user) {
      return { success: false, error: 'No autenticado' }
    }

    // ========================================
    // 2. VALIDACIÓN: Archivo presente
    // ========================================
    const file = formData.get('file') as File

    if (!file || file.size === 0) {
      return { success: false, error: 'No se proporcionó archivo' }
    }

    console.log('📁 Archivo recibido:', {
      name: file.name,
      type: file.type,
      size: `${(file.size / 1024).toFixed(2)} KB`
    })

    // ========================================
    // 3. VALIDACIÓN: Tipo de archivo
    // ========================================
    if (!ALLOWED_IMAGE_TYPES.includes(file.type)) {
      return {
        success: false,
        error: 'Formato no permitido. Solo JPG, PNG y WebP',
      }
    }

    // ========================================
    // 4. VALIDACIÓN: Tamaño máximo
    // ========================================
    if (file.size > MAX_FILE_SIZE) {
      const sizeMB = (file.size / 1024 / 1024).toFixed(2)
      return {
        success: false,
        error: `Imagen muy grande (${sizeMB}MB). Máximo 5MB`,
      }
    }

    // ========================================
    // 5. VALIDACIÓN: Dimensiones (OPCIONAL)
    // ========================================
    // Esto es una validación LIGERA sin Sharp
    // Puedes comentar este bloque si confías 100% en el frontend
    const dimensionCheck = await validateImageDimensions(file)
    
    if (!dimensionCheck.valid) {
      console.warn('⚠️ Dimensiones incorrectas:', dimensionCheck)
      // OPCIÓN A: Rechazar imagen
      // return { success: false, error: dimensionCheck.error }
      
      // OPCIÓN B: Permitir de todas formas (actual)
      console.log('✅ Permitiendo subida a pesar de dimensiones incorrectas (confiando en frontend)')
    } else if (dimensionCheck.width && dimensionCheck.height) {
      console.log(`✅ Dimensiones validadas: ${dimensionCheck.width}×${dimensionCheck.height}`)
    }

    // ========================================
    // 6. SUBIDA A R2
    // ========================================
    // Generar nombre único para el archivo
    // Formato: products/{user_id}/{timestamp}-{random}.webp
    const timestamp = Date.now()
    const random = Math.random().toString(36).substring(2, 9)
    const key = `products/${user.id}/${timestamp}-${random}.webp`

    console.log('☁️ Subiendo a R2:', key)

    const url = await uploadToR2(file, key)

    console.log('✅ Imagen subida exitosamente:', url)

    return { success: true, url }

  } catch (error) {
    console.error('❌ Error uploading product image:', error)
    return {
      success: false,
      error: 'Error al subir imagen. Intenta de nuevo.',
    }
  }
}

/**
 * Elimina una imagen de producto de Cloudflare R2
 * 
 * VALIDACIONES:
 * 1. Usuario autenticado ✅
 * 2. URL proporcionada ✅
 * 3. Imagen pertenece al usuario ✅
 * 
 * @param imageUrl - URL pública de la imagen a eliminar
 * @returns Resultado de la operación
 */
export async function deleteProductImage(
  imageUrl: string
): Promise<DeleteResult> {
  try {
    // Verificar autenticación
    const supabase = await createClient()
    const {
      data: { user },
    } = await supabase.auth.getUser()

    if (!user) {
      return { success: false, error: 'No autenticado' }
    }

    if (!imageUrl) {
      return { success: false, error: 'URL de imagen no proporcionada' }
    }

    // Extraer la key desde la URL
    const key = getKeyFromUrl(imageUrl)

    console.log('🗑️ Eliminando imagen:', key)

    // Verificar que la imagen pertenece al usuario
    // La key debe empezar con "products/{user_id}/"
    if (!key.startsWith(`products/${user.id}/`)) {
      console.warn('⚠️ Intento de eliminar imagen de otro usuario:', key)
      return {
        success: false,
        error: 'No tienes permiso para eliminar esta imagen',
      }
    }

    // Eliminar de R2
    await deleteFromR2(key)

    console.log('✅ Imagen eliminada exitosamente')

    return { success: true }
  } catch (error) {
    console.error('❌ Error deleting product image:', error)
    return {
      success: false,
      error: 'Error al eliminar imagen. Intenta de nuevo.',
    }
  }
}

// ========================================
// 📝 NOTAS PARA VALIDACIÓN ESTRICTA:
// ========================================
/*
Si quieres VALIDACIÓN ESTRICTA de dimensiones en el servidor,
instala Sharp y usa este código:

npm install sharp

import sharp from 'sharp'

async function validateWithSharp(file: File): Promise<boolean> {
  try {
    const arrayBuffer = await file.arrayBuffer()
    const buffer = Buffer.from(arrayBuffer)
    
    const metadata = await sharp(buffer).metadata()
    
    if (metadata.width !== 800 || metadata.height !== 800) {
      console.error(`❌ Dimensiones incorrectas: ${metadata.width}×${metadata.height}`)
      return false
    }
    
    console.log('✅ Dimensiones validadas con Sharp: 800×800')
    return true
  } catch (error) {
    console.error('Error validando con Sharp:', error)
    return false
  }
}

Luego reemplaza validateImageDimensions() con validateWithSharp()
*/