'use server'

import { createClient } from '@/lib/supabase/server'
import { CategoryFormData } from '@/types/category'
import { revalidatePath } from 'next/cache'

export async function addCategory(data: CategoryFormData) {
  const supabase = await createClient()

  const { data: { user }, error: authError } = await supabase.auth.getUser()

  if (authError || !user) {
    return { error: 'No autenticado' }
  }

  const { data: category, error } = await supabase
    .from('categories')
    .insert({
      user_id: user.id,
      name: data.name,
      description: data.description || null,
      parent_category_id: data.parent_category_id || null,
      color: data.color,
      icon: data.icon,
      active: data.active,
    })
    .select()
    .single()

  if (error) {
    console.error('Error adding category:', error)
    return { error: error.message }
  }

  revalidatePath('/inventory')
  return { success: true, data: category }
}

export async function getCategories() {
  const supabase = await createClient()

  const { data: { user }, error: authError } = await supabase.auth.getUser()

  if (authError || !user) {
    return { error: 'No autenticado' }
  }

  const { data: categories, error } = await supabase
    .from('categories')
    .select('*')
    .order('order_index', { ascending: true })
    .order('name', { ascending: true })

  if (error) {
    console.error('Error fetching categories:', error)
    return { error: error.message }
  }

  return { success: true, data: categories }
}

export async function updateCategory(categoryId: string, data: CategoryFormData) {
  const supabase = await createClient()

  const { data: { user }, error: authError } = await supabase.auth.getUser()

  if (authError || !user) {
    return { error: 'No autenticado' }
  }

  const { data: category, error } = await supabase
    .from('categories')
    .update({
      name: data.name,
      description: data.description || null,
      parent_category_id: data.parent_category_id || null,
      color: data.color,
      icon: data.icon,
      active: data.active,
    })
    .eq('id', categoryId)
    .select()
    .single()

  if (error) {
    console.error('Error updating category:', error)
    return { error: error.message }
  }

  revalidatePath('/inventory')
  return { success: true, data: category }
}

export async function deleteCategory(categoryId: string) {
  const supabase = await createClient()

  const { data: { user }, error: authError } = await supabase.auth.getUser()

  if (authError || !user) {
    return { error: 'No autenticado' }
  }

  const { count, error: countError } = await supabase
    .from('products')
    .select('*', { count: 'exact', head: true })
    .eq('category_id', categoryId)

  if (countError) {
    console.error('Error checking products:', countError)
    return { error: countError.message }
  }

  if (count && count > 0) {
    return { error: `No se puede eliminar la categoría porque tiene ${count} producto(s) asignado(s)` }
  }

  const { error } = await supabase
    .from('categories')
    .delete()
    .eq('id', categoryId)

  if (error) {
    console.error('Error deleting category:', error)
    return { error: error.message }
  }

  revalidatePath('/inventory')
  return { success: true }
}
