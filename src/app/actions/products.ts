'use server'

import { createClient } from '@/lib/supabase/server'
import { ProductFormData } from '@/types/product'
import { revalidatePath } from 'next/cache'

export async function addProduct(data: ProductFormData) {
  const supabase = await createClient()

  const { data: { user }, error: authError } = await supabase.auth.getUser()

  if (authError || !user) {
    return { error: 'No autenticado' }
  }

  const { data: product, error } = await supabase
    .from('products')
    .insert({
      user_id: user.id,
      name: data.name,
      code: data.code,
      barcode: data.barcode || null,  // ✅ NUEVO: Guardar barcode
      category_id: data.category_id || null,
      stock_quantity: data.stock_quantity,
      minimum_stock: data.minimum_stock,
      sale_price: data.sale_price || null,
      cost_price: data.cost_price || null,
      unit_of_measure: data.unit_of_measure || null,
      active: data.active,
    })
    .select()
    .single()

  if (error) {
    console.error('Error adding product:', error)
    if (error.code === '23505') {
      return { error: 'Ya tienes un producto con este código. Por favor usa otro código.' }
    }
    return { error: error.message }
  }

  revalidatePath('/inventory')
  return { success: true, data: product }
}

export async function getProducts() {
  const supabase = await createClient()

  const { data: { user }, error: authError } = await supabase.auth.getUser()

  if (authError || !user) {
    return { error: 'No autenticado' }
  }

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

export async function updateProduct(productId: string, data: ProductFormData) {
  const supabase = await createClient()

  const { data: { user }, error: authError } = await supabase.auth.getUser()

  if (authError || !user) {
    return { error: 'No autenticado' }
  }

  const { data: product, error } = await supabase
    .from('products')
    .update({
      name: data.name,
      code: data.code,
      barcode: data.barcode || null,  // ✅ NUEVO: Actualizar barcode
      category_id: data.category_id || null,
      stock_quantity: data.stock_quantity,
      minimum_stock: data.minimum_stock,
      sale_price: data.sale_price || null,
      cost_price: data.cost_price || null,
      unit_of_measure: data.unit_of_measure || null,
      active: data.active,
    })
    .eq('id', productId)
    .select()
    .single()

  if (error) {
    console.error('Error updating product:', error)
    if (error.code === '23505') {
      return { error: 'Ya tienes un producto con este código. Por favor usa otro código.' }
    }
    return { error: error.message }
  }

  revalidatePath('/inventory')
  return { success: true, data: product }
}

export async function deleteProduct(productId: string) {
  const supabase = await createClient()

  const { data: { user }, error: authError } = await supabase.auth.getUser()

  if (authError || !user) {
    return { error: 'No autenticado' }
  }

  const { error } = await supabase
    .from('products')
    .delete()
    .eq('id', productId)

  if (error) {
    console.error('Error deleting product:', error)
    return { error: error.message }
  }

  revalidatePath('/inventory')
  return { success: true }
}

export async function searchProducts(query: string) {
  const supabase = await createClient()

  const { data: { user }, error: authError } = await supabase.auth.getUser()

  if (authError || !user) {
    return { error: 'No autenticado' }
  }

  if (!query.trim()) {
    return getProducts()
  }

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

export async function findProductByCode(code: string) {
  const supabase = await createClient()

  const { data: { user }, error: authError } = await supabase.auth.getUser()

  if (authError || !user) {
    return { error: 'No autenticado' }
  }

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

// ✅ NUEVA FUNCIÓN: Buscar producto por barcode
export async function findProductByBarcode(barcode: string) {
  const supabase = await createClient()

  const { data: { user }, error: authError } = await supabase.auth.getUser()

  if (authError || !user) {
    return { error: 'No autenticado' }
  }

  const { data: product, error } = await supabase
    .from('products')
    .select(`
      *,
      category:categories(id, name, color, icon)
    `)
    .eq('barcode', barcode)
    .eq('user_id', user.id)
    .maybeSingle()  // ✅ Usa maybeSingle en lugar de single para no lanzar error si no existe

  if (error) {
    console.error('Error finding product by barcode:', error)
    return { error: error.message }
  }

  return { success: true, data: product }
}

export async function incrementProductStock(productId: string) {
  const supabase = await createClient()

  const { data: { user }, error: authError } = await supabase.auth.getUser()

  if (authError || !user) {
    return { error: 'No autenticado' }
  }

  const { data: product, error: fetchError } = await supabase
    .from('products')
    .select('stock_quantity')
    .eq('id', productId)
    .eq('user_id', user.id)
    .single()

  if (fetchError) {
    console.error('Error fetching product:', fetchError)
    return { error: fetchError.message }
  }

  const newStock = product.stock_quantity + 1

  const { data: updatedProduct, error: updateError } = await supabase
    .from('products')
    .update({ stock_quantity: newStock })
    .eq('id', productId)
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
  return { success: true, data: updatedProduct }
}

export async function decrementProductStock(productId: string, quantity: number = 1) {
  const supabase = await createClient()

  const { data: { user }, error: authError } = await supabase.auth.getUser()

  if (authError || !user) {
    return { error: 'No autenticado' }
  }

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
    return { error: `Stock insuficiente. Disponible: ${product.stock_quantity}, Solicitado: ${quantity}` }
  }

  const newStock = product.stock_quantity - quantity

  const { data: updatedProduct, error: updateError } = await supabase
    .from('products')
    .update({ stock_quantity: newStock })
    .eq('id', productId)
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