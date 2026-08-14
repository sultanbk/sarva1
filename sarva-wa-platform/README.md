# Sarva One - WhatsApp eCommerce Platform

This is the cloud-native, multi-tenant bot server that powers WhatsApp eCommerce transactions. It processes Meta cloud webhook payloads, manages catalog search and interactive shopping carts, facilitates Razorpay payment link checkouts, and handles order synchronization with the desktop billing POS.

---

## Technical Stack

- **Runtime**: Node.js v22 (Express.js)
- **Database**: Built-in `node:sqlite` (using `DatabaseSync` for synchronous local execution)
- **WhatsApp Integration**: Official Meta Cloud API (Interactive List Messages & Buttons)
- **Payment Gateway**: Razorpay Payment Links API

---

## Directory Map

```
src/
├── config.ts          # Environment variables & constants
├── db/                # node:sqlite migrations, connection, and repo classes
│   ├── tenant.repo.ts
│   ├── catalog.repo.ts
│   ├── order.repo.ts
│   └── session.repo.ts
├── flows/             # State-machine dialog flows (browse, cart, checkout, welcome)
├── handlers/          # Webhook routing & signature validation
├── routes/            # REST API endpoints (webhook, catalog sync, orders)
├── services/          # Razorpay & WhatsApp API integration services
└── types/             # Shared TypeScript structures
```

---

## API Endpoints Reference

All endpoints (except webhook and health check) require a header for authentication:
- **`x-api-key`**: The tenant's API key.
- Alternatively, **`Authorization: Bearer <API_KEY>`**.

### 1. Catalog Sync
- **Endpoint**: `POST /api/sync/catalog`
- **Description**: Replaces or updates the tenant's online catalog.
- **Payload**:
  ```json
  {
    "products": [
      {
        "posProductId": 42,
        "name": "Silk Saree",
        "description": "Premium mulberry silk",
        "category": "Sarees",
        "price": 1200.0,
        "mrp": 1500.0,
        "stock": 10,
        "imageUrl": "https://example.com/saree.jpg"
      }
    ]
  }
  ```

### 2. Retrieve Orders
- **Endpoint**: `GET /api/sync/orders`
- **Parameters**:
  - `status`: Filter by status (e.g. `pending`, `confirmed`, `dispatched`, `delivered`, `cancelled`).
  - `since`: ISO timestamp for incremental fetch.

### 3. Order Count
- **Endpoint**: `GET /api/sync/orders/count`
- **Parameters**:
  - `status`: e.g. `pending` (used to query pending count badge).

### 4. Update Status
- **Endpoint**: `PUT /api/sync/orders/:orderNo/status`
- **Description**: Transitions order states (`confirmed`, `shipped`, `packed`, `dispatched`, `delivered`, `cancelled`) and triggers corresponding WhatsApp status notification alerts to the customer.

### 5. Onboard Tenant
- **Endpoint**: `POST /api/sync/onboard`
- **Headers**: `x-server-secret`: Internal cluster master key.
- **Description**: Registers a new shop with their Meta access tokens and Razorpay credentials.

---

## Local Setup

1. Copy `.env.example` to `.env` and configure credentials:
   ```bash
   PORT=8000
   DB_PATH=./data/sarva_wa.db
   INTERNAL_API_SECRET=your-internal-key
   SYNC_API_KEY=your-pos-sync-key
   ```
2. Install dependencies:
   ```bash
   npm install
   ```
3. Run development mode:
   ```bash
   npm run dev
   ```

---

_Developed for the Sarva One eCommerce Suite_
