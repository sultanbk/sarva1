// ============================================================
// Checkout Flow — Collect name, address, payment, create order
// ============================================================
import type { IncomingMessage, Session, Tenant, OrderCreateData, OrderItem } from '../types'
import { sessionRepo } from '../db/session.repo'
import { orderRepo } from '../db/order.repo'
import { tenantRepo } from '../db/tenant.repo'
import { whatsappService } from '../services/whatsapp.service'
import { razorpayService } from '../services/razorpay.service'

export async function handleCheckout(
  tenant: Tenant,
  msg: IncomingMessage,
  session: Session,
): Promise<void> {
  const text = extractText(msg).trim()
  const state = session.state

  // ---- Step 1: Collect customer name ----
  if (state === 'CHECKOUT_NAME') {
    if (session.name) {
      // Already have name, skip to address
      sessionRepo.setState(tenant.id, msg.waId, 'CHECKOUT_ADDRESS')
      await askAddress(tenant, msg.waId, session.name)
      return
    }

    await whatsappService.sendText(
      tenant, msg.waId,
      `📝 *Almost there!*\n\nPlease share your *full name* for delivery:`,
    )
    sessionRepo.setState(tenant.id, msg.waId, 'CHECKOUT_NAME')

    // If they just answered (text isn't a command)
    if (text && text.length > 1 && !isCommand(text)) {
      const name = text.replace(/\s+/g, ' ').trim()
      sessionRepo.upsert(tenant.id, msg.waId, { name, state: 'CHECKOUT_ADDRESS' })
      await askAddress(tenant, msg.waId, name)
    }
    return
  }

  // ---- Step 2: Collect delivery address ----
  if (state === 'CHECKOUT_ADDRESS') {
    if (!text || isCommand(text)) {
      await askAddress(tenant, msg.waId, session.name ?? 'Customer')
      return
    }

    const address = text.replace(/\s+/g, ' ').trim()
    if (address.length < 10) {
      await whatsappService.sendText(
        tenant, msg.waId,
        `⚠️ Please provide a complete address including house number, street, city and pincode.`,
      )
      return
    }

    sessionRepo.upsert(tenant.id, msg.waId, { state: 'CHECKOUT_PAYMENT' })

    // Show order summary + payment options
    const subtotal = session.cart.reduce((sum, i) => sum + i.price * i.quantity, 0)
    const deliveryCharge = subtotal >= tenant.freeDeliveryAbove ? 0 : tenant.deliveryCharge
    const total = subtotal + deliveryCharge

    const itemLines = session.cart
      .map(i => `• ${i.name} × ${i.quantity} — ₹${(i.price * i.quantity).toFixed(0)}`)
      .join('\n')

    await whatsappService.sendButtons(
      tenant, msg.waId,
      [
        `📦 *Order Summary*`,
        `─────────────────`,
        itemLines,
        `─────────────────`,
        `Subtotal: ₹${subtotal.toFixed(0)}`,
        `Delivery: ${deliveryCharge === 0 ? 'FREE 🎉' : `₹${deliveryCharge.toFixed(0)}`}`,
        `*Total: ₹${total.toFixed(0)}*`,
        `─────────────────`,
        `📍 Deliver to: ${session.name}`,
        address,
        `─────────────────`,
        `Choose payment method:`,
      ].join('\n'),
      [
        { id: `pay_upi__${address}`, title: '💳 Pay Online (UPI)' },
        { id: `pay_cod__${address}`, title: '💵 Cash on Delivery' },
      ],
    )
    return
  }

  // ---- Step 3: Payment choice + order creation ----
  if (state === 'CHECKOUT_PAYMENT') {
    const choice = text.toLowerCase()

    if (choice.startsWith('pay_upi__') || choice.startsWith('pay_cod__')) {
      const isUpi = choice.startsWith('pay_upi__')
      const address = choice.split('__').slice(1).join('__')
      await createOrder(tenant, msg, session, isUpi ? 'upi' : 'cod', address)
      return
    }

    // They may have just typed their payment choice
    if (choice === '1' || choice.includes('upi') || choice.includes('online') || choice.includes('pay')) {
      await whatsappService.sendText(tenant, msg.waId, `Please type your delivery address first to continue.`)
      sessionRepo.setState(tenant.id, msg.waId, 'CHECKOUT_ADDRESS')
      return
    }
  }

  // ---- Awaiting payment ----
  if (state === 'AWAITING_PAYMENT') {
    await whatsappService.sendText(
      tenant, msg.waId,
      `⏳ Your payment is pending. Please complete the payment using the link sent above.\n\nIf you face any issues, type *Hi* to restart.`,
    )
    return
  }
}

async function createOrder(
  tenant: Tenant,
  msg: IncomingMessage,
  session: Session,
  paymentMethod: 'upi' | 'cod',
  address: string,
): Promise<void> {
  const subtotal = session.cart.reduce((sum, i) => sum + i.price * i.quantity, 0)
  const deliveryCharge = subtotal >= tenant.freeDeliveryAbove ? 0 : tenant.deliveryCharge
  const grandTotal = subtotal + deliveryCharge

  // Generate order number
  const shopPrefix = tenant.shopName
    .split(' ')
    .map(w => w[0])
    .join('')
    .toUpperCase()
    .slice(0, 3)

  const orderNo = tenantRepo.nextOrderNo(tenant.id, shopPrefix)

  const items: OrderItem[] = session.cart.map(i => ({
    posProductId: i.posProductId,
    name: i.name,
    price: i.price,
    quantity: i.quantity,
    subtotal: i.price * i.quantity,
  }))

  const orderData: OrderCreateData & { orderNo: string } = {
    tenantId: tenant.id,
    orderNo,
    waId: msg.waId,
    customerName: session.name ?? 'Customer',
    customerPhone: `+${msg.waId}`,
    deliveryAddress: address,
    items,
    subtotal,
    deliveryCharge,
    grandTotal,
    paymentMethod,
  }

  const order = orderRepo.create(orderData)

  if (paymentMethod === 'cod') {
    // COD: confirm order immediately, notify operator
    orderRepo.updateStatus(order.id, 'confirmed')
    sessionRepo.clearCart(tenant.id, msg.waId)

    await whatsappService.sendText(
      tenant, msg.waId,
      [
        `🎉 *Order Placed Successfully!*`,
        ``,
        `📦 *Order #${orderNo}*`,
        `─────────────────`,
        items.map(i => `• ${i.name} × ${i.quantity} — ₹${i.subtotal.toFixed(0)}`).join('\n'),
        `─────────────────`,
        `Subtotal: ₹${subtotal.toFixed(0)}`,
        `Delivery: ${deliveryCharge === 0 ? 'FREE' : `₹${deliveryCharge.toFixed(0)}`}`,
        `*Total (Cash on Delivery): ₹${grandTotal.toFixed(0)}*`,
        `─────────────────`,
        `📍 ${session.name}`,
        address,
        ``,
        `⏱️ Expected delivery: ${tenant.deliveryDays} business days`,
        ``,
        `We'll send you updates when your order is packed and shipped! 🚚`,
        ``,
        `Thank you for shopping with *${tenant.shopName}* 🙏`,
      ].join('\n'),
    )
  } else {
    // UPI: generate Razorpay payment link
    sessionRepo.setState(tenant.id, msg.waId, 'AWAITING_PAYMENT')

    try {
      const paymentLink = await razorpayService.createPaymentLink(tenant, {
        orderId: order.id,
        orderNo,
        amount: grandTotal,
        customerName: session.name ?? 'Customer',
        customerPhone: `+${msg.waId}`,
        description: `Order ${orderNo} — ${tenant.shopName}`,
      })

      orderRepo.updateStatus(order.id, 'awaiting_payment', {
        razorpayOrderId: paymentLink.id,
      })

      await whatsappService.sendText(
        tenant, msg.waId,
        [
          `💳 *Complete Your Payment*`,
          ``,
          `Order *#${orderNo}* | ₹${grandTotal.toFixed(0)}`,
          ``,
          `Click below to pay securely via UPI, Card, or Net Banking:`,
          `👉 ${paymentLink.shortUrl}`,
          ``,
          `⏰ Link expires in 15 minutes`,
          ``,
          `Your order will be confirmed automatically after payment ✅`,
        ].join('\n'),
      )
    } catch (err) {
      console.error('[Checkout] Razorpay error:', err)
      // Fallback to COD if Razorpay fails
      orderRepo.updateStatus(order.id, 'confirmed')
      sessionRepo.clearCart(tenant.id, msg.waId)
      await whatsappService.sendText(
        tenant, msg.waId,
        `⚠️ Online payment is temporarily unavailable.\n\nYour order *#${orderNo}* has been placed as *Cash on Delivery* instead.\n\nTotal to pay: ₹${grandTotal.toFixed(0)}\n\nThank you for shopping with ${tenant.shopName}! 🙏`,
      )
    }
  }
}

async function askAddress(tenant: Tenant, waId: string, name: string): Promise<void> {
  await whatsappService.sendText(
    tenant, waId,
    `Thanks, *${name}*! 📍\n\nPlease share your complete *delivery address*:\n_(House no, Street, City, Pincode)_\n\nExample: *45 MG Road, Bengaluru 560001*`,
  )
}

function isCommand(text: string): boolean {
  return ['hi', 'hello', 'cart', 'cancel', 'back', 'menu'].includes(text.toLowerCase())
}

function extractText(msg: IncomingMessage): string {
  if (msg.type === 'text') return msg.text ?? ''
  if (msg.type === 'interactive') {
    return msg.buttonReply?.id ?? msg.listReply?.id ?? ''
  }
  return ''
}
