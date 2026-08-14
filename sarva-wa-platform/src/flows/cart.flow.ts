// ============================================================
// Cart Flow — View cart, remove items, proceed to checkout
// ============================================================
import type { IncomingMessage, Session, Tenant } from '../types'
import { sessionRepo } from '../db/session.repo'
import { whatsappService } from '../services/whatsapp.service'
import { handleCheckout } from './checkout.flow'

export async function handleCart(
  tenant: Tenant,
  msg: IncomingMessage,
  session: Session,
): Promise<void> {
  const text = extractText(msg).trim().toLowerCase()

  // Handle post-display button actions
  if (text === 'checkout' || text === 'proceed_checkout') {
    if (session.cart.length === 0) {
      await whatsappService.sendText(tenant, msg.waId, `🛒 Your cart is empty! Type *Hi* to browse products.`)
      return
    }
    sessionRepo.setState(tenant.id, msg.waId, 'CHECKOUT_NAME')
    await handleCheckout(tenant, msg, session)
    return
  }

  if (text === 'keep_shopping' || text === 'continue') {
    sessionRepo.setState(tenant.id, msg.waId, 'BROWSING_CATEGORIES')
    await whatsappService.sendText(
      tenant, msg.waId,
      `👍 Continue shopping! Type a category name or type *Hi* for the menu.`,
    )
    return
  }

  if (text === 'clear_cart') {
    sessionRepo.upsert(tenant.id, msg.waId, { cart: [], state: 'MAIN_MENU' })
    await whatsappService.sendText(tenant, msg.waId, `🗑️ Cart cleared.\n\nType *Hi* to start shopping again.`)
    return
  }

  // Remove item by number
  if (text.startsWith('remove_') || text.startsWith('rm_')) {
    const idx = parseInt(text.replace(/^(remove_|rm_)/, ''), 10) - 1
    if (!isNaN(idx) && idx >= 0 && idx < session.cart.length) {
      const removed = session.cart[idx]
      sessionRepo.removeFromCart(tenant.id, msg.waId, removed.posProductId)
      const updated = sessionRepo.get(tenant.id, msg.waId)!
      await showCart(tenant, msg.waId, updated, `✅ *${removed.name}* removed from cart.`)
    } else {
      await whatsappService.sendText(tenant, msg.waId, `❌ Invalid item number.`)
    }
    return
  }

  // Default: show the cart
  sessionRepo.setState(tenant.id, msg.waId, 'CART')
  await showCart(tenant, msg.waId, session)
}

async function showCart(
  tenant: Tenant,
  waId: string,
  session: Session,
  prefixMessage?: string,
): Promise<void> {
  if (session.cart.length === 0) {
    await whatsappService.sendButtons(
      tenant, waId,
      `🛒 Your cart is empty!\n\nStart browsing to add products.`,
      [{ id: 'keep_shopping', title: '🛍️ Browse Products' }],
    )
    return
  }

  const subtotal = session.cart.reduce((sum, item) => sum + item.price * item.quantity, 0)
  const deliveryCharge = subtotal >= tenant.freeDeliveryAbove ? 0 : tenant.deliveryCharge
  const total = subtotal + deliveryCharge

  const itemLines = session.cart
    .map((item, i) => `${i + 1}. *${item.name}* × ${item.quantity}\n   ₹${(item.price * item.quantity).toFixed(0)}`)
    .join('\n')

  const removeHint = session.cart.length > 0
    ? `\n\nTo remove an item, type *remove_1*, *remove_2* etc.`
    : ''

  const body = [
    prefixMessage ?? '',
    `🛒 *Your Cart — ${tenant.shopName}*`,
    '─────────────────',
    itemLines,
    '─────────────────',
    `Subtotal: ₹${subtotal.toFixed(0)}`,
    deliveryCharge === 0
      ? `Delivery: *FREE* 🎉 (above ₹${tenant.freeDeliveryAbove})`
      : `Delivery: ₹${deliveryCharge.toFixed(0)}`,
    `*Total: ₹${total.toFixed(0)}*`,
    removeHint,
  ].filter(Boolean).join('\n')

  await whatsappService.sendButtons(
    tenant, waId, body,
    [
      { id: 'proceed_checkout', title: '✅ Checkout' },
      { id: 'keep_shopping', title: '🛍️ Add More' },
      { id: 'clear_cart', title: '🗑️ Clear Cart' },
    ],
  )
}

function extractText(msg: IncomingMessage): string {
  if (msg.type === 'text') return msg.text ?? ''
  if (msg.type === 'interactive') {
    return msg.buttonReply?.id ?? msg.listReply?.id ?? ''
  }
  return ''
}
