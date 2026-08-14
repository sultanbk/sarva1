// ============================================================
// Message Handler — Routes incoming WhatsApp messages
// to the correct tenant session flow
// ============================================================
import type { IncomingMessage, Tenant } from '../types'
import { sessionRepo } from '../db/session.repo'
import { whatsappService } from '../services/whatsapp.service'
import { handleWelcome } from '../flows/welcome.flow'
import { handleBrowse } from '../flows/browse.flow'
import { handleCart } from '../flows/cart.flow'
import { handleCheckout } from '../flows/checkout.flow'

export async function handleMessage(
  tenant: Tenant,
  msg: IncomingMessage,
): Promise<void> {
  // Get or create session
  let session = sessionRepo.get(tenant.id, msg.waId)
  if (!session) {
    session = sessionRepo.upsert(tenant.id, msg.waId, {
      state: 'IDLE',
      language: tenant.language,
    })
  }

  // Mark message as read (shows double blue tick to customer)
  try {
    await whatsappService.markRead(tenant, msg.messageId)
  } catch {
    // Non-critical — don't fail the flow if markRead fails
  }

  // Normalise the message text
  const text = extractText(msg).trim().toLowerCase()

  // Global commands (work in any state)
  if (['hi', 'hello', 'hey', 'hii', 'start', 'menu', '0', 'home', 'ಹಲೋ', 'ನಮಸ್ಕಾರ'].includes(text)) {
    sessionRepo.reset(tenant.id, msg.waId)
    await handleWelcome(tenant, msg)
    return
  }

  if (text === 'cancel' || text === 'stop') {
    sessionRepo.reset(tenant.id, msg.waId)
    await whatsappService.sendText(
      tenant,
      msg.waId,
      `Your session has been reset.\n\nType *Hi* to start shopping again 🛍️`,
    )
    return
  }

  // Route by current state
  const state = session.state

  if (state === 'IDLE' || state === 'MAIN_MENU') {
    await handleWelcome(tenant, msg)
    return
  }

  if (state === 'BROWSING_CATEGORIES' || state === 'BROWSING_PRODUCTS') {
    await handleBrowse(tenant, msg, session)
    return
  }

  if (state === 'CART') {
    await handleCart(tenant, msg, session)
    return
  }

  if (
    state === 'CHECKOUT_NAME' ||
    state === 'CHECKOUT_ADDRESS' ||
    state === 'CHECKOUT_PAYMENT' ||
    state === 'AWAITING_PAYMENT'
  ) {
    await handleCheckout(tenant, msg, session)
    return
  }

  // Fallback — unrecognised input
  await whatsappService.sendText(
    tenant,
    msg.waId,
    `Sorry, I didn\'t understand that 😅\n\nType *Hi* to go back to the main menu.`,
  )
}

function extractText(msg: IncomingMessage): string {
  if (msg.type === 'text') return msg.text ?? ''
  if (msg.type === 'interactive') {
    return msg.buttonReply?.id ?? msg.listReply?.id ?? ''
  }
  return ''
}
