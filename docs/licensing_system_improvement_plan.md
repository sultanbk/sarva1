# Sarva One Licensing System Improvement Plan

## Purpose

This document plans the next major improvements for the Sarva One licensing system. It is based on the current implementation in:

- `sarvaone_lience_management/sarva-one-server`
- `sarvaone-admin`
- `docs/licensing_model.md`
- `docs/architecture.md`
- `docs/roadmap.md`

The current system already supports license creation, activation, validation, machine locking, heartbeats, admin management, grace periods, and feature flags. The next goal is to harden the licensing flow, make license state consistent across server and dashboard, improve auditability, and prepare the system for multi-seat shops and automated renewals.

## Current System Summary

### Current Strengths

- Express and TypeScript backend with Drizzle ORM.
- PostgreSQL-backed license and heartbeat storage.
- Admin dashboard with JWT login.
- Machine-bound activation using `machineId`.
- Public license endpoints protected by `X-API-Key`.
- Grace period calculation during validation.
- Heartbeat telemetry for usage and inactivity tracking.
- Admin actions for create, update, suspend, reactivate, renew, delete, and reset machine.

### Original Weak Points Addressed By This Plan

- License signatures used `API_KEY` and had a hardcoded fallback secret before Phase 1.
- The shared client API key can leak from the Electron app.
- Activation is not atomic and can race under simultaneous requests.
- The server and admin dashboard both calculate license status separately.
- Dashboard stats count raw DB status, not effective status after expiry/grace rules.
- Admin license delete is permanent.
- Important actions are not audit-logged.
- Feature flags are hardcoded in code, making custom plans limited.
- One license supports only one machine.
- Renewals are manually implemented and partly calculated client-side.
- `/api/license/deactivate-machine` accepts an admin token in the request body.
- Password rules are weak during setup.
- There are no visible automated tests for the licensing edge cases.

## Target Architecture

The license server should be the single source of truth for all license decisions.

Every license-facing response should expose a server-computed state object:

```ts
type LicenseState = {
  licenseId: string;
  key: string;
  plan: string;
  storedStatus: "trial" | "active" | "expired" | "suspended";
  effectiveStatus: "trial" | "active" | "grace" | "expired" | "suspended";
  expiresAt: string;
  graceEndsAt: string;
  daysRemaining: number;
  features: Record<string, boolean | number>;
  signature: string;
};
```

The admin dashboard, POS app, dashboard metrics, and billing enforcement should all use this same server-computed state.

## Guiding Principles

1. The server decides licensing state.
2. The client may cache license state, but only in signed form.
3. Admin actions must be reversible or auditable.
4. Machine activation must be atomic.
5. Expiry, grace, suspension, and plan features must behave consistently everywhere.
6. Schema changes should be rolled out incrementally.
7. Security hardening comes before advanced billing automation.

## Phase 1: Immediate Hardening

### Goal

Fix the highest-risk issues without requiring a major database redesign.

### Backend Tasks

1. Add asymmetric license signing configuration.
   - Update `.env.example`.
   - Use `LICENSE_PRIVATE_KEY` only on the server for signing license payloads.
   - Bundle or distribute `LICENSE_PUBLIC_KEY` to the POS app for offline verification.
   - Include `LICENSE_KEY_ID` for future key rotation.
   - Fail startup if the private key is missing in production.

2. Remove license signing fallback.
   - Previous behavior used a fallback secret if `API_KEY` was missing.
   - Replace this with a strict configuration error.

3. Create a shared `buildLicenseState()` service.
   - Inputs: license row.
   - Outputs: stored status, effective status, expiry metadata, features, signed payload.
   - Use it in activate, validate, admin list, admin detail, and dashboard stats.

4. Make activation atomic.
   - Replace separate check/update flow with a conditional database update.
   - Update only where `machine_id IS NULL OR machine_id = incomingMachineId`.
   - If no row is returned, respond with `MACHINE_MISMATCH`.

5. Move admin-controlled machine deactivation.
   - Prefer `/api/admin/licenses/:id/reset-machine`.
   - Deprecate or restrict `/api/license/deactivate-machine`.
   - If kept, require `Authorization: Bearer <token>` instead of `adminToken` in the JSON body.

6. Make dashboard stats expiry-aware.
   - Count effective active, grace, expired, suspended.
   - Calculate MRR only from licenses with effective `active` or `trial` according to business rules.
   - Return grace count and expiring soon count directly from the server.

7. Strengthen setup password validation.
   - Require minimum 10 or 12 characters.
   - Consider requiring mixed character classes later.

### Admin Dashboard Tasks

1. Stop recomputing license status in `sarvaone-admin/src/lib.ts`.
2. Use server-provided `effectiveStatus`.
3. Remove client-side dashboard stat derivations that depend on only the first 100 licenses.
4. Display `graceEndsAt` and `daysRemaining`.

### Tests

Add tests for:

- Activation binds first machine.
- Activation accepts the same machine again.
- Activation rejects a second machine.
- Two simultaneous activations cannot bind two machines.
- Active license before expiry returns `active`.
- Expired license inside grace returns `grace`.
- Expired license after grace returns `expired`.
- Suspended license always returns `suspended`.
- Dashboard stats use effective status.
- Missing `LICENSE_PRIVATE_KEY` fails safely in production.

### Acceptance Criteria

- No license payload is signed with `API_KEY`.
- No fallback signing secret exists.
- Activation is race-safe.
- Admin and POS status displays match server state.
- Dashboard totals do not count expired-in-practice licenses as active.
- TypeScript build passes.

## Phase 2: Audit Logs And Safer Admin Operations

### Goal

Make every important licensing action traceable and reduce destructive operations.

### Schema Changes

Add `license_events`:

```sql
CREATE TABLE license_events (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  license_id UUID REFERENCES licenses(id) ON DELETE SET NULL,
  actor_type VARCHAR(50) NOT NULL,
  actor_id VARCHAR(255),
  event_type VARCHAR(100) NOT NULL,
  metadata JSONB,
  ip_address VARCHAR(100),
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW() NOT NULL
);
```

Add soft delete fields to `licenses`:

```sql
ALTER TABLE licenses ADD COLUMN deleted_at TIMESTAMP WITH TIME ZONE;
ALTER TABLE licenses ADD COLUMN deleted_by VARCHAR(255);
```

### Events To Track

- `license.created`
- `license.updated`
- `license.renewed`
- `license.suspended`
- `license.reactivated`
- `license.deleted`
- `license.machine_reset`
- `license.activated`
- `license.machine_mismatch`
- `license.validation_failed`
- `admin.login_failed`
- `admin.password_changed`

### Backend Tasks

1. Create `recordLicenseEvent()`.
2. Add event recording to all admin mutation routes.
3. Replace hard delete with soft delete.
4. Add optional hard-delete only for internal maintenance, not dashboard default.
5. Add event history to license detail endpoint.

### Admin Dashboard Tasks

1. Show license event timeline on client detail page.
2. Replace delete wording with archive/deactivate wording if soft delete is used.
3. Add confirmation copy for machine reset, suspend, and archive.

### Acceptance Criteria

- Every major admin mutation creates an event.
- Deleted licenses are hidden by default but recoverable.
- A support user can answer who changed a license and when.

### Phase 2 Implementation Checklist

- [x] Add `license_events` table to the Drizzle schema.
- [x] Add soft delete fields to `licenses`.
- [x] Add SQL migration for audit logs and soft delete.
- [x] Update migration runner to apply all SQL migrations in order.
- [x] Add `recordLicenseEvent()` service helper.
- [x] Hide archived licenses from normal license list/detail/dashboard queries.
- [x] Record admin login failure events.
- [x] Record admin password change events.
- [x] Record license create, update, renewal, suspend, reactivate, reset, archive, activation, mismatch, and validation failure events.
- [x] Replace hard delete with soft archive.
- [x] Add license event history to the admin license detail API.
- [x] Add audit timeline to the admin client detail page.
- [x] Update destructive UI wording from delete to archive.
- [x] Run TypeScript checks.

## Phase 3: License Token And Client Cache Hardening

### Goal

Reduce local cache tampering risk in the Electron POS app.

### Token Strategy

The server returns a signed license token. The POS stores the token, not loose editable license fields.

Suggested signed payload:

```ts
type SignedLicenseToken = {
  key: string;
  licenseId: string;
  machineIdHash: string;
  plan: string;
  effectiveStatus: string;
  expiresAt: string;
  graceEndsAt: string;
  features: Record<string, boolean | number>;
  issuedAt: string;
  validUntil: string;
  tokenVersion: number;
};
```

### Backend Tasks

1. Include `licenseToken` in activate and validate responses.
2. Add `tokenVersion` support.
3. Add short validity window for online validation tokens.
4. Implement asymmetric signing (ECDSA or RSA-256) as the baseline:
    - Server signs the license token using a private key.
    - POS verifies the token offline using a bundled public key, preventing key extraction attacks.

### POS App Tasks

1. Store signed license token locally.
2. Verify token before trusting cached state.
3. Reject modified or invalid cached license data.
4. Keep offline allowance policy separate from subscription grace.
5. Show a clear activation/online-check screen when token is invalid.

### Acceptance Criteria

- Editing local SQLite fields cannot extend a license.
- POS can still work offline within the configured offline allowance.
- Tampered cache causes safe lockout or forced online validation.

### Phase 3 Implementation Checklist

- [x] Return `licenseToken` alongside the existing `signature` field for backward compatibility.
- [x] Add `validUntil`, `issuedAt`, `offlineDaysAllowance`, and `tokenVersion` to signed license state.
- [x] Add `/api/license/public-key` for POS public-key discovery.
- [x] Add `LICENSE_TOKEN_TTL_HOURS` and `OFFLINE_DAYS_ALLOWANCE` env configuration.
- [ ] Implement POS-side local token verification and cache migration.
- [ ] Add automated tamper-token tests.

## Phase 4: Multi-Seat Licensing

### Goal

Allow one license key to authorize multiple billing counters or machines.

### Schema Changes

Add `max_seats`:

```sql
ALTER TABLE licenses ADD COLUMN max_seats INTEGER DEFAULT 1 NOT NULL;
```

Add `license_activations`:

```sql
CREATE TABLE license_activations (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  license_id UUID REFERENCES licenses(id) ON DELETE CASCADE NOT NULL,
  machine_id_hash VARCHAR(255) NOT NULL,
  hostname VARCHAR(255),
  app_version VARCHAR(50),
  activated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW() NOT NULL,
  last_seen_at TIMESTAMP WITH TIME ZONE,
  deactivated_at TIMESTAMP WITH TIME ZONE,
  UNIQUE (license_id, machine_id_hash)
);
```

### Backend Tasks

1. Hash machine IDs before storing.
2. Update activation flow:
   - If machine is already activated, allow.
   - If active seat count is below `maxSeats`, create activation.
   - Otherwise reject with `MAX_SEATS_EXCEEDED`.
3. Update validation flow:
   - Check machine exists in active activations.
4. Update heartbeat flow:
   - Update activation `lastSeenAt`.
   - Insert heartbeat as before.
5. Add admin endpoint to deactivate a specific machine.

### Admin Dashboard Tasks

1. Show activated machines per license.
2. Show last seen, app version, and status per machine.
3. Allow deactivating one machine without resetting the whole license.
4. Allow editing `maxSeats`.

### Acceptance Criteria

- Existing single-machine licenses continue to work with `maxSeats = 1`.
- A multi-seat license can activate up to its limit.
- Admin can remove one machine without affecting others.

### Phase 4 Implementation Checklist

- [x] Add `max_seats` to `licenses`.
- [x] Add `license_activations` table and Drizzle schema.
- [x] Backfill existing `licenses.machine_id` into `license_activations`.
- [x] Hash machine IDs before storing in activation records.
- [x] Make activation flow seat-aware.
- [x] Make validation and heartbeat use active activation records.
- [x] Add admin endpoint to deactivate one activation.
- [x] Show activated machines and seat usage in admin detail.
- [x] Allow creating/updating license seat limits from admin UI.
- [ ] Add concurrency tests for max-seat activation.

## Phase 5: Plan And Entitlement Management

### Goal

Make plans and custom features configurable without code changes.

### Schema Option

```sql
CREATE TABLE plans (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  code VARCHAR(50) UNIQUE NOT NULL,
  name VARCHAR(255) NOT NULL,
  monthly_price INTEGER DEFAULT 0 NOT NULL,
  is_active BOOLEAN DEFAULT TRUE NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW() NOT NULL
);

CREATE TABLE plan_entitlements (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  plan_id UUID REFERENCES plans(id) ON DELETE CASCADE NOT NULL,
  entitlement_key VARCHAR(100) NOT NULL,
  value_type VARCHAR(20) NOT NULL,
  boolean_value BOOLEAN,
  number_value INTEGER,
  text_value TEXT,
  UNIQUE (plan_id, entitlement_key)
);
```

### Backend Tasks

1. Seed current `starter`, `growth`, `pro`, and `custom` plans.
2. Read feature flags from DB or versioned config.
3. Cache plan entitlements safely.
4. Include feature version in license token.
5. Add admin endpoints for plan management later.

### Admin Dashboard Tasks

1. Display plan limits clearly.
2. Allow custom entitlements for custom licenses after backend support exists.

### Acceptance Criteria

- Existing plans produce the same features as before.
- Custom plan limits no longer require a deployment.
- Dashboard and POS receive the same entitlement object.

### Phase 5 Implementation Checklist

- [x] Add `plans` table.
- [x] Add `plan_entitlements` table.
- [x] Seed current plan codes in migration.
- [x] Add admin `/api/admin/plans` catalog endpoint.
- [x] Keep current hardcoded feature flags as fallback entitlements.
- [ ] Add admin UI for editing plan entitlements.
- [ ] Change license token feature resolution to prefer DB entitlements after seed data is populated.

## Phase 6: Payment And Renewal Automation

### Goal

Reduce manual renewal work and connect payments to license expiry.

### Recommended Gateway

For Indian customers, Razorpay is a practical first integration. Stripe can be considered later if international payments are needed.

### Schema Changes

```sql
CREATE TABLE payment_events (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  license_id UUID REFERENCES licenses(id) ON DELETE SET NULL,
  provider VARCHAR(50) NOT NULL,
  provider_payment_id VARCHAR(255),
  provider_order_id VARCHAR(255),
  amount INTEGER NOT NULL,
  currency VARCHAR(10) DEFAULT 'INR' NOT NULL,
  status VARCHAR(50) NOT NULL,
  raw_payload JSONB,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW() NOT NULL
);
```

### Backend Tasks

1. Add renewal quote endpoint.
2. Add payment order creation endpoint.
3. Add Razorpay webhook route.
4. Verify webhook signatures.
5. Extend license only after verified payment success.
6. Record payment event and license event.

### Admin Dashboard Tasks

1. Show payment history.
2. Show renewal status.
3. Allow manual renewal with required note/payment reference.

### Acceptance Criteria

- Payment success automatically renews license.
- Failed or spoofed webhooks do not modify licenses.
- Admin can trace each renewal to a payment event.

### Phase 6 Implementation Checklist

- [x] Add `payment_events` table and Drizzle schema.
- [x] Add renewal quote endpoint.
- [x] Add manual payment recording endpoint.
- [x] Manual payment recording extends license expiry and records audit events.
- [x] Show payment history on admin license detail.
- [ ] Add Razorpay order creation endpoint.
- [ ] Add Razorpay webhook route and signature verification.
- [ ] Add public renewal page.

## Phase 7: Monitoring And Alerts

### Goal

Make support and operational issues visible without requiring constant dashboard checking.

### Alerts

- New activation.
- Machine mismatch attempt.
- Repeated invalid license attempts.
- License entering grace.
- License expired.
- No heartbeat for 48 hours.
- Payment success/failure.
- Admin login failures above threshold.

### Backend Tasks

1. Create notification utility.
2. Support Slack, Discord, or email provider via env config.
3. Add scheduled job for inactivity and expiry checks.
4. Store notification attempts if reliability is important.

### Acceptance Criteria

- Admin receives important licensing events automatically.
- Alerts contain enough context to act quickly.
- Failed notification delivery does not break licensing APIs.

### Phase 7 Implementation Checklist

- [x] Critical events are recorded internally through `license_events`.
- [ ] External Slack/Discord/email webhook notifications require explicit approval because they can export customer/license identifiers to a third-party URL.
- [ ] Add scheduled inactivity and expiry checks.
- [ ] Add notification delivery records if external alerts are approved.

## Phase 8: Security Hardening

### Backend Security

- Add strict production config validation on startup.
- Use timing-safe comparison for secrets.
- Add per-license and per-machine rate limiting, not only per IP.
- Avoid exposing internal error messages in production.
- Store hashed machine IDs instead of raw IDs.
- Add setup token for `/api/admin/setup`.
- Add account lockout or delay after repeated failed admin logins.
- Consider MFA for admin users.

### Admin Frontend Security

- Avoid long-lived tokens in `localStorage` if feasible.
- Prefer httpOnly secure cookies if deployment setup allows.
- Add token refresh or shorter sessions.
- Add clear logout behavior.

### POS Security

- Verify signed license token locally.
- Do not store editable authoritative fields.
  - Detect local clock rollback (compare system clock time against the latest transaction or backup timestamp in SQLite, locking the app if the clock is set backward).
  - Require online validation after `offlineDaysAllowance` (embedded in the signed token) is exhausted.

### Phase 8 Implementation Checklist

- [x] Add production config validation for `MACHINE_ID_HASH_SECRET`.
- [x] Use timing-safe comparison for `X-API-Key`.
- [x] Add optional `ADMIN_SETUP_TOKEN` protection for first admin setup.
- [x] Store hashed machine IDs for new activation records.
- [x] Add `.env.example` entries for token TTL, offline allowance, machine hash secret, and setup token.
- [ ] Add per-license/per-machine rate limiting.
- [ ] Add admin MFA or account lockout.
- [ ] Implement POS clock rollback detection.

## Phase 9: Test Strategy

### Unit Tests

- `buildLicenseState()`
- `expiryState()`
- feature entitlement resolution
- token signing and verification
- duration/renewal calculations

### Integration Tests

- Activation flow.
- Validation flow.
- Heartbeat flow.
- Admin create/update/suspend/reactivate/reset.
- Dashboard stats.
- Payment webhook verification.

### Security Tests

- Missing secrets.
- Invalid API key.
- Invalid admin token.
- Machine mismatch.
- Tampered license token.
- Expired token.
- Suspended license.
- Rate limit behavior.

### Regression Test Cases

- Existing active license remains active after migration.
- Existing one-machine license becomes one activation.
- Expired license inside grace remains usable.
- Expired license outside grace blocks billing.
- Suspended license blocks even if not expired.

## Rollout Plan

### Step 1: Ship Phase 1 In Place

- No major schema migration required.
- Add server-computed effective status.
- Update dashboard to consume server state.
- Deploy and verify stats.

### Step 2: Add Audit Logs And Soft Delete

- Add migrations.
- Add event writes.
- Keep dashboard behavior mostly unchanged.
- Add event timeline after backend is stable.

### Step 3: Add Signed Token Cache Support

- Backend can return both old response fields and new token.
- POS can adopt token verification gradually.
- After adoption, make token mandatory.

### Step 4: Add Multi-Seat Migration

- Create `license_activations`.
- Backfill existing `licenses.machine_id` into activation records.
- Keep old `machine_id` temporarily for compatibility.
- Switch validation to new activation table.
- Remove old field only after all clients are updated.

### Step 5: Add Payments

- Start with manual renewal event logging.
- Add Razorpay order creation.
- Add webhook verification.
- Enable public renewal link.

## Backward Compatibility Notes

- Keep current activation and validation response fields until POS clients are updated.
- Add new fields rather than removing old ones.
- Existing licenses should default to `maxSeats = 1`.
- Existing `machineId` should be migrated into `license_activations`.
- Keep `status` enum as stored admin status; expose `effectiveStatus` separately.

## Suggested Work Order

1. Phase 1 hardening.
2. Signed license token cache (with asymmetric keys).
3. Audit logs and soft delete.
4. Multi-seat licensing.
5. Plan entitlement management.
6. Payment automation.
7. Monitoring and alerts.
8. Advanced security hardening.

## Phase 1 Implementation Checklist

- [x] Add `LICENSE_PRIVATE_KEY`, `LICENSE_PUBLIC_KEY`, and `LICENSE_KEY_ID` to `.env.example`.
- [x] Add config validation helper.
- [x] Replace `signLicensePayload()` secret source with RS256 private-key signing.
- [x] Remove fallback signing secret.
- [x] Add `buildLicenseState()`.
- [x] Use `buildLicenseState()` in `/activate`.
- [x] Use `buildLicenseState()` in `/validate`.
- [x] Add `effectiveStatus`, `graceEndsAt`, and `daysRemaining` to admin list/detail.
- [x] Update dashboard stats to use effective status.
- [x] Fix activation race with atomic update.
- [x] Move or secure `/deactivate-machine`.
- [x] Strengthen setup password validation.
- [x] Update admin dashboard to trust server status.
- [ ] Add tests for status and activation behavior.
- [x] Run TypeScript checks.

## Open Product Decisions

1. Should trial licenses count toward MRR?
2. Should grace licenses count toward MRR?
3. Should expired licenses automatically update stored DB status, or remain computed only?
4. How many offline days should POS allow independent of subscription grace?
5. Should machine reset require a reason/note?
6. Should admins be allowed to archive licenses, or only suspend them?
7. Should multi-seat be available only on selected plans?
8. Should license keys be shown fully in the dashboard or masked by default?
9. Should payment renewal be monthly only, or support 3, 6, and 12 month terms?

## Recommended Immediate Next Step

Implement Phase 1 first. It delivers the highest value quickly:

- Better security.
- More accurate dashboard numbers.
- Consistent license status.
- Race-safe activation.
- Safer admin behavior.

After Phase 1 is stable, move to audit logs and soft delete before adding larger features like multi-seat licensing and automated payments.
