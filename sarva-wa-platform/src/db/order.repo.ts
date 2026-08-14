// ============================================================
// Order Repository
// ============================================================
import { getDb } from '../db/connection'
import type { Order, OrderCreateData, OrderStatus } from '../types'

function rowToOrder(row: Record<string, unknown>): Order {
  return {
    id: row.id as number,
    tenantId: row.tenant_id as string,
    orderNo: row.order_no as string,
    waId: row.wa_id as string,
    customerName: row.customer_name as string,
    customerPhone: row.customer_phone as string,
    deliveryAddress: row.delivery_address as string,
    items: JSON.parse(row.items_json as string),
    subtotal: row.subtotal as number,
    deliveryCharge: row.delivery_charge as number,
    grandTotal: row.grand_total as number,
    status: row.status as OrderStatus,
    paymentMethod: row.payment_method as Order['paymentMethod'],
    razorpayOrderId: row.razorpay_order_id as string | null,
    razorpayPaymentId: row.razorpay_payment_id as string | null,
    posBillId: row.pos_bill_id as number | null,
    posCustomerId: row.pos_customer_id as number | null,
    createdAt: row.created_at as string,
    updatedAt: row.updated_at as string,
  }
}

export const orderRepo = {
  create(data: OrderCreateData & { orderNo: string }): Order {
    const db = getDb()
    const result = db.prepare(`
      INSERT INTO orders (
        tenant_id, order_no, wa_id, customer_name, customer_phone,
        delivery_address, items_json, subtotal, delivery_charge, grand_total,
        status, payment_method
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `).run(
      data.tenantId,
      data.orderNo,
      data.waId,
      data.customerName,
      data.customerPhone,
      data.deliveryAddress,
      JSON.stringify(data.items),
      data.subtotal,
      data.deliveryCharge,
      data.grandTotal,
      data.paymentMethod === 'upi' ? 'awaiting_payment' : 'pending',
      data.paymentMethod,
    )
    // node:sqlite returns lastInsertRowid as bigint — convert to number
    return this.getById(Number(result.lastInsertRowid))!
  },

  getById(id: number): Order | null {
    const db = getDb()
    const row = db.prepare('SELECT * FROM orders WHERE id = ?').get(id) as Record<string, unknown> | undefined
    return row ? rowToOrder(row) : null
  },

  getByOrderNo(tenantId: string, orderNo: string): Order | null {
    const db = getDb()
    const row = db
      .prepare('SELECT * FROM orders WHERE tenant_id = ? AND order_no = ?')
      .get(tenantId, orderNo) as Record<string, unknown> | undefined
    return row ? rowToOrder(row) : null
  },

  getByRazorpayOrderId(razorpayOrderId: string): Order | null {
    const db = getDb()
    const row = db
      .prepare('SELECT * FROM orders WHERE razorpay_order_id = ?')
      .get(razorpayOrderId) as Record<string, unknown> | undefined
    return row ? rowToOrder(row) : null
  },

  getByWaId(tenantId: string, waId: string, limit = 5): Order[] {
    const db = getDb()
    const rows = db
      .prepare('SELECT * FROM orders WHERE tenant_id = ? AND wa_id = ? ORDER BY created_at DESC LIMIT ?')
      .all(tenantId, waId, limit) as Record<string, unknown>[]
    return rows.map(rowToOrder)
  },

  /** Get all orders for a tenant, ordered newest first */
  getByTenant(tenantId: string, status?: OrderStatus, since?: string): Order[] {
    const db = getDb()
    let sql = 'SELECT * FROM orders WHERE tenant_id = ?'
    const params: (string | number | null | bigint)[] = [tenantId]
    if (status) { sql += ' AND status = ?'; params.push(status) }
    if (since) { sql += ' AND created_at > ?'; params.push(since) }
    sql += ' ORDER BY created_at DESC LIMIT 100'
    const rows = db.prepare(sql).all(...params) as Record<string, unknown>[]
    return rows.map(rowToOrder)
  },

  updateStatus(
    id: number,
    status: OrderStatus,
    extra?: { razorpayOrderId?: string; razorpayPaymentId?: string; posBillId?: number; posCustomerId?: number },
  ): Order | null {
    const db = getDb()
    const fields = ["status = ?", "updated_at = datetime('now')"]
    const values: (string | number | null | bigint)[] = [status]

    if (extra?.razorpayOrderId) { fields.push('razorpay_order_id = ?'); values.push(extra.razorpayOrderId) }
    if (extra?.razorpayPaymentId) { fields.push('razorpay_payment_id = ?'); values.push(extra.razorpayPaymentId) }
    if (extra?.posBillId) { fields.push('pos_bill_id = ?'); values.push(extra.posBillId) }
    if (extra?.posCustomerId) { fields.push('pos_customer_id = ?'); values.push(extra.posCustomerId) }

    values.push(id)
    db.prepare(`UPDATE orders SET ${fields.join(', ')} WHERE id = ?`).run(...values)
    return this.getById(id)
  },
}
