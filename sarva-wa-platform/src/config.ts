// ============================================================
// Sarva One WhatsApp Platform — Configuration
// ============================================================
import 'dotenv/config'

function require_env(key: string): string {
  const val = process.env[key]
  if (!val) throw new Error(`Missing required environment variable: ${key}`)
  return val
}

export const config = {
  port: parseInt(process.env.PORT ?? '3000', 10),
  nodeEnv: process.env.NODE_ENV ?? 'development',
  isDev: (process.env.NODE_ENV ?? 'development') === 'development',

  meta: {
    appSecret: process.env.META_APP_SECRET ?? '',
    verifyToken: process.env.META_VERIFY_TOKEN ?? 'sarva_wa_verify_token_2024',
    graphApiBase: 'https://graph.facebook.com/v21.0',
  },

  db: {
    path: process.env.DB_PATH ?? './data/sarva-wa.db',
  },

  razorpay: {
    keyId: process.env.RAZORPAY_KEY_ID ?? '',
    keySecret: process.env.RAZORPAY_KEY_SECRET ?? '',
  },

  security: {
    internalApiSecret: process.env.INTERNAL_API_SECRET ?? 'dev-secret-change-in-prod',
    encryptionKey: process.env.ENCRYPTION_KEY ?? 'dev-enc-key-32-chars-padded-here',
  },
} as const
