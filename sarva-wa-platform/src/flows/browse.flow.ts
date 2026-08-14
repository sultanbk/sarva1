import type { IncomingMessage, Session, Tenant } from '../types'
import { sessionRepo } from '../db/session.repo'
import { catalogRepo } from '../db/catalog.repo'
import { whatsappService } from '../services/whatsapp.service'
import { handleCart } from './cart.flow'

// Helpers — defined before use to avoid forward reference errors
function extractText(msg: IncomingMessage): string {
  if (msg.type === 'text') return msg.text ?? ''
  if (msg.type === 'interactive') {
    return msg.buttonReply?.id ?? msg.listReply?.id ?? ''
  }
  return ''
}

function isNumeric(text: string): boolean {
  return /^\d+$/.test(text)
}

export async function handleBrowse(
  tenant: Tenant,
  msg: IncomingMessage,
  session: Session,
): Promise<void> {
  const text = extractText(msg).trim().toLowerCase()

  // ---- Browsing categories ----
  if (session.state === 'BROWSING_CATEGORIES' || text === 'show_categories') {
    const categories = catalogRepo.getCategories(tenant.id)

    if (categories.length === 0) {
      await whatsappService.sendText(
        tenant, msg.waId,
        `😔 No products are currently available in our online store.\n\nPlease check back later or type *Hi* for the main menu.`,
      )
      return
    }

    sessionRepo.setState(tenant.id, msg.waId, 'BROWSING_CATEGORIES')

    const items = categories.map((cat, i) => ({
      id: `cat_${encodeCategory(cat)}`,
      title: cat,
      description: `Browse ${cat}`,
    }))

    await whatsappService.sendList(
      tenant, msg.waId,
      `🛍️ *Shop by Category*\n\nWe have ${categories.length} categories. Pick one to browse:`,
      'Choose Category',
      items,
    )
    return
  }

  // ---- Category selected ----
  if (text.startsWith('cat_')) {
    const category = decodeCategory(text.replace('cat_', ''))
    sessionRepo.upsert(tenant.id, msg.waId, {
      state: 'BROWSING_PRODUCTS',
      currentCategory: category,
      currentPage: 0,
    })
    await showProducts(tenant, msg.waId, category, 0)
    return
  }

  // ---- Product browsing controls ----
  if (session.state === 'BROWSING_PRODUCTS') {
    const category = session.currentCategory ?? ''

    // Next page
    if (text === 'n' || text === 'next') {
      const nextPage = session.currentPage + 1
      sessionRepo.upsert(tenant.id, msg.waId, { currentPage: nextPage })
      await showProducts(tenant, msg.waId, category, nextPage)
      return
    }

    // Previous page
    if (text === 'b' || text === 'back' || text === 'prev') {
      if (session.currentPage === 0) {
        // Go back to categories
        sessionRepo.setState(tenant.id, msg.waId, 'BROWSING_CATEGORIES')
        await handleBrowse(tenant, { ...msg, text: 'show_categories' } as IncomingMessage, session)
      } else {
        const prevPage = Math.max(0, session.currentPage - 1)
        sessionRepo.upsert(tenant.id, msg.waId, { currentPage: prevPage })
        await showProducts(tenant, msg.waId, category, prevPage)
      }
      return
    }

    // View cart
    if (text === 'cart' || text === 'view cart' || text === 'c') {
      sessionRepo.setState(tenant.id, msg.waId, 'CART')
      await handleCart(tenant, msg, session)
      return
    }

    // Search mode
    if (session.state === 'BROWSING_PRODUCTS' && text.length > 2 && !isNumeric(text)) {
      const results = catalogRepo.search(tenant.id, text)
      if (results.length === 0) {
        await whatsappService.sendText(
          tenant, msg.waId,
          `🔍 No products found for "*${text}*".\n\nTry a different keyword, or type *B* to go back.`,
        )
        return
      }
      const productList = results
        .map((p, i) => `${i + 1}️⃣ *${p.name}*\n   ₹${p.price.toFixed(0)}${p.mrp ? ` ~~₹${p.mrp}~~` : ''} | ${p.stock > 0 ? '✅ In Stock' : '❌ Out of Stock'}`)
        .join('\n\n')

      await whatsappService.sendText(
        tenant, msg.waId,
        `🔍 *Search Results for "${text}":*\n\n${productList}\n\nReply with the *number* to add to cart, or type *B* to go back.`,
      )

      // Store search results temporarily in session state for number selection
      sessionRepo.upsert(tenant.id, msg.waId, {
        currentCategory: `__search__${text}`,
        currentPage: 0,
      })
      return
    }

    // Number selection — add product to cart
    if (isNumeric(text)) {
      const index = parseInt(text, 10) - 1
      const { products } = catalogRepo.getByCategory(tenant.id, category, session.currentPage)

      if (index < 0 || index >= products.length) {
        await whatsappService.sendText(
          tenant, msg.waId,
          `❌ Invalid selection. Please reply with a number between 1 and ${products.length}.`,
        )
        return
      }

      const product = products[index]

      if (product.stock === 0) {
        await whatsappService.sendText(
          tenant, msg.waId,
          `😔 Sorry, *${product.name}* is currently out of stock.\n\nPlease choose another product.`,
        )
        return
      }

      sessionRepo.addToCart(tenant.id, msg.waId, {
        posProductId: product.posProductId,
        name: product.name,
        price: product.price,
        quantity: 1,
      })

      const updatedSession = sessionRepo.get(tenant.id, msg.waId)!
      const cartTotal = updatedSession.cart.reduce((sum, i) => sum + i.price * i.quantity, 0)
      const itemCount = updatedSession.cart.reduce((sum, i) => sum + i.quantity, 0)

      await whatsappService.sendButtons(
        tenant, msg.waId,
        `✅ *${product.name}* added to cart!\n\n🛒 Cart: ${itemCount} item${itemCount > 1 ? 's' : ''} — ₹${cartTotal.toFixed(0)}`,
        [
          { id: 'continue_shopping', title: '🛍️ Keep Shopping' },
          { id: 'go_to_cart', title: '🛒 View Cart' },
        ],
      )

      sessionRepo.setState(tenant.id, msg.waId, 'BROWSING_PRODUCTS')
      return
    }

    // Handle post-add-to-cart buttons
    if (text === 'continue_shopping') {
      await showProducts(tenant, msg.waId, category, session.currentPage)
      return
    }
    if (text === 'go_to_cart') {
      sessionRepo.setState(tenant.id, msg.waId, 'CART')
      const refreshed = sessionRepo.get(tenant.id, msg.waId)!
      await handleCart(tenant, msg, refreshed)
      return
    }
  }

  // Fallback
  await whatsappService.sendText(
    tenant, msg.waId,
    `Type a *number* to select a product, *N* for next, *B* to go back, or *Hi* for the main menu.`,
  )
}

async function showProducts(
  tenant: Tenant,
  waId: string,
  category: string,
  page: number,
): Promise<void> {
  const { products, total, hasMore } = catalogRepo.getByCategory(tenant.id, category, page)

  if (products.length === 0) {
    await whatsappService.sendText(
      tenant, waId,
      `😔 No products found in *${category}*.\n\nType *B* to go back to categories.`,
    )
    return
  }

  const showing = page * 4 + products.length
  const productLines = products
    .map((p, i) => [
      `${i + 1}️⃣ *${p.name}*`,
      `   💰 ₹${p.price.toFixed(0)}${p.mrp ? ` | ~~MRP ₹${p.mrp}~~` : ''}`,
      p.description ? `   ${p.description.slice(0, 60)}` : '',
      `   ${p.stock > 0 ? `✅ In Stock (${p.stock} left)` : '❌ Out of Stock'}`,
    ].filter(Boolean).join('\n'))
    .join('\n\n')

  const nav: string[] = []
  if (hasMore) nav.push('*N* → Next')
  if (page > 0) nav.push('*B* → Previous')
  nav.push('*Cart* → View Cart')

  const body = [
    `🥻 *${category}* (${showing} of ${total})`,
    '',
    productLines,
    '',
    '─────────────────',
    `Reply *number* to add to cart`,
    nav.join(' | '),
  ].join('\n')

  await whatsappService.sendText(tenant, waId, body)
}

function encodeCategory(cat: string): string {
  return Buffer.from(cat).toString('base64').replace(/[^a-zA-Z0-9]/g, '_')
}

function decodeCategory(encoded: string): string {
  try {
    return Buffer.from(encoded.replace(/_/g, '/'), 'base64').toString()
  } catch {
    return encoded
  }
}
