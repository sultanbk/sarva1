# Client Telemetry Wire Spec — Runtime Logs

**Status:** Implemented (server + admin console)
**Applies to:** `sarva-one-server` (license API) → `sarva-one-admin` (console) → Electron client (to implement)

This document specifies the contract for shipping runtime logs from installed client terminals to the license server, and how the admin console surfaces them. It is the counterpart to the `/activate` and `/heartbeat` endpoints the client already calls.

---

## 1. Log Ingest Endpoint

### `POST /api/license/logs`

Authenticated with the **license API key** (`x-api-key` header), same as `/heartbeat`.

**Rate limit:** `clientLogRateLimit` (independent bucket from heartbeat/activate — see `sarva-one-server/src/middleware/rateLimit.ts`).

**Request body (JSON):**

```jsonc
{
  "key": "SARVA-XXXX-...",          // license key, required
  "machineId": "ab12cd34-...",      // machine fingerprint, required
  "appVersion": "3.2.1",            // required
  "logs": [
    {
      "level": "error",             // "debug" | "info" | "warn" | "error" | "fatal"
      "message": "Failed to sync orders",   // 1..2000 chars
      "source": "OrderSyncService", // optional, component/context name, max 100
      "stackTrace": "Error: ...",   // optional, max 4000
      "metadata": { "orderId": 123, "retries": 2 },   // optional, free-form object
      "clientTs": "2026-08-01T09:30:00+05:30"          // optional, ISO 8601 with offset
    }
    // min 1, max 100 entries per request
  ]
}
```

**Responses:**

| HTTP | Code                | Meaning |
|------|---------------------|---------|
| 200  | —                   | Accepted (always returns `{ received: <n> }` on 200) |
| 404  | `LICENSE_NOT_FOUND` | Bad key |
| 403  | `MACHINE_BLOCKED`   | Machine blocked by admin |
| 409  | `MACHINE_MISMATCH`  | Not activated on this machine |

**Client behavior:** Log failures silently. The endpoint intentionally never returns 5xx for invalid payloads — it returns `{ received: 0 }` so the client can drop the batch and continue. Batch is best-effort; `metadata` may be up to a few KB but should be kept small.

---

## 2. What the server stores

Table: `client_logs` (see migration in `sarva-one-server/drizzle/*.sql`)

| Column       | Type          | Notes |
|--------------|---------------|-------|
| `id`         | uuid          | PK |
| `license_id` | uuid          | FK → licenses |
| `machine_id` | text          | raw client machine id |
| `app_version`| text          | from request |
| `level`      | text          | one of debug/info/warn/error/fatal |
| `message`    | text          | truncated to 2000 |
| `source`     | text          | nullable |
| `stack_trace`| text          | nullable, truncated to 4000 |
| `metadata`   | jsonb         | nullable |
| `ip_address` | text          | resolved server-side |
| `client_ts`  | timestamptz   | nullable (client clock) |
| `created_at` | timestamptz   | server ingest time |

Indexed on `(license_id, created_at)` and `level`.

---

## 3. Admin read APIs (all require admin JWT)

### `GET /api/admin/licenses/:id/logs`
Per-client logs.

Query params: `page` (1-based), `pageSize` (max 100, default 50), `level` (debug|info|warn|error|fatal), `q` (searches `message` / `source`), `source`, `from` (ISO date), `to`, all optional.

```jsonc
{
  "logs": [ { "id": "...", "licenseId": "...", "machineId": "...", "appVersion": "3.2.1",
              "level": "error", "message": "...", "source": "...", "stackTrace": null,
              "metadata": {...}, "ipAddress": "...", "clientTs": "...", "createdAt": "..." } ],
  "pagination": { "page": 1, "pageSize": 50, "total": 1234 },
  "summary": { "total": 1234, "byLevel": { "debug": 10, "info": 100, "warn": 20, "error": 1000, "fatal": 104 } }
}
```

### `GET /api/admin/logs`
Global feed, identical shape. Each row additionally includes `shopName` (resolved server-side). `licenseId` filter param supported.

### `GET /api/admin/dashboard/extended`
Analytics for the console dashboard:

```jsonc
{
  "revenue": { "monthly": [{ "month": "Aug 26", "revenue": 12000 }], "byPlan": [{ "plan": "professional", "revenue": 9000 }] },
  "activations": { "perMonth": [{ "month": "Jul 26", "activations": 4 }] },
  "resourceUsage": {
    "dbSizeTrend": [{ "date": "Jul 18", "dbSizeMB": 12.3 }],
    "ramUsedTrend": [{ "date": "Jul 18", "ramUsedGB": 1.4 }],
    "appVersionTimeline": [{ "date": "Jul 18", "version": "3.2.1", "count": 3 }]
  },
  "errors": {
    "byLevelOverTime": [{ "bucket": "Jul 18", "debug": 0, "info": 0, "warn": 1, "error": 5, "fatal": 0 }],
    "byLevel": [{ "level": "error", "count": 10 }],
    "topMessages": [{ "message": "sync failed", "count": 8 }],
    "topFailingClients": [{ "licenseId": "...", "shopName": "Shop A", "count": 6 }],
    "total": 23
  }
}
```

### `GET /api/admin/licenses/:id`
Now also returns `logSummary: { total, byLevel: { debug, info, warn, error, fatal } }`.

---

## 4. Client implementation guidance (Electron)

Recommended: a lightweight ring-buffer logger that batches.

```ts
const MAX_BATCH = 100
const FLUSH_INTERVAL_MS = 30_000 // or on-demand when error occurs

const queue: LogEntry[] = []

function log(level, message, source?, metadata?) {
  queue.push({ level, message, source, metadata, clientTs: new Date().toISOString() })
  if (queue.length >= MAX_BATCH) flush()
}

async function flush() {
  if (queue.length === 0) return
  const batch = queue.splice(0, queue.length)
  try {
    await api.post('/api/license/logs', { key, machineId, appVersion, logs: batch })
  } catch {
    // requeue oldest N if buffer full; never crash the app
  }
}
```

**Guidelines:**
- Do **not** ship secrets or PII in `metadata`/`message` (admin console displays them raw).
- Never block the main thread; flush is fire-and-forget.
- Keep `message` under 2000 chars; truncate stack traces to 4000.
- Use `source` for the module/service name so the console can filter per component.
- Prefer erroring on the client side rather than retrying aggressively — server treats logs as best-effort.
