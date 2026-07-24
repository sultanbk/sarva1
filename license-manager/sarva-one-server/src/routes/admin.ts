import bcrypt from "bcryptjs";
import { and, asc, count, desc, eq, isNull, ilike, or } from "drizzle-orm";
import { Router, type Request } from "express";
import { z } from "zod";
import { db } from "../db/connection.js";
import { adminUsers, licenseActivations, licenseEvents, licenses, paymentEvents } from "../db/schema.js";
import { requireAdminAuth, signAdminToken } from "../middleware/auth.js";
import { adminRateLimit, loginRateLimit } from "../middleware/rateLimit.js";
import {
  buildLicenseFilters,
  dashboardStats,
  errorResponse,
  generateUniqueLicenseKey,
  latestHeartbeatAtSql,
  licenseListColumns,
  licenseStatePayload,
  licenseWithHeartbeatHistory,
  planCatalog,
  planMonthlyPrices,
  recordLicenseEvent,
  successResponse
} from "../services/licenseService.js";

export const adminRouter = Router();

adminRouter.use(adminRateLimit);

const validationMessage = (error: z.ZodError) =>
  error.errors.map((issue) => `${issue.path.join(".") || "body"}: ${issue.message}`).join("; ");

const loginSchema = z.object({
  email: z.string().email(),
  password: z.string().min(1)
});

const setupSchema = z.object({
  email: z.string().email(),
  password: z.string().min(10),
  name: z.string().min(1)
});

const listSchema = z.object({
  page: z.coerce.number().int().positive().default(1),
  pageSize: z.coerce.number().int().positive().max(100).default(20),
  status: z.enum(["trial", "active", "expired", "suspended"]).optional(),
  plan: z.enum(["starter", "professional", "enterprise"]).optional(),
  q: z.string().trim().min(1).optional(),
  sort: z.enum(["createdAt", "shopName", "ownerName", "plan", "status", "expiresAt", "lastHeartbeatAt"]).default("createdAt"),
  includeArchived: z.enum(["true", "false"]).transform((value) => value === "true").optional()
});

const createLicenseSchema = z.object({
  shopName: z.string({ required_error: "Shop name is required." }).min(1),
  ownerName: z.string({ required_error: "Owner name is required." }).min(1),
  phone: z.string({ required_error: "Phone is required." }).min(1),
  email: z.string({ required_error: "Email is required." }).email(),
  plan: z.enum(["starter", "professional", "enterprise"]),
  status: z.enum(["trial", "active", "expired", "suspended"]).default("trial"),
  expiresAt: z.coerce.date().optional(),
  duration: z.enum(["1month", "3months", "6months", "1year"]).optional(),
  gracePeriodDays: z.number().int().nonnegative().default(7),
  maxSeats: z.number().int().positive().max(99).default(1),
  notes: z.string().nullable().optional()
});

function expiresAtFromDuration(duration: "1month" | "3months" | "6months" | "1year") {
  const durationDays = {
    "1month": 30,
    "3months": 90,
    "6months": 180,
    "1year": 365
  } satisfies Record<typeof duration, number>;

  return new Date(Date.now() + durationDays[duration] * 24 * 60 * 60 * 1000);
}

const updateLicenseSchema = z.object({
  plan: z.enum(["starter", "professional", "enterprise"]).optional(),
  status: z.enum(["trial", "active", "expired", "suspended"]).optional(),
  expiresAt: z.coerce.date().optional(),
  maxSeats: z.number().int().positive().max(99).optional(),
  gracePeriodDays: z.number().int().nonnegative().optional(),
  notes: z.string().nullable().optional()
});

const changePasswordSchema = z.object({
  currentPassword: z.string().min(1),
  newPassword: z.string().min(10)
});

const manualPaymentSchema = z.object({
  amount: z.number().int().positive(),
  currency: z.string().min(1).max(10).default("INR"),
  provider: z.string().min(1).max(50).default("manual"),
  providerPaymentId: z.string().max(255).optional(),
  providerOrderId: z.string().max(255).optional(),
  months: z.number().int().positive().max(36).default(1),
  rawPayload: z.record(z.unknown()).optional()
});

function withLicenseState<T extends Parameters<typeof licenseStatePayload>[0]>(license: T) {
  return {
    ...license,
    ...licenseStatePayload(license)
  };
}

function requestIp(req: Request) {
  return req.ip ?? req.socket.remoteAddress ?? "unknown";
}

async function recordAdminEvent(
  req: Request,
  eventType: string,
  metadata?: Record<string, unknown>,
  licenseId?: string | null
) {
  await recordLicenseEvent({
    licenseId,
    actorType: "admin",
    actorId: req.admin?.email ?? null,
    eventType,
    metadata,
    ipAddress: requestIp(req)
  });
}

function licenseOrderBy(sort: z.infer<typeof listSchema>["sort"]) {
  if (sort === "shopName") return asc(licenses.shopName);
  if (sort === "ownerName") return asc(licenses.ownerName);
  if (sort === "plan") return asc(licenses.plan);
  if (sort === "status") return asc(licenses.status);
  if (sort === "expiresAt") return asc(licenses.expiresAt);
  if (sort === "lastHeartbeatAt") return desc(latestHeartbeatAtSql());
  return desc(licenses.createdAt);
}

adminRouter.post("/login", loginRateLimit, async (req, res, next) => {
  try {
    const body = loginSchema.parse(req.body);
    const admin = await db.query.adminUsers.findFirst({
      where: eq(adminUsers.email, body.email)
    });

    if (!admin) {
      await recordLicenseEvent({
        actorType: "admin",
        actorId: body.email,
        eventType: "admin.login_failed",
        metadata: { reason: "admin_not_found" },
        ipAddress: requestIp(req)
      });
      return res.status(401).json(errorResponse("LOGIN_FAILED", "Email or password is incorrect."));
    }

    const passwordMatches = await bcrypt.compare(body.password, admin.passwordHash);

    if (!passwordMatches) {
      await recordLicenseEvent({
        actorType: "admin",
        actorId: body.email,
        eventType: "admin.login_failed",
        metadata: { reason: "invalid_password" },
        ipAddress: requestIp(req)
      });
      return res.status(401).json(errorResponse("LOGIN_FAILED", "Email or password is incorrect."));
    }

    const token = signAdminToken({
      id: admin.id,
      email: admin.email,
      name: admin.name
    });

    return res.json(
      successResponse({
        token,
        admin: {
          id: admin.id,
          email: admin.email,
          name: admin.name
        }
      })
    );
  } catch (error) {
    if (error instanceof z.ZodError) {
      return res.status(400).json(errorResponse("VALIDATION_ERROR", validationMessage(error)));
    }

    return next(error);
  }
});

adminRouter.post("/setup", async (_req, res) => {
  return res.status(403).json(
    errorResponse("UNAUTHORIZED", "Web-based admin initialization is disabled. Run the CLI tool: npm run admin:create")
  );
});

adminRouter.use(requireAdminAuth);

adminRouter.get("/config/api-key", (_req, res) => {
  const key = process.env.API_KEY ?? "";
  const masked = key.length > 4 ? "*".repeat(key.length - 4) + key.slice(-4) : key;
  return res.json(successResponse({ apiKey: masked }));
});

adminRouter.get("/plans", async (_req, res, next) => {
  try {
    return res.json(successResponse(await planCatalog()));
  } catch (error) {
    return next(error);
  }
});

adminRouter.put("/password", async (req, res, next) => {
  try {
    const body = changePasswordSchema.parse(req.body);
    const admin = await db.query.adminUsers.findFirst({
      where: eq(adminUsers.id, req.admin?.id ?? "")
    });

    if (!admin) {
      return res.status(404).json(errorResponse("UNAUTHORIZED", "Admin user was not found."));
    }

    const passwordMatches = await bcrypt.compare(body.currentPassword, admin.passwordHash);

    if (!passwordMatches) {
      return res.status(401).json(errorResponse("INVALID_PASSWORD", "Current password is incorrect."));
    }

    const passwordHash = await bcrypt.hash(body.newPassword, 12);
    await db.update(adminUsers).set({ passwordHash }).where(eq(adminUsers.id, admin.id));
    await recordAdminEvent(req, "admin.password_changed");

    return res.json(successResponse({ changed: true }));
  } catch (error) {
    if (error instanceof z.ZodError) {
      return res.status(400).json(errorResponse("VALIDATION_ERROR", validationMessage(error)));
    }

    return next(error);
  }
});

adminRouter.get("/licenses", async (req, res, next) => {
  try {
    const query = listSchema.parse(req.query);
    const where = buildLicenseFilters({ ...query, includeArchived: query.includeArchived ?? false });
    const offset = (query.page - 1) * query.pageSize;

    const [rows, totalRows] = await Promise.all([
      db
        .select(licenseListColumns())
        .from(licenses)
        .where(where)
        .orderBy(licenseOrderBy(query.sort))
        .limit(query.pageSize)
        .offset(offset),
      db.select({ total: count() }).from(licenses).where(where)
    ]);

    return res.json(
      successResponse({
        licenses: rows.map(withLicenseState),
        pagination: {
          page: query.page,
          pageSize: query.pageSize,
          total: totalRows[0]?.total ?? 0
        }
      })
    );
  } catch (error) {
    if (error instanceof z.ZodError) {
      return res.status(400).json(errorResponse("VALIDATION_ERROR", validationMessage(error)));
    }

    return next(error);
  }
});

adminRouter.post("/licenses", async (req, res, next) => {
  try {
    const body = createLicenseSchema.parse(req.body);
    const expiresAt = body.expiresAt ?? (body.duration ? expiresAtFromDuration(body.duration) : new Date("9999-12-31T23:59:59Z"));

    const key = await generateUniqueLicenseKey();
    const [created] = await db
      .insert(licenses)
      .values({
        key,
        shopName: body.shopName,
        ownerName: body.ownerName,
        phone: body.phone,
        email: body.email,
        plan: body.plan,
        status: body.status,
        expiresAt,
        gracePeriodDays: body.gracePeriodDays,
        maxSeats: body.maxSeats,
        createdBy: req.admin?.email ?? "unknown",
        notes: body.notes ?? null
      })
      .returning();
    await recordAdminEvent(req, "license.created", { after: created }, created.id);

    return res.status(201).json(successResponse(withLicenseState(created)));
  } catch (error) {
    if (error instanceof z.ZodError) {
      return res.status(400).json(errorResponse("VALIDATION_ERROR", validationMessage(error)));
    }

    return next(error);
  }
});

adminRouter.get("/licenses/:id", async (req, res, next) => {
  try {
    const license = await licenseWithHeartbeatHistory(req.params.id);

    if (!license) {
      return res.status(404).json(errorResponse("LICENSE_NOT_FOUND", "License was not found."));
    }

    return res.json(successResponse(withLicenseState(license)));
  } catch (error) {
    return next(error);
  }
});

adminRouter.put("/licenses/:id", async (req, res, next) => {
  try {
    const body = updateLicenseSchema.parse(req.body);
    const existing = await db.query.licenses.findFirst({ where: eq(licenses.id, req.params.id) });

    if (!existing) {
      return res.status(404).json(errorResponse("LICENSE_NOT_FOUND", "License was not found."));
    }

    const [updated] = await db
      .update(licenses)
      .set({
        ...body,
        updatedAt: new Date()
      })
      .where(eq(licenses.id, req.params.id))
      .returning();

    if (!updated) {
      return res.status(404).json(errorResponse("LICENSE_NOT_FOUND", "License was not found."));
    }
    const eventType = body.expiresAt ? "license.renewed" : "license.updated";
    await recordAdminEvent(req, eventType, { before: existing, after: updated, changes: body }, updated.id);

    return res.json(successResponse(withLicenseState(updated)));
  } catch (error) {
    if (error instanceof z.ZodError) {
      return res.status(400).json(errorResponse("VALIDATION_ERROR", validationMessage(error)));
    }

    return next(error);
  }
});

adminRouter.delete("/licenses/:id", async (req, res, next) => {
  try {
    const existing = await db.query.licenses.findFirst({ where: eq(licenses.id, req.params.id) });

    if (!existing) {
      return res.status(404).json(errorResponse("LICENSE_NOT_FOUND", "License was not found."));
    }

    const [archived] = await db
      .update(licenses)
      .set({
        deletedAt: new Date(),
        deletedBy: req.admin?.email ?? "unknown",
        updatedAt: new Date()
      })
      .where(eq(licenses.id, req.params.id))
      .returning();

    await recordAdminEvent(req, "license.deleted", { before: existing, after: archived }, archived.id);

    return res.json(successResponse({ deleted: true, archived: true }));
  } catch (error) {
    return next(error);
  }
});

adminRouter.post("/licenses/:id/suspend", async (req, res, next) => {
  try {
    const existing = await db.query.licenses.findFirst({ where: eq(licenses.id, req.params.id) });

    if (!existing) {
      return res.status(404).json(errorResponse("LICENSE_NOT_FOUND", "License was not found."));
    }

    const [updated] = await db
      .update(licenses)
      .set({ status: "suspended", updatedAt: new Date() })
      .where(eq(licenses.id, req.params.id))
      .returning();

    if (!updated) {
      return res.status(404).json(errorResponse("LICENSE_NOT_FOUND", "License was not found."));
    }
    await recordAdminEvent(req, "license.suspended", { before: existing, after: updated }, updated.id);

    return res.json(successResponse(withLicenseState(updated)));
  } catch (error) {
    return next(error);
  }
});

adminRouter.post("/licenses/:id/activate", async (req, res, next) => {
  try {
    const existing = await db.query.licenses.findFirst({ where: eq(licenses.id, req.params.id) });

    if (!existing) {
      return res.status(404).json(errorResponse("LICENSE_NOT_FOUND", "License was not found."));
    }

    const updates: Record<string, unknown> = { status: "active", updatedAt: new Date() };

    if (existing.expiresAt <= new Date()) {
      updates.expiresAt = new Date(Date.now() + 30 * 24 * 60 * 60 * 1000);
    }

    const [updated] = await db
      .update(licenses)
      .set(updates)
      .where(eq(licenses.id, req.params.id))
      .returning();
    await recordAdminEvent(req, "license.reactivated", { before: existing, after: updated }, updated.id);

    return res.json(successResponse(withLicenseState(updated)));
  } catch (error) {
    return next(error);
  }
});

adminRouter.post("/licenses/:id/reset-machine", async (req, res, next) => {
  try {
    const existing = await db.query.licenses.findFirst({ where: eq(licenses.id, req.params.id) });

    if (!existing) {
      return res.status(404).json(errorResponse("LICENSE_NOT_FOUND", "License was not found."));
    }

    const [updated] = await db
      .update(licenses)
      .set({ machineId: null, activatedAt: null, updatedAt: new Date() })
      .where(eq(licenses.id, req.params.id))
      .returning();

    if (!updated) {
      return res.status(404).json(errorResponse("LICENSE_NOT_FOUND", "License was not found."));
    }
    await db
      .update(licenseActivations)
      .set({ deactivatedAt: new Date() })
      .where(and(eq(licenseActivations.licenseId, req.params.id), isNull(licenseActivations.deactivatedAt)));
    await recordAdminEvent(req, "license.machine_reset", { before: existing, after: updated }, updated.id);

    return res.json(successResponse(withLicenseState(updated)));
  } catch (error) {
    return next(error);
  }
});

adminRouter.post("/licenses/:id/activations/:activationId/deactivate", async (req, res, next) => {
  try {
    const [updated] = await db
      .update(licenseActivations)
      .set({ deactivatedAt: new Date() })
      .where(and(eq(licenseActivations.id, req.params.activationId), eq(licenseActivations.licenseId, req.params.id)))
      .returning();

    if (!updated) {
      return res.status(404).json(errorResponse("LICENSE_NOT_FOUND", "Activation was not found."));
    }

    await recordAdminEvent(req, "license.machine_deactivated", { activationId: updated.id }, req.params.id);

    return res.json(successResponse(updated));
  } catch (error) {
    return next(error);
  }
});

adminRouter.post("/licenses/:id/activations/:activationId/block", async (req, res, next) => {
  try {
    const [updated] = await db
      .update(licenseActivations)
      .set({ blockedAt: new Date(), deactivatedAt: new Date() })
      .where(and(eq(licenseActivations.id, req.params.activationId), eq(licenseActivations.licenseId, req.params.id)))
      .returning();

    if (!updated) {
      return res.status(404).json(errorResponse("LICENSE_NOT_FOUND", "Activation was not found."));
    }

    await recordAdminEvent(req, "license.machine_blocked", { activationId: updated.id, machineIdHash: updated.machineIdHash }, req.params.id);

    return res.json(successResponse(updated));
  } catch (error) {
    return next(error);
  }
});

adminRouter.post("/licenses/:id/activations/:activationId/unblock", async (req, res, next) => {
  try {
    const [updated] = await db
      .update(licenseActivations)
      .set({ blockedAt: null })
      .where(and(eq(licenseActivations.id, req.params.activationId), eq(licenseActivations.licenseId, req.params.id)))
      .returning();

    if (!updated) {
      return res.status(404).json(errorResponse("LICENSE_NOT_FOUND", "Activation was not found."));
    }

    await recordAdminEvent(req, "license.machine_unblocked", { activationId: updated.id, machineIdHash: updated.machineIdHash }, req.params.id);

    return res.json(successResponse(updated));
  } catch (error) {
    return next(error);
  }
});

adminRouter.get("/licenses/:id/renewal-quote", async (req, res, next) => {
  try {
    const license = await db.query.licenses.findFirst({ where: eq(licenses.id, req.params.id) });

    if (!license) {
      return res.status(404).json(errorResponse("LICENSE_NOT_FOUND", "License was not found."));
    }

    const months = Number(req.query.months ?? 1);
    const safeMonths = Number.isInteger(months) && months > 0 && months <= 36 ? months : 1;
    const amount = safeMonths * (planMonthlyPrices[license.plan] ?? 0);

    return res.json(
      successResponse({
        licenseId: license.id,
        plan: license.plan,
        months: safeMonths,
        amount,
        currency: "INR"
      })
    );
  } catch (error) {
    return next(error);
  }
});

adminRouter.post("/licenses/:id/manual-payment", async (req, res, next) => {
  try {
    const body = manualPaymentSchema.parse(req.body);
    const existing = await db.query.licenses.findFirst({ where: eq(licenses.id, req.params.id) });

    if (!existing) {
      return res.status(404).json(errorResponse("LICENSE_NOT_FOUND", "License was not found."));
    }

    const currentExpiry = existing.expiresAt.getTime() > Date.now() ? existing.expiresAt : new Date();
    const expiresAt = new Date(currentExpiry.getTime() + body.months * 30 * 24 * 60 * 60 * 1000);
    const [payment] = await db
      .insert(paymentEvents)
      .values({
        licenseId: existing.id,
        provider: body.provider,
        providerPaymentId: body.providerPaymentId ?? null,
        providerOrderId: body.providerOrderId ?? null,
        amount: body.amount,
        currency: body.currency,
        status: "paid",
        rawPayload: body.rawPayload
      })
      .returning();
    const [updated] = await db
      .update(licenses)
      .set({ expiresAt, status: "active", updatedAt: new Date() })
      .where(eq(licenses.id, existing.id))
      .returning();

    await recordAdminEvent(req, "payment.manual_recorded", { payment, before: existing, after: updated }, existing.id);
    await recordAdminEvent(req, "license.renewed", { paymentId: payment.id, months: body.months }, existing.id);

    return res.json(successResponse({ payment, license: withLicenseState(updated) }));
  } catch (error) {
    if (error instanceof z.ZodError) {
      return res.status(400).json(errorResponse("VALIDATION_ERROR", validationMessage(error)));
    }

    return next(error);
  }
});

adminRouter.get("/dashboard", async (_req, res, next) => {
  try {
    return res.json(successResponse(await dashboardStats()));
  } catch (error) {
    return next(error);
  }
});

const auditLogQuerySchema = z.object({
  page: z.coerce.number().int().positive().default(1),
  pageSize: z.coerce.number().int().positive().max(100).default(20),
  actorType: z.string().optional(),
  eventType: z.string().optional(),
  q: z.string().optional(),
  licenseId: z.string().uuid().optional()
});

adminRouter.get("/audit-log", async (req, res, next) => {
  try {
    const query = auditLogQuerySchema.parse(req.query);
    const offset = (query.page - 1) * query.pageSize;
    
    const conditions = [];
    if (query.actorType) {
      conditions.push(eq(licenseEvents.actorType, query.actorType));
    }
    if (query.eventType) {
      conditions.push(eq(licenseEvents.eventType, query.eventType));
    }
    if (query.licenseId) {
      conditions.push(eq(licenseEvents.licenseId, query.licenseId));
    }
    if (query.q) {
      const search = `%${query.q}%`;
      conditions.push(
        or(
          ilike(licenseEvents.actorId, search),
          ilike(licenseEvents.eventType, search)
        )
      );
    }
    const where = conditions.length ? and(...conditions) : undefined;

    const [rows, totalRows] = await Promise.all([
      db
        .select()
        .from(licenseEvents)
        .where(where)
        .orderBy(desc(licenseEvents.createdAt))
        .limit(query.pageSize)
        .offset(offset),
      db.select({ total: count() }).from(licenseEvents).where(where)
    ]);

    return res.json(
      successResponse({
        events: rows,
        pagination: {
          page: query.page,
          pageSize: query.pageSize,
          total: totalRows[0]?.total ?? 0
        }
      })
    );
  } catch (error) {
    if (error instanceof z.ZodError) {
      return res.status(400).json(errorResponse("VALIDATION_ERROR", validationMessage(error)));
    }
    return next(error);
  }
});

const bulkExtendSchema = z.object({
  licenseIds: z.array(z.string().uuid()),
  months: z.number().int().positive().max(36)
});

adminRouter.post("/licenses/bulk-extend", async (req, res, next) => {
  try {
    const body = bulkExtendSchema.parse(req.body);
    const updatedLicenses: any[] = [];
    
    await db.transaction(async (tx) => {
      for (const id of body.licenseIds) {
        const existing = await tx.query.licenses.findFirst({ where: eq(licenses.id, id) });
        if (!existing) continue;

        const currentExpiry = existing.expiresAt.getTime() > Date.now() ? existing.expiresAt : new Date();
        const expiresAt = new Date(currentExpiry.getTime() + body.months * 30 * 24 * 60 * 60 * 1000);

        const [updated] = await tx
          .update(licenses)
          .set({ expiresAt, status: "active", updatedAt: new Date() })
          .where(eq(licenses.id, id))
          .returning();

        if (updated) {
          updatedLicenses.push(withLicenseState(updated));
          await recordLicenseEvent({
            licenseId: id,
            actorType: "admin",
            actorId: req.admin?.email ?? null,
            eventType: "license.renewed",
            metadata: { bulk: true, months: body.months, before: existing, after: updated },
            ipAddress: requestIp(req)
          });
        }
      }
    });

    return res.json(successResponse({ updated: updatedLicenses }));
  } catch (error) {
    if (error instanceof z.ZodError) {
      return res.status(400).json(errorResponse("VALIDATION_ERROR", validationMessage(error)));
    }
    return next(error);
  }
});
