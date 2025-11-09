// Cloudflare D1 Client for inventory_history

import type { InventoryHistory, InventoryHistoryInsert } from './types';

/**
 * Check if we're running in Cloudflare Pages environment
 */
function isCloudflarePages(): boolean {
  // @ts-ignore - Cloudflare Pages injects this at runtime
  return typeof process.env.DB !== 'undefined' || typeof globalThis.DB !== 'undefined';
}

/**
 * Get D1 database instance from Cloudflare Pages environment
 * This works automatically when deployed to Cloudflare Pages with wrangler.toml configuration
 */
function getD1Database(): D1Database | null {
  // In Cloudflare Pages, the binding is available via process.env
  // @ts-ignore - Cloudflare Pages injects this at runtime
  const db = process.env.DB || globalThis.DB;

  return db as D1Database | null;
}

/**
 * Type for D1 REST API response
 */
interface D1ApiResponse {
  result: Array<{
    results: any[];
    success: boolean;
    meta: any;
  }>;
  success: boolean;
  errors: any[];
  messages: any[];
}

/**
 * Execute D1 query using REST API (for development)
 */
async function executeD1Query(sql: string, params: any[] = []): Promise<any> {
  const accountId = process.env.CLOUDFLARE_ACCOUNT_ID;
  const databaseId = process.env.CLOUDFLARE_DATABASE_ID;
  const apiToken = process.env.CLOUDFLARE_D1_TOKEN;

  if (!accountId || !databaseId || !apiToken) {
    throw new Error('Cloudflare D1 credentials not configured. Add CLOUDFLARE_ACCOUNT_ID, CLOUDFLARE_DATABASE_ID, and CLOUDFLARE_D1_TOKEN to .env.local');
  }

  const response = await fetch(
    `https://api.cloudflare.com/client/v4/accounts/${accountId}/d1/database/${databaseId}/query`,
    {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${apiToken}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        sql,
        params,
      }),
    }
  );

  if (!response.ok) {
    const error = await response.text();
    throw new Error(`D1 API Error: ${response.status} - ${error}`);
  }

  const data = await response.json() as D1ApiResponse;
  return data.result[0];
}

/**
 * Query all inventory history records for a specific user
 * Ordered by scanned_at DESC (newest first)
 */
export async function queryInventoryHistory(userId: string): Promise<InventoryHistory[]> {
  const db = getD1Database();

  if (db) {
    // Production: Use D1 binding
    const { results } = await db
      .prepare('SELECT * FROM inventory_history WHERE user_id = ? ORDER BY scanned_at DESC')
      .bind(userId)
      .all<InventoryHistory>();

    return results || [];
  } else {
    // Development: Use REST API
    const result = await executeD1Query(
      'SELECT * FROM inventory_history WHERE user_id = ? ORDER BY scanned_at DESC',
      [userId]
    );

    return result.results || [];
  }
}

/**
 * Insert a new inventory history record
 */
export async function insertInventoryHistory(
  data: InventoryHistoryInsert
): Promise<InventoryHistory> {
  const db = getD1Database();

  // Generate a unique ID (similar to UUID but compatible with SQLite)
  const id = crypto.randomUUID();

  if (db) {
    // Production: Use D1 binding
    const result = await db
      .prepare(`
        INSERT INTO inventory_history (id, user_id, product_id, product_name, barcode, stock_before, stock_after, scanned_at)
        VALUES (?, ?, ?, ?, ?, ?, ?, CURRENT_TIMESTAMP)
        RETURNING *
      `)
      .bind(
        id,
        data.user_id,
        data.product_id,
        data.product_name,
        data.barcode,
        data.stock_before,
        data.stock_after
      )
      .first<InventoryHistory>();

    if (!result) {
      throw new Error('Failed to insert inventory history record');
    }

    return result;
  } else {
    // Development: Use REST API
    const result = await executeD1Query(
      `INSERT INTO inventory_history (id, user_id, product_id, product_name, barcode, stock_before, stock_after, scanned_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, CURRENT_TIMESTAMP)
       RETURNING *`,
      [
        id,
        data.user_id,
        data.product_id,
        data.product_name,
        data.barcode,
        data.stock_before,
        data.stock_after,
      ]
    );

    if (!result.results || result.results.length === 0) {
      throw new Error('Failed to insert inventory history record');
    }

    return result.results[0];
  }
}

/**
 * Get a single inventory history record by ID
 * SECURITY: Filters by both id AND user_id to prevent unauthorized access
 */
export async function getInventoryHistoryById(id: string, userId: string): Promise<InventoryHistory | null> {
  const db = getD1Database();

  if (db) {
    // Production: Use D1 binding
    const result = await db
      .prepare('SELECT * FROM inventory_history WHERE id = ? AND user_id = ?')
      .bind(id, userId)
      .first<InventoryHistory>();

    return result || null;
  } else {
    // Development: Use REST API
    const result = await executeD1Query(
      'SELECT * FROM inventory_history WHERE id = ? AND user_id = ?',
      [id, userId]
    );

    return result.results?.[0] || null;
  }
}

/**
 * Count total inventory history records for a user
 */
export async function countInventoryHistory(userId: string): Promise<number> {
  const db = getD1Database();

  if (db) {
    // Production: Use D1 binding
    const result = await db
      .prepare('SELECT COUNT(*) as count FROM inventory_history WHERE user_id = ?')
      .bind(userId)
      .first<{ count: number }>();

    return result?.count || 0;
  } else {
    // Development: Use REST API
    const result = await executeD1Query(
      'SELECT COUNT(*) as count FROM inventory_history WHERE user_id = ?',
      [userId]
    );

    return result.results?.[0]?.count || 0;
  }
}
