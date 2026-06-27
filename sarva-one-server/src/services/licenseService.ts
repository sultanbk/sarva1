import { randomInt } from "node:crypto";
import { and, count, desc, eq, getTableColumns, gte, ilike, lte, or, sql } from "drizzle-orm";
import { db } from "../db/connection.js";
import { heartbeats, licenses, type License, type Plan } from "../db/schema.js";

export type ApiErrorCode =
  | "LICENSE_NOT_FOUND"
  | "LICENSE_INACTIVE"
  | "MACHINE_MISMATCH"
  | "LICENSE_EXPIRED"
  | "LICENSE_SUSPENDED"
  | "VALIDATION_ERROR"
  | "UNAUTHORIZED"
  | "INVALID_TOKEN"
  | "INVALID_API_KEY"
  | "RATE_LIMITED"
  | "SERVER_MISCONFIGURED"
  | "LOGIN_FAILED"
  | "INVALID_PASSWORD"
  | "ADMIN_ALREADY_EXISTS";

export const successResponse = <T>(data: T) => ({ success: true, data });

export const errorResponse = (error: ApiErrorCode, message: string) => ({
  success: false,
  error,
  message
});

export const featureFlags: Record<Plan, Record<string, boolean | number>> = {
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
    maxUsers: 1
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
    maxUsers: 2
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
    maxUsers: -1
  },
  custom: {
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
    maxUsers: -1
  }
};

function planPriceFromEnv(plan: Plan) {
  const envName = `PLAN_PRICE_${plan.toUpperCase()}`;
  const value = Number(process.env[envName] ?? 0);
  return Number.isFinite(value) && value >= 0 ? value : 0;
}

export const planMonthlyPrices: Record<Plan, number> = {
  starter: planPriceFromEnv("starter"),
  growth: planPriceFromEnv("growth"),
  pro: planPriceFromEnv("pro"),
  custom: planPriceFromEnv("custom")
};

const alphabet = "ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789";

export async function generateUniqueLicenseKey() {
  for (let attempt = 0; attempt < 20; attempt += 1) {
    const segments = Array.from({ length: 4 }, () =>
      Array.from({ length: 4 }, () => alphabet[randomInt(alphabet.length)]).join("")
    );
    const key = `SARVA-${segments.join("-")}`;
    const existing = await db.query.licenses.findFirst({ where: eq(licenses.key, key) });

    if (!existing) {
      return key;
    }
  }

  throw new Error("Unable to generate a unique license key");
}

export async function findLicenseByKey(key: string) {
  return db.query.licenses.findFirst({
    where: eq(licenses.key, key)
  });
}

export function daysRemaining(expiresAt: Date) {
  return Math.ceil((expiresAt.getTime() - Date.now()) / (24 * 60 * 60 * 1000));
}

export function expiryState(license: License) {
  const remaining = daysRemaining(license.expiresAt);

  if (remaining >= 0) {
    return { status: license.status, daysRemaining: remaining };
  }

  if (Math.abs(remaining) <= license.gracePeriodDays) {
    return { status: "grace", daysRemaining: remaining };
  }

  return { status: "expired", daysRemaining: remaining };
}

export async function setMachineAndActivate(license: License, machineId: string) {
  const [updated] = await db
    .update(licenses)
    .set({
      machineId,
      status: "active",
      activatedAt: license.activatedAt ?? new Date(),
      updatedAt: new Date()
    })
    .where(eq(licenses.id, license.id))
    .returning();

  return updated;
}

export async function insertHeartbeat(params: {
  licenseId: string;
  machineId: string;
  appVersion: string;
  ipAddress: string;
  usageStats?: {
    billsToday?: number;
    totalBills?: number;
    totalCustomers?: number;
    totalProducts?: number;
  };
}) {
  await db.insert(heartbeats).values({
    licenseId: params.licenseId,
    machineId: params.machineId,
    appVersion: params.appVersion,
    ipAddress: params.ipAddress,
    billsToday: params.usageStats?.billsToday ?? 0,
    totalBills: params.usageStats?.totalBills ?? 0,
    totalCustomers: params.usageStats?.totalCustomers ?? 0,
    totalProducts: params.usageStats?.totalProducts ?? 0
  });
}

export function publicLicensePayload(license: License) {
  return {
    plan: license.plan,
    expiresAt: license.expiresAt,
    features: featureFlags[license.plan],
    shopName: license.shopName
  };
}

export function buildLicenseFilters(filters: {
  status?: License["status"];
  plan?: Plan;
  q?: string;
  expiresBefore?: Date;
  expiresAfter?: Date;
}) {
  const conditions = [];

  if (filters.status) {
    conditions.push(eq(licenses.status, filters.status));
  }

  if (filters.plan) {
    conditions.push(eq(licenses.plan, filters.plan));
  }

  if (filters.q) {
    const search = `%${filters.q}%`;
    conditions.push(
      or(
        ilike(licenses.key, search),
        ilike(licenses.shopName, search),
        ilike(licenses.ownerName, search),
        ilike(licenses.email, search),
        ilike(licenses.phone, search)
      )
    );
  }

  if (filters.expiresBefore) {
    conditions.push(lte(licenses.expiresAt, filters.expiresBefore));
  }

  if (filters.expiresAfter) {
    conditions.push(gte(licenses.expiresAt, filters.expiresAfter));
  }

  return conditions.length ? and(...conditions) : undefined;
}

export type LicenseSort = "shopName" | "ownerName" | "plan" | "status" | "expiresAt" | "lastHeartbeatAt";

export function latestHeartbeatAtSql() {
  return sql<Date | null>`(
    select max(${heartbeats.createdAt})
    from ${heartbeats}
    where ${heartbeats.licenseId} = ${licenses.id}
  )`;
}

export function licenseListColumns() {
  return {
    ...getTableColumns(licenses),
    lastHeartbeatAt: latestHeartbeatAtSql()
  };
}

export async function dashboardStats() {
  const now = new Date();
  const totals = await db.select({ total: count() }).from(licenses);
  const active = await db.select({ total: count() }).from(licenses).where(eq(licenses.status, "active"));
  const expired = await db
    .select({ total: count() })
    .from(licenses)
    .where(eq(licenses.status, "expired"));
  const activeByPlan = await db
    .select({ plan: licenses.plan, total: count() })
    .from(licenses)
    .where(eq(licenses.status, "active"))
    .groupBy(licenses.plan);

  const mrr = activeByPlan.reduce((sum, row) => sum + row.total * planMonthlyPrices[row.plan], 0);

  return {
    total: totals[0]?.total ?? 0,
    active: active[0]?.total ?? 0,
    expired: expired[0]?.total ?? 0,
    mrr,
    activeByPlan
  };
}

export async function licenseWithHeartbeatHistory(id: string) {
  const license = await db.query.licenses.findFirst({
    where: eq(licenses.id, id)
  });

  if (!license) {
    return undefined;
  }

  const history = await db.query.heartbeats.findMany({
    where: eq(heartbeats.licenseId, id),
    orderBy: desc(heartbeats.createdAt),
    limit: 100
  });

  return { ...license, heartbeats: history };
}

export const updatedNow = sql`now()`;
