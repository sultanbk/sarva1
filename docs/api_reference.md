# API Reference Guide

This document lists the current REST API surface for the Sarva One License Server.

## 1. Global Specifications

### Server Environments

- Production Base URL: `https://sarvaonelicencemanagement-production.up.railway.app`
- Local Dev URL: `http://localhost:3000`

### Authentication

Client POS endpoints under `/api/license/*` require:

```http
X-API-Key: <API_KEY>
```

Admin endpoints under `/api/admin/*` require:

```http
Authorization: Bearer <JWT_TOKEN>
```

`POST /api/admin/setup` may also require:

```http
X-Setup-Token: <ADMIN_SETUP_TOKEN>
```

This header is required only when `ADMIN_SETUP_TOKEN` is configured.

## 2. Shared License State Shape

Activation, validation, and admin license responses include server-computed license state:

```json
{
  "status": "active",
  "licenseId": "uuid",
  "key": "SARVA-XXXX-XXXX-XXXX-XXXX",
  "plan": "pro",
  "storedStatus": "active",
  "effectiveStatus": "active",
  "expiresAt": "2027-07-17T00:00:00.000Z",
  "graceEndsAt": "2027-07-24T00:00:00.000Z",
  "daysRemaining": 365,
  "features": {
    "maxBillsPerMonth": -1,
    "maxProducts": -1,
    "multiUser": true
  },
  "maxSeats": 2,
  "shopName": "Krishnapriya Textiles",
  "issuedAt": "2026-07-18T12:00:00.000Z",
  "validUntil": "2026-07-19T12:00:00.000Z",
  "offlineDaysAllowance": 7,
  "tokenVersion": 1,
  "signature": "<RS256-JWT>",
  "licenseToken": "<RS256-JWT>"
}
```

`status` and `effectiveStatus` are computed by the server. `storedStatus` is the database/admin status.

## 3. Client Licensing Endpoints

These endpoints are rate-limited to 10 requests/min per IP.

### Get Public License Verification Key

- Method: `GET`
- URL: `/api/license/public-key`

Response:

```json
{
  "success": true,
  "data": {
    "keyId": "sarvaone-license-key-v1",
    "algorithm": "RS256",
    "publicKey": "-----BEGIN PUBLIC KEY-----..."
  }
}
```

The POS app uses this public key to verify `licenseToken` offline.

### Activate License

- Method: `POST`
- URL: `/api/license/activate`

Payload:

```json
{
  "key": "SARVA-A3F7-KP92-XM41-BN85",
  "machineId": "raw-device-fingerprint",
  "appVersion": "1.0.2",
  "hostname": "BILLING-PC-1"
}
```

Notes:

- The server hashes `machineId` before writing activation records.
- A license can activate up to `maxSeats` active machines.
- Existing legacy `licenses.machine_id` is still honored during migration.

Success response: shared license state object.

Errors:

- `LICENSE_NOT_FOUND`
- `LICENSE_INACTIVE`
- `LICENSE_EXPIRED`
- `MAX_SEATS_EXCEEDED`
- `MACHINE_MISMATCH`

### Validate License

- Method: `POST`
- URL: `/api/license/validate`

Payload:

```json
{
  "key": "SARVA-A3F7-KP92-XM41-BN85",
  "machineId": "raw-device-fingerprint",
  "appVersion": "1.0.2"
}
```

Success response: shared license state object.

Validation succeeds when the machine exists in active `license_activations` or matches the legacy machine binding during migration.

### Heartbeat

- Method: `POST`
- URL: `/api/license/heartbeat`

Payload:

```json
{
  "key": "SARVA-A3F7-KP92-XM41-BN85",
  "machineId": "raw-device-fingerprint",
  "appVersion": "1.0.2",
  "usageStats": {
    "billsToday": 14,
    "totalBills": 842,
    "totalCustomers": 210,
    "totalProducts": 350
  }
}
```

Response:

```json
{
  "success": true,
  "data": {
    "received": true
  }
}
```

Heartbeat updates activation `lastSeenAt` and app version when the machine is activated.

### Deactivate Machine

- Method: `POST`
- URL: `/api/license/deactivate-machine`
- Auth: `X-API-Key` plus `Authorization: Bearer <admin JWT>`

Payload:

```json
{
  "key": "SARVA-A3F7-KP92-XM41-BN85",
  "machineId": "raw-device-fingerprint"
}
```

This route exists for compatibility. Prefer admin machine reset or activation-specific deactivation routes.

## 4. Admin Endpoints

Admin endpoints are JWT-authenticated except `/login` and `/setup`.

### Setup Initial Admin

- Method: `POST`
- URL: `/api/admin/setup`

Payload:

```json
{
  "email": "admin@sarvaone.com",
  "password": "StrongPassword123",
  "name": "Sultan Kabadi"
}
```

Password minimum: 10 characters.

### Login

- Method: `POST`
- URL: `/api/admin/login`

Payload:

```json
{
  "email": "admin@sarvaone.com",
  "password": "StrongPassword123"
}
```

Failed login attempts are recorded in `license_events`.

### Dashboard

- Method: `GET`
- URL: `/api/admin/dashboard`

Response includes effective-status counts and dashboard alert lists:

```json
{
  "success": true,
  "data": {
    "total": 24,
    "active": 20,
    "trial": 1,
    "grace": 2,
    "expired": 1,
    "suspended": 0,
    "mrr": 45000,
    "activeByPlan": [{ "plan": "pro", "total": 12 }],
    "clientsByPlan": [{ "plan": "pro", "count": 12 }],
    "clientsPerMonth": [{ "month": "Jul", "clients": 4 }],
    "heartbeatsDaily": [{ "day": "Sat", "heartbeats": 18 }],
    "expiringSoon": [],
    "graceLicenses": [],
    "inactiveClients": []
  }
}
```

Archived licenses are excluded.

### List Licenses

- Method: `GET`
- URL: `/api/admin/licenses`

Query parameters:

- `page`: default `1`
- `pageSize`: default `20`, max `100`
- `status`: `trial` | `active` | `expired` | `suspended`
- `plan`: `starter` | `growth` | `pro` | `custom`
- `q`: search shop, owner, phone, email, or key
- `sort`: `createdAt` | `shopName` | `ownerName` | `plan` | `status` | `expiresAt` | `lastHeartbeatAt`
- `includeArchived`: `true` | `false`, default `false`

License rows include computed license state, `lastHeartbeatAt`, `maxSeats`, and archive fields.

### Get License Detail

- Method: `GET`
- URL: `/api/admin/licenses/:id`

Response includes:

- license fields and computed license state
- `heartbeats`
- `events`
- `activations`
- `payments`

### Create License

- Method: `POST`
- URL: `/api/admin/licenses`

Payload:

```json
{
  "shopName": "Priyanka Silks",
  "ownerName": "Priyanka",
  "phone": "9988776655",
  "email": "priyanka@silks.com",
  "plan": "starter",
  "status": "active",
  "duration": "1year",
  "gracePeriodDays": 7,
  "maxSeats": 1,
  "notes": "Premium retailer"
}
```

Use either `duration` or `expiresAt`.

### Update License

- Method: `PUT`
- URL: `/api/admin/licenses/:id`

Allowed fields:

```json
{
  "plan": "pro",
  "status": "active",
  "expiresAt": "2027-07-17T00:00:00.000Z",
  "maxSeats": 3,
  "notes": "Renewed by phone"
}
```

Changing `expiresAt` records a `license.renewed` event.

### Archive License

- Method: `DELETE`
- URL: `/api/admin/licenses/:id`

This is a soft archive. The row remains in the database with `deletedAt` and `deletedBy`.

### Suspend License

- Method: `POST`
- URL: `/api/admin/licenses/:id/suspend`

Sets stored status to `suspended`.

### Reactivate License

- Method: `POST`
- URL: `/api/admin/licenses/:id/activate`

Sets stored status to `active`. If the license is already expired, expiry is extended by 30 days.

### Reset All Machine Bindings

- Method: `POST`
- URL: `/api/admin/licenses/:id/reset-machine`

Clears legacy machine binding and deactivates all active activation records.

### Deactivate One Machine

- Method: `POST`
- URL: `/api/admin/licenses/:id/activations/:activationId/deactivate`

Sets `deactivatedAt` on a single activation record.

### Plan Catalog

- Method: `GET`
- URL: `/api/admin/plans`

Returns DB-backed plans when available, otherwise falls back to current static plan feature flags.

### Renewal Quote

- Method: `GET`
- URL: `/api/admin/licenses/:id/renewal-quote?months=1`

Returns a renewal quote scaffold. Payment-gateway pricing is not fully automated yet.

### Manual Payment

- Method: `POST`
- URL: `/api/admin/licenses/:id/manual-payment`

Payload:

```json
{
  "amount": 150000,
  "currency": "INR",
  "provider": "manual",
  "providerPaymentId": "BANK-REF-123",
  "months": 1
}
```

Records a `payment_events` row, extends expiry, and records audit events.

## 5. Error Schema

All non-2xx responses use:

```json
{
  "success": false,
  "error": "ApiErrorCode",
  "message": "Human-readable description"
}
```

Common error codes:

| Error Code | HTTP Status | Context |
|---|---:|---|
| `VALIDATION_ERROR` | 400 | Invalid request body/query |
| `INVALID_API_KEY` | 401 | Missing or invalid `X-API-Key` |
| `UNAUTHORIZED` | 401 | Missing bearer token or setup token |
| `INVALID_TOKEN` | 401 | Invalid/expired JWT |
| `LOGIN_FAILED` | 401 | Admin credentials invalid |
| `LICENSE_NOT_FOUND` | 404 | License or activation not found |
| `LICENSE_INACTIVE` | 403 | License cannot be activated |
| `LICENSE_EXPIRED` | 403 | License expired beyond grace |
| `MACHINE_MISMATCH` | 409 | Machine is not activated |
| `MAX_SEATS_EXCEEDED` | 409 | Seat limit reached |
| `RATE_LIMITED` | 429 | Request limit exceeded |
| `SERVER_MISCONFIGURED` | 500 | Required server config missing |

---

Sarva One REST API Reference Manual v2.0
