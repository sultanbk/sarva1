# Licensing Model Reference

This document defines current Sarva One licensing behavior: plans, effective status, signed tokens, multi-seat activation, grace periods, and audit/payment records.

## 1. Plan Feature Matrix

The server currently keeps static feature flags as the fallback entitlement source. Phase 5 added `plans` and `plan_entitlements` tables so plan features can be made database-configurable.

| Feature Flag | Type | Starter | Growth | Pro | Custom |
|---|---|---:|---:|---:|---:|
| `maxBillsPerMonth` | number | 50 | 500 | -1 | -1 |
| `maxProducts` | number | 100 | 1000 | -1 | -1 |
| `maxCustomers` | number | 50 | -1 | -1 | -1 |
| `maxUsers` | number | 1 | 2 | -1 | -1 |
| `whatsappIntegration` | boolean | false | true | true | true |
| `creditManagement` | boolean | false | true | true | true |
| `creditAging` | boolean | false | false | true | true |
| `customerAnalytics` | boolean | false | false | true | true |
| `expenseTracking` | boolean | false | true | true | true |
| `estimates` | boolean | false | true | true | true |
| `returnExchange` | boolean | false | true | true | true |
| `barcodeLabels` | boolean | false | true | true | true |
| `dataExport` | boolean | false | true | true | true |
| `googleDriveBackup` | boolean | false | true | true | true |
| `auditTrail` | boolean | false | false | true | true |
| `profitLossReport` | boolean | false | false | true | true |
| `gstReports` | boolean | false | true | true | true |
| `multiUser` | boolean | false | true | true | true |

`-1` means unlimited.

## 2. Stored Status vs Effective Status

The database stores an admin status:

- `trial`
- `active`
- `expired`
- `suspended`

The server computes runtime `effectiveStatus`:

- `trial`: evaluation license still within term.
- `active`: paid/valid license still within term.
- `grace`: expiry has passed, but the license is still within `gracePeriodDays`.
- `expired`: expiry plus grace period has passed.
- `suspended`: admin lockout; always blocks regardless of expiry.

Clients and dashboards should use `effectiveStatus` for behavior and display.

## 3. Grace Periods

### Subscription Grace

`gracePeriodDays` is stored per license. A license whose `expiresAt` has passed remains usable until:

```text
graceEndsAt = expiresAt + gracePeriodDays
```

After `graceEndsAt`, `effectiveStatus` becomes `expired`.

### Offline Allowance

The server includes `offlineDaysAllowance` inside the signed license token. The POS app should use this to decide how long it can trust a previously verified token without online validation.

Subscription grace and offline allowance are separate policies.

## 4. Signed License Token

Activation and validation responses include a signed RS256 JWT:

- `signature`
- `licenseToken`

Both currently contain the same token for backward compatibility.

The token payload includes:

- `licenseId`
- `key`
- `plan`
- `storedStatus`
- `effectiveStatus`
- `expiresAt`
- `graceEndsAt`
- `daysRemaining`
- `features`
- `maxSeats`
- `shopName`
- `issuedAt`
- `validUntil`
- `offlineDaysAllowance`
- `tokenVersion`

The POS should verify the token using the public key from `/api/license/public-key`.

## 5. Multi-Seat Activation

Each license has `maxSeats`, default `1`.

The server stores activated machines in `license_activations`:

- `licenseId`
- `machineIdHash`
- `hostname`
- `appVersion`
- `activatedAt`
- `lastSeenAt`
- `deactivatedAt`

Raw machine IDs are not stored for new activation records. They are hashed with `MACHINE_ID_HASH_SECRET`.

Activation rules:

1. Same active machine can validate/activate again.
2. New machine is allowed only if active activation count is below `maxSeats`.
3. If the limit is reached, activation returns `MAX_SEATS_EXCEEDED`.
4. Admins can deactivate one machine or reset all machines.

Legacy compatibility: `licenses.machine_id` still exists and is honored while old clients/data migrate.

## 6. Heartbeats

Heartbeat records include:

- license id
- raw machine id in the heartbeat telemetry record
- app version
- IP address
- bills today
- total bills
- total customers
- total products
- created timestamp

Heartbeat also updates activation `lastSeenAt` and app version when an active activation exists.

## 7. Audit Events

Important changes are recorded in `license_events`:

- license created
- license updated
- license renewed
- license suspended
- license reactivated
- license archived
- license activated
- machine reset/deactivated
- machine mismatch
- validation failed
- max seats exceeded
- admin login failed
- password changed
- manual payment recorded

The admin dashboard shows these in the Audit Timeline on the license detail page.

## 8. Soft Archive

Dashboard delete is now an archive:

- `deletedAt` is set.
- `deletedBy` is set.
- archived licenses are hidden from normal list/detail/dashboard queries.

This keeps support history, audit events, payments, and heartbeats recoverable.

## 9. Payments And Renewals

Current payment model:

- manual payment recording is supported.
- manual payment extends `expiresAt` by `months * 30 days`.
- payment is written to `payment_events`.
- renewal and payment audit events are recorded.

Razorpay/Stripe automation remains planned.

---

Sarva One Licensing Engine Reference Guide v2.0
