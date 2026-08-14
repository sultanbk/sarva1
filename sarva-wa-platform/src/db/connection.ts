// ============================================================
// Sarva One WhatsApp Platform — SQLite Database
// Uses Node.js 22 built-in node:sqlite (no native compilation needed)
// ============================================================
import { DatabaseSync } from 'node:sqlite'
import path from 'path'
import fs from 'fs'
import { config } from '../config'

// node:sqlite uses a slightly different type for statement results
export type RunResult = { lastInsertRowid: number | bigint; changes: number }

let _db: DatabaseSync | null = null

export function getDb(): DatabaseSync {
  if (_db) return _db

  const dbPath = path.resolve(config.db.path)
  const dir = path.dirname(dbPath)
  if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true })

  _db = new DatabaseSync(dbPath)

  // Pragmas via exec (node:sqlite doesn't have a separate pragma() method)
  _db.exec('PRAGMA journal_mode = WAL')
  _db.exec('PRAGMA foreign_keys = ON')
  _db.exec('PRAGMA synchronous = NORMAL')

  runMigrations(_db)
  return _db
}

function runMigrations(db: DatabaseSync): void {
  db.exec(`
    -- ============================================================
    -- TENANTS: One per Sarva One shop with WhatsApp eCommerce
    -- ============================================================
    CREATE TABLE IF NOT EXISTS tenants (
      id                TEXT PRIMARY KEY,
      shop_id           TEXT UNIQUE NOT NULL,
      shop_name         TEXT NOT NULL,
      shop_city         TEXT,
      wa_phone          TEXT UNIQUE NOT NULL,
      wa_phone_id       TEXT NOT NULL,
      wa_business_id    TEXT NOT NULL,
      wa_access_token   TEXT NOT NULL,
      razorpay_key_id   TEXT,
      razorpay_key_secret TEXT,
      api_key           TEXT UNIQUE NOT NULL,
      language          TEXT DEFAULT 'en',
      delivery_charge   REAL DEFAULT 80,
      free_delivery_above REAL DEFAULT 2500,
      delivery_days     TEXT DEFAULT '3-5',
      business_hours_start TEXT DEFAULT '10:00',
      business_hours_end   TEXT DEFAULT '20:00',
      auto_create_bill  INTEGER DEFAULT 1,
      is_active         INTEGER DEFAULT 1,
      plan              TEXT DEFAULT 'professional',
      onboarded_at      TEXT DEFAULT (datetime('now'))
    );

    -- ============================================================
    -- CATALOG: Per-tenant product listings (synced from POS)
    -- ============================================================
    CREATE TABLE IF NOT EXISTS catalog (
      id                INTEGER PRIMARY KEY AUTOINCREMENT,
      tenant_id         TEXT NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
      pos_product_id    INTEGER NOT NULL,
      name              TEXT NOT NULL,
      description       TEXT,
      category          TEXT,
      price             REAL NOT NULL,
      mrp               REAL,
      stock             INTEGER DEFAULT 0,
      is_available      INTEGER DEFAULT 1,
      image_media_id    TEXT,
      synced_at         TEXT DEFAULT (datetime('now')),
      UNIQUE (tenant_id, pos_product_id)
    );

    CREATE INDEX IF NOT EXISTS idx_catalog_tenant ON catalog(tenant_id, is_available);
    CREATE INDEX IF NOT EXISTS idx_catalog_category ON catalog(tenant_id, category);

    -- ============================================================
    -- SESSIONS: Per-customer conversation state
    -- ============================================================
    CREATE TABLE IF NOT EXISTS sessions (
      id                INTEGER PRIMARY KEY AUTOINCREMENT,
      tenant_id         TEXT NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
      wa_id             TEXT NOT NULL,
      name              TEXT,
      state             TEXT DEFAULT 'IDLE',
      current_category  TEXT,
      current_page      INTEGER DEFAULT 0,
      cart_json         TEXT DEFAULT '[]',
      language          TEXT DEFAULT 'en',
      last_activity     TEXT DEFAULT (datetime('now')),
      UNIQUE (tenant_id, wa_id)
    );

    CREATE INDEX IF NOT EXISTS idx_sessions_tenant ON sessions(tenant_id, wa_id);

    -- ============================================================
    -- ORDERS: All WhatsApp orders
    -- ============================================================
    CREATE TABLE IF NOT EXISTS orders (
      id                  INTEGER PRIMARY KEY AUTOINCREMENT,
      tenant_id           TEXT NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
      order_no            TEXT NOT NULL,
      wa_id               TEXT NOT NULL,
      customer_name       TEXT NOT NULL,
      customer_phone      TEXT NOT NULL,
      delivery_address    TEXT NOT NULL,
      items_json          TEXT NOT NULL,
      subtotal            REAL NOT NULL,
      delivery_charge     REAL DEFAULT 80,
      grand_total         REAL NOT NULL,
      status              TEXT DEFAULT 'pending',
      payment_method      TEXT,
      razorpay_order_id   TEXT,
      razorpay_payment_id TEXT,
      pos_bill_id         INTEGER,
      pos_customer_id     INTEGER,
      created_at          TEXT DEFAULT (datetime('now')),
      updated_at          TEXT DEFAULT (datetime('now')),
      UNIQUE (tenant_id, order_no)
    );

    CREATE INDEX IF NOT EXISTS idx_orders_tenant ON orders(tenant_id, status);
    CREATE INDEX IF NOT EXISTS idx_orders_wa ON orders(tenant_id, wa_id);

    -- ============================================================
    -- ORDER COUNTER: Per-tenant sequential numbering
    -- ============================================================
    CREATE TABLE IF NOT EXISTS order_counters (
      tenant_id   TEXT PRIMARY KEY REFERENCES tenants(id) ON DELETE CASCADE,
      last_no     INTEGER DEFAULT 0
    );
  `)

  console.log('[DB] Migrations complete')
  seedDefaultTenant(db)
}

function seedDefaultTenant(db: DatabaseSync): void {
  const tenantId = process.env.DEFAULT_TENANT_ID || 'krishnapriya-textiles'
  const shopName = process.env.DEFAULT_TENANT_NAME || 'Krishnapriya Textiles'
  const waPhone = process.env.DEFAULT_TENANT_WA_PHONE || '+919108455006'
  const waPhoneId = process.env.DEFAULT_TENANT_WA_PHONE_ID
  const waBusinessId = process.env.DEFAULT_TENANT_WA_BUSINESS_ID
  const waAccessToken = process.env.DEFAULT_TENANT_WA_ACCESS_TOKEN
  const apiKey = process.env.SYNC_API_KEY || 'kpt-pos-sync-secret-key-2026'

  if (!waPhoneId || !waBusinessId || !waAccessToken) {
    console.log('[DB] Seeding skipped: DEFAULT_TENANT_WA_PHONE_ID, DEFAULT_TENANT_WA_BUSINESS_ID, or DEFAULT_TENANT_WA_ACCESS_TOKEN environment variables not set.')
    return
  }

  try {
    const insert = db.prepare(`
      INSERT INTO tenants (
        id, shop_id, shop_name, shop_city, wa_phone, wa_phone_id, wa_business_id, wa_access_token, api_key
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
      ON CONFLICT(id) DO UPDATE SET
        shop_name = excluded.shop_name,
        wa_phone = excluded.wa_phone,
        wa_phone_id = excluded.wa_phone_id,
        wa_business_id = excluded.wa_business_id,
        wa_access_token = excluded.wa_access_token,
        api_key = excluded.api_key
    `)
    insert.run(
      tenantId,
      tenantId,
      shopName,
      'Bengaluru',
      waPhone.replace(/\s+/g, ''),
      waPhoneId,
      waBusinessId,
      waAccessToken,
      apiKey
    )
    console.log(`[DB] Default tenant "${shopName}" successfully seeded/updated on startup`)
  } catch (err) {
    console.error('[DB] Failed to seed default tenant:', err)
  }
}
