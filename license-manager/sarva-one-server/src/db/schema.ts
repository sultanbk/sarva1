import { relations } from "drizzle-orm";
import {
  boolean,
  integer,
  jsonb,
  pgEnum,
  pgTable,
  text,
  timestamp,
  uuid,
  varchar
} from "drizzle-orm/pg-core";

export const planEnum = pgEnum("plan", ["starter", "professional", "enterprise"]);
export const statusEnum = pgEnum("status", ["trial", "active", "expired", "suspended"]);
export const logLevelEnum = pgEnum("log_level", ["debug", "info", "warn", "error", "fatal"]);

export const licenses = pgTable("licenses", {
  id: uuid("id").primaryKey().defaultRandom(),
  key: varchar("key", { length: 25 }).notNull().unique(),
  shopName: varchar("shop_name", { length: 255 }).notNull(),
  ownerName: varchar("owner_name", { length: 255 }).notNull(),
  phone: varchar("phone", { length: 50 }).notNull(),
  email: varchar("email", { length: 255 }).notNull(),
  plan: planEnum("plan").notNull(),
  status: statusEnum("status").notNull().default("trial"),
  machineId: varchar("machine_id", { length: 255 }),
  activatedAt: timestamp("activated_at", { withTimezone: true }),
  expiresAt: timestamp("expires_at", { withTimezone: true }).notNull(),
  gracePeriodDays: integer("grace_period_days").notNull().default(7),
  maxSeats: integer("max_seats").notNull().default(1),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
  createdBy: varchar("created_by", { length: 255 }).notNull(),
  deletedAt: timestamp("deleted_at", { withTimezone: true }),
  deletedBy: varchar("deleted_by", { length: 255 }),
  notes: text("notes")
});

export const licenseActivations = pgTable("license_activations", {
  id: uuid("id").primaryKey().defaultRandom(),
  licenseId: uuid("license_id")
    .notNull()
    .references(() => licenses.id, { onDelete: "cascade" }),
  machineIdHash: varchar("machine_id_hash", { length: 255 }).notNull(),
  hostname: varchar("hostname", { length: 255 }),
  appVersion: varchar("app_version", { length: 50 }),
  activatedAt: timestamp("activated_at", { withTimezone: true }).notNull().defaultNow(),
  lastSeenAt: timestamp("last_seen_at", { withTimezone: true }),
  deactivatedAt: timestamp("deactivated_at", { withTimezone: true }),
  blockedAt: timestamp("blocked_at", { withTimezone: true })
});

export const heartbeats = pgTable("heartbeats", {
  id: uuid("id").primaryKey().defaultRandom(),
  licenseId: uuid("license_id")
    .notNull()
    .references(() => licenses.id, { onDelete: "cascade" }),
  machineId: varchar("machine_id", { length: 255 }).notNull(),
  appVersion: varchar("app_version", { length: 50 }).notNull(),
  billsToday: integer("bills_today").notNull().default(0),
  totalBills: integer("total_bills").notNull().default(0),
  totalCustomers: integer("total_customers").notNull().default(0),
  totalProducts: integer("total_products").notNull().default(0),
  ipAddress: varchar("ip_address", { length: 100 }).notNull(),
  metadata: jsonb("metadata").$type<{
    osPlatform: string;
    osRelease: string;
    cpuModel: string;
    cpuCores: number;
    totalMemoryGB: number;
    freeMemoryGB: number;
    timezone: string;
    chromeVersion: string;
    electronVersion: string;
    dbSizeMB: number;
  }>(),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow()
});

export const adminUsers = pgTable("admin_users", {
  id: uuid("id").primaryKey().defaultRandom(),
  email: varchar("email", { length: 255 }).notNull().unique(),
  passwordHash: varchar("password_hash", { length: 255 }).notNull(),
  name: varchar("name", { length: 255 }).notNull(),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow()
});

export const licenseEvents = pgTable("license_events", {
  id: uuid("id").primaryKey().defaultRandom(),
  licenseId: uuid("license_id").references(() => licenses.id, { onDelete: "set null" }),
  actorType: varchar("actor_type", { length: 50 }).notNull(),
  actorId: varchar("actor_id", { length: 255 }),
  eventType: varchar("event_type", { length: 100 }).notNull(),
  metadata: jsonb("metadata").$type<Record<string, unknown>>(),
  ipAddress: varchar("ip_address", { length: 100 }),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow()
});

export const plans = pgTable("plans", {
  id: uuid("id").primaryKey().defaultRandom(),
  code: varchar("code", { length: 50 }).notNull().unique(),
  name: varchar("name", { length: 255 }).notNull(),
  monthlyPrice: integer("monthly_price").notNull().default(0),
  isActive: boolean("is_active").notNull().default(true),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow()
});

export const planEntitlements = pgTable("plan_entitlements", {
  id: uuid("id").primaryKey().defaultRandom(),
  planId: uuid("plan_id")
    .notNull()
    .references(() => plans.id, { onDelete: "cascade" }),
  entitlementKey: varchar("entitlement_key", { length: 100 }).notNull(),
  valueType: varchar("value_type", { length: 20 }).notNull(),
  booleanValue: boolean("boolean_value"),
  numberValue: integer("number_value"),
  textValue: text("text_value")
});

export const paymentEvents = pgTable("payment_events", {
  id: uuid("id").primaryKey().defaultRandom(),
  licenseId: uuid("license_id").references(() => licenses.id, { onDelete: "set null" }),
  provider: varchar("provider", { length: 50 }).notNull(),
  providerPaymentId: varchar("provider_payment_id", { length: 255 }),
  providerOrderId: varchar("provider_order_id", { length: 255 }),
  amount: integer("amount").notNull(),
  currency: varchar("currency", { length: 10 }).notNull().default("INR"),
  status: varchar("status", { length: 50 }).notNull(),
  rawPayload: jsonb("raw_payload").$type<Record<string, unknown>>(),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow()
});

export const clientLogs = pgTable("client_logs", {
  id: uuid("id").primaryKey().defaultRandom(),
  licenseId: uuid("license_id")
    .notNull()
    .references(() => licenses.id, { onDelete: "cascade" }),
  machineId: varchar("machine_id", { length: 255 }).notNull(),
  appVersion: varchar("app_version", { length: 50 }).notNull(),
  level: logLevelEnum("level").notNull().default("info"),
  message: text("message").notNull(),
  source: varchar("source", { length: 100 }),
  stackTrace: text("stack_trace"),
  metadata: jsonb("metadata").$type<Record<string, unknown>>(),
  ipAddress: varchar("ip_address", { length: 100 }),
  clientTs: timestamp("client_ts", { withTimezone: true }),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow()
});

export const licensesRelations = relations(licenses, ({ many }) => ({
  heartbeats: many(heartbeats),
  events: many(licenseEvents),
  activations: many(licenseActivations),
  payments: many(paymentEvents),
  logs: many(clientLogs)
}));

export const licenseActivationsRelations = relations(licenseActivations, ({ one }) => ({
  license: one(licenses, {
    fields: [licenseActivations.licenseId],
    references: [licenses.id]
  })
}));

export const heartbeatsRelations = relations(heartbeats, ({ one }) => ({
  license: one(licenses, {
    fields: [heartbeats.licenseId],
    references: [licenses.id]
  })
}));

export const licenseEventsRelations = relations(licenseEvents, ({ one }) => ({
  license: one(licenses, {
    fields: [licenseEvents.licenseId],
    references: [licenses.id]
  })
}));

export const plansRelations = relations(plans, ({ many }) => ({
  entitlements: many(planEntitlements)
}));

export const planEntitlementsRelations = relations(planEntitlements, ({ one }) => ({
  plan: one(plans, {
    fields: [planEntitlements.planId],
    references: [plans.id]
  })
}));

export const paymentEventsRelations = relations(paymentEvents, ({ one }) => ({
  license: one(licenses, {
    fields: [paymentEvents.licenseId],
    references: [licenses.id]
  })
}));

export const clientLogsRelations = relations(clientLogs, ({ one }) => ({
  license: one(licenses, {
    fields: [clientLogs.licenseId],
    references: [licenses.id]
  })
}));

export type License = typeof licenses.$inferSelect;
export type NewLicense = typeof licenses.$inferInsert;
export type ClientLog = typeof clientLogs.$inferSelect;
export type LicenseActivation = typeof licenseActivations.$inferSelect;
export type LicenseEvent = typeof licenseEvents.$inferSelect;
export type Plan = (typeof planEnum.enumValues)[number];
export type LicenseStatus = (typeof statusEnum.enumValues)[number];
