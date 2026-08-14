// ============================================================
// Welcome Flow — Greeting and main menu
// ============================================================
import type { IncomingMessage, Tenant } from '../types'
import { sessionRepo } from '../db/session.repo'
import { whatsappService } from '../services/whatsapp.service'
import { handleBrowse } from './browse.flow'

const MAIN_MENU_ITEMS = [
  { id: 'browse', title: '🛍️ Browse Products' },
  { id: 'search', title: '🔍 Search a Product' },
  { id: 'my_orders', title: '📦 My Orders' },
  { id: 'contact', title: '📞 Contact Shop' },
]

export async function handleWelcome(
  tenant: Tenant,
  msg: IncomingMessage,
): Promise<void> {
  const text = extractRawText(msg).trim().toLowerCase()
  const session = sessionRepo.get(tenant.id, msg.waId)

  // If they're coming from main menu selection
  if (session?.state === 'MAIN_MENU') {
    const choice = text
    if (choice === 'browse' || choice === '1') {
      sessionRepo.setState(tenant.id, msg.waId, 'BROWSING_CATEGORIES')
      await handleBrowse(tenant, { ...msg, text: 'show_categories' } as IncomingMessage, sessionRepo.get(tenant.id, msg.waId)!)
      return
    }
    if (choice === 'search' || choice === '2') {
      sessionRepo.setState(tenant.id, msg.waId, 'BROWSING_PRODUCTS')
      await whatsappService.sendText(
        tenant,
        msg.waId,
        `🔍 *Search Products*\n\nType the name of the product you're looking for:\n_(e.g., "silk saree", "cotton kurta")_`,
      )
      return
    }
    if (choice === 'my_orders' || choice === '3') {
      // handled by orders flow (future)
      await whatsappService.sendText(
        tenant,
        msg.waId,
        `📦 Type your order number (e.g. *WA-001*) to check status, or type *Hi* for the main menu.`,
      )
      return
    }
    if (choice === 'contact' || choice === '4') {
      await whatsappService.sendText(
        tenant,
        msg.waId,
        `📞 *Contact ${tenant.shopName}*\n\nYou can reach us at:\n🏪 ${tenant.shopName}${tenant.shopCity ? ', ' + tenant.shopCity : ''}\n\nOur team will respond shortly during business hours (${tenant.businessHoursStart} – ${tenant.businessHoursEnd}).\n\nType *Hi* to go back to the menu.`,
      )
      return
    }
  }

  // Send the welcome greeting
  const greeting = buildGreeting(tenant)
  sessionRepo.upsert(tenant.id, msg.waId, { state: 'MAIN_MENU' })

  await whatsappService.sendList(
    tenant,
    msg.waId,
    greeting,
    'Show Menu',
    MAIN_MENU_ITEMS,
  )
}

function buildGreeting(tenant: Tenant): string {
  const isOpen = isBusinessHours(tenant)

  return [
    `🙏 *Welcome to ${tenant.shopName}!*`,
    tenant.shopCity ? `📍 ${tenant.shopCity}` : '',
    '',
    isOpen
      ? `We\'re open and ready to help you shop! 🛍️`
      : `⏰ We\'re currently closed (Hours: ${tenant.businessHoursStart}–${tenant.businessHoursEnd})\nWe\'ll respond to your order as soon as we open.`,
    '',
    `What would you like to do?`,
  ].filter(Boolean).join('\n')
}

function isBusinessHours(tenant: Tenant): boolean {
  const now = new Date()
  const [startH, startM] = tenant.businessHoursStart.split(':').map(Number)
  const [endH, endM] = tenant.businessHoursEnd.split(':').map(Number)
  const current = now.getHours() * 60 + now.getMinutes()
  const start = startH * 60 + startM
  const end = endH * 60 + endM
  return current >= start && current <= end
}

function extractRawText(msg: IncomingMessage): string {
  if (msg.type === 'text') return msg.text ?? ''
  if (msg.type === 'interactive') {
    return msg.buttonReply?.id ?? msg.listReply?.id ?? ''
  }
  return ''
}
