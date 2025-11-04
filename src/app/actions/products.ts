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