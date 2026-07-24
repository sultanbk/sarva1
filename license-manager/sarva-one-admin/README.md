# Sarva One License Admin Dashboard

React dashboard for operating the Sarva One licensing backend.

## Stack

- React 19
- TypeScript
- Vite
- TanStack Query
- React Router
- Tailwind CSS
- Recharts
- Lucide React

## Current Features

### Dashboard

- Total, active, expired, MRR, and ARR metrics.
- Server-computed dashboard data from `/api/admin/dashboard`.
- New clients chart.
- Clients by plan chart.
- Daily heartbeat chart.
- Alert lists for expiring soon, grace-period licenses, and inactive clients.

### Client List

- Search by shop, owner, phone, email, or key.
- Filter by stored status and plan.
- Sort by shop, owner, plan, status, expiry, or last heartbeat.
- Copy license key.
- Suspend/reactivate.
- Reset machine binding.
- Open detail page.

### Client Detail

- License state, plan, expiry, and seat usage.
- Shop profile.
- Quick actions:
  - suspend
  - reactivate
  - renew 30 days
  - reset all machines
  - update plan
  - update max seats
  - update expiry
  - update notes
- Activated machine list with per-seat deactivation.
- Payment history.
- Heartbeat activity timeline.
- Audit timeline from `license_events`.
- Archive license instead of permanent delete.

### Create License

- Create license with:
  - shop details
  - plan
  - duration or custom expiry
  - grace period days
  - max seats
  - internal notes
- Copy generated license key.
- Generate WhatsApp message link.

### Settings

- Change admin password.
- View masked API key.
- Copy license endpoint URLs.
- Check server health.

## Environment

Create `.env` in `sarvaone-admin`:

```env
VITE_API_URL=https://sarvaonelicencemanagement-production.up.railway.app
VITE_ADMIN_API_PREFIX=/api/admin
VITE_LICENSE_API_PREFIX=/api/license
```

## Development

```bash
npm install
npm run dev
```

Open `http://localhost:5173`.

## Build

```bash
npm run build
```

Preview:

```bash
npm run preview
```

## API Contract Notes

- License status shown by the UI uses server-provided `effectiveStatus`.
- Dashboard data no longer derives from only the first 100 licenses; it uses `/api/admin/dashboard`.
- License detail expects `heartbeats`, `events`, `activations`, and `payments`.
- Archive calls still use `DELETE /api/admin/licenses/:id`, but the backend soft-archives the license.

---

Sarva One Admin Dashboard v2.0
