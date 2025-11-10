'use server'

import { createClient } from '@/lib/supabase/server'
import { requireAuth } from '@/lib/supabase/auth'
import { ProductFormData } from '@/types/product'
import { revalidatePath, unstable_noStore as noStore } from 'next/cache'
import { AUTH_MESSAGES, PRODUCT_MESSAGES } from '@/constants/validation'

/**
 * Adds a new product to the inventory
 * @param data - Product form data
 * @returns Success with product data or error message
 */
export async function addProduct(data: ProductFormData) {
  const user = await requireAuth()

  if (!user) {
    return { error: AUTH_MESSAGES.NOT_AUTHENTICATED }
  }

  const supabase = await createClient()

  const { data: product, error } = await supabase
    .from('products')
    .insert({
      user_id: user.id,
      name: data.name,
      code: data.code,
      barcode: data.barcode || null,
      category_id: data.category_id || null,
      stock_quantity: data.stock_quantity,
      minimum_stock: data.minimum_stock,
      sale_price: data.sale_price || null,
      cost_price: data.cost_price || null,
      unit_of_measure: data.unit_of_measure || null,
      image_url: data.image_url || null,
      active: data.active,
    })
    .select()
    .single()

  if (error) {
    console.error('Error adding product:', error)
    if (error.code === '23505') {
      return { error: PRODUCT_MESSAGES.CODE_DUPLICATE }
    }
    return { error: error.message }
  }

  revalidatePath('/inventory')
  return { success: true, data: product }
}

/**
 * Retrieves all products for the authenticated user
 * @returns Success with products array or error message
 */
export async function getProducts() {
  const user = await requireAuth()

  if (!user) {
    return { error: AUTH_MESSAGES.NOT_AUTHENTICATED }
  }

  const supabase = await createClient()

  const { data: products, error } = await supabase
    .from('products')
    .select(`
      *,
      category:categories(id, name, color, icon)
    `)
    .order('created_at', { ascending: false })

  if (error) {
    console.error('Error fetching products:', error)
    return { error: error.message }
  }

  return { success: true, data: products }
}

/**
 * Updates an existing product
 * @param productId - ID of the product to update
 * @param data - Updated product form data
 * @returns Success with updated product data or error message
 */
export async function updateProduct(productId: string, data: ProductFormData) {
  const user = await requireAuth()

  if (!user) {
    return { error: AUTH_MESSAGES.NOT_AUTHENTICATED }
  }

  const supabase = await createClient()

  const { data: product, error } = await supabase
    .from('products')
    .update({
      name: data.name,
      code: data.code,
      barcode: data.barcode || null,
      category_id: data.category_id || null,
      stock_quantity: data.stock_quantity,
      minimum_stock: data.minimum_stock,
      sale_price: data.sale_price || null,
      cost_price: data.cost_price || null,
      unit_of_measure: data.unit_of_measure || null,
      image_url: data.image_url || null,
      active: data.active,
    })
    .eq('id', productId)
    .eq('user_id', user.id)  // SECURITY: Only update own products
    .select()
    .single()

  if (error) {
    console.error('Error updating product:', error)
    if (error.code === '23505') {
      return { error: PRODUCT_MESSAGES.CODE_DUPLICATE }
    }
    return { error: error.message }
  }

  revalidatePath('/inventory')
  return { success: true, data: product }
}

/**
 * Deletes a product from the inventory
 * IMPORTANTE: Elimina también la imagen de R2 si existe
 * @param productId - ID of the product to delete
 * @returns Success or error message
 */
export async function deleteProduct(productId: string) {
  const user = await requireAuth()

  if (!user) {
    return { error: AUTH_MESSAGES.NOT_AUTHENTICATED }
  }

  const supabase = await createClient()

  // 🔍 PASO 1: Obtener el producto para saber si tiene imagen
  const { data: product, error: fetchError } = await supabase
    .from('products')
    .select('image_url')
    .eq('id', productId)
    .eq('user_id', user.id)
    .single()

  if (fetchError) {
    console.error('Error fetching product:', fetchError)
    return { error: fetchError.message }
  }

  // 🗑️ PASO 2: Eliminar la imagen de R2 si existe
  if (product?.image_url) {
    console.log('🗑️ Eliminando imagen de R2 antes de borrar producto...')
    try {
      // Importar dinámicamente para evitar problemas de módulos
      const { deleteProductImage } = await import('@/app/actions/upload')
      const deleteResult = await deleteProductImage(product.image_url)
      
      if (deleteResult.success) {
        console.log('✅ Imagen eliminada de R2')
      } else {
        console.warn('⚠️ No se pudo eliminar imagen de R2:', deleteResult.error)
        // Continuamos con la eliminación del producto aunque falle la imagen
      }
    } catch (deleteError) {
      console.error('❌ Error eliminando imagen de R2:', deleteError)
      // Continuamos con la eliminación del producto aunque falle la imagen
    }
  }

  // ❌ PASO 3: Eliminar el producto de la base de datos
  const { error } = await supabase
    .from('products')
    .delete()
    .eq('id', productId)
    .eq('user_id', user.id)  // SECURITY: Only delete own products

  if (error) {
    console.error('Error deleting product:', error)
    return { error: error.message }
  }

  console.log('✅ Producto eliminado completamente (BD + R2)')
  revalidatePath('/inventory')
  return { success: true }
}

/**
 * Searches products by name or code
 * @param query - Search query string
 * @returns Success with matching products or error message
 */
export async function searchProducts(query: string) {
  const user = await requireAuth()

  if (!user) {
    return { error: AUTH_MESSAGES.NOT_AUTHENTICATED }
  }

  if (!query.trim()) {
    return getProducts()
  }

  const supabase = await createClient()

  const { data: products, error } = await supabase
    .from('products')
    .select('*')
    .or(`name.ilike.%${query}%,code.ilike.%${query}%`)
    .order('created_at', { ascending: false })

  if (error) {
    console.error('Error searching products:', error)
    return { error: error.message }
  }

  return { success: true, data: products }
}

/**
 * Finds a product by its unique code
 * @param code - Product code to search for
 * @returns Success with product data (or null if not found) or error message
 */
export async function findProductByCode(code: string) {
  const user = await requireAuth()

  if (!user) {
    return { error: AUTH_MESSAGES.NOT_AUTHENTICATED }
  }

  const supabase = await createClient()

  const { data: product, error } = await supabase
    .from('products')
    .select(`
      *,
      category:categories(id, name, color, icon)
    `)
    .eq('code', code)
    .eq('user_id', user.id)
    .single()

  if (error) {
    if (error.code === 'PGRST116') {
      return { success: true, data: null }
    }
    console.error('Error finding product:', error)
    return { error: error.message }
  }

  return { success: true, data: product }
}

/**
 * Scans barcode and increments stock in ONE QUERY - ULTRA RÁPIDO 🚀
 * @param barcode - Barcode to search for and update
 * @returns Success with updated product data or null if not found
 */
export async function scanAndIncrementStock(barcode: string) {
  const user = await requireAuth()

  if (!user) {
    return { error: AUTH_MESSAGES.NOT_AUTHENTICATED }
  }

  const supabase = await createClient()

  // 🚀 UNA SOLA QUERY: Busca Y actualiza al mismo tiempo
  const { data: products, error } = await supabase
    .rpc('scan_and_increment_stock', { 
      barcode_param: barcode,
      user_id_param: user.id 
    })

  if (error) {
    console.error('Error scanning and updating:', error)
    return { error: error.message }
  }

  if (!products || products.length === 0) {
    return { success: true, data: null }
  }

  const product = products[0]
  
  // Transformar el formato de categoría
  if (product.category_name) {
    product.category = {
      id: product.category_id,
      name: product.category_name,
      color: product.category_color,
      icon: product.category_icon
    }
    delete product.category_name
    delete product.category_color
    delete product.category_icon
  }

  // 🔥 NO revalidar en cada escaneo - solo al cerrar el modal
  // revalidatePath('/inventory')
  
  return { success: true, data: product }
}

/**
 * Finds a product by its barcode - OPTIMIZADO ⚡
 * @param barcode - Barcode to search for
 * @returns Success with product data (or null if not found) or error message
 */
export async function findProductByBarcode(barcode: string) {
  // Deshabilitar caché para evitar falsos negativos con productos recién agregados
  noStore()

  const user = await requireAuth()

  if (!user) {
    return { error: AUTH_MESSAGES.NOT_AUTHENTICATED }
  }

  const supabase = await createClient()

  // ✅ Query optimizada con índice
  const { data: product, error } = await supabase
    .from('products')
    .select(`
      *,
      category:categories(id, name, color, icon)
    `)
    .eq('barcode', barcode)
    .eq('user_id', user.id)
    .maybeSingle()

  if (error) {
    console.error('Error finding product by barcode:', error)
    return { error: error.message }
  }

  // Invalidar caché de la página de inventario
  revalidatePath('/inventory')

  return { success: true, data: product }
}

/**
 * Increments a product's stock quantity by 1 - OPTIMIZADO ⚡
 * ✨ ACTUALIZADO: Ahora retorna también image_url para guardar en historial
 * @param productId - ID of the product to increment
 * @returns Success with updated product data or error message
 */
export async function incrementProductStock(productId: string) {
  const user = await requireAuth()

  if (!user) {
    return { error: AUTH_MESSAGES.NOT_AUTHENTICATED }
  }

  const supabase = await createClient()

  // ✅ UNA SOLA QUERY: Usar función SQL para actualizar
  const { data: products, error } = await supabase
    .rpc('increment_product_stock', { 
      product_id: productId,
      user_id_param: user.id 
    })

  if (error) {
    console.error('Error updating stock:', error)
    return { error: error.message }
  }

  if (!products || products.length === 0) {
    return { error: 'Producto no encontrado' }
  }

  const product = products[0]

  // Obtener categoría si existe
  if (product.category_id) {
    const { data: category } = await supabase
      .from('categories')
      .select('id, name, color, icon')
      .eq('id', product.category_id)
      .single()

    if (category) {
      product.category = category
    }
  }

  revalidatePath('/inventory')
  return { success: true, data: product }
}

/**
 * Decrements a product's stock quantity
 * Validates that sufficient stock is available before decrementing
 * @param productId - ID of the product to decrement
 * @param quantity - Amount to decrement (default: 1)
 * @returns Success with updated product data or error message
 */
export async function decrementProductStock(productId: string, quantity: number = 1) {
  const user = await requireAuth()

  if (!user) {
    return { error: AUTH_MESSAGES.NOT_AUTHENTICATED }
  }

  const supabase = await createClient()

  const { data: product, error: fetchError } = await supabase
    .from('products')
    .select('stock_quantity, name')
    .eq('id', productId)
    .eq('user_id', user.id)
    .single()

  if (fetchError) {
    console.error('Error fetching product:', fetchError)
    return { error: fetchError.message }
  }

  // Validar que haya stock suficiente
  if (product.stock_quantity < quantity) {
    const { getInsufficientStockMessage } = await import('@/constants/validation')
    return { error: getInsufficientStockMessage(product.stock_quantity, quantity) }
  }

  const newStock = product.stock_quantity - quantity

  const { data: updatedProduct, error: updateError } = await supabase
    .from('products')
    .update({ stock_quantity: newStock })
    .eq('id', productId)
    .eq('user_id', user.id)  // SECURITY: Only update own products
    .select(`
      *,
      category:categories(id, name, color, icon)
    `)
    .single()

  if (updateError) {
    console.error('Error updating stock:', updateError)
    return { error: updateError.message }
  }

  revalidatePath('/inventory')
  revalidatePath('/pos')
  return { success: true, data: updatedProduct }
}

/**
 * Revalidates inventory cache - Call only when closing scanner
 */
export async function revalidateInventory() {
  revalidatePath('/inventory')
  return { success: true }
}

// ========================================
// 📦 INVENTORY HISTORY FUNCTIONS
// ========================================

/**
 * DEPRECATED: Inventory history functions migrated to Cloudflare D1
 * See src/app/actions/inventory-history-d1.ts for new implementation
 *
 * Old Supabase functions removed:
 * - saveInventoryHistory() → Use saveInventoryHistoryD1()
 * - getInventoryHistory() → Use getInventoryHistoryD1()
 */