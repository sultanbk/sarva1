// ============================================================
// WhatsApp Service — Send messages via Meta Cloud API
// Uses per-tenant access tokens and phone number IDs
// ============================================================
import axios from 'axios'
import { config } from '../config'
import type { Tenant } from '../types'

const BASE = config.meta.graphApiBase

// ---- Low-level sender ----

async function sendRaw(
  tenant: Tenant,
  payload: Record<string, unknown>,
): Promise<void> {
  try {
    await axios.post(
      `${BASE}/${tenant.waPhoneId}/messages`,
      { messaging_product: 'whatsapp', ...payload },
      {
        headers: {
          Authorization: `Bearer ${tenant.waAccessToken}`,
          'Content-Type': 'application/json',
        },
      },
    )
  } catch (err: unknown) {
    if (axios.isAxiosError(err)) {
      console.error('[WA] Send error:', err.response?.data ?? err.message)
    } else {
      console.error('[WA] Send error:', err)
    }
    throw err
  }
}

// ---- Public API ----

export const whatsappService = {
  /** Send a plain text message */
  async sendText(tenant: Tenant, to: string, text: string): Promise<void> {
    await sendRaw(tenant, {
      to,
      type: 'text',
      text: { body: text, preview_url: false },
    })
  },

  /**
   * Send a message with up to 3 quick-reply buttons.
   * WhatsApp limits: button text ≤ 20 chars, body ≤ 1024 chars.
   */
  async sendButtons(
    tenant: Tenant,
    to: string,
    body: string,
    buttons: Array<{ id: string; title: string }>,
  ): Promise<void> {
    await sendRaw(tenant, {
      to,
      type: 'interactive',
      interactive: {
        type: 'button',
        body: { text: body },
        action: {
          buttons: buttons.slice(0, 3).map(b => ({
            type: 'reply',
            reply: { id: b.id, title: b.title.slice(0, 20) },
          })),
        },
      },
    })
  },

  /**
   * Send a list picker (up to 10 items in one section).
   * Best for menus with many options (categories, products).
   */
  async sendList(
    tenant: Tenant,
    to: string,
    body: string,
    buttonLabel: string,
    items: Array<{ id: string; title: string; description?: string }>,
  ): Promise<void> {
    // WhatsApp limits: title ≤ 24 chars, description ≤ 72 chars
    await sendRaw(tenant, {
      to,
      type: 'interactive',
      interactive: {
        type: 'list',
        body: { text: body },
        action: {
          button: buttonLabel.slice(0, 20),
          sections: [
            {
              title: 'Options',
              rows: items.slice(0, 10).map(item => ({
                id: item.id,
                title: item.title.slice(0, 24),
                description: item.description?.slice(0, 72),
              })),
            },
          ],
        },
      },
    })
  },

  /** Mark a message as read (reduces unread count in customer's WhatsApp) */
  async markRead(tenant: Tenant, messageId: string): Promise<void> {
    await sendRaw(tenant, {
      status: 'read',
      message_id: messageId,
    })
  },
}
