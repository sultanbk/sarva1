# Sarva One License API Server

Backend service for Sarva One license management. It is built with Node.js, Express, TypeScript, Drizzle ORM, and PostgreSQL.

## Features

- License activation, validation, heartbeat telemetry, and signed license tokens.
- RS256 license token signing with public-key verification support for POS clients.
- Server-computed `effectiveStatus`, grace metadata, and feature flags.
- Multi-seat activation through `license_activations`.
- Hashed machine IDs for activation records.
- Admin JWT authentication.
- License create/update/suspend/reactivate/archive/renew workflows.
- Audit logging through `license_events`.
- Soft archive instead of hard delete.
- Manual payment recording and payment history.
- Plan catalog and entitlement schema scaffolding.
- Dashboard stats using server-computed effective status.

## Directory Structure

```text
sarva-one-server/
  src/
    config.ts
    index.ts
    db/
      connection.ts
      migrate.ts
      schema.ts
      migrations/
    middleware/
      auth.ts
      rateLimit.ts
    routes/
      admin.ts
      license.ts
    scripts/
      createAdmin.ts
    services/
      licenseService.ts
```

## Environment Variables

Required in production:

- `DATABASE_URL`: PostgreSQL connection string.
- `DATABASE_SSL`: `true` for hosted Postgres SSL.
- `JWT_SECRET`: admin JWT signing secret.
- `API_KEY`: shared POS API key for `/api/license/*`.
- `LICENSE_PRIVATE_KEY`: RS256 private key for license token signing.
- `MACHINE_ID_HASH_SECRET`: secret salt for hashing machine IDs.

Recommended:

- `LICENSE_PUBLIC_KEY`: RS256 public key returned by `/api/license/public-key`.
- `LICENSE_KEY_ID`: key id used in JWT header, default `sarvaone-license-key-v1`.
- `LICENSE_TOKEN_TTL_HOURS`: default `24`.
- `OFFLINE_DAYS_ALLOWANCE`: default `7`.
- `ADMIN_SETUP_TOKEN`: optional first-admin setup protection.
- `PLAN_PRICE_STARTER`, `PLAN_PRICE_GROWTH`, `PLAN_PRICE_PRO`, `PLAN_PRICE_CUSTOM`.
- `ADMIN_ORIGIN`: allowed admin dashboard origin.
- `PORT`: default `3000`.
- `NODE_ENV`: `development` or `production`.

PEM keys can be stored with escaped newlines:

```env
LICENSE_PRIVATE_KEY="-----BEGIN PRIVATE KEY-----\n...\n-----END PRIVATE KEY-----"
LICENSE_PUBLIC_KEY="-----BEGIN PUBLIC KEY-----\n...\n-----END PUBLIC KEY-----"
```

## Setup

Install dependencies:

```bash
npm install
```

Copy env template:

```bash
cp .env.example .env
```

Run migrations:

```bash
npm run db:migrate
```

The migration runner applies every SQL file in `src/db/migrations` in sorted order.

Create the first admin user:

```bash
npm run admin:create -- admin@sarvaone.com StrongPassword123 "Sultan Kabadi"
```

## Development

```bash
npm run dev
```

## Production

```bash
npm run build
npm start
```

## Validation

```bash
npm run typecheck
```

## Public License Routes

Protected by `X-API-Key`.

- `GET /api/license/public-key`
- `POST /api/license/activate`
- `POST /api/license/validate`
- `POST /api/license/heartbeat`
- `POST /api/license/deactivate-machine`

`/deactivate-machine` also requires `Authorization: Bearer <admin JWT>` and exists mainly for compatibility. Prefer admin reset/deactivate routes.

## Admin Routes

Public:

- `POST /api/admin/setup`
- `POST /api/admin/login`

JWT protected:

- `GET /api/admin/dashboard`
- `GET /api/admin/plans`
- `GET /api/admin/licenses`
- `POST /api/admin/licenses`
- `GET /api/admin/licenses/:id`
- `PUT /api/admin/licenses/:id`
- `DELETE /api/admin/licenses/:id`
- `POST /api/admin/licenses/:id/suspend`
- `POST /api/admin/licenses/:id/activate`
- `POST /api/admin/licenses/:id/reset-machine`
- `POST /api/admin/licenses/:id/activations/:activationId/deactivate`
- `GET /api/admin/licenses/:id/renewal-quote`
- `POST /api/admin/licenses/:id/manual-payment`
- `PUT /api/admin/password`
- `GET /api/admin/config/api-key`

## Current Data Model Notes

- `licenses`: primary license/customer record with `maxSeats`, grace config, stored admin status, and soft archive fields.
- `license_activations`: hashed machine bindings and last-seen state.
- `license_events`: admin and client audit trail.
- `payment_events`: manual/payment-gateway renewal history.
- `plans` and `plan_entitlements`: plan catalog scaffold.
- `heartbeats`: usage telemetry snapshots.

Deletion from the dashboard is an archive. Archived licenses are hidden by default but retained for support history.

For request/response examples, see `docs/api_reference.md`.

---

Sarva One License Management API v2.0
