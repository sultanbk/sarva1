# Sarva One — License Management System

> Legacy reference note: this original guide predates the v2 licensing changes. For current behavior, use `docs/api_reference.md`, `docs/architecture.md`, `docs/licensing_model.md`, and `docs/licensing_system_improvement_plan.md`. The current implementation includes RS256 license tokens, multi-seat activations, audit logs, soft archive, plan/payment scaffolding, and hashed activation machine IDs.
### Complete Technical Reference Guide

> **Developer:** Sultan Kabadi — [sultanbk.com](https://sultanbk.com)
> **System:** Sarva One Billing & Inventory Platform
> **Last Updated:** June 2026

---

## Table of Contents

1. [System Architecture Overview](#1-system-architecture-overview)
2. [Repository Structure](#2-repository-structure)
3. [Database Schemas](#3-database-schemas)
4. [License Server — API Reference](#4-license-server--api-reference)
5. [LicenseManager — Electron Main Process](#5-licensemanager--electron-main-process)
6. [IPC Communication Layer](#6-ipc-communication-layer)
7. [Preload Bridge](#7-preload-bridge)
8. [Zustand License Store](#8-zustand-license-store)
9. [Feature Flags & Plan Definitions](#9-feature-flags--plan-definitions)
10. [Feature Gate Components](#10-feature-gate-components)
11. [App Launch Flow](#11-app-launch-flow)
12. [Heartbeat System](#12-heartbeat-system)
13. [Machine Locking](#13-machine-locking)
14. [Grace Period Logic](#14-grace-period-logic)
15. [Admin Dashboard](#15-admin-dashboard)
16. [Environment Variables](#16-environment-variables)
17. [Deployment — Railway](#17-deployment--railway)
18. [Commands Reference](#18-commands-reference)
19. [Error Codes Reference](#19-error-codes-reference)
20. [Security Considerations](#20-security-considerations)
21. [Troubleshooting](#21-troubleshooting)

---

## 1. System Architecture Overview

The Sarva One license system is made up of three independent components that communicate over HTTPS.

```
┌─────────────────────────────────────────────────────────────────┐
│                        CLIENT MACHINE                           │
│                                                                 │
│  ┌─────────────────────────────────────────────────────────┐   │
│  │              Sarva One Billing App (Electron)           │   │
│  │                                                         │   │
│  │  Renderer Process (React)                               │   │
│  │  ├── licenseStore (Zustand)                             │   │
│  │  ├── FeatureGate components                             │   │
│  │  ├── ActivationScreen                                   │   │
│  │  ├── LicenseStatusBar                                   │   │
│  │  └── UpgradePrompt                                      │   │
│  │                   │ IPC (contextBridge)                 │   │
│  │  Main Process (Node.js)                                 │   │
│  │  ├── LicenseManager                                     │   │
│  │  ├── licenseHandlers (IPC)                              │   │
│  │  └── SQLite (license_cache table)                       │   │
│  └───────────────────────┬─────────────────────────────────┘   │
└────────────────────────  │  ─────────────────────────────────── ┘
                           │ HTTPS (every 6h heartbeat + on-launch)
                           ▼
┌─────────────────────────────────────────────────────────────────┐
│              SARVA ONE LICENSE SERVER (Railway)                 │
│       sarvaonelicencemanagement-production.up.railway.app       │
│                                                                 │
│  Express.js + TypeScript                                        │
│  ├── POST /api/license/activate                                 │
│  ├── POST /api/license/validate                                 │
│  ├── POST /api/license/heartbeat                                │
│  ├── POST /api/license/deactivate-machine                       │
│  └── /api/admin/* (JWT protected)                               │
│                                                                 │
│  PostgreSQL Database                                            │
│  ├── licenses                                                   │
│  ├── heartbeats                                                 │
│  └── admin_users                                                │
└───────────────────────────┬─────────────────────────────────────┘
                            │ HTTPS (JWT auth)
                            ▼
┌─────────────────────────────────────────────────────────────────┐
│                  SARVA ONE ADMIN DASHBOARD                      │
│                  (React + TanStack Query)                       │
│                                                                 │
│  ├── Dashboard (MRR, ARR, active clients)                       │
│  ├── Client list + detail pages                                 │
│  ├── License CRUD operations                                    │
│  └── Usage analytics per client                                 │
└─────────────────────────────────────────────────────────────────┘
```

### Communication Flow Summary

| Direction | Protocol | Frequency | Purpose |
|---|---|---|---|
| App → Server | HTTPS POST | On launch | License validation |
| App → Server | HTTPS POST | Every 6 hours | Heartbeat + usage stats |
| App → Server | HTTPS POST | On activation | First-time key activation |
| Admin Dashboard → Server | HTTPS (JWT) | On demand | License management |
| Server → App | JSON response | Per request | License state + feature flags |

---

## 2. Repository Structure

Three separate repositories:

```
sarvaone-licence-management/     ← License Server (Node.js + Express)
├── src/
│   ├── db/
│   │   ├── connection.ts        ← PostgreSQL connection
│   │   ├── schema.ts            ← Drizzle ORM schema
│   │   └── migrations/
│   ├── routes/
│   │   ├── license.ts           ← Public license endpoints
│   │   └── admin.ts             ← Protected admin endpoints
│   ├── middleware/
│   │   ├── auth.ts              ← JWT verification
│   │   └── rateLimit.ts         ← Rate limiting
│   ├── services/
│   │   └── licenseService.ts    ← Core license logic
│   └── index.ts                 ← Express app entry
├── .env.example
├── package.json
└── tsconfig.json

sarvaone-admin/                  ← Admin Dashboard (React + Vite)
├── src/
│   ├── pages/
│   │   ├── Login.tsx
│   │   ├── Dashboard.tsx
│   │   ├── Clients.tsx
│   │   ├── ClientDetail.tsx
│   │   ├── CreateLicense.tsx
│   │   └── Settings.tsx
│   ├── components/
│   │   ├── StatusBadge.tsx
│   │   ├── PlanBadge.tsx
│   │   └── Sidebar.tsx
│   └── lib/
│       └── api.ts               ← Axios instance with JWT
├── .env
└── package.json

kpt-billing/                     ← POS App (Electron + React)
├── src/
│   ├── main/
│   │   ├── license/
│   │   │   └── LicenseManager.ts   ← Core license logic
│   │   ├── ipc/
│   │   │   └── licenseHandlers.ts  ← IPC channel handlers
│   │   └── database/
│   │       └── schema.ts           ← Includes license_cache table
│   ├── renderer/
│   │   ├── stores/
│   │   │   └── licenseStore.ts     ← Zustand store
│   │   └── components/
│   │       └── license/
│   │           ├── FeatureGate.tsx
│   │           ├── LimitGate.tsx
│   │           ├── UpgradePrompt.tsx
│   │           ├── UpgradeDialog.tsx
│   │           ├── LicenseStatusBar.tsx
│   │           ├── ActivationScreen.tsx
│   │           ├── RenewalScreen.tsx
│   │           └── SuspendedScreen.tsx
│   ├── preload/
│   │   └── index.ts               ← contextBridge exposure
│   └── shared/
│       └── licenseTypes.ts        ← Shared TypeScript types
└── package.json
```

---

## 3. Database Schemas

### 3.1 PostgreSQL — License Server

#### `licenses` table

```sql
CREATE TABLE licenses (
  id                UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  key               VARCHAR(24) UNIQUE NOT NULL,  -- SARVA-XXXX-XXXX-XXXX-XXXX
  shop_name         VARCHAR(255) NOT NULL,
  owner_name        VARCHAR(255) NOT NULL,
  phone             VARCHAR(20) NOT NULL,
  email             VARCHAR(255),
  plan              VARCHAR(20) NOT NULL,         -- starter | growth | pro | custom
  status            VARCHAR(20) NOT NULL,         -- trial | active | expired | suspended
  machine_id        VARCHAR(255),                 -- NULL until first activation
  activated_at      TIMESTAMP,
  expires_at        TIMESTAMP NOT NULL,
  grace_period_days INTEGER DEFAULT 7,
  created_at        TIMESTAMP DEFAULT NOW(),
  updated_at        TIMESTAMP DEFAULT NOW(),
  created_by        VARCHAR(255),                 -- admin user ID
  notes             TEXT
);
```

#### `heartbeats` table

```sql
CREATE TABLE heartbeats (
  id               UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  license_id       UUID REFERENCES licenses(id),
  machine_id       VARCHAR(255),
  app_version      VARCHAR(20),
  bills_today      INTEGER DEFAULT 0,
  total_bills      INTEGER DEFAULT 0,
  total_customers  INTEGER DEFAULT 0,
  total_products   INTEGER DEFAULT 0,
  ip_address       VARCHAR(45),
  created_at       TIMESTAMP DEFAULT NOW()
);
```

#### `admin_users` table

```sql
CREATE TABLE admin_users (
  id           UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  email        VARCHAR(255) UNIQUE NOT NULL,
  password_hash VARCHAR(255) NOT NULL,
  name         VARCHAR(255) NOT NULL,
  created_at   TIMESTAMP DEFAULT NOW()
);
```

### 3.2 SQLite — Billing App (license_cache)

```typescript
// src/main/database/schema.ts (Drizzle ORM)

export const licenseCache = sqliteTable('license_cache', {
  id:               integer('id').primaryKey({ autoIncrement: true }),
  licenseKey:       text('license_key').notNull(),
  plan:             text('plan').notNull(),            // starter | growth | pro | custom
  status:           text('status').notNull(),          // trial | active | grace | expired | suspended | not_activated
  shopName:         text('shop_name'),
  ownerName:        text('owner_name'),
  expiresAt:        text('expires_at'),                // ISO string
  gracePeriodDays:  integer('grace_period_days').default(7),
  features:         text('features'),                  // JSON.stringify(FeatureFlags)
  machineId:        text('machine_id'),
  lastValidated:    text('last_validated'),            // ISO timestamp
  createdAt:        text('created_at'),
});
```

---

## 4. License Server — API Reference

**Base URL:** `https://sarvaonelicencemanagement-production.up.railway.app`

All app-to-server requests require the header:
```
X-API-Key: <API_KEY from environment>
Content-Type: application/json
```

All admin requests require:
```
Authorization: Bearer <JWT_TOKEN>
Content-Type: application/json
```

---

### `POST /api/license/activate`

Called once on first app launch when a license key is entered.

**Request:**
```json
{
  "key": "SARVA-A3F7-KP92-XM41-BN85",
  "machineId": "a1b2c3d4e5f6...",
  "appVersion": "1.0.1"
}
```

**Success Response `200`:**
```json
{
  "success": true,
  "data": {
    "status": "active",
    "plan": "pro",
    "shopName": "Krishnapriya Textiles",
    "ownerName": "Puneet",
    "expiresAt": "2027-01-01T00:00:00.000Z",
    "daysRemaining": 365,
    "gracePeriodDays": 7,
    "features": {
      "maxBillsPerMonth": -1,
      "maxProducts": -1,
      "maxCustomers": -1,
      "whatsappIntegration": true,
      "creditManagement": true,
      "creditAging": true,
      "customerAnalytics": true,
      "expenseTracking": true,
      "estimates": true,
      "returnExchange": true,
      "barcodeLabels": true,
      "dataExport": true,
      "googleDriveBackup": true,
      "auditTrail": true,
      "profitLossReport": true,
      "gstReports": true,
      "multiUser": true,
      "maxUsers": -1
    }
  }
}
```

**Error Responses:**
```json
{ "success": false, "error": "MACHINE_MISMATCH", "message": "License already activated on another device" }
{ "success": false, "error": "LICENSE_NOT_FOUND", "message": "Invalid license key" }
{ "success": false, "error": "LICENSE_EXPIRED", "message": "License has expired" }
{ "success": false, "error": "LICENSE_SUSPENDED", "message": "License has been suspended" }
```

---

### `POST /api/license/validate`

Called on every app launch and whenever re-validation is needed.

**Request:**
```json
{
  "key": "SARVA-A3F7-KP92-XM41-BN85",
  "machineId": "a1b2c3d4e5f6...",
  "appVersion": "1.0.1"
}
```

**Response:** Same structure as `/activate`.

Additional status values in response:
- `"grace"` — expired but within grace period
- `"expired"` — past grace period

---

### `POST /api/license/heartbeat`

Called silently every 6 hours. Never blocks the app — any errors are swallowed.

**Request:**
```json
{
  "key": "SARVA-A3F7-KP92-XM41-BN85",
  "machineId": "a1b2c3d4e5f6...",
  "appVersion": "1.0.1",
  "usageStats": {
    "billsToday": 24,
    "totalBills": 1842,
    "totalCustomers": 312,
    "totalProducts": 480
  }
}
```

**Response `200`:**
```json
{ "success": true, "data": { "received": true } }
```

---

### `POST /api/license/deactivate-machine`

Admin-only. Resets machine lock so license can be activated on a new computer.

**Request:**
```json
{
  "key": "SARVA-A3F7-KP92-XM41-BN85",
  "adminToken": "<JWT>"
}
```

**Response `200`:**
```json
{ "success": true, "data": { "message": "Machine lock cleared. License can be activated on a new device." } }
```

---

### Admin Endpoints (JWT Protected)

| Method | Endpoint | Description |
|---|---|---|
| `POST` | `/api/admin/login` | Get JWT token |
| `POST` | `/api/admin/setup` | Create first admin user (run once) |
| `GET` | `/api/admin/licenses` | List all licenses (pagination + filters) |
| `POST` | `/api/admin/licenses` | Create new license + generate key |
| `GET` | `/api/admin/licenses/:id` | Single license with heartbeat history |
| `PUT` | `/api/admin/licenses/:id` | Update plan, status, expiry, notes |
| `POST` | `/api/admin/licenses/:id/suspend` | Suspend license |
| `POST` | `/api/admin/licenses/:id/activate` | Reactivate license |
| `POST` | `/api/admin/licenses/:id/reset-machine` | Clear machine lock |
| `GET` | `/api/admin/dashboard` | Stats: total, active, expired, MRR, ARR |

---

## 5. LicenseManager — Electron Main Process

**File:** `src/main/license/LicenseManager.ts`

This is the core class that manages all license operations in the main process.

```typescript
class LicenseManager {
  private currentState: LicenseState;
  private cachedMachineId: string | null = null;
  private heartbeatTimer: NodeJS.Timeout | null = null;
  private readonly SERVER_URL = process.env.VITE_LICENSE_SERVER_URL;
  private readonly TIMEOUT_MS = 10000; // 10 second timeout on all requests
  private readonly HEARTBEAT_INTERVAL_MS = 6 * 60 * 60 * 1000; // 6 hours
  private readonly OFFLINE_GRACE_DAYS = 7;
}
```

### Method Descriptions

#### `initialize(): Promise<LicenseState>`
- Entry point called in `src/main/index.ts` before `BrowserWindow` is shown
- Loads `license_cache` from SQLite
- If no record: returns `{ status: 'not_activated' }`
- If record exists: pings server if online, falls back to cache if offline
- Starts heartbeat timer regardless of outcome
- Never throws — always returns a valid `LicenseState`

#### `activate(key: string): Promise<ActivationResult>`
- Validates key format before hitting server (`/^SARVA-[A-Z0-9]{4}-[A-Z0-9]{4}-[A-Z0-9]{4}-[A-Z0-9]{4}$/`)
- Calls `POST /api/license/activate`
- On success: upserts `license_cache` table with full response
- Updates `this.currentState` in memory
- Returns `ActivationResult`

#### `validateWithServer(key: string): Promise<LicenseState>`
- Calls `POST /api/license/validate`
- On success: updates `license_cache.last_validated` to `NOW()`
- On network error or timeout: calls `validateFromCache()` instead
- Never throws

#### `validateFromCache(cache: LicenseCacheRow): LicenseState`
- Checks `last_validated` — if more than `OFFLINE_GRACE_DAYS * 24h` ago → `grace_expired`
- Checks `expires_at` — if past → `expired`
- Returns cached `status` and `features`

#### `isFeatureEnabled(feature: keyof FeatureFlags): boolean`
- Reads from `this.currentState.features`
- Returns `false` if state is null or not activated

#### `checkLimit(limitKey, currentCount): boolean`
- Reads limit value from `this.currentState.features[limitKey]`
- Returns `true` if limit is `-1` (unlimited)
- Returns `true` if `currentCount < limit`
- Returns `false` if at or over limit

#### `startHeartbeat(): void`
- Sets `setInterval` for `HEARTBEAT_INTERVAL_MS`
- Also fires once immediately after 30 seconds (first run delay)

#### `sendHeartbeat(): Promise<void>`
- Queries SQLite for usage stats
- POSTs to `/api/license/heartbeat`
- Entire method wrapped in try/catch — completely silent

#### `getMachineId(): string`
- Uses `node-machine-id` package: `machineIdSync({ original: true })`
- Caches result in `this.cachedMachineId` after first call

#### `getLicenseState(): LicenseState`
- Returns `this.currentState`
- Used by IPC handlers

### Initialization in Main Process

```typescript
// src/main/index.ts

import { LicenseManager } from './license/LicenseManager'
import { registerLicenseHandlers } from './ipc/licenseHandlers'

const licenseManager = new LicenseManager()

app.whenReady().then(async () => {
  // Initialize license BEFORE creating window
  await licenseManager.initialize()

  // Register IPC handlers with the manager instance
  registerLicenseHandlers(licenseManager)

  // Now create window
  createWindow()
})
```

---

## 6. IPC Communication Layer

**File:** `src/main/ipc/licenseHandlers.ts`

IPC (Inter-Process Communication) is how the Electron main process talks to the React renderer. All license operations go through named channels.

### Registered Channels

| Channel | Direction | Handler |
|---|---|---|
| `license:get-state` | Renderer → Main | Returns current `LicenseState` |
| `license:activate` | Renderer → Main | Calls `licenseManager.activate(key)` |
| `license:is-feature-enabled` | Renderer → Main | Calls `licenseManager.isFeatureEnabled(feature)` |
| `license:check-limit` | Renderer → Main | Calls `licenseManager.checkLimit(key, count)` |

### Registration Pattern

```typescript
// src/main/ipc/licenseHandlers.ts

import { ipcMain } from 'electron'
import { LicenseManager } from '../license/LicenseManager'

export function registerLicenseHandlers(licenseManager: LicenseManager) {

  ipcMain.handle('license:get-state', async () => {
    return licenseManager.getLicenseState()
  })

  ipcMain.handle('license:activate', async (_, key: string) => {
    return licenseManager.activate(key)
  })

  ipcMain.handle('license:is-feature-enabled', async (_, feature: string) => {
    return licenseManager.isFeatureEnabled(feature as keyof FeatureFlags)
  })

  ipcMain.handle('license:check-limit', async (_, limitKey: string, currentCount: number) => {
    return licenseManager.checkLimit(limitKey as any, currentCount)
  })
}
```

---

## 7. Preload Bridge

**File:** `src/preload/index.ts`

The preload script runs in a privileged context and uses `contextBridge` to safely expose IPC methods to the React renderer. Direct IPC access from renderer is disabled for security.

```typescript
// src/preload/index.ts

import { contextBridge, ipcRenderer } from 'electron'

contextBridge.exposeInMainWorld('license', {
  getState: (): Promise<LicenseState> =>
    ipcRenderer.invoke('license:get-state'),

  activate: (key: string): Promise<ActivationResult> =>
    ipcRenderer.invoke('license:activate', key),

  isFeatureEnabled: (feature: string): Promise<boolean> =>
    ipcRenderer.invoke('license:is-feature-enabled', feature),

  checkLimit: (limitKey: string, currentCount: number): Promise<boolean> =>
    ipcRenderer.invoke('license:check-limit', limitKey, currentCount),
})
```

**TypeScript declaration** (add to `src/renderer/env.d.ts`):
```typescript
interface Window {
  license: {
    getState(): Promise<LicenseState>
    activate(key: string): Promise<ActivationResult>
    isFeatureEnabled(feature: string): Promise<boolean>
    checkLimit(limitKey: string, currentCount: number): Promise<boolean>
  }
}
```

---

## 8. Zustand License Store

**File:** `src/renderer/stores/licenseStore.ts`

The Zustand store is the single source of truth for license state in the React renderer. Components read from here rather than calling `window.license` directly.

```typescript
interface LicenseStore {
  // State
  licenseState: LicenseState | null
  isLoading: boolean
  isActivated: boolean
  plan: PlanTier | null
  features: FeatureFlags | null

  // Actions
  initialize: () => Promise<void>
  activate: (key: string) => Promise<ActivationResult>
  isFeatureEnabled: (feature: keyof FeatureFlags) => boolean
  checkLimit: (limitKey: string, count: number) => boolean
}
```

### Usage in Components

```typescript
// Reading state
const { plan, features, isActivated } = useLicenseStore()

// Checking a feature
const { isFeatureEnabled } = useLicenseStore()
const canUseWhatsApp = isFeatureEnabled('whatsappIntegration')

// Activating
const { activate } = useLicenseStore()
const result = await activate('SARVA-XXXX-XXXX-XXXX-XXXX')
```

---

## 9. Feature Flags & Plan Definitions

**File:** `src/shared/licenseTypes.ts`

### TypeScript Types

```typescript
export type PlanTier = 'starter' | 'growth' | 'pro' | 'custom'

export type LicenseStatus =
  | 'not_activated'
  | 'trial'
  | 'active'
  | 'grace'
  | 'expired'
  | 'suspended'
  | 'grace_expired'

export interface FeatureFlags {
  maxBillsPerMonth: number    // -1 = unlimited
  maxProducts: number         // -1 = unlimited
  maxCustomers: number        // -1 = unlimited
  whatsappIntegration: boolean
  creditManagement: boolean
  creditAging: boolean
  customerAnalytics: boolean
  expenseTracking: boolean
  estimates: boolean
  returnExchange: boolean
  barcodeLabels: boolean
  dataExport: boolean
  googleDriveBackup: boolean
  auditTrail: boolean
  profitLossReport: boolean
  gstReports: boolean
  multiUser: boolean
  maxUsers: number            // -1 = unlimited
}

export interface LicenseState {
  status: LicenseStatus
  plan: PlanTier | null
  shopName: string | null
  ownerName: string | null
  expiresAt: string | null
  daysRemaining: number | null
  features: FeatureFlags | null
  gracePeriodDays: number
}

export interface ActivationResult {
  success: boolean
  licenseState?: LicenseState
  error?: string
  errorCode?: string
}
```

### Plan Feature Matrix

```typescript
// Defined in server: src/services/licenseService.ts
// Also mirrored in app: src/shared/licenseTypes.ts

export const PLAN_FEATURES: Record<PlanTier, FeatureFlags> = {
  starter: {
    maxBillsPerMonth: 50,
    maxProducts: 100,
    maxCustomers: 50,
    whatsappIntegration: false,
    creditManagement: false,
    creditAging: false,
    customerAnalytics: false,
    expenseTracking: false,
    estimates: false,
    returnExchange: false,
    barcodeLabels: false,
    dataExport: false,
    googleDriveBackup: false,
    auditTrail: false,
    profitLossReport: false,
    gstReports: false,
    multiUser: false,
    maxUsers: 1,
  },
  growth: {
    maxBillsPerMonth: 500,
    maxProducts: 1000,
    maxCustomers: -1,
    whatsappIntegration: true,
    creditManagement: true,
    creditAging: false,
    customerAnalytics: false,
    expenseTracking: true,
    estimates: true,
    returnExchange: true,
    barcodeLabels: true,
    dataExport: true,
    googleDriveBackup: true,
    auditTrail: false,
    profitLossReport: false,
    gstReports: true,
    multiUser: true,
    maxUsers: 2,
  },
  pro: {
    maxBillsPerMonth: -1,
    maxProducts: -1,
    maxCustomers: -1,
    whatsappIntegration: true,
    creditManagement: true,
    creditAging: true,
    customerAnalytics: true,
    expenseTracking: true,
    estimates: true,
    returnExchange: true,
    barcodeLabels: true,
    dataExport: true,
    googleDriveBackup: true,
    auditTrail: true,
    profitLossReport: true,
    gstReports: true,
    multiUser: true,
    maxUsers: -1,
  },
  custom: {
    // All features enabled — configured per client requirements
    maxBillsPerMonth: -1,
    maxProducts: -1,
    maxCustomers: -1,
    whatsappIntegration: true,
    creditManagement: true,
    creditAging: true,
    customerAnalytics: true,
    expenseTracking: true,
    estimates: true,
    returnExchange: true,
    barcodeLabels: true,
    dataExport: true,
    googleDriveBackup: true,
    auditTrail: true,
    profitLossReport: true,
    gstReports: true,
    multiUser: true,
    maxUsers: -1,
  },
}
```

---

## 10. Feature Gate Components

**Directory:** `src/renderer/components/license/`

### `FeatureGate`

Wraps any component and conditionally renders based on plan.

```tsx
// Usage
<FeatureGate feature="creditAging">
  <CreditAgingReport />
</FeatureGate>

// With custom fallback
<FeatureGate feature="auditTrail" fallback={<div>Upgrade to Pro</div>}>
  <AuditLog />
</FeatureGate>

// Silent — renders nothing if locked
<FeatureGate feature="whatsappIntegration" silent>
  <WhatsAppButton />
</FeatureGate>
```

### `LimitGate`

Wraps billing actions and shows warnings near limits.

```tsx
// Usage
<LimitGate limitKey="maxBillsPerMonth" currentCount={monthlyBillCount}>
  <CreateBillButton />
</LimitGate>
```

**Behavior thresholds:**
- `currentCount >= limit * 0.8` → yellow warning banner
- `currentCount >= limit` → red error banner, action disabled
- `limit === -1` → always renders children, no banner

### `UpgradePrompt`

Shown inside `FeatureGate` when a feature is locked.

```tsx
// Compact variant for inline use
<UpgradePrompt feature="profitLossReport" compact />

// Full card variant (default)
<UpgradePrompt feature="customerAnalytics" />
```

### `ActivationScreen`

Full-screen component shown when `status === 'not_activated'`.

Key behavior:
- Auto-formats input as `SARVA-XXXX-XXXX-XXXX-XXXX` while typing
- Validates format with regex before submitting
- Shows specific error messages per error code
- Plays success animation before transitioning to main app

### `LicenseStatusBar`

Thin bar visible in app header showing current license status.

| Status | Color | Text example |
|---|---|---|
| `trial` | Amber | "Trial — 22 days remaining" |
| `active` | Green | "Pro Plan — Active until 01 Jan 2027" |
| `grace` | Orange | "Subscription expired — 5 days grace remaining" |
| `expired` | Red | "Subscription expired — Please renew" |
| `suspended` | Dark Red | "Account suspended — Contact Sarva One" |

---

## 11. App Launch Flow

**File:** `src/renderer/App.tsx`

```
App mounts
    │
    ▼
licenseStore.initialize() called
    │
    ▼
SplashScreen shown (minimum 1500ms)
    │
    ▼
LicenseManager.initialize() completes in main process
    │
    ├── status: 'not_activated'   ──→  ActivationScreen (full screen)
    │
    ├── status: 'suspended'       ──→  SuspendedScreen (full screen, no bypass)
    │
    ├── status: 'expired'         ──→  RenewalScreen (full screen)
    │   or 'grace_expired'              billing blocked
    │
    ├── status: 'grace'           ──→  Normal App
    │                                  + RenewalBanner at top
    │                                  + billing still works
    │
    └── status: 'trial'           ──→  Normal App
        or 'active'                    + LicenseStatusBar
                                       + full feature access per plan
```

### Mid-Session Expiry

If a license expires while the app is already running (checked on heartbeat response):
- Do **NOT** show full-screen renewal screen mid-session
- Show a non-blocking `RenewalBanner` at the top of the app
- User finishes current task, renewal happens on next launch

---

## 12. Heartbeat System

### What Gets Sent

```typescript
interface HeartbeatPayload {
  key: string
  machineId: string
  appVersion: string
  usageStats: {
    billsToday: number      // COUNT(*) WHERE DATE(created_at) = DATE('now')
    totalBills: number      // COUNT(*) FROM bills
    totalCustomers: number  // COUNT(*) FROM customers
    totalProducts: number   // COUNT(*) FROM products
  }
}
```

### Schedule

- First heartbeat: 30 seconds after app launch (delayed to not slow startup)
- Subsequent: every 6 hours via `setInterval`
- On app close: no final heartbeat (intentional — server detects inactivity by last heartbeat timestamp)

### Failure Handling

```typescript
async sendHeartbeat(): Promise<void> {
  try {
    const stats = await this.collectUsageStats()
    await fetch(`${SERVER_URL}/api/license/heartbeat`, {
      method: 'POST',
      signal: AbortSignal.timeout(10000),  // 10s timeout
      headers: { 'X-API-Key': API_KEY, 'Content-Type': 'application/json' },
      body: JSON.stringify({ key, machineId, appVersion, usageStats: stats })
    })
  } catch {
    // Completely silent — never interrupt the app
    if (isDev) console.log('[LicenseManager] Heartbeat failed silently')
  }
}
```

### Server-Side Inactive Detection (Admin Dashboard)

Clients with no heartbeat in 48 hours appear in the admin dashboard alerts section. This helps Sultan identify:
- Shops that may have stopped using the software
- Shops that may need a check-in call
- Possible technical issues at the client's end

---

## 13. Machine Locking

### How It Works

1. App calls `getMachineId()` using `node-machine-id`
2. This generates a unique hardware fingerprint for the computer
3. On first activation, fingerprint is sent to server with the license key
4. Server stores it in `licenses.machine_id`
5. Every future validation checks: `incoming machineId === stored machineId`
6. Mismatch → `MACHINE_MISMATCH` error

### node-machine-id Implementation

```typescript
import { machineIdSync } from 'node-machine-id'

getMachineId(): string {
  if (this.cachedMachineId) return this.cachedMachineId
  this.cachedMachineId = machineIdSync({ original: true })
  return this.cachedMachineId
}
```

The `original: true` flag returns the raw hardware ID without hashing, making it more stable across OS updates.

### Resetting Machine Lock (Client Gets New Computer)

**From Admin Dashboard:**
1. Go to client detail page
2. Click "Reset Machine Lock"
3. Calls `POST /api/admin/licenses/:id/reset-machine`
4. Server sets `machine_id = NULL`
5. Client enters license key on new computer — first activation runs again

**Via curl (manual):**
```bash
curl -X POST https://sarvaonelicencemanagement-production.up.railway.app/api/admin/licenses/:id/reset-machine \
  -H "Authorization: Bearer YOUR_JWT_TOKEN"
```

---

## 14. Grace Period Logic

### Timeline

```
Subscription active
        │
        ▼
  Expiry date reached
        │
        ├── Days 1-7: status = 'grace'
        │   - App shows RenewalBanner (non-blocking)
        │   - All features still work
        │   - Billing works fully
        │
        └── Day 8+: status = 'expired'
            - App shows RenewalScreen on next launch
            - Billing restricted
            - Contact Sultan to renew
```

### Offline Grace Period (Separate Logic)

This is different from subscription expiry grace. It handles the case where the app cannot reach the server:

```
Last successful server validation
        │
        ▼
  App goes offline / server unreachable
        │
        ├── Days 1-7 offline: validateFromCache() returns cached status
        │   - App works normally using saved license data
        │
        └── Day 8+ offline: status = 'grace_expired'
            - App shows warning
            - Forces user to go online and revalidate
```

### Logic in `validateFromCache()`

```typescript
validateFromCache(cache: LicenseCacheRow): LicenseState {
  const lastValidated = new Date(cache.lastValidated)
  const hoursSinceValidation = (Date.now() - lastValidated.getTime()) / 36e5
  const offlineGraceHours = this.OFFLINE_GRACE_DAYS * 24

  // Offline too long — force online validation
  if (hoursSinceValidation > offlineGraceHours) {
    return { ...baseState, status: 'grace_expired' }
  }

  // Subscription expired
  if (cache.expiresAt && new Date(cache.expiresAt) < new Date()) {
    const daysSinceExpiry = (Date.now() - new Date(cache.expiresAt).getTime()) / 864e5
    if (daysSinceExpiry > cache.gracePeriodDays) {
      return { ...baseState, status: 'expired' }
    }
    return { ...baseState, status: 'grace' }
  }

  return { ...baseState, status: cache.status as LicenseStatus }
}
```

---

## 15. Admin Dashboard

**Tech Stack:** React 19 + TypeScript + Vite + TanStack Query + shadcn/ui + Recharts

**Local dev URL:** `http://localhost:5173`

### API Client Setup

```typescript
// src/lib/api.ts

import axios from 'axios'

export const api = axios.create({
  baseURL: import.meta.env.VITE_API_URL,
})

api.interceptors.request.use((config) => {
  const token = localStorage.getItem('sarvaone_admin_token')
  if (token) config.headers.Authorization = `Bearer ${token}`
  return config
})

api.interceptors.response.use(
  (res) => res,
  (err) => {
    if (err.response?.status === 401) {
      localStorage.removeItem('sarvaone_admin_token')
      window.location.href = '/login'
    }
    return Promise.reject(err)
  }
)
```

### Key Dashboard Metrics

```typescript
// GET /api/admin/dashboard returns:
{
  totalClients: number,
  activeClients: number,
  expiredClients: number,
  trialClients: number,
  suspendedClients: number,
  mrr: number,           // sum of active monthly subscriptions in ₹
  arr: number,           // mrr * 12
  expiringIn7Days: License[],
  inGracePeriod: License[],
  inactiveClients: License[],  // no heartbeat in 48h
}
```

---

## 16. Environment Variables

### License Server (`sarvaone-licence-management/.env`)

```env
# Database
DATABASE_URL=postgresql://user:password@host:5432/dbname

# Security
JWT_SECRET=<32+ char random hex string>
API_KEY=<32+ char random hex string>

# Server
PORT=3000
NODE_ENV=production
```

### Billing App (`kpt-billing/.env`)

```env
# License server URL
VITE_LICENSE_SERVER_URL=https://sarvaonelicencemanagement-production.up.railway.app

# API Key (must match server)
VITE_LICENSE_API_KEY=<same API_KEY as server>
```

### Admin Dashboard (`sarvaone-admin/.env`)

```env
# Backend API
VITE_API_URL=https://sarvaonelicencemanagement-production.up.railway.app

# Sultan's WhatsApp number for upgrade CTAs
VITE_SUPPORT_WHATSAPP=+91XXXXXXXXXX
```

> ⚠️ **Never commit `.env` files to GitHub.** Add them to `.gitignore`.

---

## 17. Deployment — Railway

### Server Deployment

```bash
# 1. Push to GitHub (private repo)
git push origin main

# 2. Railway auto-deploys on push
# Monitor at: https://railway.app/dashboard

# 3. Set environment variables in Railway dashboard
# Project → Service → Variables → Add each variable
```

### Run Migrations on Railway

```bash
# Via Railway CLI
railway run npx drizzle-kit push

# Or via Railway dashboard terminal
npx drizzle-kit push
```

### Verify Deployment

```bash
# Health check
curl https://sarvaonelicencemanagement-production.up.railway.app/health

# Expected
{ "status": "ok", "timestamp": "2026-06-27T10:00:00.000Z", "version": "1.0.0" }
```

---

## 18. Commands Reference

### License Server

```bash
# Install dependencies
npm install

# Development (with hot reload)
npm run dev

# Build TypeScript
npm run build

# Start production
npm start

# Run database migrations
npm run db:migrate

# Push schema changes (Drizzle)
npx drizzle-kit push

# Generate migrations
npx drizzle-kit generate

# View database (Drizzle Studio)
npx drizzle-kit studio
```

### Billing App (Electron)

```bash
# Install dependencies
npm install

# Install node-machine-id (required for license)
npm install node-machine-id
npm install @types/node-machine-id --save-dev

# Development mode
npm run dev

# Build for Windows
npm run build:win

# Build for macOS
npm run build:mac

# Build for Linux
npm run build:linux

# Type check
npm run typecheck

# Lint
npm run lint
```

### Admin Dashboard

```bash
# Install dependencies
npm install

# Development
npm run dev

# Build for production
npm run build

# Preview production build
npm run preview
```

### Useful curl Commands for Testing

```bash
# Set base URL
BASE=https://sarvaonelicencemanagement-production.up.railway.app
API_KEY=your_api_key_here

# Create admin user (run once)
curl -X POST $BASE/api/admin/setup \
  -H "Content-Type: application/json" \
  -d '{"email":"sultan@sarvaone.com","password":"your_password","name":"Sultan Kabadi"}'

# Login and get JWT
curl -X POST $BASE/api/admin/login \
  -H "Content-Type: application/json" \
  -d '{"email":"sultan@sarvaone.com","password":"your_password"}'

# Create a new license (replace TOKEN)
curl -X POST $BASE/api/admin/licenses \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer TOKEN" \
  -d '{"shopName":"Krishnapriya Textiles","ownerName":"Puneet","phone":"9XXXXXXXXX","plan":"pro","duration":"1year"}'

# List all licenses
curl $BASE/api/admin/licenses \
  -H "Authorization: Bearer TOKEN"

# Suspend a license
curl -X POST $BASE/api/admin/licenses/LICENSE_ID/suspend \
  -H "Authorization: Bearer TOKEN"

# Reactivate a license
curl -X POST $BASE/api/admin/licenses/LICENSE_ID/activate \
  -H "Authorization: Bearer TOKEN"

# Reset machine lock
curl -X POST $BASE/api/admin/licenses/LICENSE_ID/reset-machine \
  -H "Authorization: Bearer TOKEN"

# Test license validation (simulates what the app does)
curl -X POST $BASE/api/license/validate \
  -H "Content-Type: application/json" \
  -H "X-API-Key: $API_KEY" \
  -d '{"key":"SARVA-XXXX-XXXX-XXXX-XXXX","machineId":"test123","appVersion":"1.0.1"}'

# Dashboard stats
curl $BASE/api/admin/dashboard \
  -H "Authorization: Bearer TOKEN"
```

---

## 19. Error Codes Reference

### License API Error Codes

| Code | HTTP Status | Description | Resolution |
|---|---|---|---|
| `LICENSE_NOT_FOUND` | 404 | Key does not exist in database | Check key is correct, create new license |
| `MACHINE_MISMATCH` | 403 | Key already activated on different machine | Reset machine lock from admin dashboard |
| `LICENSE_EXPIRED` | 403 | License past expiry and grace period | Renew from admin dashboard |
| `LICENSE_SUSPENDED` | 403 | License manually suspended | Reactivate from admin dashboard |
| `INVALID_KEY_FORMAT` | 400 | Key doesn't match SARVA-XXXX-XXXX-XXXX-XXXX pattern | Correct the key format |
| `INVALID_API_KEY` | 401 | X-API-Key header missing or wrong | Check VITE_LICENSE_API_KEY env var |
| `INVALID_TOKEN` | 401 | JWT token invalid or expired | Re-login to admin dashboard |
| `RATE_LIMIT_EXCEEDED` | 429 | Too many requests from same IP | Wait 60 seconds |

### App-Side Status Codes

| Status | Cause | App Behavior |
|---|---|---|
| `not_activated` | Fresh install, no license cached | Show ActivationScreen |
| `trial` | License active, in trial period | Normal app + trial banner |
| `active` | License active and valid | Normal app |
| `grace` | Subscription expired, within grace period | Normal app + renewal banner |
| `expired` | Past grace period | RenewalScreen, billing blocked |
| `grace_expired` | Offline for 7+ days | Force online validation screen |
| `suspended` | Admin suspended | SuspendedScreen, no access |

---

## 20. Security Considerations

### API Key Protection
- `X-API-Key` is a static shared secret between app and server
- Stored in Electron app as `VITE_LICENSE_API_KEY` env variable
- Rotatable — update in Railway env vars and rebuild/redeploy the app
- Rate limited to 10 req/min per IP to prevent brute force

### JWT Tokens (Admin)
- Short expiry: 24 hours
- Stored only in `localStorage` on admin dashboard
- Never sent to the billing app
- Admin endpoints completely inaccessible without valid JWT

### Machine ID
- Hardware fingerprint using `node-machine-id`
- Not perfectly foolproof (can be spoofed with VM tools) but adequate for this use case
- Stored hashed in production database

### HTTPS Only
- All production communication over HTTPS
- Railway provides SSL automatically
- App enforces HTTPS in production via `allowedOrigins` check

### Data Minimization
- Heartbeat only sends aggregate counts — no customer names, amounts, or PII
- Admin dashboard shows usage stats but not actual business data

### License Key Format
- Cryptographically random using `crypto.randomBytes()`
- 16 uppercase alphanumeric chars = ~85 bits of entropy
- Cannot be guessed; must be issued by server

---

## 21. Troubleshooting

### App shows ActivationScreen even after activation

**Cause:** `license_cache` table may be empty or corrupted.

```bash
# Check via SQLite browser or run in app DevTools:
# Main process → check license_cache table directly
```

**Fix:** Re-enter the license key. If key works, the cache write is fixed automatically.

---

### `MACHINE_MISMATCH` error on a known good key

**Cause:** User is on a different computer or OS reinstall changed machine ID.

**Fix:**
```bash
# Reset machine lock via curl
curl -X POST $BASE/api/admin/licenses/LICENSE_ID/reset-machine \
  -H "Authorization: Bearer TOKEN"
```
Then re-activate on the new machine.

---

### Heartbeat not appearing in Railway logs

**Cause:** App is offline, or first heartbeat hasn't fired yet (fires 30s after launch).

**Check:** Look for heartbeat records in the `heartbeats` table:
```sql
SELECT * FROM heartbeats 
WHERE created_at > NOW() - INTERVAL '24 hours'
ORDER BY created_at DESC;
```

---

### Feature gates not working (all features unlocked regardless of plan)

**Cause:** `license_cache.features` is NULL or features are not being read correctly.

**Debug in DevTools console:**
```javascript
const state = await window.license.getState()
console.log(state.features)
```

If `features` is null, re-activate the license to force a fresh fetch from server.

---

### Server health check fails on Railway

**Steps:**
1. Check Railway logs for startup errors
2. Verify `DATABASE_URL` is correctly set in Railway variables
3. Check if migrations ran: `railway run npx drizzle-kit push`
4. Check if `PORT` env var is set to `3000`

---

### App crashes on startup related to LicenseManager

**Cause:** `VITE_LICENSE_SERVER_URL` not set or `node-machine-id` not installed.

**Fix:**
```bash
# Verify .env has the URL
cat .env | grep VITE_LICENSE_SERVER_URL

# Install missing package
npm install node-machine-id
```

---

### Admin login returns 401

**Cause:** JWT_SECRET may have changed after server redeploy, invalidating old tokens.

**Fix:** Log in again on the admin dashboard — a fresh token is issued.

---

## Appendix — License Key Generation Algorithm

```typescript
// src/services/licenseService.ts (server)

import crypto from 'crypto'

function generateLicenseKey(): string {
  const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789'
  const randomGroup = () =>
    Array.from(crypto.randomBytes(4))
      .map(b => chars[b % chars.length])
      .join('')

  return `SARVA-${randomGroup()}-${randomGroup()}-${randomGroup()}-${randomGroup()}`
}

// Ensure uniqueness before returning
async function createUniqueKey(): Promise<string> {
  let key: string
  let exists = true

  while (exists) {
    key = generateLicenseKey()
    const record = await db.query.licenses.findFirst({ where: eq(licenses.key, key) })
    exists = !!record
  }

  return key
}
```

---

*Sarva One License Management System — Technical Reference v1.0*
*Developed by Sultan Kabadi — sultanbk.com*
