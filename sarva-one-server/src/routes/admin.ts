import bcrypt from "bcryptjs";
import { and, count, desc, eq } from "drizzle-orm";
import { Router } from "express";
import { z } from "zod";
import { db } from "../db/connection.js";
import { adminUsers, licenses } from "../db/schema.js";
import { requireAdminAuth, signAdminToken } from "../middleware/auth.js";
import { adminRateLimit } from "../middleware/rateLimit.js";
import {
  buildLicenseFilters,
  dashboardStats,
  errorResponse,
  generateUniqueLicenseKey,
  licenseWithHeartbeatHistory,
  successResponse
} from "../services/licenseService.js";

export const adminRouter = Router();

adminRouter.use(adminRateLimit);

const loginSchema = z.object({
  email: z.string().email(),
  password: z.string().min(1)
});

const listSchema = z.object({
  page: z.coerce.number().int().positive().default(1),
  pageSize: z.coerce.number().int().positive().max(100).default(20),
  status: z.enum(["trial", "active", "expired", "suspended"]).optional(),
  plan: z.enum(["starter", "growth", "pro", "custom"]).optional(),
  q: z.string().trim().min(1).optional()
});

const createLicenseSchema = z.object({
  shopName: z.string().min(1),
  ownerName: z.string().min(1),
  phone: z.string().min(1),
  email: z.string().email(),
  plan: z.enum(["starter", "growth", "pro", "custom"]),
  status: z.enum(["trial", "active", "expired", "suspended"]).default("trial"),
  expiresAt: z.coerce.date(),
  gracePeriodDays: z.number().int().nonnegative().default(7),
  notes: z.string().nullable().optional()
});

const updateLicenseSchema = z.object({
  plan: z.enum(["starter", "growth", "pro", "custom"]).optional(),
  status: z.enum(["trial", "active", "expired", "suspended"]).optional(),
  expiresAt: z.coerce.date().optional(),
  notes: z.string().nullable().optional()
});

adminRouter.post("/login", async (req, res, next) => {
  try {
    const body = loginSchema.parse(req.body);
    const admin = await db.query.adminUsers.findFirst({
      where: eq(adminUsers.email, body.email)
    });

    if (!admin) {
      return res.status(401).json(errorResponse("LOGIN_FAILED", "Email or password is incorrect."));
    }

    const passwordMatches = await bcrypt.compare(body.password, admin.passwordHash);

    if (!passwordMatches) {
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
      return res.status(400).json(errorResponse("VALIDATION_ERROR", error.errors[0]?.message ?? "Invalid request."));
    }

    return next(error);
  }
});

adminRouter.use(requireAdminAuth);

adminRouter.get("/licenses", async (req, res, next) => {
  try {
    const query = listSchema.parse(req.query);
    const where = buildLicenseFilters(query);
    const offset = (query.page - 1) * query.pageSize;

    const [rows, totalRows] = await Promise.all([
      db.select().from(licenses).where(where).orderBy(desc(licenses.createdAt)).limit(query.pageSize).offset(offset),
      db.select({ total: count() }).from(licenses).where(where)
    ]);

    return res.json(
      successResponse({
        licenses: rows,
        pagination: {
          page: query.page,
          pageSize: query.pageSize,
          total: totalRows[0]?.total ?? 0
        }
      })
    );
  } catch (error) {
    if (error instanceof z.ZodError) {
      return res.status(400).json(errorResponse("VALIDATION_ERROR", error.errors[0]?.message ?? "Invalid request."));
    }

    return next(error);
  }
});

adminRouter.post("/licenses", async (req, res, next) => {
  try {
    const body = createLicenseSchema.parse(req.body);
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
        expiresAt: body.expiresAt,
        gracePeriodDays: body.gracePeriodDays,
        createdBy: req.admin?.email ?? "unknown",
        notes: body.notes ?? null
      })
      .returning();

    return res.status(201).json(successResponse(created));
  } catch (error) {
    if (error instanceof z.ZodError) {
      return res.status(400).json(errorResponse("VALIDATION_ERROR", error.errors[0]?.message ?? "Invalid request."));
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

    return res.json(successResponse(license));
  } catch (error) {
    return next(error);
  }
});

adminRouter.put("/licenses/:id", async (req, res, next) => {
  try {
    const body = updateLicenseSchema.parse(req.body);
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

    return res.json(successResponse(updated));
  } catch (error) {
    if (error instanceof z.ZodError) {
      return res.status(400).json(errorResponse("VALIDATION_ERROR", error.errors[0]?.message ?? "Invalid request."));
    }

    return next(error);
  }
});

adminRouter.post("/licenses/:id/suspend", async (req, res, next) => {
  try {
    const [updated] = await db
      .update(licenses)
      .set({ status: "suspended", updatedAt: new Date() })
      .where(eq(licenses.id, req.params.id))
      .returning();

    if (!updated) {
      return res.status(404).json(errorResponse("LICENSE_NOT_FOUND", "License was not found."));
    }

    return res.json(successResponse(updated));
  } catch (error) {
    return next(error);
  }
});

adminRouter.post("/licenses/:id/activate", async (req, res, next) => {
  try {
    const [updated] = await db
      .update(licenses)
      .set({ status: "active", updatedAt: new Date() })
      .where(eq(licenses.id, req.params.id))
      .returning();

    if (!updated) {
      return res.status(404).json(errorResponse("LICENSE_NOT_FOUND", "License was not found."));
    }

    return res.json(successResponse(updated));
  } catch (error) {
    return next(error);
  }
});

adminRouter.post("/licenses/:id/reset-machine", async (req, res, next) => {
  try {
    const [updated] = await db
      .update(licenses)
      .set({ machineId: null, activatedAt: null, updatedAt: new Date() })
      .where(eq(licenses.id, req.params.id))
      .returning();

    if (!updated) {
      return res.status(404).json(errorResponse("LICENSE_NOT_FOUND", "License was not found."));
    }

    return res.json(successResponse(updated));
  } catch (error) {
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
