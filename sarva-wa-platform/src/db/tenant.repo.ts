// ============================================================
// Tenant Repository — CRUD for shop tenants
// ============================================================
import crypto from 'crypto'
import { getDb } from '../db/connection'
import type { Tenant, TenantCreateData } from '../types'

function rowToTenant(row: Record<string, unknown>): Tenant {
  return {
    id: row.id as string,
    shopId: row.shop_id as string,
    shopName: row.shop_name as string,
    shopCity: row.shop_city as string | null,
    waPhone: row.wa_phone as string,
    waPhoneId: row.wa_phone_id as string,
    waBusinessId: row.wa_business_id as string,
    waAccessToken: row.wa_access_token as string,
    razorpayKeyId: row.razorpay_key_id as string | null,
    razorpayKeySecret: row.razorpay_key_secret as string | null,
    apiKey: row.api_key as string,
    language: (row.language as Tenant['language']) ?? 'en',
    deliveryCharge: row.delivery_charge as number,
    freeDeliveryAbove: row.free_delivery_above as number,
    deliveryDays: row.delivery_days as string,
    businessHoursStart: row.business_hours_start as string,
    businessHoursEnd: row.business_hours_end as string,
    autoCreateBill: (row.auto_create_bill as number) === 1,
    isActive: (row.is_active as number) === 1,
    onboardedAt: row.onboarded_at as string,
    plan: row.plan as string,
  }
}

export const tenantRepo = {
  /**
   * Find tenant by their WhatsApp phone number.
   * Used by the webhook router to identify which shop a message belongs to.
   */
  getByWaPhone(waPhone: string): Tenant | null {
    const db = getDb()
    const row = db
      .prepare('SELECT * FROM tenants WHERE wa_phone = ? AND is_active = 1')
      .get(waPhone) as Record<string, unknown> | undefined
    return row ? rowToTenant(row) : null
  },

  /**
   * Find tenant by their Meta Phone Number ID.
   * The webhook metadata gives us phoneNumberId, not the phone itself.
   */
  getByPhoneId(phoneNumberId: string): Tenant | null {
    const db = getDb()
    const row = db
      .prepare('SELECT * FROM tenants WHERE wa_phone_id = ? AND is_active = 1')
      .get(phoneNumberId) as Record<string, unknown> | undefined
    return row ? rowToTenant(row) : null
  },

  /** Find tenant by API key (used by POS sync endpoints) */
  getByApiKey(apiKey: string): Tenant | null {
    const db = getDb()
    const row = db
      .prepare('SELECT * FROM tenants WHERE api_key = ? AND is_active = 1')
      .get(apiKey) as Record<string, unknown> | undefined
    return row ? rowToTenant(row) : null
  },

  getById(id: string): Tenant | null {
    const db = getDb()
    const row = db
      .prepare('SELECT * FROM tenants WHERE id = ?')
      .get(id) as Record<string, unknown> | undefined
    return row ? rowToTenant(row) : null
  },

  getAll(): Tenant[] {
    const db = getDb()
    const rows = db
      .prepare('SELECT * FROM tenants ORDER BY shop_name')
      .all() as Record<string, unknown>[]
    return rows.map(rowToTenant)
  },

  create(data: TenantCreateData): Tenant {
    const db = getDb()
    const id = crypto.randomUUID()
    const apiKey = `ska_${crypto.randomUUID().replace(/-/g, '')}`

    db.prepare(`
      INSERT INTO tenants (
        id, shop_id, shop_name, shop_city,
        wa_phone, wa_phone_id, wa_business_id, wa_access_token,
        razorpay_key_id, razorpay_key_secret,
        api_key, language, delivery_charge, free_delivery_above,
        delivery_days, business_hours_start, business_hours_end
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `).run(
      id,
      data.shopId,
      data.shopName,
      data.shopCity ?? null,
      data.waPhone,
      data.waPhoneId,
      data.waBusinessId,
      data.waAccessToken,
      data.razorpayKeyId ?? null,
      data.razorpayKeySecret ?? null,
      apiKey,
      data.language ?? 'en',
      data.deliveryCharge ?? 80,
      data.freeDeliveryAbove ?? 2500,
      data.deliveryDays ?? '3-5',
      data.businessHoursStart ?? '10:00',
      data.businessHoursEnd ?? '20:00',
    )

    // Initialise order counter for this tenant
    db.prepare('INSERT INTO order_counters (tenant_id, last_no) VALUES (?, 0)').run(id)

    return this.getById(id)!
  },

  /** Atomically get next order number for a tenant e.g. "WA-KPT-001" */
  nextOrderNo(tenantId: string, prefix: string): string {
    const db = getDb()
    // node:sqlite doesn't support RETURNING in the same way — use two statements
    db.prepare('UPDATE order_counters SET last_no = last_no + 1 WHERE tenant_id = ?').run(tenantId)
    const result = db
      .prepare('SELECT last_no FROM order_counters WHERE tenant_id = ?')
      .get(tenantId) as { last_no: number } | undefined
    const n = result?.last_no ?? 1
    return `WA-${prefix}-${String(n).padStart(3, '0')}`
  },
}
