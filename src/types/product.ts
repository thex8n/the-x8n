export interface Product {
  id: string
  user_id: string
  name: string
  code: string
  category_id: string | null
  stock_quantity: number
  minimum_stock: number
  sale_price: number | null
  cost_price: number | null
  unit_of_measure: string | null
  image_url: string | null
  active: boolean
  created_at: string
  updated_at: string
}

export interface ProductFormData {
  name: string
  code: string
  category_id?: string | null
  stock_quantity: number
  minimum_stock: number
  sale_price?: number
  cost_price?: number
  unit_of_measure?: string
  image_url?: string | null
  active: boolean
}

export interface ProductWithCategory extends Product {
  category?: {
    id: string
    name: string
    color: string
    icon: string
  }
}