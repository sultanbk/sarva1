// ============================================================
// Razorpay Service — Per-tenant payment links
// ============================================================
import Razorpay from 'razorpay'
import crypto from 'crypto'
import type { Tenant, PaymentLinkResult } from '../types'
import { config } from '../config'

interface PaymentLinkInput {
  orderId: number
  orderNo: string
  amount: number
  customerName: string
  customerPhone: string
  description: string
}

export const razorpayService = {
  /**
   * Create a Razorpay Payment Link for the given order.
   * Uses the tenant's own Razorpay keys if available,
   * falls back to Sarva One's platform keys.
   */
  async createPaymentLink(
    tenant: Tenant,
    input: PaymentLinkInput,
  ): Promise<PaymentLinkResult> {
    const keyId = tenant.razorpayKeyId || config.razorpay.keyId
    const keySecret = tenant.razorpayKeySecret || config.razorpay.keySecret

    if (!keyId || !keySecret) {
      throw new Error('Razorpay keys not configured for this tenant')
    }

    const razorpay = new Razorpay({ key_id: keyId, key_secret: keySecret })

    const amountPaise = Math.round(input.amount * 100)   // Razorpay uses paise

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const link = await (razorpay.paymentLink as any).create({
      amount: amountPaise,
      currency: 'INR',
      accept_partial: false,
      description: input.description,
      customer: {
        name: input.customerName,
        contact: input.customerPhone,
      },
      notify: {
        sms: false,    // we send via WhatsApp instead
        email: false,
      },
      reminder_enable: false,
      notes: {
        order_no: input.orderNo,
        order_id: String(input.orderId),
      },
      callback_url: `${process.env.SERVER_URL ?? 'http://localhost:3000'}/api/payment/callback`,
      callback_method: 'get',
      expire_by: Math.floor(Date.now() / 1000) + 15 * 60,  // 15 minutes
    })

    return {
      id: link.id as string,
      shortUrl: link.short_url as string,
      amount: input.amount,
      currency: 'INR',
    }
  },

  /**
   * Verify Razorpay webhook signature.
   * https://razorpay.com/docs/webhooks/validate-payment-signature/
   */
  verifyWebhookSignature(
    body: string,
    signature: string,
    tenant: Tenant,
  ): boolean {
    const secret = tenant.razorpayKeySecret || config.razorpay.keySecret
    const expected = crypto
      .createHmac('sha256', secret)
      .update(body)
      .digest('hex')
    return crypto.timingSafeEqual(
      Buffer.from(signature),
      Buffer.from(expected),
    )
  },
}
