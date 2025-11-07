import { ProductWithCategory } from './product'

export interface CartItem {
  product: ProductWithCategory
  quantity: number
}

export interface Cart {
  items: CartItem[]
  total: number
}
