// ============================================================
// Catalog Repository — Product listings per tenant
// ============================================================
import { getDb } from '../db/connection'
import type { CatalogProduct, CatalogSyncItem } from '../types'

const PAGE_SIZE = 4   // products shown per WhatsApp message

function rowToProduct(row: Record<string, unknown>): CatalogProduct {
  return {
    id: row.id as number,
    tenantId: row.tenant_id as string,
    posProductId: row.pos_product_id as number,
    name: row.name as string,
    description: row.description as string | null,
    category: row.category as string | null,
    price: row.price as number,
    mrp: row.mrp as number | null,
    stock: row.stock as number,
    isAvailable: (row.is_available as number) === 1,
    imageMediaId: row.image_media_id as string | null,
    syncedAt: row.synced_at as string,
  }
}

export const catalogRepo = {
  /** Get all distinct categories for a tenant */
  getCategories(tenantId: string): string[] {
    const db = getDb()
    const rows = db
      .prepare(`
        SELECT DISTINCT category FROM catalog
        WHERE tenant_id = ? AND is_available = 1 AND stock > 0 AND category IS NOT NULL
        ORDER BY category
      `)
      .all(tenantId) as { category: string }[]
    return rows.map(r => r.category)
  },

  /** Get products by category, paginated */
  getByCategory(tenantId: string, category: string, page: number): {
    products: CatalogProduct[]
    total: number
    hasMore: boolean
  } {
    const db = getDb()
    const offset = page * PAGE_SIZE

    const total = (db
      .prepare(`SELECT COUNT(*) as n FROM catalog WHERE tenant_id = ? AND category = ? AND is_available = 1 AND stock > 0`)
      .get(tenantId, category) as { n: number }).n

    const rows = db
      .prepare(`
        SELECT * FROM catalog
        WHERE tenant_id = ? AND category = ? AND is_available = 1 AND stock > 0
        ORDER BY name LIMIT ? OFFSET ?
      `)
      .all(tenantId, category, PAGE_SIZE, offset) as Record<string, unknown>[]

    return {
      products: rows.map(rowToProduct),
      total,
      hasMore: offset + PAGE_SIZE < total,
    }
  },

  /** Search products by name */
  search(tenantId: string, query: string): CatalogProduct[] {
    const db = getDb()
    const rows = db
      .prepare(`
        SELECT * FROM catalog
        WHERE tenant_id = ? AND is_available = 1 AND stock > 0
        AND (LOWER(name) LIKE ? OR LOWER(description) LIKE ?)
        LIMIT 5
      `)
      .all(tenantId, `%${query.toLowerCase()}%`, `%${query.toLowerCase()}%`) as Record<string, unknown>[]
    return rows.map(rowToProduct)
  },

  getById(tenantId: string, posProductId: number): CatalogProduct | null {
    const db = getDb()
    const row = db
      .prepare('SELECT * FROM catalog WHERE tenant_id = ? AND pos_product_id = ?')
      .get(tenantId, posProductId) as Record<string, unknown> | undefined
    return row ? rowToProduct(row) : null
  },

  /**
   * Full catalog sync from POS — upsert all items.
   * Products not in the sync list are marked unavailable (not deleted).
   */
  sync(tenantId: string, items: CatalogSyncItem[]): { synced: number; skipped: number } {
    const db = getDb()
    let synced = 0
    let skipped = 0

    const posIds = items.map(i => i.posProductId)

    // Wrap in explicit transaction for atomicity
    db.exec('BEGIN')
    try {
      // Mark items not in sync as unavailable
      if (posIds.length > 0) {
        const placeholders = posIds.map(() => '?').join(', ')
        db.prepare(`
          UPDATE catalog SET is_available = 0
          WHERE tenant_id = ? AND pos_product_id NOT IN (${placeholders})
        `).run(tenantId, ...posIds)
      }

      for (const item of items) {
        try {
          db.prepare(`
            INSERT INTO catalog (tenant_id, pos_product_id, name, description, category, price, mrp, stock, is_available, synced_at)
            VALUES (?, ?, ?, ?, ?, ?, ?, ?, 1, datetime('now'))
            ON CONFLICT (tenant_id, pos_product_id) DO UPDATE SET
              name = excluded.name,
              description = excluded.description,
              category = excluded.category,
              price = excluded.price,
              mrp = excluded.mrp,
              stock = excluded.stock,
              is_available = 1,
              synced_at = datetime('now')
          `).run(
            tenantId,
            item.posProductId,
            item.name,
            item.description ?? null,
            item.category ?? null,
            item.price,
            item.mrp ?? null,
            item.stock,
          )
          synced++
        } catch {
          skipped++
        }
      }

      db.exec('COMMIT')
    } catch (err) {
      db.exec('ROLLBACK')
      throw err
    }

    return { synced, skipped }
  },
}
