# Sarva One License Manager — Security & Correctness Analysis + Improvement Roadmap

**Date:** 2026-08-01
**Scope:** `sarva-one-server` (Express 4 + TypeScript + Drizzle ORM + PostgreSQL) and `sarva-one-admin` (React 19 + Vite admin dashboard).
**Method:** three parallel exploration/audit passes, with every high-impact finding verified directly against source (`file:line` refs included).
**Status:** Analysis complete. Roadmap is implementation-ready — check off items as you go.

---

## System at a glance

- Two sibling packages (not a monorepo), each with its own `.git` and `node_modules`:
  - `sarva-one-server` — the API. Core logic in `src/services/licenseService.ts`; routes in `src/routes/license.ts` (client/POS API) and `src/routes/admin.ts` (admin API).
  - `sarva-one-admin` — the dashboard. Deployed to Vercel; server deployed to Railway.
- **The POS/Electron client is NOT in this repo.** The server signs an RS256 license-token JWT that the client is expected to verify offline using a public key from `GET /api/license/public-key`.
- License keys are random 20-char bearer strings (`SARVA-XXXX-XXXX-XXXX-XXXX`, ~104 bits). The authoritative signed artifact is a separate RS256 JWT (`licenseService.ts:164-180, 376-381`).

---

## Part 1 — Verified findings

### 🔴 Critical — Security

#### C1. Live secrets sit in plaintext `.env` files on disk
`sarva-one-server/.env` (git-ignored but present in the working tree and on the deploy host) contains `DATABASE_URL` (connection string **with password**), `JWT_SECRET`, `API_KEY`, and `LICENSE_PRIVATE_KEY` — the **live RSA private key that signs every license token**. Anyone with host/file access can mint valid license tokens for any plan or impersonate an admin.
- Verified: `.env` is git-ignored (`git check-ignore .env` → ignored), so not in git history — but present locally.
- `config.ts:23-33` only *requires* these in `NODE_ENV=production`.

#### C2. No key-rotation path; the scheme collapses if the private key leaks
- The server signs (`signLicensePayload`, `licenseService.ts:376-381`) but **never verifies** license tokens. All trust rests on the out-of-repo POS client verifying RS256 — cannot be audited here.
- `licenseKeyId()` (`config.ts:19-21`) defaults to `sarvaone-license-key-v1`; **no mechanism to rotate keys** (v2/v3, multiple active public keys).
- The public-key endpoint is itself behind `X-API-Key` (`license.ts:24`).

#### C3. Shared license API key is funneled into a public client bundle
- `sarva-one-admin/.env` has `VITE_APP_API_KEY` (same key the server gates on). Any `import.meta.env.VITE_*` reference ships it into the public Vite bundle.
- The POS client must carry this key → extracting it from a desktop app is trivial → **the license API is effectively public**. Keys are random ~104 bits (brute-force infeasible), but a leaked key + extracted API key = unauthorized activation.

### 🟠 High — License integrity / correctness

#### H1. No server-side expiry or suspension enforcement
- `POST /validate` (`license.ts:127-164`) returns **200 with a signed, active-looking payload for expired AND suspended licenses** — it only checks existence, machine-block, and machine-activation. Enforcement is fully delegated to the client honoring `effectiveStatus` in the signed token.
- `POST /heartbeat` (`license.ts:166-201`) checks suspension (line 183) but **not expiry**.
- `POST /activate` rejects only once past the grace window (`expiryState().status === "expired"`, `license.ts:79-83`) — a license can be re-activated throughout its whole grace period after expiry.

#### H2. Seat-cap bypass via legacy `machineId`
- `setMachineAndActivate` (`licenseService.ts:235, 248-251`): when `total >= maxSeats`, activation is still allowed if `license.machineId === machineId` — the legacy primary machine permanently bypasses the seat limit.
- `isMachineActivated` (`licenseService.ts:304`): `license.machineId === machineId` authorizes validate even with **no activation row**. Consequence: admin deactivates a seat (`admin.ts:473-491` sets only `deactivated_at`) but the legacy primary machine still validates, because `licenses.machine_id` is not cleared by per-seat deactivation (only `reset-machine` clears it).
- Two sources of truth: legacy column `licenses.machineId` coexists with `license_activations`.

#### H3. Machine-hash salt mismatch in DB backfill (broken legacy activation matches)
- Migration `0002_tokens_seats_entitlements_payments.sql:19-23` backfills `machine_id_hash` with **unsalted** `sha256(machine_id)`.
- Runtime `hashMachineId` (`licenseService.ts:188-191`) hashes `sha256(salt:machineId)` with `MACHINE_ID_HASH_SECRET ?? JWT_SECRET`.
- Backfilled activation rows will **never match** runtime hashes (unless the secret is empty) → legacy single-machine licenses lose their activation binding after the migration.
- Secondary: `MACHINE_ID_HASH_SECRET` falls back to `JWT_SECRET` (`licenseService.ts:189`) — key reuse; and the on-disk `.env` sets **no** `MACHINE_ID_HASH_SECRET`.

#### H4. Pricing env-var drift — paid tiers silently price at ₹0
- Code reads `PLAN_PRICE_STARTER` / `PLAN_PRICE_PROFESSIONAL` / `PLAN_PRICE_ENTERPRISE` (`licenseService.ts:97-107`).
- `.env` actually contains `PLAN_PRICE_GROWTH` / `PLAN_PRICE_PRO` / `PLAN_PRICE_CUSTOM` (pre-rename names). Verified via masked key listing. → `professional` and `enterprise` fall back to `0`.

#### H5. Perpetual default expiry is one omitted field away
- Creating a license with no `expiresAt` and no `duration` sets `expiresAt = 9999-12-31T23:59:59Z` (`admin.ts:286`).

### 🟡 Medium — Hardening

- **M1. CORS wildcard.** `index.ts:35-36` allows *any* `https://sarva1-*.vercel.app` / `https://sarvaone-admin-*.vercel.app` origin with `credentials: true`. Bearer-token auth limits practical impact today, but dangerous if cookie/session auth is ever added.
- **M2. `trust proxy = 1`** (`index.ts:17`) keys rate limits off `X-Forwarded-For` — spoofable if the server is ever reachable without the proxy in front.
- **M3. No CSP/security headers on the SPA.** Helmet only covers API responses (`index.ts:18`). The Vercel-served admin SPA has no CSP/HSTS; admin JWT lives in `localStorage` (`lib.ts:4`). One XSS = full admin takeover. (No current XSS vector found.)
- **M4. 500 handler leaks internal error text.** `index.ts:59-63` returns `Unexpected server error: ${errMsg}` (can include SQL/paths).
- **M5. Admin JWT not revocable / env-ambivalent.** `auth.ts:28-34` — HS256, 12h, no `jti`/`aud`/`iss`; password change does not invalidate issued tokens; same `JWT_SECRET` across envs = cross-env token reuse.
- **M6. No roles.** Every admin is a superuser over every license, payment, machine block, audit log.
- **M7. Stale `dist/` artifact.** Compiled `sarva-one-server/dist/routes/license.js` has a `POST /deactivate-machine` route **absent from source** (README and admin `lib.ts` still reference it). If the running server is stale `dist`, deployed behavior differs from source.
- **M8. Heartbeat swallows all errors.** `license.ts:197-200` — any telemetry-insert failure still returns `{received: true}`, masking backend failures.
- **M9. Dependency advisories.** `npm audit`: admin has 2 high (`react-router`/`react-router-dom` 7.18.0 — GHSA-qwww-vcr4-c8h2, RSC CSRF; low practical impact for this non-RSC SPA); server has 1 low (`body-parser` <1.20.6 DoS; mitigated by static `"1mb"` limit). Stale/mismatched: `cors@2.8.5`, `@types/express ^5` vs `express@4`, admin `typescript ~6.0.2` (pre-release).
- **M10. Orphaned key material.** Server `.env` has an undocumented second base64 key block between `NODE_ENV` and `LICENSE_PRIVATE_KEY`.
- **M11. `grace` is never persisted** (computed in `expiryState`, `licenseService.ts:203-219`); a manually-set stored `expired` status overrides a later renewal unless the admin also clears status (short-circuit at line 206).

### 🔵 Product / architectural observations

- **P1. Feature limits are client-enforced only.** `featureFlags`/`plan_entitlements` (`licenseService.ts:34-95`) are signed into the token (`features`, `licenseStatePayload`) but the server **never enforces** `maxBillsPerMonth` / `maxProducts` / `maxCustomers`. Deliberate for offline, but no compliance/alerts layer.
- **P2. No background jobs.** No cron/webhooks; expiry derived on request. No expiring-soon alerts, no auto trial→active, no stored-status flips.
- **P3. Replay window.** Every `/validate`/`/activate` mints a fresh token valid offline for `LICENSE_TOKEN_TTL_HOURS` (24h) + `OFFLINE_DAYS_ALLOWANCE` (7d). No nonce/replay protection.
- **P4. Signed token leaks the raw `machineId`** (`licenseStatePayload`) — first activated device ID visible to any token holder.

### ✅ Things done well (worth keeping)

- Strong input validation: Zod on every body/query (`admin.ts:31-99`, `license.ts:26-56`); 1 MB body cap (`index.ts:46`).
- No injection surface found: all Drizzle queries parameterized; no `eval`/`exec`/`child_process`.
- `timingSafeEqual` API-key compare with length check (`auth.ts:36-52`).
- bcrypt cost 12; login rate-limited 5/15min (`rateLimit.ts:24-32`); `/api/admin/setup` hard-disabled (`admin.ts:194-198`); admins only via CLI.
- `SELECT ... FOR UPDATE` row lock in activation (`licenseService.ts:225`) prevents concurrent seat oversubscription.
- Comprehensive audit log (`license_events`) with actor + IP on every action.
- Soft-delete archive (`deletedAt`/`deletedBy`); archived keys return 404.
- License keys random, server-side only, collision-checked.

---

## Part 2 — Improvement roadmap

> **Recommended order:** Phase 0 (ops, now) → Phase 1 (license integrity) → Phase 2 (hardening) → Phase 3 (compliance).

### Phase 0 — Ops / rotate now (do first, no code)

- [ ] **Rotate all secrets:** regenerate `LICENSE_PRIVATE_KEY`/`LICENSE_PUBLIC_KEY` (re-issue tokens), `JWT_SECRET`, `API_KEY`, and the DB password. Treat the environment as compromised until done.
- [ ] Move secrets to a secrets manager (Railway env vars / Doppler / Vercel env).
- [ ] Remove the orphaned base64 key block from `sarva-one-server/.env` (M10).
- [ ] Remove `VITE_APP_API_KEY` from `sarva-one-admin/.env`; never reference `VITE_*` secrets in the client bundle (C3).
- [ ] Delete or rebuild stale `sarva-one-server/dist/` so deployed code matches source (M7).

### Phase 1 — License integrity (server + admin, in-repo)

- [ ] **H1 — Server-side deny for expired/suspended:** in `/validate` and `/heartbeat`, return **403 `LICENSE_EXPIRED` / `LICENSE_SUSPENDED`** when `expiryState()` is expired or the stored status is suspended (keep `/activate`'s existing expired check). Offline POS window (`validUntil` + `offlineDaysAllowance`) is untouched; online the 403 is authoritative. **Note:** POS client SDK update required (out-of-repo) to surface the 403.
- [ ] **H2 — Remove legacy `machineId` seat bypass:** make the active-activation count authoritative in `setMachineAndActivate`; drop the `license.machineId === machineId` fallback in `isMachineActivated`; clear `licenses.machineId` on per-seat deactivate (or migrate fully to `license_activations`).
- [ ] **H3 — Fix machine-hash consistency:** versioned hashing (v1 unsalted legacy + v2 salted) with dual-lookup during a transition window; one-time re-backfill with the salt; drop v1 afterward. Require `MACHINE_ID_HASH_SECRET` independent of `JWT_SECRET` (set it in `.env` / production config).
- [ ] **H4 — Fix pricing env drift:** rename `.env` keys to `PLAN_PRICE_PROFESSIONAL` / `PLAN_PRICE_ENTERPRISE`; add a startup warning if a non-free plan price reads 0.
- [ ] **H5 — Make perpetual expiry explicit:** replace the `9999-12-31` default with a real default (e.g., 30 days) or a required explicit `duration`; add a confirmation in the admin UI when creating a perpetual license.
- [ ] **C2 — Add key-rotation support:** bump `LICENSE_KEY_ID` to v2; keep v1 public key active for a verification window; support listing multiple public keys at `/public-key`.

### Phase 2 — Security hardening

- [ ] **M1 —** Narrow CORS to exact origins; drop the `.vercel.app` wildcard.
- [ ] **M2 —** Trust proxy only from known proxy IPs (Railway-specific `trust proxy` config), or validate `X-Forwarded-For`.
- [ ] **M3/M5 —** Add CSP + security headers to the Vercel-served SPA (`vercel.json` `headers` block) or proxy it through Express; consider httpOnly-cookie or short-lived admin tokens.
- [ ] **M4 —** Stop leaking raw error strings in 500 responses — log server-side, return a generic message.
- [ ] **M5 —** Admin JWT: add `jti`, `aud`/`iss`, revocation check on password change.
- [ ] **M9 —** Upgrade `react-router-dom` per advisory (or document the exception); pin `typescript` to stable; align `@types/express`.
- [ ] **M8 —** Make heartbeat failures visible (log-and-return vs swallow), at least in server logs.

### Phase 3 — Product / compliance (larger, separate effort)

- [ ] **P1 —** Server-side usage compliance: compare heartbeat counters (`billsToday`, `totalProducts`, …) against plan entitlements; surface overages in the admin dashboard and audit log; optionally enforce with a grace-tolerant "soft deny" (offline-tolerant — counters upload on reconnect).
- [ ] **P2 —** Expiry/grace alerting: lightweight scheduler or on-access detection for expiring-soon / grace / expired licenses.
- [ ] **P2 —** Trial lifecycle automation (trial→active/expired transitions).
- [ ] **P3 —** Replay protection: client nonce + server-side `jti` short-lived token model for online validation.
- [ ] **P4 —** Stop putting raw `machineId` in the signed token; use the hash or omit.

---

## Part 3 — Verification notes

- Analysis was verified by re-reading the critical files directly: `routes/license.ts`, `services/licenseService.ts` (lines 30–319), `routes/admin.ts` (lines 283–382), `config.ts`, `middleware/auth.ts`, `index.ts`, and `db/migrations/0002_tokens_seats_entitlements_payments.sql`.
- Secret presence confirmed via a **masked key-name listing** (values never read into the report); env drift confirmed by masked comparison.
- When implementing a phase, verify with: `npm run typecheck` + `npm run build` in `sarva-one-server`, `npm run db:migrate` against a staging DB, then end-to-end curl tests (active / grace / expired / suspended × validate / activate / heartbeat) and admin CRUD regression.

---

## Out of scope / notes

- The POS/Electron client is not in this repo; client-side changes (verify RS256 + `validUntil`, honor 403s, stop embedding the API key) are required but tracked separately.
- Phase 0 is ops (rotate secrets), not code.
