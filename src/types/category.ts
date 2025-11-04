export interface Category {
  id: string
  user_id: string
  name: string
  description: string | null
  parent_category_id: string | null
  color: string
  icon: string
  active: boolean
  order_index: number
  created_at: string
  updated_at: string
}

export interface CategoryFormData {
  name: string
  description?: string
  parent_category_id?: string | null
  color: string
  icon: string
  active: boolean
}

export interface CategoryWithProductCount extends Category {
  product_count?: number
}
