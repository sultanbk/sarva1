// ============================================================
// Sarva One WhatsApp Platform — All TypeScript Types
// ============================================================

// ---- Tenant (one per Sarva One shop) ----
export interface Tenant {
  id: string                  // UUID
  shopId: string              // Sarva One license key / shop identifier
  shopName: string            // "Krishnapriya Textiles"
  shopCity: string | null     // "Shirahatti"
  waPhone: string             // "+919108455006" — the bot's number
  waPhoneId: string           // Meta Phone Number ID
  waBusinessId: string        // Meta WABA ID
  waAccessToken: string       // encrypted Meta System User token
  razorpayKeyId: string | null
  razorpayKeySecret: string | null  // encrypted
  apiKey: string              // secret POS uses to authenticate to this server
  language: 'en' | 'kn' | 'hi' | 'te'
  deliveryCharge: number
  freeDeliveryAbove: number
  deliveryDays: string        // "3-5"
  businessHoursStart: string  // "10:00"
  businessHoursEnd: string    // "20:00"
  autoCreateBill: boolean
  isActive: boolean
  onboardedAt: string
  plan: string
}

export interface TenantCreateData {
  shopId: string
  shopName: string
  shopCity?: string
  waPhone: string
  waPhoneId: string
  waBusinessId: string
  waAccessToken: string
  razorpayKeyId?: string
  razorpayKeySecret?: string
  language?: Tenant['language']
  deliveryCharge?: number
  freeDeliveryAbove?: number
  deliveryDays?: string
  businessHoursStart?: string
  businessHoursEnd?: string
}

// ---- Catalog Product ----
export interface CatalogProduct {
  id: number
  tenantId: string
  posProductId: number
  name: string
  description: string | null
  category: string | null
  price: number
  mrp: number | null
  stock: number
  isAvailable: boolean
  imageMediaId: string | null   // Meta media ID (for image messages)
  syncedAt: string
}

export interface CatalogSyncItem {
  posProductId: number
  name: string
  description?: string
  category?: string
  price: number
  mrp?: number
  stock: number
  isAvailable?: boolean
  imageUrl?: string   // POS will send image URL; we upload to Meta and store media ID
}

// ---- Session (per customer conversation) ----
export type SessionState =
  | 'IDLE'
  | 'MAIN_MENU'
  | 'BROWSING_CATEGORIES'
  | 'BROWSING_PRODUCTS'
  | 'CART'
  | 'CHECKOUT_NAME'
  | 'CHECKOUT_ADDRESS'
  | 'CHECKOUT_PAYMENT'
  | 'AWAITING_PAYMENT'
  | 'DONE'

export interface CartItem {
  posProductId: number
  name: string
  price: number
  quantity: number
}

export interface Session {
  id: number
  tenantId: string
  waId: string              // customer WhatsApp number e.g. "919876543210"
  name: string | null
  state: SessionState
  currentCategory: string | null
  currentPage: number
  cart: CartItem[]
  language: 'en' | 'kn' | 'hi' | 'te'
  lastActivity: string
}

// ---- Orders ----
export interface OrderItem {
  posProductId: number
  name: string
  price: number
  quantity: number
  subtotal: number
}

export type OrderStatus =
  | 'pending'         // COD placed, not confirmed
  | 'awaiting_payment'// UPI link sent, waiting
  | 'paid'            // payment confirmed
  | 'confirmed'       // operator confirmed (auto for UPI, manual for COD)
  | 'packed'
  | 'dispatched'
  | 'delivered'
  | 'cancelled'

export interface Order {
  id: number
  tenantId: string
  orderNo: string           // "WA-KPT-001"
  waId: string
  customerName: string
  customerPhone: string
  deliveryAddress: string
  items: OrderItem[]
  subtotal: number
  deliveryCharge: number
  grandTotal: number
  status: OrderStatus
  paymentMethod: 'upi' | 'cod' | null
  razorpayOrderId: string | null
  razorpayPaymentId: string | null
  posBillId: number | null
  posCustomerId: number | null
  createdAt: string
  updatedAt: string
}

export interface OrderCreateData {
  tenantId: string
  waId: string
  customerName: string
  customerPhone: string
  deliveryAddress: string
  items: OrderItem[]
  subtotal: number
  deliveryCharge: number
  grandTotal: number
  paymentMethod: 'upi' | 'cod'
}

// ---- WhatsApp Message Types ----
export interface IncomingMessage {
  tenantId: string
  waId: string            // sender's WA number (without +)
  messageId: string
  type: 'text' | 'interactive' | 'image' | 'audio' | 'unknown'
  text?: string
  buttonReply?: { id: string; title: string }
  listReply?: { id: string; title: string; description?: string }
  timestamp: number
}

export interface MetaWebhookPayload {
  object: string
  entry: MetaEntry[]
}

export interface MetaEntry {
  id: string
  changes: MetaChange[]
}

export interface MetaChange {
  value: {
    messaging_product: string
    metadata: { display_phone_number: string; phone_number_id: string }
    contacts?: Array<{ profile: { name: string }; wa_id: string }>
    messages?: MetaRawMessage[]
    statuses?: unknown[]
  }
  field: string
}

export interface MetaRawMessage {
  from: string
  id: string
  timestamp: string
  type: string
  text?: { body: string }
  interactive?: {
    type: 'button_reply' | 'list_reply'
    button_reply?: { id: string; title: string }
    list_reply?: { id: string; title: string; description?: string }
  }
}

// ---- API Responses ----
export interface ApiResponse<T = unknown> {
  success: boolean
  data?: T
  error?: string
}

// ---- Razorpay ----
export interface PaymentLinkResult {
  id: string
  shortUrl: string
  amount: number
  currency: string
}
