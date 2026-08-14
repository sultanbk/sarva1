// ============================================================
// Session Repository — Conversation state per customer per tenant
// ============================================================
import { getDb } from '../db/connection'
import type { Session, SessionState, CartItem } from '../types'

function rowToSession(row: Record<string, unknown>): Session {
  return {
    id: row.id as number,
    tenantId: row.tenant_id as string,
    waId: row.wa_id as string,
    name: row.name as string | null,
    state: row.state as SessionState,
    currentCategory: row.current_category as string | null,
    currentPage: row.current_page as number,
    cart: JSON.parse((row.cart_json as string) || '[]') as CartItem[],
    language: (row.language as Session['language']) ?? 'en',
    lastActivity: row.last_activity as string,
  }
}

export const sessionRepo = {
  get(tenantId: string, waId: string): Session | null {
    const db = getDb()
    const row = db
      .prepare('SELECT * FROM sessions WHERE tenant_id = ? AND wa_id = ?')
      .get(tenantId, waId) as Record<string, unknown> | undefined
    return row ? rowToSession(row) : null
  },

  upsert(
    tenantId: string,
    waId: string,
    updates: Partial<Omit<Session, 'id' | 'tenantId' | 'waId'>>,
  ): Session {
    const db = getDb()
    const existing = this.get(tenantId, waId)

    if (!existing) {
      // Create new session
      db.prepare(`
        INSERT INTO sessions (tenant_id, wa_id, name, state, current_category, current_page, cart_json, language, last_activity)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, datetime('now'))
      `).run(
        tenantId,
        waId,
        updates.name ?? null,
        updates.state ?? 'IDLE',
        updates.currentCategory ?? null,
        updates.currentPage ?? 0,
        JSON.stringify(updates.cart ?? []),
        updates.language ?? 'en',
      )
    } else {
      // Update existing
      const fields: string[] = ["last_activity = datetime('now')"]
      const values: (string | number | null | bigint | Uint8Array)[] = []

      if (updates.name !== undefined) { fields.push('name = ?'); values.push(updates.name ?? null) }
      if (updates.state !== undefined) { fields.push('state = ?'); values.push(updates.state) }
      if (updates.currentCategory !== undefined) { fields.push('current_category = ?'); values.push(updates.currentCategory ?? null) }
      if (updates.currentPage !== undefined) { fields.push('current_page = ?'); values.push(updates.currentPage) }
      if (updates.cart !== undefined) { fields.push('cart_json = ?'); values.push(JSON.stringify(updates.cart)) }
      if (updates.language !== undefined) { fields.push('language = ?'); values.push(updates.language) }

      values.push(tenantId, waId)
      db.prepare(`UPDATE sessions SET ${fields.join(', ')} WHERE tenant_id = ? AND wa_id = ?`)
        .run(...values)
    }

    return this.get(tenantId, waId)!
  },

  setState(tenantId: string, waId: string, state: SessionState): void {
    this.upsert(tenantId, waId, { state })
  },

  addToCart(tenantId: string, waId: string, item: CartItem): Session {
    const session = this.get(tenantId, waId) ?? { cart: [] as CartItem[] } as Session
    const existing = session.cart.find(c => c.posProductId === item.posProductId)
    let newCart: CartItem[]
    if (existing) {
      newCart = session.cart.map(c =>
        c.posProductId === item.posProductId
          ? { ...c, quantity: c.quantity + item.quantity }
          : c,
      )
    } else {
      newCart = [...session.cart, item]
    }
    return this.upsert(tenantId, waId, { cart: newCart })
  },

  removeFromCart(tenantId: string, waId: string, posProductId: number): Session {
    const session = this.get(tenantId, waId)
    const newCart = (session?.cart ?? []).filter(c => c.posProductId !== posProductId)
    return this.upsert(tenantId, waId, { cart: newCart })
  },

  clearCart(tenantId: string, waId: string): void {
    this.upsert(tenantId, waId, { cart: [], state: 'DONE' })
  },

  reset(tenantId: string, waId: string): void {
    const db = getDb()
    db.prepare(`
      UPDATE sessions SET state = 'IDLE', cart_json = '[]', current_category = NULL, current_page = 0,
      last_activity = datetime('now') WHERE tenant_id = ? AND wa_id = ?
    `).run(tenantId, waId)
  },
}
