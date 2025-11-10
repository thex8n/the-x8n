'use server';

import { revalidatePath } from 'next/cache';
import { requireAuth } from '@/lib/supabase/auth';
import { queryInventoryHistory, insertInventoryHistory } from '@/lib/d1/client';
import type { InventoryHistory } from '@/lib/d1/types';

/**
 * Get all inventory history records for the authenticated user from Cloudflare D1
 */
export async function getInventoryHistoryD1(): Promise<InventoryHistory[]> {
  const user = await requireAuth();

  if (!user) {
    throw new Error('Usuario no autenticado');
  }

  try {
    const history = await queryInventoryHistory(user.id);
    return history;
  } catch (error) {
    console.error('Error fetching inventory history from D1:', error);
    throw new Error('No se pudo cargar el historial de inventario');
  }
}

/**
 * Save a new inventory history record to Cloudflare D1
 * ✨ ACTUALIZADO: Ahora incluye imageUrl
 */
export async function saveInventoryHistoryD1(
  productId: string,
  productName: string,
  barcode: string,
  stockBefore: number,
  stockAfter: number,
  imageUrl?: string | null  // ← NUEVO: Parámetro opcional para la imagen
): Promise<void> {
  const user = await requireAuth();

  if (!user) {
    throw new Error('Usuario no autenticado');
  }

  try {
    await insertInventoryHistory({
      user_id: user.id,
      product_id: productId,
      product_name: productName,
      barcode,
      stock_before: stockBefore,
      stock_after: stockAfter,
      image_url: imageUrl || null,  // ← NUEVO: Pasar la URL de la imagen
    });

    // Revalidate the inventory history page to show the new record
    revalidatePath('/inventory_history');
  } catch (error) {
    console.error('Error saving inventory history to D1:', error);
    throw new Error('No se pudo guardar el historial de inventario');
  }
}