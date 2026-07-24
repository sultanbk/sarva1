# Sarva One License System Roadmap

This roadmap summarizes the current implementation status and remaining work. For the detailed tracker, see `docs/licensing_system_improvement_plan.md`.

## Current Status

| Phase | Area | Status |
|---|---|---|
| Phase 1 | Hardening and effective status | Implemented |
| Phase 2 | Audit logs and soft archive | Implemented |
| Phase 3 | Signed license token backend | Backend implemented, POS verification pending |
| Phase 4 | Multi-seat licensing | Backend/admin foundation implemented, tests pending |
| Phase 5 | Plan entitlement management | Schema/catalog scaffold implemented |
| Phase 6 | Payment automation | Manual payment scaffold implemented, gateway pending |
| Phase 7 | Monitoring and alerts | Internal audit events implemented, external alerts pending approval |
| Phase 8 | Security hardening | Several backend controls implemented, advanced controls pending |
| Phase 9 | Automated testing | Still pending |

## Implemented Highlights

### License Hardening

- RS256 signed license token returned as `licenseToken`.
- Public key discovery endpoint: `GET /api/license/public-key`.
- Centralized server-side license state calculation.
- `effectiveStatus`, `storedStatus`, `graceEndsAt`, and `daysRemaining`.
- Production config validation.
- Timing-safe API key comparison.

### Audit And Archive

- `license_events` audit table.
- Admin login failure and password-change events.
- License create/update/renew/suspend/reactivate/archive events.
- Client activation, validation failure, and seat-limit events.
- Soft archive fields on `licenses`.

### Multi-Seat Licensing

- `maxSeats` on licenses.
- `license_activations` table.
- Hashed machine ID activation records.
- Activation/validation/heartbeat use active activation records.
- Admin can deactivate one machine or reset all machines.

### Plan And Payment Scaffold

- `plans` table.
- `plan_entitlements` table.
- `payment_events` table.
- Plan catalog endpoint.
- Renewal quote scaffold.
- Manual payment recording and expiry extension.

## Remaining High-Priority Work

1. Implement POS-side license token verification.
2. Migrate POS cache to store signed token as the authoritative local state.
3. Add automated tests for:
   - activation race conditions
   - max-seat enforcement
   - expiry/grace computation
   - audit event recording
   - manual payment renewal
4. Populate DB-backed entitlements and switch feature resolution from hardcoded fallback to DB-first.
5. Add Razorpay order creation and webhook signature verification.
6. Add admin UI for plan entitlement editing.
7. Add per-license/per-machine rate limiting.
8. Add admin MFA or account lockout.
9. Add scheduled checks for inactive clients and upcoming expiries.

## External Alerts Note

Slack/Discord/email alerts are intentionally not implemented by default because they can export customer/license identifiers to third-party URLs. Enable this only after explicitly deciding:

- which provider is trusted
- what data may be sent
- whether messages should mask license keys or customer identifiers

## Rollout Checklist

Before deployment:

- Set `LICENSE_PRIVATE_KEY`.
- Set `LICENSE_PUBLIC_KEY`.
- Set `MACHINE_ID_HASH_SECRET`.
- Set `ADMIN_SETUP_TOKEN` if public setup protection is desired.
- Run `npm run db:migrate`.
- Verify existing `licenses.machine_id` values are backfilled into `license_activations`.
- Confirm POS clients tolerate additional response fields.

---

Sarva One Platform Scaling Roadmap v2.0
