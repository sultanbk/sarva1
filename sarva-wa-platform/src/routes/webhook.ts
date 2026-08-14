// ============================================================
// Webhook Route — Receives all WhatsApp messages from Meta
// GET  /webhook  → Meta verification
// POST /webhook  → Incoming messages
// ============================================================
import { Router, Request, Response } from 'express'
import crypto from 'crypto'
import { config } from '../config'
import { tenantRepo } from '../db/tenant.repo'
import { handleMessage } from '../handlers/message.handler'
import type { IncomingMessage, MetaWebhookPayload, MetaRawMessage } from '../types'

export const webhookRouter = Router()

// ---- GET: Meta webhook verification challenge ----
webhookRouter.get('/', (req: Request, res: Response) => {
  const mode = req.query['hub.mode']
  const token = req.query['hub.verify_token']
  const challenge = req.query['hub.challenge']

  if (mode === 'subscribe' && token === config.meta.verifyToken) {
    console.log('[Webhook] Meta verification successful')
    res.status(200).send(challenge)
  } else {
    console.warn('[Webhook] Meta verification failed — check META_VERIFY_TOKEN')
    res.sendStatus(403)
  }
})

// ---- POST: Incoming WhatsApp messages ----
webhookRouter.post('/', async (req: Request, res: Response) => {
  // Always respond 200 immediately — Meta retries if we're slow
  res.sendStatus(200)

  // Verify signature (protects against spoofed webhooks)
  if (!verifySignature(req)) {
    console.warn('[Webhook] Invalid Meta signature — ignoring')
    return
  }

  const payload = req.body as MetaWebhookPayload
  if (payload.object !== 'whatsapp_business_account') return

  for (const entry of payload.entry ?? []) {
    for (const change of entry.changes ?? []) {
      if (change.field !== 'messages') continue

      const { metadata, messages } = change.value

      if (!messages?.length) continue   // status updates only — skip

      // Resolve tenant by Meta Phone Number ID
      const tenant = tenantRepo.getByPhoneId(metadata.phone_number_id)
      if (!tenant) {
        console.warn(`[Webhook] No tenant for phone_number_id=${metadata.phone_number_id}`)
        continue
      }

      for (const rawMsg of messages) {
        const msg = parseMessage(tenant.id, rawMsg as MetaRawMessage)
        if (!msg) continue

        // Process in background — don't block the 200 response
        handleMessage(tenant, msg).catch(err => {
          console.error(`[Webhook] Flow error for tenant=${tenant.shopName} wa_id=${msg.waId}:`, err)
        })
      }
    }
  }
})

function verifySignature(req: Request): boolean {
  if (!config.meta.appSecret) return true  // skip in dev if secret not set

  const signature = req.headers['x-hub-signature-256'] as string | undefined
  if (!signature) return false

  const expected = `sha256=${crypto
    .createHmac('sha256', config.meta.appSecret)
    .update(JSON.stringify(req.body))
    .digest('hex')}`

  try {
    return crypto.timingSafeEqual(Buffer.from(signature), Buffer.from(expected))
  } catch {
    return false
  }
}

function parseMessage(
  tenantId: string,
  raw: MetaRawMessage,
): IncomingMessage | null {
  if (!raw) return null

  const base = {
    tenantId,
    waId: raw.from,
    messageId: raw.id,
    timestamp: parseInt(raw.timestamp, 10),
  }

  if (raw.type === 'text') {
    return { ...base, type: 'text', text: raw.text?.body ?? '' }
  }

  if (raw.type === 'interactive') {
    return {
      ...base,
      type: 'interactive',
      buttonReply: raw.interactive?.button_reply,
      listReply: raw.interactive?.list_reply,
    }
  }

  // Image, audio, etc.
  return { ...base, type: 'unknown' }
}
