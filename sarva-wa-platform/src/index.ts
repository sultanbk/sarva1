// ============================================================
// Sarva One WhatsApp Platform — Server Entry Point
// ============================================================
import express from 'express'
import morgan from 'morgan'
import { config } from './config'
import { getDb } from './db/connection'
import { webhookRouter } from './routes/webhook'
import { syncRouter } from './routes/sync'

const app = express()

// ---- Middleware ----
// Raw body needed for Meta webhook signature verification
app.use('/webhook', express.raw({ type: 'application/json' }), (req, _res, next) => {
  // Parse the raw body as JSON but keep the raw buffer for signature check
  if (Buffer.isBuffer(req.body)) {
    req.body = JSON.parse(req.body.toString())
  }
  next()
})

app.use(express.json({ limit: '1mb' }))
app.use(morgan(config.isDev ? 'dev' : 'combined'))

// ---- Routes ----
app.use('/webhook', webhookRouter)
app.use('/api/sync', syncRouter)
// Backwards-compat alias (old clients may use /api directly)
app.use('/api', syncRouter)

// ---- Health check ----
app.get('/health', (_req, res) => {
  res.json({ status: 'ok', version: '1.0.0', env: config.nodeEnv })
})

// ---- 404 ----
app.use((_req, res) => {
  res.status(404).json({ error: 'Not found' })
})

// ---- Start ----
function start(): void {
  // Ensure DB is initialised (runs migrations)
  getDb()
  console.log('[DB] Connected and migrations applied')

  app.listen(config.port, () => {
    console.log(`\n🚀 Sarva One WhatsApp Platform running`)
    console.log(`   Port:  ${config.port}`)
    console.log(`   Env:   ${config.nodeEnv}`)
    console.log(`   DB:    ${config.db.path}`)
    console.log(`\n   Webhook URL: http://localhost:${config.port}/webhook`)
    console.log(`   (Set this URL + your META_VERIFY_TOKEN in Meta App Dashboard)`)
    console.log()
  })
}

start()

export default app
