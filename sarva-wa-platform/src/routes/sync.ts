// ============================================================
// Sync Route — POS pushes product catalog to the bot server
// POST /api/sync/catalog    → Full catalog sync
// GET  /api/orders          → POS fetches new orders
// PUT  /api/orders/:orderNo → POS updates order status
// POST /api/onboard         → New tenant registration
// ============================================================
import { Router, Request, Response } from 'express'
import { z } from 'zod'
import { tenantRepo } from '../db/tenant.repo'
import { catalogRepo } from '../db/catalog.repo'
import { orderRepo } from '../db/order.repo'
import { whatsappService } from '../services/whatsapp.service'
import type { OrderStatus } from '../types'

export const syncRouter = Router()

// ---- Auth middleware: validate API key from x-api-key or Authorization header ----
function resolveTenant(req: Request, res: Response): ReturnType<typeof tenantRepo.getByApiKey> {
  // Support both 'x-api-key' header (POS IPC sends this) and 'Authorization: Bearer' header
  const xApiKey = req.headers['x-api-key'] as string | undefined
  const auth = req.headers.authorization ?? ''
  const apiKey = xApiKey || (auth.startsWith('Bearer ') ? auth.slice(7) : auth)

  if (!apiKey) {
    res.status(401).json({ success: false, error: 'Missing API key' })
    return null
  }

  const tenant = tenantRepo.getByApiKey(apiKey)
  if (!tenant) {
    res.status(401).json({ success: false, error: 'Invalid API key' })
    return null
  }
  return tenant
}

// ---- POST /api/sync/catalog ----
const CatalogSyncSchema = z.object({
  products: z.array(z.object({
    posProductId: z.number().int().positive(),
    name: z.string().min(1).max(200),
    description: z.string().max(500).optional(),
    category: z.string().max(100).optional(),
    price: z.number().positive(),
    mrp: z.number().positive().optional(),
    stock: z.number().int().min(0),
    isAvailable: z.boolean().optional(),
    imageUrl: z.string().url().optional(),
  })),
})

syncRouter.post('/catalog', (req: Request, res: Response) => {
  const tenant = resolveTenant(req, res)
  if (!tenant) return

  const parsed = CatalogSyncSchema.safeParse(req.body)
  if (!parsed.success) {
    res.status(400).json({ success: false, error: parsed.error.flatten() })
    return
  }

  const result = catalogRepo.sync(tenant.id, parsed.data.products)
  console.log(`[Sync] Tenant=${tenant.shopName} synced ${result.synced} products`)

  res.json({ success: true, ...result })
})

// ---- GET /api/sync/orders  (alias: /api/orders) ----
syncRouter.get('/orders', (req: Request, res: Response) => {
  const tenant = resolveTenant(req, res)
  if (!tenant) return

  const since = req.query.since as string | undefined
  const statusParam = req.query.status as string | undefined
  // Accept comma-separated statuses: e.g. ?status=pending,confirmed
  const status = statusParam?.includes(',') ? undefined : statusParam as OrderStatus | undefined

  const orders = orderRepo.getByTenant(tenant.id, status, since)
  res.json({ success: true, orders })
})

// ---- GET /api/sync/orders/count ----
syncRouter.get('/orders/count', (req: Request, res: Response) => {
  const tenant = resolveTenant(req, res)
  if (!tenant) return

  const statusParam = req.query.status as string | undefined
  const status = statusParam as OrderStatus | undefined
  const orders = orderRepo.getByTenant(tenant.id, status, undefined)
  res.json({ success: true, count: orders.length })
})

// ---- PUT /api/sync/orders/:orderNo/status  (alias: /api/orders/:orderNo/status) ----
const StatusUpdateSchema = z.object({
  status: z.enum(['confirmed', 'shipped', 'packed', 'dispatched', 'delivered', 'cancelled']),
  note: z.string().optional(),
  posBillId: z.number().int().optional(),
  posCustomerId: z.number().int().optional(),
})

syncRouter.put('/orders/:orderNo/status', async (req: Request, res: Response) => {
  const tenant = resolveTenant(req, res)
  if (!tenant) return

  const order = orderRepo.getByOrderNo(tenant.id, req.params.orderNo)
  if (!order) {
    // Also try by ID string (POS sends order UUID)
    res.status(404).json({ success: false, error: 'Order not found' })
    return
  }

  const parsed = StatusUpdateSchema.safeParse(req.body)
  if (!parsed.success) {
    res.status(400).json({ success: false, error: parsed.error.flatten() })
    return
  }

  // Map POS status names to bot internal names
  const statusMap: Record<string, OrderStatus> = {
    confirmed: 'confirmed',
    shipped: 'dispatched',
    delivered: 'delivered',
    cancelled: 'cancelled',
    packed: 'packed',
    dispatched: 'dispatched',
  }
  const mappedStatus = (statusMap[parsed.data.status] ?? parsed.data.status) as OrderStatus
  const { posBillId, posCustomerId } = parsed.data
  const updated = orderRepo.updateStatus(order.id, mappedStatus, { posBillId, posCustomerId })

  // Notify customer on WhatsApp for status changes
  const notifyMessages: Record<string, string> = {
    packed: `📦 *Your order #${order.orderNo} is packed!*\n\nIt will be handed over to the courier soon. We'll notify you once it's shipped! 🚚`,
    dispatched: `🚚 *Your order #${order.orderNo} is on its way!*\n\nExpected delivery: ${tenant.deliveryDays ?? 3} business days.\n\nThank you for shopping with *${tenant.shopName}* 🙏`,
    delivered: `🎉 *Order #${order.orderNo} delivered!*\n\nWe hope you love your purchase! 💕\n\nType *Hi* to shop again anytime.`,
    cancelled: `❌ *Order #${order.orderNo} has been cancelled.*\n\nIf you have any questions, please contact us.\n\n_${parsed.data.note ?? ''}_`,
  }

  const notify = notifyMessages[mappedStatus]
  if (notify) {
    whatsappService.sendText(tenant, order.waId, notify).catch(err => {
      console.error(`[Sync] Failed to notify customer ${order.waId}:`, err)
    })
  }

  res.json({ success: true, order: updated })
})

// ---- POST /api/onboard — Register a new shop tenant ----
const OnboardSchema = z.object({
  shopId: z.string().min(1),
  shopName: z.string().min(1).max(200),
  shopCity: z.string().optional(),
  waPhone: z.string().regex(/^\+91\d{10}$/, 'Must be Indian number: +91XXXXXXXXXX'),
  waPhoneId: z.string().min(1),
  waBusinessId: z.string().min(1),
  waAccessToken: z.string().min(1),
  razorpayKeyId: z.string().optional(),
  razorpayKeySecret: z.string().optional(),
  language: z.enum(['en', 'kn', 'hi', 'te']).optional(),
  deliveryCharge: z.number().min(0).optional(),
  freeDeliveryAbove: z.number().min(0).optional(),
})

syncRouter.post('/onboard', (req: Request, res: Response) => {
  // This endpoint uses the internal server secret, not a tenant API key
  const serverSecret = req.headers['x-server-secret']
  if (serverSecret !== process.env.INTERNAL_API_SECRET) {
    res.status(401).json({ success: false, error: 'Unauthorized' })
    return
  }

  const parsed = OnboardSchema.safeParse(req.body)
  if (!parsed.success) {
    res.status(400).json({ success: false, error: parsed.error.flatten() })
    return
  }

  // Check if tenant with this phone already exists
  const existing = tenantRepo.getByWaPhone(parsed.data.waPhone)
  if (existing) {
    res.status(409).json({ success: false, error: 'This WhatsApp number is already registered' })
    return
  }

  const tenant = tenantRepo.create(parsed.data)
  console.log(`[Onboard] New tenant registered: ${tenant.shopName} (${tenant.waPhone})`)

  res.status(201).json({
    success: true,
    tenant: {
      id: tenant.id,
      shopName: tenant.shopName,
      waPhone: tenant.waPhone,
      apiKey: tenant.apiKey,   // returned once for the POS to save
    },
  })
})

// ---- GET /api/health ----
syncRouter.get('/health', (_req: Request, res: Response) => {
  res.json({ success: true, status: 'ok', tenants: tenantRepo.getAll().length })
})
