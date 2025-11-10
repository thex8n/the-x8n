// Types for Cloudflare D1 inventory_history table

export interface InventoryHistory {
  id: string;
  user_id: string;
  product_id: string;
  product_name: string;
  barcode: string;
  stock_before: number;
  stock_after: number;
  image_url?: string | null; // ← NUEVO: URL de la imagen del producto
  scanned_at: string; // ISO 8601 datetime string
}

export interface InventoryHistoryInsert {
  user_id: string;
  product_id: string;
  product_name: string;
  barcode: string;
  stock_before: number;
  stock_after: number;
  image_url?: string | null; // ← NUEVO: URL de la imagen del producto
}

// Cloudflare D1 Database binding type
export interface Env {
  DB: D1Database;
}