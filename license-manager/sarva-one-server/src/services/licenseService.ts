import { createHash, randomInt } from "node:crypto";
import { and, count, desc, eq, getTableColumns, gte, ilike, isNull, isNotNull, lte, or, sql, lt } from "drizzle-orm";
import { db } from "../db/connection.js";
import { clientLogs, heartbeats, licenseActivations, licenseEvents, licenses, paymentEvents, plans, planEntitlements, type License, type Plan, type ClientLog } from "../db/schema.js";
import jwt from "jsonwebtoken";
import { licenseKeyId, licensePrivateKey, licensePublicKey } from "../config.js";

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
  | "MAX_SEATS_EXCEEDED"
  | "RATE_LIMITED"
  | "SERVER_MISCONFIGURED"
  | "LOGIN_FAILED"
  | "INVALID_PASSWORD"
  | "ADMIN_ALREADY_EXISTS"
  | "MACHINE_BLOCKED";

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
  professional: {
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
  enterprise: {
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
  professional: planPriceFromEnv("professional"),
  enterprise: planPriceFromEnv("enterprise")
};

let cachedPlanEntitlements: Record<string, Record<string, boolean | number | string>> = {};

export async function seedEntitlementsIfEmpty() {
  try {
    const [check] = await db.select({ count: count() }).from(planEntitlements);
    if (Number(check?.count ?? 0) > 0) {
      await refreshPlanEntitlementsCache();
      return;
    }

    console.log("🌱 Database plan entitlements are empty. Seeding from fallback configurations...");
    const dbPlans = await db.select().from(plans);
    
    for (const plan of dbPlans) {
      const code = plan.code as Plan;
      const fallbackFeatures = featureFlags[code];
      if (!fallbackFeatures) continue;

      for (const [key, value] of Object.entries(fallbackFeatures)) {
        const valType = typeof value;
        await db.insert(planEntitlements).values({
          planId: plan.id,
          entitlementKey: key,
          valueType: valType,
          booleanValue: valType === "boolean" ? (value as unknown as boolean) : null,
          numberValue: valType === "number" ? (value as unknown as number) : null,
          textValue: valType === "string" ? (value as unknown as string) : null
        }).onConflictDoNothing();
      }
    }
    console.log("✅ Seeded plan entitlements.");
    await refreshPlanEntitlementsCache();
  } catch (error) {
    console.error("❌ Failed to seed plan entitlements:", error);
  }
}

export async function refreshPlanEntitlementsCache() {
  try {
    const catalog = await planCatalog();
    const newCache: Record<string, Record<string, boolean | number | string>> = {};
    for (const plan of catalog) {
      newCache[plan.code] = plan.entitlements;
    }
    cachedPlanEntitlements = newCache;
    console.log("⚡ Plan entitlements cache refreshed successfully.");
  } catch (error) {
    console.error("❌ Failed to refresh plan entitlements cache:", error);
  }
}

export function getPlanEntitlements(plan: Plan): Record<string, boolean | number | string> {
  return cachedPlanEntitlements[plan] ?? featureFlags[plan];
}

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
    where: and(eq(licenses.key, key), isNull(licenses.deletedAt))
  });
}

export function hashMachineId(machineId: string) {
  const salt = process.env.MACHINE_ID_HASH_SECRET ?? process.env.JWT_SECRET ?? "";
  return createHash("sha256").update(`${salt}:${machineId}`).digest("hex");
}

export function daysRemaining(expiresAt: Date) {
  return Math.ceil((expiresAt.getTime() - Date.now()) / (24 * 60 * 60 * 1000));
}

export type EffectiveLicenseStatus = License["status"] | "grace";

export function graceEndsAt(license: License) {
  return new Date(license.expiresAt.getTime() + license.gracePeriodDays * 24 * 60 * 60 * 1000);
}

export function expiryState(license: License) {
  const remaining = daysRemaining(license.expiresAt);

  if (license.status === "suspended" || license.status === "expired") {
    return { status: license.status, daysRemaining: remaining };
  }

  if (remaining >= 0) {
    return { status: license.status, daysRemaining: remaining };
  }

  if (Math.abs(remaining) <= license.gracePeriodDays) {
    return { status: "grace", daysRemaining: remaining };
  }

  return { status: "expired", daysRemaining: remaining };
}

export async function setMachineAndActivate(license: License, machineId: string, appVersion?: string, hostname?: string) {
  const machineIdHash = hashMachineId(machineId);

  return db.transaction(async (tx) => {
    await tx.execute(sql`select id from ${licenses} where ${licenses.id} = ${license.id} for update`);

    const existingActivation = await tx.query.licenseActivations.findFirst({
      where: and(
        eq(licenseActivations.licenseId, license.id),
        eq(licenseActivations.machineIdHash, machineIdHash),
        isNull(licenseActivations.deactivatedAt)
      )
    });

    const legacyMachineMatches = !license.machineId || license.machineId === machineId;

    if (existingActivation) {
      await tx
        .update(licenseActivations)
        .set({ lastSeenAt: new Date(), appVersion: appVersion ?? existingActivation.appVersion, hostname: hostname ?? existingActivation.hostname })
        .where(eq(licenseActivations.id, existingActivation.id));
    } else {
      const [{ total }] = await tx
        .select({ total: count() })
        .from(licenseActivations)
        .where(and(eq(licenseActivations.licenseId, license.id), isNull(licenseActivations.deactivatedAt)));

      if (total >= license.maxSeats) {
        if (!legacyMachineMatches) {
          return { license: undefined, error: "MAX_SEATS_EXCEEDED" as const };
        }
      } else {
        await tx.insert(licenseActivations).values({
          licenseId: license.id,
          machineIdHash,
          hostname: hostname ?? null,
          appVersion: appVersion ?? null,
          lastSeenAt: new Date()
        });
      }
    }

    const [updated] = await tx
      .update(licenses)
      .set({
        machineId: license.machineId ?? machineId,
        status: "active",
        activatedAt: license.activatedAt ?? new Date(),
        updatedAt: new Date()
      })
      .where(eq(licenses.id, license.id))
      .returning();

    return { license: updated };
  });
}

export async function isMachineBlocked(machineId: string): Promise<boolean> {
  const machineIdHash = hashMachineId(machineId);
  const blocked = await db.query.licenseActivations.findFirst({
    where: and(
      eq(licenseActivations.machineIdHash, machineIdHash),
      isNotNull(licenseActivations.blockedAt)
    )
  });
  return Boolean(blocked);
}

export async function isMachineActivated(license: License, machineId: string) {
  const machineIdHash = hashMachineId(machineId);
  const activation = await db.query.licenseActivations.findFirst({
    where: and(
      eq(licenseActivations.licenseId, license.id),
      eq(licenseActivations.machineIdHash, machineIdHash),
      isNull(licenseActivations.deactivatedAt),
      isNull(licenseActivations.blockedAt)
    )
  });

  if (await isMachineBlocked(machineId)) {
    return false;
  }

  return Boolean(activation) || license.machineId === machineId;
}

export async function touchActivation(licenseId: string, machineId: string, appVersion: string) {
  await db
    .update(licenseActivations)
    .set({ lastSeenAt: new Date(), appVersion })
    .where(
      and(
        eq(licenseActivations.licenseId, licenseId),
        eq(licenseActivations.machineIdHash, hashMachineId(machineId)),
        isNull(licenseActivations.deactivatedAt)
      )
    );
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
  systemMetadata?: {
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
  };
}) {
  await touchActivation(params.licenseId, params.machineId, params.appVersion);
  await db.insert(heartbeats).values({
    licenseId: params.licenseId,
    machineId: params.machineId,
    appVersion: params.appVersion,
    ipAddress: params.ipAddress,
    billsToday: params.usageStats?.billsToday ?? 0,
    totalBills: params.usageStats?.totalBills ?? 0,
    totalCustomers: params.usageStats?.totalCustomers ?? 0,
    totalProducts: params.usageStats?.totalProducts ?? 0,
    metadata: params.systemMetadata ?? null
  });
}

export async function recordLicenseEvent(params: {
  licenseId?: string | null;
  actorType: "admin" | "client" | "system";
  actorId?: string | null;
  eventType: string;
  metadata?: Record<string, unknown>;
  ipAddress?: string | null;
}) {
  await db.insert(licenseEvents).values({
    licenseId: params.licenseId ?? null,
    actorType: params.actorType,
    actorId: params.actorId ?? null,
    eventType: params.eventType,
    metadata: params.metadata,
    ipAddress: params.ipAddress ?? null
  });
}

export const clientLogLevels = ["debug", "info", "warn", "error", "fatal"] as const;
export type ClientLogLevel = (typeof clientLogLevels)[number];

export async function insertClientLogs(params: {
  licenseId: string;
  machineId: string;
  appVersion: string;
  ipAddress: string;
  entries: Array<{
    level: ClientLogLevel;
    message: string;
    source?: string;
    stackTrace?: string;
    metadata?: Record<string, unknown>;
    clientTs?: string;
  }>;
}) {
  if (!params.entries.length) return;
  await db.insert(clientLogs).values(
    params.entries.map((e) => ({
      licenseId: params.licenseId,
      machineId: params.machineId,
      appVersion: params.appVersion,
      ipAddress: params.ipAddress,
      level: e.level,
      message: e.message,
      source: e.source ?? null,
      stackTrace: e.stackTrace ?? null,
      metadata: e.metadata ?? null,
      clientTs: e.clientTs ? new Date(e.clientTs) : null
    }))
  );
  const retentionDays = process.env.LOG_RETENTION_DAYS ? Number(process.env.LOG_RETENTION_DAYS) : null;
  if (retentionDays && Math.random() < 0.01) {
    const cutoff = new Date(Date.now() - retentionDays * 864e5);
    await db.delete(clientLogs).where(lt(clientLogs.createdAt, cutoff));
  }
}

export async function queryClientLogs(filters: {
  licenseId?: string;
  level?: ClientLogLevel;
  q?: string;
  source?: string;
  from?: Date;
  to?: Date;
  limit: number;
  offset: number;
}): Promise<{
  logs: ClientLog[];
  total: number;
  summary: { total: number; byLevel: Record<ClientLogLevel, number> };
}> {
  const conditions = [];
  if (filters.licenseId) conditions.push(eq(clientLogs.licenseId, filters.licenseId));
  if (filters.level) conditions.push(eq(clientLogs.level, filters.level));
  if (filters.source) conditions.push(eq(clientLogs.source, filters.source));
  if (filters.q) {
    const search = `%${filters.q}%`;
    conditions.push(or(ilike(clientLogs.message, search), ilike(clientLogs.source, search)));
  }
  if (filters.from) conditions.push(gte(clientLogs.createdAt, filters.from));
  if (filters.to) {
    const toDate = new Date(filters.to);
    toDate.setDate(toDate.getDate() + 1);
    conditions.push(lte(clientLogs.createdAt, toDate));
  }
  const where = conditions.length ? and(...conditions) : undefined;

  const [logs, totalResult, summaryRows] = await Promise.all([
    db
      .select()
      .from(clientLogs)
      .where(where)
      .orderBy(desc(clientLogs.createdAt))
      .limit(filters.limit)
      .offset(filters.offset),
    db.select({ total: count() }).from(clientLogs).where(where),
    db
      .select({ level: clientLogs.level, count: count() })
      .from(clientLogs)
      .where(where)
      .groupBy(clientLogs.level)
  ]);

  const byLevel: Record<ClientLogLevel, number> = {
    debug: 0,
    info: 0,
    warn: 0,
    error: 0,
    fatal: 0
  };
  for (const row of summaryRows) {
    byLevel[row.level as ClientLogLevel] = Number(row.count);
  }

  return {
    logs,
    total: totalResult[0]?.total ?? 0,
    summary: { total: totalResult[0]?.total ?? 0, byLevel }
  };
}

export function signLicensePayload(payload: Record<string, unknown>): string {
  return jwt.sign(payload, licensePrivateKey(), {
    algorithm: "RS256",
    keyid: licenseKeyId()
  });
}
export function licenseStatePayload(license: License) {
  const state = expiryState(license);
  const graceEnds = graceEndsAt(license);
  const issuedAt = new Date();
  const tokenTtlHours = Number(process.env.LICENSE_TOKEN_TTL_HOURS ?? 24);
  const validUntil = new Date(issuedAt.getTime() + tokenTtlHours * 60 * 60 * 1000);
  const offlineDaysAllowance = Number(process.env.OFFLINE_DAYS_ALLOWANCE ?? 7);

  return {
    status: state.status,
    licenseId: license.id,
    key: license.key,
    plan: license.plan,
    machineId: license.machineId,
    storedStatus: license.status,
    effectiveStatus: state.status,
    expiresAt: license.expiresAt instanceof Date ? license.expiresAt.toISOString() : license.expiresAt,
    graceEndsAt: graceEnds.toISOString(),
    daysRemaining: state.daysRemaining,
    features: getPlanEntitlements(license.plan),
    maxSeats: license.maxSeats,
    shopName: license.shopName,
    issuedAt: issuedAt.toISOString(),
    validUntil: validUntil.toISOString(),
    offlineDaysAllowance,
    tokenVersion: 1
  };
}
export function buildLicenseState(license: License) {
  const payload = licenseStatePayload(license);
  const signature = signLicensePayload(payload);

  return {
    ...payload,
    signature,
    licenseToken: signature
  };
}

export function publicLicensePayload(license: License) {
  return buildLicenseState(license);
}

export function buildLicenseFilters(filters: {
  status?: License["status"];
  plan?: Plan;
  q?: string;
  expiresBefore?: Date;
  expiresAfter?: Date;
  includeArchived?: boolean;
}) {
  const conditions = [];

  if (!filters.includeArchived) {
    conditions.push(isNull(licenses.deletedAt));
  }

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
  const allLicenses = await db.select(licenseListColumns()).from(licenses).where(isNull(licenses.deletedAt));
  const latestUsageByLicense = new Map<
    string,
    { billsToday: number; totalBills: number; totalCustomers: number; totalProducts: number; appVersion: string; createdAt: Date }
  >();
  const activeByPlanMap = new Map<Plan, number>();
  const clientsByPlanMap = new Map<Plan, number>();
  let active = 0;
  let trial = 0;
  let grace = 0;
  let expired = 0;
  let suspended = 0;

  const latestHeartbeatsResult = (await db.execute(sql`
    select distinct on (license_id) 
      license_id as "licenseId", 
      bills_today as "billsToday", 
      total_bills as "totalBills", 
      total_customers as "totalCustomers", 
      total_products as "totalProducts", 
      app_version as "appVersion", 
      created_at as "createdAt"
    from heartbeats 
    order by license_id, created_at desc
  `)) as any;

  const latestHeartbeats = latestHeartbeatsResult.rows || [];

  for (const hb of latestHeartbeats) {
    latestUsageByLicense.set(hb.licenseId, {
      billsToday: Number(hb.billsToday),
      totalBills: Number(hb.totalBills),
      totalCustomers: Number(hb.totalCustomers),
      totalProducts: Number(hb.totalProducts),
      appVersion: String(hb.appVersion),
      createdAt: new Date(hb.createdAt)
    });
  }

  allLicenses.forEach((license) => {
    const effectiveStatus = expiryState(license).status;
    clientsByPlanMap.set(license.plan, (clientsByPlanMap.get(license.plan) ?? 0) + 1);

    if (effectiveStatus === "active") {
      active += 1;
      activeByPlanMap.set(license.plan, (activeByPlanMap.get(license.plan) ?? 0) + 1);
    } else if (effectiveStatus === "trial") {
      trial += 1;
    } else if (effectiveStatus === "grace") {
      grace += 1;
    } else if (effectiveStatus === "expired") {
      expired += 1;
    } else if (effectiveStatus === "suspended") {
      suspended += 1;
    }
  });

  const activeByPlan = Array.from(activeByPlanMap, ([plan, total]) => ({ plan, total }));
  const clientsByPlan = (["starter", "professional", "enterprise"] as Plan[]).map((plan) => ({
    plan,
    count: clientsByPlanMap.get(plan) ?? 0
  }));
  const mrr = activeByPlan.reduce((sum, row) => sum + row.total * planMonthlyPrices[row.plan], 0);
  const now = Date.now();
  const oneDay = 24 * 60 * 60 * 1000;
  const sevenDays = 7 * 24 * 60 * 60 * 1000;
  const twoDays = 2 * 24 * 60 * 60 * 1000;
  const licensesWithState = allLicenses.map((license) => ({
    ...license,
    ...licenseStatePayload(license)
  }));
  const latestUsages = Array.from(latestUsageByLicense.values());
  const appVersionsMap = new Map<string, number>();

  latestUsages.forEach((usage) => {
    appVersionsMap.set(usage.appVersion, (appVersionsMap.get(usage.appVersion) ?? 0) + 1);
  });

  const clientsWithUsage = licensesWithState.map((license) => {
    const usage = latestUsageByLicense.get(license.id);

    return {
      id: license.id,
      shopName: license.shopName,
      ownerName: license.ownerName,
      phone: license.phone,
      plan: license.plan,
      effectiveStatus: license.effectiveStatus,
      lastHeartbeatAt: usage?.createdAt ?? license.lastHeartbeatAt ?? null,
      appVersion: usage?.appVersion ?? null,
      billsToday: usage?.billsToday ?? 0,
      totalBills: usage?.totalBills ?? 0,
      totalCustomers: usage?.totalCustomers ?? 0,
      totalProducts: usage?.totalProducts ?? 0
    };
  });
  const monthKey = (value: Date) => value.toLocaleDateString("en-IN", { month: "short" });
  const months = Array.from({ length: 6 }, (_item, index) => {
    const date = new Date();
    date.setMonth(date.getMonth() - (5 - index));
    return monthKey(date);
  });

  return {
    total: allLicenses.length,
    active,
    trial,
    grace,
    expired,
    suspended,
    totalBillsGenerated: latestUsages.reduce((sum, usage) => sum + usage.totalBills, 0),
    billsToday: latestUsages.reduce((sum, usage) => sum + usage.billsToday, 0),
    totalCustomersReported: latestUsages.reduce((sum, usage) => sum + usage.totalCustomers, 0),
    totalProductsReported: latestUsages.reduce((sum, usage) => sum + usage.totalProducts, 0),
    reportingClients: latestUsageByLicense.size,
    clientsSyncedToday: clientsWithUsage.filter((client) => client.lastHeartbeatAt && now - new Date(client.lastHeartbeatAt).getTime() <= oneDay).length,
    clientsNeverSynced: clientsWithUsage.filter((client) => !client.lastHeartbeatAt).length,
    appVersions: Array.from(appVersionsMap, ([version, count]) => ({ version, count })).sort((a, b) => b.count - a.count),
    topBillClients: clientsWithUsage
      .filter((client) => client.totalBills > 0)
      .sort((a, b) => b.totalBills - a.totalBills)
      .slice(0, 8),
    clientSyncHealth: [
      {
        status: "Synced today",
        clients: clientsWithUsage.filter((client) => client.lastHeartbeatAt && now - new Date(client.lastHeartbeatAt).getTime() <= oneDay).length
      },
      {
        status: "Stale",
        clients: clientsWithUsage.filter((client) => client.lastHeartbeatAt && now - new Date(client.lastHeartbeatAt).getTime() > twoDays).length
      },
      {
        status: "Never synced",
        clients: clientsWithUsage.filter((client) => !client.lastHeartbeatAt).length
      }
    ],
    mrr,
    activeByPlan,
    clientsByPlan,
    clientsPerMonth: months.map((month) => ({
      month,
      clients: allLicenses.filter((license) => monthKey(license.createdAt) === month).length
    })),
    heartbeatsDaily: Array.from({ length: 7 }, (_item, index) => {
      const date = new Date();
      date.setDate(date.getDate() - (6 - index));
      const dateKey = date.toDateString();
      const heartbeats = allLicenses.filter((license) => {
        if (!license.lastHeartbeatAt) return false;
        return new Date(license.lastHeartbeatAt).toDateString() === dateKey;
      }).length;

      return { day: date.toLocaleDateString("en-IN", { weekday: "short" }), heartbeats };
    }),
    expiringSoon: licensesWithState.filter((license) => {
      const expires = new Date(license.expiresAt).getTime();
      return expires >= now && expires <= now + sevenDays;
    }),
    graceLicenses: licensesWithState.filter((license) => license.effectiveStatus === "grace"),
    inactiveClients: licensesWithState.filter((license) => {
      if (license.effectiveStatus !== "active") return false;
      if (!license.lastHeartbeatAt) return true;
      return now - new Date(license.lastHeartbeatAt).getTime() > twoDays;
    })
  };
}

export async function dashboardExtended() {
  const now = Date.now();
  const oneDay = 24 * 60 * 60 * 1000;
  const sevenDays = 7 * 24 * 60 * 60 * 1000;
  const fourteenDays = 14 * 24 * 60 * 60 * 1000;
  const sixMonths = 6 * 30 * 24 * 60 * 60 * 1000;

  const monthKey = (value: Date) => value.toLocaleDateString("en-IN", { month: "short", year: "2-digit" });

  // Revenue monthly (last 6 months)
  const revenueMonthlyResult = (await db.execute(sql`
    select date_trunc('month', created_at)::date as month, sum(amount) as revenue
    from payment_events
    where status in ('paid', 'succeeded', 'success', 'completed')
      and created_at >= ${new Date(now - sixMonths)}
    group by date_trunc('month', created_at)
    order by month
  `)) as any;
  const revenueMonthly = (revenueMonthlyResult.rows || []).map((r: any) => ({
    month: monthKey(new Date(r.month)),
    revenue: Number(r.revenue)
  }));

  // Revenue by plan
  const revenueByPlanResult = (await db.execute(sql`
    select l.plan, sum(pe.amount) as revenue
    from payment_events pe
    join licenses l on pe.license_id = l.id
    where pe.status in ('paid', 'succeeded', 'success', 'completed')
    group by l.plan
  `)) as any;
  const revenueByPlan = (revenueByPlanResult.rows || []).map((r: any) => ({
    plan: r.plan as Plan,
    revenue: Number(r.revenue)
  }));

  // Activations per month (last 6 months)
  const activationsResult = (await db.execute(sql`
    select date_trunc('month', activated_at)::date as month, count(*) as activations
    from license_activations
    where activated_at >= ${new Date(now - sixMonths)}
    group by date_trunc('month', activated_at)
    order by month
  `)) as any;
  const activationsPerMonth = (activationsResult.rows || []).map((r: any) => ({
    month: monthKey(new Date(r.month)),
    activations: Number(r.activations)
  }));

  // Resource usage - daily avg dbSizeMB and RAM used (last 14 days)
  const resourceResult = (await db.execute(sql`
    select date_trunc('day', created_at)::date as date,
      avg((metadata->>'dbSizeMB')::numeric) as avg_db_size,
      avg((metadata->>'totalMemoryGB')::numeric - (metadata->>'freeMemoryGB')::numeric) as avg_ram_used
    from heartbeats
    where metadata is not null
      and (metadata->>'dbSizeMB') is not null
      and (metadata->>'totalMemoryGB') is not null
      and (metadata->>'freeMemoryGB') is not null
      and created_at >= ${new Date(now - fourteenDays)}
    group by date_trunc('day', created_at)
    order by date
  `)) as any;
  const dbSizeTrend = (resourceResult.rows || []).map((r: any) => ({
    date: new Date(r.date).toLocaleDateString("en-IN", { month: "short", day: "numeric" }),
    dbSizeMB: Number(r.avg_db_size)
  }));
  const ramUsedTrend = (resourceResult.rows || []).map((r: any) => ({
    date: new Date(r.date).toLocaleDateString("en-IN", { month: "short", day: "numeric" }),
    ramUsedGB: Number(r.avg_ram_used)
  }));

  // App version timeline (last 14 days)
  const versionResult = (await db.execute(sql`
    select date_trunc('day', created_at)::date as date, app_version as version, count(*) as count
    from heartbeats
    where created_at >= ${new Date(now - fourteenDays)}
    group by date_trunc('day', created_at), app_version
    order by date, count desc
  `)) as any;
  const appVersionTimeline = (versionResult.rows || []).map((r: any) => ({
    date: new Date(r.date).toLocaleDateString("en-IN", { month: "short", day: "numeric" }),
    version: r.version,
    count: Number(r.count)
  }));

  // Errors from client_logs (last 7 days)
  const errorsResult = (await db.execute(sql`
    select date_trunc('day', created_at)::date as bucket,
      level,
      count(*) as count
    from client_logs
    where level in ('error', 'fatal')
      and created_at >= ${new Date(now - sevenDays)}
    group by date_trunc('day', created_at), level
    order by bucket
  `)) as any;
  const byLevelOverTimeMap = new Map<string, Record<string, number>>();
  for (const row of errorsResult.rows || []) {
    const key = new Date(row.bucket).toLocaleDateString("en-IN", { month: "short", day: "numeric" });
    if (!byLevelOverTimeMap.has(key)) {
      byLevelOverTimeMap.set(key, { debug: 0, info: 0, warn: 0, error: 0, fatal: 0 });
    }
    byLevelOverTimeMap.get(key)![row.level] = Number(row.count);
  }
  const byLevelOverTime = Array.from(byLevelOverTimeMap.entries()).map(([bucket, levels]) => ({
    bucket,
    ...levels
  }));

  // Error by level (total last 7 days)
  const byLevelResult = (await db.execute(sql`
    select level, count(*) as count
    from client_logs
    where level in ('debug', 'info', 'warn', 'error', 'fatal')
      and created_at >= ${new Date(now - sevenDays)}
    group by level
  `)) as any;
  const byLevel = (byLevelResult.rows || []).map((r: any) => ({
    level: r.level,
    count: Number(r.count)
  }));

  // Top error messages (last 7 days)
  const topMessagesResult = (await db.execute(sql`
    select left(message, 200) as message, count(*) as count
    from client_logs
    where level in ('error', 'fatal')
      and created_at >= ${new Date(now - sevenDays)}
    group by left(message, 200)
    order by count desc
    limit 8
  `)) as any;
  const topMessages = (topMessagesResult.rows || []).map((r: any) => ({
    message: r.message,
    count: Number(r.count)
  }));

  // Top failing clients (last 7 days)
  const topFailingResult = (await db.execute(sql`
    select cl.license_id as licenseId, l.shop_name as shopName, count(*) as count
    from client_logs cl
    join licenses l on cl.license_id = l.id
    where cl.level in ('error', 'fatal')
      and cl.created_at >= ${new Date(now - sevenDays)}
    group by cl.license_id, l.shop_name
    order by count desc
    limit 8
  `)) as any;
  const topFailingClients = (topFailingResult.rows || []).map((r: any) => ({
    licenseId: r.licenseId,
    shopName: r.shopName,
    count: Number(r.count)
  }));

  const totalErrorsResult = (await db.execute(sql`
    select count(*) as total
    from client_logs
    where level in ('error', 'fatal')
      and created_at >= ${new Date(now - sevenDays)}
  `)) as any;
  const totalErrors = Number((totalErrorsResult.rows?.[0]?.total) ?? 0);

  return {
    revenue: {
      monthly: revenueMonthly,
      byPlan: revenueByPlan
    },
    activations: { perMonth: activationsPerMonth },
    resourceUsage: { dbSizeTrend, ramUsedTrend, appVersionTimeline },
    errors: {
      byLevelOverTime,
      byLevel,
      topMessages,
      topFailingClients,
      total: totalErrors
    }
  };
}

export async function licenseWithHeartbeatHistory(id: string) {
  const license = await db.query.licenses.findFirst({
    where: and(eq(licenses.id, id), isNull(licenses.deletedAt))
  });

  if (!license) {
    return undefined;
  }

  const [history, latestHeartbeat, events, activations, payments, logSummary] = await Promise.all([
    db.query.heartbeats.findMany({
      where: eq(heartbeats.licenseId, id),
      orderBy: desc(heartbeats.createdAt),
      limit: 100
    }),
    db.query.heartbeats.findFirst({
      where: eq(heartbeats.licenseId, id),
      orderBy: desc(heartbeats.createdAt)
    }),
    db.query.licenseEvents.findMany({
      where: eq(licenseEvents.licenseId, id),
      orderBy: desc(licenseEvents.createdAt),
      limit: 100
    }),
    db.query.licenseActivations.findMany({
      where: eq(licenseActivations.licenseId, id),
      orderBy: desc(licenseActivations.activatedAt),
      limit: 100
    }),
    db.query.paymentEvents.findMany({
      where: eq(paymentEvents.licenseId, id),
      orderBy: desc(paymentEvents.createdAt),
      limit: 100
    }),
    db
      .select({ level: clientLogs.level, count: count() })
      .from(clientLogs)
      .where(eq(clientLogs.licenseId, id))
      .groupBy(clientLogs.level)
  ]);

  const usageSummary = latestHeartbeat
    ? {
        billsToday: latestHeartbeat.billsToday,
        totalBills: latestHeartbeat.totalBills,
        totalCustomers: latestHeartbeat.totalCustomers,
        totalProducts: latestHeartbeat.totalProducts,
        appVersion: latestHeartbeat.appVersion,
        lastHeartbeatAt: latestHeartbeat.createdAt
      }
    : null;

  const byLevel: Record<ClientLogLevel, number> = {
    debug: 0,
    info: 0,
    warn: 0,
    error: 0,
    fatal: 0
  };
  for (const row of logSummary) {
    byLevel[row.level as ClientLogLevel] = Number(row.count);
  }
  const totalLogs = logSummary.reduce((sum, row) => sum + Number(row.count), 0);

  return { ...license, usageSummary, heartbeats: history, events, activations, payments, logSummary: { total: totalLogs, byLevel } };
}

export const updatedNow = sql`now()`;

export function publicKeyPayload() {
  return {
    keyId: licenseKeyId(),
    algorithm: "RS256",
    publicKey: licensePublicKey() ?? null
  };
}

export async function planCatalog() {
  const rows = await db.query.plans.findMany({
    with: {
      entitlements: true
    },
    orderBy: plans.code
  });

  if (!rows.length) {
    return (["starter", "professional", "enterprise"] as Plan[]).map((plan) => ({
      code: plan,
      name: plan[0].toUpperCase() + plan.slice(1),
      monthlyPrice: planMonthlyPrices[plan],
      entitlements: featureFlags[plan]
    }));
  }

  return rows.map((plan) => ({
    code: plan.code,
    name: plan.name,
    monthlyPrice: plan.monthlyPrice,
    isActive: plan.isActive,
    entitlements: Object.fromEntries(
      plan.entitlements.map((entitlement) => [
        entitlement.entitlementKey,
        entitlement.valueType === "boolean"
          ? Boolean(entitlement.booleanValue)
          : entitlement.valueType === "number"
            ? entitlement.numberValue ?? 0
            : entitlement.textValue ?? ""
      ])
    )
  }));
}
