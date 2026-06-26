import { relations } from "drizzle-orm";
import {
  integer,
  pgEnum,
  pgTable,
  text,
  timestamp,
  uuid,
  varchar
} from "drizzle-orm/pg-core";

export const planEnum = pgEnum("plan", ["starter", "growth", "pro", "custom"]);
export const statusEnum = pgEnum("status", ["trial", "active", "expired", "suspended"]);

export const licenses = pgTable("licenses", {
  id: uuid("id").primaryKey().defaultRandom(),
  key: varchar("key", { length: 24 }).notNull().unique(),
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
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
  createdBy: varchar("created_by", { length: 255 }).notNull(),
  notes: text("notes")
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
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow()
});

export const adminUsers = pgTable("admin_users", {
  id: uuid("id").primaryKey().defaultRandom(),
  email: varchar("email", { length: 255 }).notNull().unique(),
  passwordHash: varchar("password_hash", { length: 255 }).notNull(),
  name: varchar("name", { length: 255 }).notNull(),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow()
});

export const licensesRelations = relations(licenses, ({ many }) => ({
  heartbeats: many(heartbeats)
}));

export const heartbeatsRelations = relations(heartbeats, ({ one }) => ({
  license: one(licenses, {
    fields: [heartbeats.licenseId],
    references: [licenses.id]
  })
}));

export type License = typeof licenses.$inferSelect;
export type NewLicense = typeof licenses.$inferInsert;
export type Plan = (typeof planEnum.enumValues)[number];
export type LicenseStatus = (typeof statusEnum.enumValues)[number];
