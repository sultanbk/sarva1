# KPT Billing — System Requirements Specification (SRS)

> **Product:** KPT Billing (Sarva One Billing)  
> **Version:** 5.1.1  
> **Author:** Sultan Kabadi ([sultanbk.com](https://sultanbk.com))  
> **Date:** July 2026  
> **Status:** Production Ready

---

## Table of Contents

1. [Introduction](#1-introduction)
2. [System Architecture](#2-system-architecture)
3. [Functional Requirements](#3-functional-requirements)
    - 3.1 Point of Sale (Billing)
    - 3.2 Product & Inventory Management
    - 3.3 Customer Management
    - 3.4 Credit Management
    - 3.5 Purchase & Stock-In
    - 3.6 Supplier Management
    - 3.7 Reporting & Analytics
    - 3.8 PDF Generation
    - 3.9 Thermal Printing
    - 3.10 Barcode Support
    - 3.11 WhatsApp Integration
    - 3.12 Data Export
    - 3.13 Backup & Restore
    - 3.14 Security & Access Control
    - 3.15 Estimates & Quotations
    - 3.16 Expense Tracking
    - 3.17 Audit Trail
    - 3.18 Licensing & Plan Gating
    - 3.19 Application Updates
4. [Non-Functional Requirements](#4-non-functional-requirements)
5. [Technical Requirements](#5-technical-requirements)
6. [Database Schema](#6-database-schema)
7. [User Roles & Permissions](#7-user-roles--permissions)
8. [Licensing & Plan Tiers](#8-licensing--plan-tiers)
9. [Integration Requirements](#9-integration-requirements)
10. [Performance Requirements](#10-performance-requirements)
11. [Security Requirements](#11-security-requirements)
12. [Deployment Requirements](#12-deployment-requirements)
13. [Glossary](#13-glossary)

---

## 1. Introduction

### 1.1 Purpose

KPT Billing is an **offline-first desktop billing, inventory, purchase, credit, reporting, printing, and backup system** built for retail businesses. It is designed for fast shop-counter billing on Windows while keeping all business data local and fully functional without an internet connection.

This document defines the complete system requirements for KPT Billing, serving as the authoritative reference for customers evaluating the product, developers building and maintaining the system, and the official website content.

### 1.2 Product Scope

KPT Billing serves the following retail verticals:

- Textile / Garment POS
- Pharmacy POS
- Grocery POS
- Electronics POS
- Hardware Store POS
- Wholesale Distribution POS
- Bakery POS
- Restaurant POS (with additional restaurant-specific workflows)

The primary deployment is **Krishnapriya Textiles**, and the software is designed for single-shop or multi-user (staff-managed) retail operations.

### 1.3 Target Audience

| Audience | How They Use This Document |
|---|---|
| **Customers / Shop Owners** | Evaluate whether KPT Billing meets their business needs |
| **Developers & Engineers** | Understand the architecture, modules, and technical specifications |
| **QA & Testing Teams** | Derive test cases from functional requirements |
| **Marketing & Website** | Extract feature descriptions and capability statements |

### 1.4 Key Design Principles

| Principle | Description |
|---|---|
| **Offline-First** | All core features work without internet. Cloud features are optional add-ons. |
| **Billing-Never-Stops** | The POS billing flow must never be blocked by licensing, network failures, or non-critical features. |
| **Data Privacy** | All business data stays in local SQLite. No customer data leaves the shop without explicit action. |
| **Role-Based Security** | PIN-protected access with Owner, Manager, and Cashier roles. |
| **Local-First Licensing** | License validation caches locally for offline operation with tamper detection. |

---

## 2. System Architecture

### 2.1 High-Level Architecture

```
┌─────────────────────────────────────────────────────────────┐
│                    Electron Desktop App                      │
│  ┌─────────────────────────────────────────────────────────┐│
│  │                Main Process (Node.js)                    ││
│  │  ┌───────────┐  ┌──────────────┐  ┌──────────────────┐  ││
│  │  │  SQLite   │  │   IPC        │  │    Services      │  ││
│  │  │  Database │  │   Handlers   │  │  - Printing      │  ││
│  │  │ (better-  │  │  (Zod Valid.)│  │  - PDF Gen       │  ││
│  │  │  sqlite3) │  │              │  │  - Backup        │  ││
│  │  └───────────┘  └──────┬───────┘  │  - License       │  ││
│  │                         │          │  - Updates       │  ││
│  │                         │          │  - Export        │  ││
│  │                         │          └──────────────────┘  ││
│  └─────────────────────────┼───────────────────────────────┘│
│                            │ IPC                             │
│  ┌─────────────────────────┼───────────────────────────────┐│
│  │              Preload Bridge (contextBridge)              ││
│  │              window.api + window.license                 ││
│  └─────────────────────────┼───────────────────────────────┘│
│                            │                                 │
│  ┌─────────────────────────┼───────────────────────────────┐│
│  │               Renderer Process (React)                  ││
│  │  ┌──────────┐  ┌────────────┐  ┌────────────────────┐  ││
│  │  │  Pages   │  │  Services  │  │  Stores (Zustand)  │  ││
│  │  │ - Billing│  │  (API      │  │  - BillingStore    │  ││
│  │  │ - Prod.  │  │   Wrappers)│  │  - AuthStore       │  ││
│  │  │ - Reports│  │            │  │  - LicenseStore    │  ││
│  │  │ - etc.   │  └────────────┘  └────────────────────┘  ││
│  │  └──────────┘                                           ││
│  └─────────────────────────────────────────────────────────┘│
└─────────────────────────────────────────────────────────────┘
```

### 2.2 Technology Stack

| Layer | Technology | Purpose |
|---|---|---|
| **Desktop Shell** | Electron 39 | Cross-platform desktop runtime |
| **Build Tooling** | electron-vite 5, Vite 7 | Fast development and build pipeline |
| **UI Framework** | React 19 | Component-based user interface |
| **Language** | TypeScript 5.9 | Type-safe development |
| **Styling** | Tailwind CSS 4 | Utility-first CSS framework |
| **UI Components** | Radix UI primitives | Accessible, headless UI components |
| **State Management** | Zustand + Immer | Lightweight reactive state |
| **Database** | SQLite via better-sqlite3 | Local relational database |
| **ORM** | Drizzle ORM | Type-safe query builder (documentation/schema support) |
| **Validation** | Zod 4 | Runtime type validation for IPC boundaries |
| **Charts** | Recharts | SVG-based data visualization |
| **Virtualization** | @tanstack/react-table + @tanstack/react-virtual | High-performance large-list rendering |
| **Testing** | Vitest, React Testing Library, Playwright | Unit, integration, and E2E testing |
| **Packaging** | electron-builder | Windows (NSIS/Squirrel), macOS (DMG), Linux (AppImage) |

### 2.3 Data Flow

```
React Pages → Renderer Services → window.api (Preload) →
  IPC (Zod Validation) → Main Process Handlers →
    Database Repositories (SQLite)
```

All business logic that touches the database, filesystem, printers, or network runs in the main process. The renderer never directly accesses the database or native APIs.

### 2.4 Runtime Boundaries

| Process | Responsibilities |
|---|---|
| **Main Process** | SQLite connection, IPC handlers, filesystem access, printer/PDF jobs, audit logging, license validation, network calls (update checks, cloud backup) |
| **Preload Bridge** | Typed window.api surface, IPC event subscription cleanup, no business logic |
| **Renderer Process** | UI rendering, user interaction, view state (Zustand stores), service wrappers |

---

## 3. Functional Requirements

### 3.1 Point of Sale (Billing)

The core billing system is the primary interface. It must always be accessible without authentication.

| ID | Requirement | Priority |
|---|---|---|
| POS-01 | **Product Search** — Search by name, SKU, or short name with real-time dropdown results (max 15 items) | Critical |
| POS-02 | **Barcode Scanning** — Auto-detect rapid sequential keystrokes (<80–100ms interval, min 4 chars) as barcode input and instantly add product to cart | Critical |
| POS-03 | **Weighted Barcode Parsing** — Parse EAN-13 weighted barcodes (prefixes 20–29) with 3-decimal quantity extraction for fabric/weighing scales | High |
| POS-04 | **Hands-Free Scanner Mode** — Auto-refocus search input every 500ms with audio scan beep for scanner-only checkout | High |
| POS-05 | **Shopping Cart** — Add, remove, update quantities (fractional decimals supported), per-item discount (% or flat), editable prices | Critical |
| POS-06 | **Custom Items** — Add unlisted ("Other") items with custom name, price, and unit selector | High |
| POS-07 | **Customer Association** — Search and link a customer or quick-add (Alt+N) inline | High |
| POS-08 | **Bill-Level Discount** — Apply percentage or flat discount to entire bill before tax | High |
| POS-09 | **Coupon Code Support** — Apply coupon codes with configurable rules (discount type, min bill amount, usage limits) | Medium |
| POS-10 | **GST Calculation** — Automatic CGST + SGST split based on product GST rate (0/5/12/18/28%) and HSN code | Critical |
| POS-11 | **GST Calculation Options** — Support both tax-inclusive and tax-exclusive pricing models | High |
| POS-12 | **Loyalty & Occasion Discounts** — Auto-check and apply Gold (5%) / Platinum (10%) tier discounts and Birthday/Anniversary (10%) discounts | High |
| POS-13 | **Payment Modes** — Cash (with tendered amount and change calculation), UPI (with reference number), Card, Credit, and Mixed (split across modes) | Critical |
| POS-14 | **Hold / Recall Bills** — Park in-progress bills (F6) and recall later (F8), persisted to database | Medium |
| POS-15 | **Round-Off** — Configurable rounding: none, round to ₹1, round to ₹0.50 | Medium |
| POS-16 | **Bill Numbering** — Auto-generated sequential format: `KPT/{FY}/0001` (financial-year scoped) | Critical |
| POS-17 | **Bill Status** — Completed, Returned, or Cancelled lifecycle | High |
| POS-18 | **Auto Print** — Configurable auto-print of receipt on bill completion | Medium |
| POS-19 | **Keyboard Shortcuts** — Full keyboard navigation: F2 (Billing), Esc (search focus), F6 (Hold), F8 (Recall), F9 (Clear), F11 (Pay) | High |
| POS-20 | **Plan Limit Awareness** — Hold-bill action warns at 80% of monthly bill limit and disables when limit reached | High |
| POS-21 | **Return & Exchange** — Process returns/exchanges with stock restoration, refund processing, proportional GST recalculation | High |

### 3.2 Product & Inventory Management

| ID | Requirement | Priority |
|---|---|---|
| PRD-01 | **Full CRUD** — Create, update (with price history logging), soft-delete products | Critical |
| PRD-02 | **Product Fields** — Name, short name, SKU (auto-generated unique), barcode, category, HSN code, purchase/selling/wholesale price, GST rate, stock (opening + current), low stock alert, location, color, size, material, supplier, image, brand, unit (pcs/mtr/kg), notes | Critical |
| PRD-03 | **SKU Auto-Generation** — Unique SKU generation that avoids collisions after deletes and imports | Critical |
| PRD-04 | **Category Management** — Hierarchical categories with parent/child support, inline CRUD management dialog, product count display | High |
| PRD-05 | **Product Filters & Sorting** — Collapsible filter panel: Category, Supplier, GST Rate, Stock Status (All/In Stock/Low Stock/Out of Stock), Active Status, Page Size. Sort by Name, SKU, Stock, Cost/Selling Price | High |
| PRD-06 | **Stock Tracking** — Auto-managed current stock with movement tracking (sale, purchase, adjustment, return, damage, opening) | Critical |
| PRD-07 | **Stock Adjustment** — Manual adjustments with reason tracking | High |
| PRD-08 | **Stock Ledger** — Complete per-product movement audit trail with reference type and ID | Critical |
| PRD-09 | **Bulk Stock Update** — Spreadsheet-like dialog for inline editing multiple product stock quantities | Medium |
| PRD-10 | **Stock Valuation** — Calculate total inventory value at cost price and selling price with margin | Medium |
| PRD-11 | **Price History** — Full audit trail of all price changes with before/after values and who changed them | High |
| PRD-12 | **Bulk Import** — Import products from CSV or Excel with auto-SKU generation, existing product matching by barcode/name | High |
| PRD-13 | **Negative Stock Guard** — Stock cannot go negative unless `allowNegativeStock` is explicitly enabled | Critical |
| PRD-14 | **Plan Limit Awareness** — Add Product action warns at 80% of product limit and disables when limit reached | High |

### 3.3 Customer Management

| ID | Requirement | Priority |
|---|---|---|
| CUS-01 | **Full CRUD** — Create, update, delete customers (delete blocked if linked bills exist) | Critical |
| CUS-02 | **Customer Fields** — Name, phone (unique), email, address, city, GSTIN, customer type (regular/wholesale/walk-in), loyalty tier (silver/gold/platinum), birthday, anniversary, credit limit, opening balance, current balance | Critical |
| CUS-03 | **Search** — Real-time search by name or phone number | Critical |
| CUS-04 | **Quick Add** — Inline creation from billing page (Alt+N) with name + phone only | High |
| CUS-05 | **Bill History** — View all bills for a specific customer | High |
| CUS-06 | **Loyalty Points** — Earn points on paid bills and redeem as discounts, with per-bill toggle | Medium |
| CUS-07 | **Loyalty Ledger** — Full earn/redeem/reversal points history with running balance | Medium |
| CUS-08 | **Loyalty Expiry** — Configurable points expiry with auto-sweep on startup and warning notifications | Medium |
| CUS-09 | **Loyalty Receipts** — Per-element toggle control for earned/redeemed/balance on thermal and PDF receipts | Medium |
| CUS-10 | **WhatsApp Notifications** — Loyalty earn confirmations, expiry warnings, and redemption receipts | Medium |
| CUS-11 | **CSV Import** — Bulk customer import/upsert from CSV | Medium |
| CUS-12 | **Customer Analytics** — Top customers by revenue, purchase frequency, credit risk scoring (licence-gated) | Medium |

### 3.4 Credit Management

| ID | Requirement | Priority |
|---|---|---|
| CRT-01 | **Credit Issuance** — Bills paid via Credit mode update customer's outstanding balance | Critical |
| CRT-02 | **Credit Limits** — Per-customer credit limit with utilization tracking | High |
| CRT-03 | **Payment Recording** — Record credit payments with mode (cash/UPI/card/cheque/bank transfer), reference number, and notes | Critical |
| CRT-04 | **Credit Ledger** — Chronological ledger of all credit issued and payments received with running balance | High |
| CRT-05 | **Balance Tracking** — Before/after balance on every transaction | High |
| CRT-06 | **Credit Aging Report** — Aging buckets: Current (0–30), 31–60, 61–90, 90+ days (licence-gated) | Medium |
| CRT-07 | **Credit Risk Scoring** — Credit utilization % with risk levels: None, Low, Medium, High | Medium |
| CRT-08 | **Collection Summary** — Total collections by date range | Medium |
| CRT-09 | **WhatsApp Reminders** — Send overdue credit reminders (licence-gated) | Medium |
| CRT-10 | **Credit Risk Analysis** — Customer analytics including credit risk analysis (licence-gated) | Low |

### 3.5 Purchase & Stock-In

| ID | Requirement | Priority |
|---|---|---|
| PUR-01 | **Purchase Entry** — Create purchase orders with full line items from suppliers | Critical |
| PUR-02 | **Line Items** — Product, barcode, HSN code, quantity, purchase rate, selling rate, MRP, GST rate/amount | Critical |
| PUR-03 | **Supplier Search / Create** — Search existing suppliers or inline creation during purchase entry | High |
| PUR-04 | **Invoice Tracking** — Supplier invoice number and date capture | High |
| PUR-05 | **City Tracking** — Track supply source city (Surat, Bengaluru, etc.) | Medium |
| PUR-06 | **Payment Status** — Paid, Unpaid, or Partial tracking | High |
| PUR-07 | **Auto Stock Update** — Stock and stock ledger auto-updated on purchase creation (increment) | Critical |
| PUR-08 | **Auto Price Update** — Optional update of product selling rates from purchase rates | Medium |
| PUR-09 | **Barcode Scanner** — Scan product barcodes during purchase entry for quick lookup | Medium |
| PUR-10 | **Purchase Numbering** — Auto-sequential: `PUR/0001` | High |
| PUR-11 | **Purchase History** — View all purchases filterable by date and supplier | High |

### 3.6 Supplier Management

| ID | Requirement | Priority |
|---|---|---|
| SUP-01 | **Full CRUD** — Create, read, update, delete suppliers | High |
| SUP-02 | **Supplier Fields** — Name, phone, email, address, city, GSTIN, bank details | High |
| SUP-03 | **City-Based Grouping** — Group and filter suppliers by city | Medium |
| SUP-04 | **Supplier Search** — Quick search by name during purchase entry | High |
| SUP-05 | **Linked Purchases** — View all purchase orders from a supplier | Medium |

### 3.7 Reporting & Analytics

| ID | Requirement | Priority |
|---|---|---|
| RPT-01 | **Daily Report** — Sales summary for a date: total sales, bill count, discount, avg bill value, payment breakdown, bills table (virtualized) | Critical |
| RPT-02 | **Weekly Report** — 7-day rolling summary with daily breakdown and top 10 products | High |
| RPT-03 | **Monthly Report** — Month summary with daily breakdown and payment trends | High |
| RPT-04 | **Yearly Report** — Year summary with monthly breakdown | Medium |
| RPT-05 | **GST Report** — HSN-wise summary, rate-wise breakdowns (5/12/18/28%), GSTR-1 invoice list with all tax details (licence-gated) | High |
| RPT-06 | **Profit & Loss Report** — Revenue, COGS, gross profit, expenses by category, net profit, profit margins (licence-gated) | Medium |
| RPT-07 | **Customer Analytics** — Top customers by revenue, purchase frequency, credit risk analysis (licence-gated) | Medium |
| RPT-08 | **Credit Aging** — Overdue buckets with summary and WhatsApp reminders (licence-gated) | Medium |
| RPT-09 | **Dashboard** — Real-time stats (auto-refresh 60s): today's sales vs yesterday, week/month totals, payment breakdown, top sellers, low stock, estimated net profit, sales goal progress | Critical |
| RPT-10 | **Bill Detail View** — Full bill view from any report with Print/PDF/Return/Cancel actions | High |
| RPT-11 | **PDF Export** — All reports exportable to PDF | High |
| RPT-12 | **Virtualized Rendering** — Bill history lists must use React Virtual for smooth 60fps scrolling with hundreds of items | High |

### 3.8 PDF Generation

| ID | Requirement | Priority |
|---|---|---|
| PDF-01 | **A4 Professional Invoices** — Full-page invoices with shop header (name, address, GSTIN, phone), bill metadata, customer details, itemized table, tax breakup, grand total in words (Indian numbering), payment details, authorized-by footer | Critical |
| PDF-02 | **PDF Invoices with Return Details** — Show return annotations on items and Returns/Exchanges section with recalculated totals | High |
| PDF-03 | **Report PDFs** — Summary cards, payment breakdown, top products, bill listings | High |
| PDF-04 | **Generation Method** — Hidden BrowserWindow renders HTML template, then `printToPDF()` for accurate layout | Medium |

### 3.9 Thermal Printing

| ID | Requirement | Priority |
|---|---|---|
| THR-01 | **ESC/POS Protocol** — Direct raw printing to 80mm thermal printers using ESC/POS commands | Critical |
| THR-02 | **Compatible Printers** — TVS RP 3000 Lite and other ESC/POS-compatible printers | Critical |
| THR-03 | **Receipt Format** — 48-character width: shop header (centered), bill info, itemized list, totals, payment details, custom footer | Critical |
| THR-04 | **Thermal Receipt with Returns** — Show "** RETURNED **" annotations and Returns/Exchanges section with recalculated totals | High |
| THR-05 | **Paper Width Profiles** — Configurable: 58mm, 72mm, 80mm | Medium |
| THR-06 | **Auto Print** — Optional auto-print on bill completion | Medium |
| THR-07 | **Z-Report Thermal Print** — Generate and print end-of-day Z-Reports with cash tally, credit collection, and expense summaries | Medium |
| THR-08 | **Test Print** — Send test page from Settings to verify printer setup | Medium |
| THR-09 | **Printer Selection** — Choose from system-detected printers | Medium |
| THR-10 | **Printer Diagnostics** — Check spooler state, port connectivity, and offline status | Medium |
| THR-11 | **Barcode Label Printing** — Print product barcode labels on thermal label printers with configurable dimensions, fonts, and alignment | High |

### 3.10 Barcode Support

| ID | Requirement | Priority |
|---|---|---|
| BAR-01 | **Barcode Scanning** — Auto-detect rapid sequential keystrokes as barcode input | Critical |
| BAR-02 | **Barcode Generation** — Generate barcodes for products using bwip-js | High |
| BAR-03 | **Barcode Label Configuration** — Full customization: content visibility toggles (shop name, product name, MRP, selling price, discount), dimensions (width 50–100%, height 3–15mm), font sizes (6–20pt), alignment, margins, gap size, SKU text toggle | High |
| BAR-04 | **Printer Calibration** — Configurable X/Y offset (-5mm to +5mm) for physical alignment | Medium |
| BAR-05 | **Live Barcode Preview** — Real-time visual mockup reflecting all setting changes | Medium |
| BAR-06 | **Test Print Label** — One-click sample label print with current settings | Medium |
| BAR-07 | **MRP Strikethrough** — High-contrast vector line overlay for thermal compatibility | Medium |

### 3.11 WhatsApp Integration

| ID | Requirement | Priority |
|---|---|---|
| WHA-01 | **Bill Receipt** — Send full itemized bill as WhatsApp message via `wa.me` URL | Medium |
| WHA-02 | **Credit Reminder** — Send outstanding balance notification to overdue customers | Medium |
| WHA-03 | **Payment Confirmation** — Payment received acknowledgment with remaining balance | Medium |
| WHA-04 | **Phone Number Format** — Automatic +91 prefix for Indian numbers | Medium |
| WHA-05 | **Plan Gating** — WhatsApp actions hidden when plan does not include integration (licence-gated) | Medium |
| WHA-06 | **Loyalty Notifications** — Earn confirmations, expiry warnings, redemption receipts | Low |

### 3.12 Data Export

| ID | Requirement | Priority |
|---|---|---|
| EXP-01 | **Daily Report Export** — Summary sheet + all bills for a date as `.xlsx` (licence-gated) | Medium |
| EXP-02 | **Bill History Export** — All bills with full details for a date range (licence-gated) | Medium |
| EXP-03 | **Stock Report Export** — Complete inventory + low stock items (licence-gated) | Medium |
| EXP-04 | **Customer Report Export** — All customers with credit details (licence-gated) | Medium |
| EXP-05 | **Full Data Export** — Bills, items, products, customers, payments, purchases, expenses, stock ledger — everything (licence-gated) | Medium |

### 3.13 Backup & Restore

| ID | Requirement | Priority |
|---|---|---|
| BAK-01 | **Binary Hot Backup** — Full database backup via SQLite `.backup()` (safe on live WAL database, no locks) | Critical |
| BAK-02 | **Detached Signature** — Companion `.sig` file (machine ID + HMAC-SHA256) for integrity verification | High |
| BAK-03 | **Auto-Backup** — Configurable frequency: hourly, every 4 hours, or daily. Runs shortly after startup. | High |
| BAK-04 | **Retention** — Age-based retention (default 30 days), newest backup always kept | Medium |
| BAK-05 | **Restore** — Restore from signed `.db` (signature + integrity validated) or legacy `.sql` dump. Auto-creates safety backup before restore. | Critical |
| BAK-06 | **Cross-Machine Restore Warnings** — Warn when restoring backup from a different machine | Medium |
| BAK-07 | **Failure Alerts** — Toast notification on automatic backup failure | Medium |
| BAK-08 | **Cloud Backup (Google Drive)** — OAuth2-based upload/download/list/disconnect for Google Drive | Medium |
| BAK-09 | **Open Folders** — Quick access to backups, receipts, and reports folders from Settings | Low |

### 3.14 Security & Access Control

| ID | Requirement | Priority |
|---|---|---|
| SEC-01 | **PIN-Based Authentication** — 4–8 digit numeric PIN with on-screen number pad | Critical |
| SEC-02 | **Role-Based Access Control** — Owner, Manager, and Cashier roles with permission hierarchy | Critical |
| SEC-03 | **Protected Pages** — Dashboard, Products, Purchases, Customers, Reports, Analytics, Settings require PIN | Critical |
| SEC-04 | **Billing Always Accessible** — POS billing page requires no authentication so cashier can always bill | Critical |
| SEC-05 | **Lock Screen** — Lock app (Ctrl+L / Alt+L) with clock/date display, requires PIN to unlock | High |
| SEC-06 | **Security Toggle** — Option to fully disable security/PIN for store owners who want open access | High |
| SEC-07 | **Staff Management** — Owner-only tab: add/edit/deactivate/delete staff, reset PINs, role assignment | High |
| SEC-08 | **Protection Against Self-Lockout** — Cannot delete own account; last remaining owner cannot be deleted | High |
| SEC-09 | **PIN Hashing** — Salted scrypt format, with legacy SHA-256 migration on successful verification | Critical |
| SEC-10 | **Audit Logging** — All significant actions logged with user, action, entity, old/new values, timestamp | High |

### 3.15 Estimates & Quotations

| ID | Requirement | Priority |
|---|---|---|
| EST-01 | **Create Estimates** — Itemized quotations with product details, quantities, prices | Medium |
| EST-02 | **Estimate Numbering** — Auto-generated sequential numbers | Medium |
| EST-03 | **Validity Period** — Default 15 days, configurable | Low |
| EST-04 | **Status Tracking** — Active, Converted (to bill), Expired | Low |
| EST-05 | **Convert to Bill** — One-click conversion from estimate to bill | Medium |
| EST-06 | **Customer Details** — Name and phone captured on estimate | Medium |

### 3.16 Expense Tracking

| ID | Requirement | Priority |
|---|---|---|
| EXPT-01 | **Record Expenses** — Date, category, amount, description, payment mode | High |
| EXPT-02 | **Expense Categories** — Rent, Electricity, Salary, Transport, Packaging, Maintenance, Tea/Food, Marketing, Other | High |
| EXPT-03 | **Full CRUD** — Create, view, update, delete expenses | High |
| EXPT-04 | **Date Filtering** — View by specific date or date range | Medium |
| EXPT-05 | **Category Summary** — Category-wise expense breakdown integrated into P&L Report | Medium |
| EXPT-06 | **Dashboard Integration** — Today's expenses with net income calculation | High |

### 3.17 Audit Trail

| ID | Requirement | Priority |
|---|---|---|
| AUD-01 | **Audit Log** — Every significant action recorded: user, action type, entity type, entity ID, old/new values (JSON), timestamp | Critical |
| AUD-02 | **Stock Ledger** — Every stock movement logged with reference (sale, purchase, adjustment, return, damage) | Critical |
| AUD-03 | **Price History** — Every price change (purchase/selling/wholesale) recorded with before/after values and user | High |
| AUD-04 | **Credit Ledger** — Every credit transaction logged with running balance | High |
| AUD-05 | **Audit Log Actions** — login, logout, bill_created, bill_deleted, product_created/updated/deleted, customer_created, credit_payment, user_created/updated, activate, deactivate, reset_pin, delete, settings_updated, backup_created, backup_restored | High |

### 3.18 Licensing & Plan Gating

| ID | Requirement | Priority |
|---|---|---|
| LIC-01 | **Activation Screen** — Accept `SARVA-XXXX-XXXX-XXXX-XXXX` format licence keys | Critical |
| LIC-02 | **Server Validation** — Validate licence with remote server, cache valid state locally | Critical |
| LIC-03 | **Offline Fallback** — Fall back to local `license_cache` when server unavailable, with grace period | Critical |
| LIC-04 | **Tamper Detection** — JWT-signed licence response; deep equality check between DB columns and JWT payload on boot | Critical |
| LIC-05 | **Clock Rollback Protection** — Detect clock rollback attempts | Critical |
| LIC-06 | **Licence States** — Not activated, Trial, Active, Grace, Expired, Suspended, Grace Expired | Critical |
| LIC-07 | **Plan Tiers** — Starter, Growth, Pro, Custom with different feature sets and limits | Critical |
| LIC-08 | **Feature Gates** — `FeatureGate` component controls premium pages/sections (P&L, Customer Analytics, Credit Aging, Data Export, WhatsApp) | High |
| LIC-09 | **Limit Gates** — `LimitGate` component shows 80% usage warning and disables actions at limit (max bills/month, max products, max customers) | High |
| LIC-10 | **Status Bar** — Visual indicator showing trial/active/grace/expired/suspended state | Medium |
| LIC-11 | **Upgrade Prompts** — Locked features show plan comparison and WhatsApp upgrade CTA | Medium |
| LIC-12 | **Heartbeat** — Send app version and usage counts to licence server every 6 hours (active online) | Low |
| LIC-13 | **Grace Period** — Configurable offline/expired grace window (default 7 days) | Medium |
| LIC-14 | **Feature Flag Definitions** — profitLossReport, customerAnalytics, creditAging, dataExport, whatsappIntegration, creditManagement, expenseTracking, estimates, returnExchange, barcodeLabels, googleDriveBackup, auditTrail, gstReports, multiUser; numeric limits: maxBillsPerMonth, maxProducts, maxCustomers, maxUsers | High |

### 3.19 Application Updates

| ID | Requirement | Priority |
|---|---|---|
| UPD-01 | **Automatic Update Checks** — Check for updates every 4 hours using electron-updater | Critical |
| UPD-02 | **GitHub Releases Backend** — Updates served through GitHub Releases | Critical |
| UPD-03 | **Silent Background Download** — Download updates silently in background with progress tracking | High |
| UPD-04 | **Download Progress UI** — Show speed (MB/s) and ETA in Settings UI | Medium |
| UPD-05 | **Update State Machine** — Idle → Checking → Available → Downloading → Downloaded → Ready → Installing. Handle errors at every transition | Critical |
| UPD-06 | **Network Retry** — Exponential backoff for update checks: 3 attempts (2s, 5s, 15s) | High |
| UPD-07 | **Beta/Pre-Release Channel** — Toggle between stable and beta update feeds in Settings | Medium |
| UPD-08 | **Rollback** — Store previous version on update; in-app rollback to download and reinstall previous version | High |
| UPD-09 | **Version-Gated Migrations** — Database migrations with `minAppVersion` requirement checks | Critical |
| UPD-10 | **Draft Release Gate** — Releases created as drafts with human review gate before clients see them | High |
| UPD-11 | **Tag-Version Match Validation** — CI pipeline validates git tag matches package.json version before building | High |

---

## 4. Non-Functional Requirements

| ID | Requirement | Target |
|---|---|---|
| NFR-01 | **Offline Operation** — All core features (billing, inventory, customers, printing) must function without internet | 100% availability for core features |
| NFR-02 | **Startup Time** — Application must be ready for billing within 5 seconds of launch on modern hardware | ≤5 seconds |
| NFR-03 | **Bill Creation Latency** — Bill save + print must complete within 3 seconds | ≤3 seconds |
| NFR-04 | **Search Response** — Product/customer search must respond within 300ms of last keystroke | ≤300ms |
| NFR-05 | **Report Load Time** — Daily/monthly reports must load within 2 seconds for up to 1,000 bills | ≤2 seconds |
| NFR-06 | **Concurrent Users** — Support single-user and multi-user (up to 10 staff accounts) | 10 users |
| NFR-07 | **Database Size** — Support up to 100,000 bills and 50,000 products without performance degradation | 100K bills / 50K products |
| NFR-08 | **Data Integrity** — No data loss on power failure (WAL journal mode, atomic commits) | Zero data loss |
| NFR-09 | **Backup Reliability** — Hot backup must never corrupt or block active database operations | Concurrent-safe |
| NFR-10 | **Billing Availability** — Billing must never be blocked by licence server unavailability, network failures, printer errors, or non-critical feature failures | 100% billing uptime |
| NFR-11 | **Memory Usage** — Idle memory usage ≤ 200MB, peak ≤ 500MB | ≤200MB idle / ≤500MB peak |
| NFR-12 | **Storage** — Database + attachments ≤ 2GB for typical 5-year usage | ≤2GB |

---

## 5. Technical Requirements

### 5.1 Hardware Requirements

| Component | Minimum | Recommended |
|---|---|---|
| **CPU** | Dual-core 2.0 GHz | Quad-core 2.5 GHz+ |
| **RAM** | 2 GB | 4 GB+ |
| **Storage** | 500 MB free | 2 GB free (SSD preferred) |
| **Display** | 1366 × 768 | 1920 × 1080 |
| **OS** | Windows 10 (64-bit) | Windows 11 |
| **Printer** | ESC/POS-compatible thermal printer (80mm) | TVS RP 3000 Lite or equivalent |
| **Optional** | Barcode scanner, weighing scale | USB/Bluetooth barcode scanner |

### 5.2 Software Dependencies

| Dependency | Version | Purpose |
|---|---|---|
| Node.js | 18+ (bundled with Electron) | Runtime |
| Electron | 39.x | Desktop shell |
| SQLite | 3.x (via better-sqlite3) | Database engine |

### 5.3 Network Requirements

| Scenario | Requirement |
|---|---|
| **Offline Billing** | No network required |
| **License Activation** | Internet (one-time, optionally periodic) |
| **Cloud Backup** | Internet (on-demand only) |
| **Auto-Updates** | Internet (periodic, configurable) |
| **WhatsApp Integration** | Internet (opens via wa.me link) |

---

## 6. Database Schema

### 6.1 Database Configuration

| Setting | Value |
|---|---|
| Engine | SQLite 3 (better-sqlite3) |
| Journal Mode | WAL (Write-Ahead Logging) |
| Synchronous | NORMAL |
| Foreign Keys | ON |
| Busy Timeout | 5000ms |
| Cache Size | 20MB |
| Temp Store | MEMORY |
| File Location | `{userData}/kpt_billing.db` |

### 6.2 Tables

| Table | Purpose | Key Relationships |
|---|---|---|
| `settings` | Key-value application configuration | — |
| `categories` | Product categories (hierarchical) | `parent_id` → self |
| `products` | Master product catalog | `category_id` → categories, `supplier_id` → suppliers |
| `customers` | Customer master with credit tracking | — |
| `suppliers` | Supplier master data | — |
| `bills` | Sales bills (financial-year scoped numbering) | `customer_id` → customers |
| `bill_items` | Bill line items | `bill_id` → bills, `product_id` → products |
| `bill_returns` | Return/exchange records | `bill_id` → bills |
| `bill_return_items` | Returned line items | `return_id` → bill_returns |
| `purchases` | Purchase orders | `supplier_id` → suppliers |
| `purchase_items` | Purchase line items | `purchase_id` → purchases, `product_id` → products |
| `stock_ledger` | Stock movement audit trail | `product_id` → products |
| `credit_payments` | Customer credit payments | `customer_id` → customers |
| `expenses` | Business expense records | — |
| `estimates` | Customer quotations | — |
| `estimate_items` | Estimate line items | `estimate_id` → estimates |
| `held_bills` | Parked in-progress bills | — |
| `users` | Staff accounts with PIN and role | — |
| `audit_log` | Action audit trail | `user_id` → users |
| `price_history` | Product price change log | `product_id` → products |
| `coupons` | Discount coupon codes | — |
| `loyalty_points` | Customer loyalty points ledger | `customer_id` → customers |
| `license_cache` | Cached licence state with JWT signature | — |

---

## 7. User Roles & Permissions

### 7.1 Role Hierarchy

| Role | Level | Description |
|---|---|---|
| **Owner** | Highest | Full access: billing, refunds, products, stock, customers, reports, staff management, settings |
| **Manager** | Mid | Billing, refunds, products, stock, customers, reports — no staff or owner settings |
| **Cashier** | Basic | Billing only + day summary |

### 7.2 Permission Matrix

| Permission | Owner | Manager | Cashier |
|---|---|---|---|
| Billing (`billing`) | ✅ | ✅ | ✅ |
| Process Refunds & Returns (`process_refunds`) | ✅ | ✅ | ❌ |
| Manage Products & Purchases (`manage_products`) | ✅ | ✅ | ❌ |
| Adjust Stock (`adjust_stock`) | ✅ | ✅ | ❌ |
| Manage Customers & Credit (`manage_customers`) | ✅ | ✅ | ❌ |
| View Reports & Analytics (`view_reports`) | ✅ | ✅ | ❌ |
| Manage Staff (`manage_staff`) | ✅ | ❌ | ❌ |

### 7.3 Enforcement

- **UI Level:** Route gating, button visibility, `PinGate` component
- **IPC Level:** Every protected handler calls `requirePermission()` before processing
- **Billing Level:** Cashier can always create bills — no authentication required for POS page

---

## 8. Licensing & Plan Tiers

### 8.1 Licence States

| State | Description |
|---|---|
| `not_activated` | No licence key entered |
| `trial` | Trial period active |
| `active` | Valid paid licence |
| `grace` | Licence expired but within grace window |
| `expired` | Licence expired |
| `suspended` | Licence suspended by server |
| `grace_expired` | Grace period exhausted |

### 8.2 Feature Flags

| Flag | Type | Gated Feature |
|---|---|---|
| `profitLossReport` | boolean | Profit & Loss tab in Reports |
| `customerAnalytics` | boolean | Customer Analytics page |
| `creditAging` | boolean | Credit Aging report |
| `dataExport` | boolean | Data Export page |
| `whatsappIntegration` | boolean | WhatsApp reminder buttons |
| `creditManagement` | boolean | Credit management features |
| `expenseTracking` | boolean | Expense tracking |
| `estimates` | boolean | Estimates/Quotations |
| `returnExchange` | boolean | Return & Exchange |
| `barcodeLabels` | boolean | Barcode label printing |
| `googleDriveBackup` | boolean | Google Drive cloud backup |
| `auditTrail` | boolean | Audit trail features |
| `gstReports` | boolean | GST reports |
| `multiUser` | boolean | Multi-user/staff support |
| `maxBillsPerMonth` | number | Monthly bill limit |
| `maxProducts` | number | Product count limit |
| `maxCustomers` | number | Customer count limit |
| `maxUsers` | number | User account limit |

---

## 9. Integration Requirements

| Integration | Type | Direction | Protocol |
|---|---|---|---|
| **Thermal Printer** | Hardware | Outbound | ESC/POS raw USB/Bluetooth |
| **Barcode Scanner** | Hardware | Inbound | Keyboard wedge (HID) |
| **License Server** | REST API | Bidirectional | HTTPS, JWT-signed payloads |
| **GitHub Releases** | Cloud | Inbound | HTTPS (auto-updater) |
| **Google Drive** | Cloud | Bidirectional | OAuth 2.0, REST API |
| **WhatsApp** | Cloud | Outbound | `wa.me` URL scheme |
| **Email (SMTP)** | Cloud | Outbound | Nodemailer (planned) |

---

## 10. Performance Requirements

| Scenario | Target | Measurement |
|---|---|---|
| App cold start (first launch after boot) | ≤8 seconds | Wall clock |
| App warm start (subsequent launches) | ≤3 seconds | Wall clock |
| Bill creation (save + database commit) | ≤1 second | Wall clock |
| Product search (text) | ≤300ms | Time from last keystroke |
| Product search (barcode scan) | ≤500ms | Scan to cart |
| Report load (1,000 bills) | ≤2 seconds | Wall clock |
| PDF generation | ≤5 seconds | Wall clock |
| Database backup (1GB database) | ≤30 seconds | Wall clock |
| UI scroll performance (bill lists) | 60fps | Frames per second |

---

## 11. Security Requirements

| ID | Requirement |
|---|---|
| SEC-REQ-01 | **PIN Storage** — PINs must be hashed with salted scrypt; never stored in plaintext |
| SEC-REQ-02 | **IPC Validation** — Every IPC handler must validate inputs with Zod schemas |
| SEC-REQ-03 | **Permission Enforcement** — Every protected IPC handler must call `requirePermission()` before executing |
| SEC-REQ-04 | **License Tamper Detection** — JWT-signed licence response with deep-equality check between DB columns and JWT payload on every boot |
| SEC-REQ-05 | **Backup Integrity** — HMAC-SHA256 signed backup files; restore validates signature |
| SEC-REQ-06 | **Audit Trail** — All sensitive actions must be logged to immutable audit_log |
| SEC-REQ-07 | **Stock Integrity** — Stock cannot go negative unless explicitly enabled |
| SEC-REQ-08 | **Bill Number Uniqueness** — Bill numbers must be unique within a financial year |
| SEC-REQ-09 | **Data Isolation** — Renderer must never directly access database, filesystem, or native APIs |
| SEC-REQ-10 | **Session Security** — Lock screen clears session; re-authentication required to resume |

---

## 12. Deployment Requirements

### 12.1 Installation

| Platform | Installer Type | Method |
|---|---|---|
| Windows | NSIS / Squirrel | `.exe` installer |
| macOS | DMG | `.dmg` image |
| Linux | AppImage | `.AppImage` |

### 12.2 Update Delivery

- **Backend:** GitHub Releases
- **Client:** electron-updater with Squirrel.Windows
- **Channel:** Stable (default) + Beta (optional)
- **Frequency:** Check every 4 hours
- **Delivery:** Silent background download, install on quit

### 12.3 Data Migration

- **System:** Version-gated Drizzle migrations
- **Safety:** `minAppVersion` requirement check per migration
- **Rollback:** In-app rollback to previous version with automatic database compatibility check

---

## 13. Glossary

| Term | Definition |
|---|---|
| **POS** | Point of Sale — the billing checkout interface |
| **SKU** | Stock Keeping Unit — unique product identifier code |
| **GST** | Goods and Services Tax — Indian consumption tax |
| **CGST** | Central Goods and Services Tax (central government share) |
| **SGST** | State Goods and Services Tax (state government share) |
| **HSN** | Harmonized System of Nomenclature — product classification for GST |
| **GSTIN** | Goods and Services Tax Identification Number |
| **MRP** | Maximum Retail Price |
| **UPI** | Unified Payments Interface — Indian digital payment system |
| **ESC/POS** | Epson Standard Code for Point of Sale — thermal printer command language |
| **JWT** | JSON Web Token — cryptographically signed token for license verification |
| **WAL** | Write-Ahead Logging — SQLite journal mode for concurrent access |
| **OAuth 2.0** | Open standard for token-based authentication (used for Google Drive) |
| **Z-Report** | End-of-day financial summary report |
| **COGS** | Cost of Goods Sold |
| **P&L** | Profit and Loss |
| **GSTR-1** | Monthly GST return for outward supplies |

---

## Document History

| Version | Date | Author | Changes |
|---|---|---|---|
| 1.0 | 2026-07-30 | Sultan Kabadi | Initial comprehensive SRS document |

---

> **KPT Billing** — Developed by **[Sultan Kabadi](https://sultanbk.com)**  
> *Offline-first retail business management software for the modern shop counter.*
