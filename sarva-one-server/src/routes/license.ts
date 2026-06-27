import { Router } from "express";
import { z } from "zod";
import { db } from "../db/connection.js";
import { licenses } from "../db/schema.js";
import { requireApiKey, verifyAdminToken } from "../middleware/auth.js";
import { licenseRateLimit } from "../middleware/rateLimit.js";
import {
  errorResponse,
  expiryState,
  featureFlags,
  findLicenseByKey,
  insertHeartbeat,
  publicLicensePayload,
  setMachineAndActivate,
  successResponse
} from "../services/licenseService.js";
import { eq } from "drizzle-orm";

export const licenseRouter = Router();

licenseRouter.use(licenseRateLimit, requireApiKey);

const activationSchema = z.object({
  key: z.string().min(1),
  machineId: z.string().min(1),
  appVersion: z.string().min(1)
});

const heartbeatSchema = activationSchema.extend({
  usageStats: z
    .object({
      billsToday: z.number().int().nonnegative().optional(),
      totalBills: z.number().int().nonnegative().optional(),
      totalCustomers: z.number().int().nonnegative().optional(),
      totalProducts: z.number().int().nonnegative().optional()
    })
    .optional()
});

const deactivateSchema = z.object({
  key: z.string().min(1),
  machineId: z.string().min(1),
  adminToken: z.string().min(1)
});

licenseRouter.post("/activate", async (req, res, next) => {
  try {
    const body = activationSchema.parse(req.body);
    const license = await findLicenseByKey(body.key);

    if (!license) {
      return res.status(404).json(errorResponse("LICENSE_NOT_FOUND", "License key was not found."));
    }

    if (!["trial", "active"].includes(license.status)) {
      return res.status(403).json(errorResponse("LICENSE_INACTIVE", "License is not available for activation."));
    }

    const state = expiryState(license);

    if (state.status === "expired") {
      return res.status(403).json(errorResponse("LICENSE_EXPIRED", "License has expired."));
    }

    if (license.machineId && license.machineId !== body.machineId) {
      return res
        .status(409)
        .json(errorResponse("MACHINE_MISMATCH", "License already activated on another device."));
    }

    const updated = await setMachineAndActivate(license, body.machineId);

    return res.json(
      successResponse({
        status: updated.status,
        ...publicLicensePayload(updated)
      })
    );
  } catch (error) {
    if (error instanceof z.ZodError) {
      return res.status(400).json(errorResponse("VALIDATION_ERROR", error.errors[0]?.message ?? "Invalid request."));
    }

    return next(error);
  }
});

licenseRouter.post("/validate", async (req, res, next) => {
  try {
    const body = activationSchema.parse(req.body);
    const license = await findLicenseByKey(body.key);

    if (!license) {
      return res.status(404).json(errorResponse("LICENSE_NOT_FOUND", "License key was not found."));
    }

    if (license.machineId !== body.machineId) {
      return res.status(409).json(errorResponse("MACHINE_MISMATCH", "License is not activated on this device."));
    }

    if (license.status === "suspended") {
      return res.json(
        successResponse({
          status: "suspended",
          plan: license.plan,
          expiresAt: license.expiresAt,
          features: featureFlags[license.plan],
          daysRemaining: 0
        })
      );
    }

    const state = expiryState(license);

    return res.json(
      successResponse({
        status: state.status,
        plan: license.plan,
        expiresAt: license.expiresAt,
        features: featureFlags[license.plan],
        daysRemaining: state.daysRemaining
      })
    );
  } catch (error) {
    if (error instanceof z.ZodError) {
      return res.status(400).json(errorResponse("VALIDATION_ERROR", error.errors[0]?.message ?? "Invalid request."));
    }

    return next(error);
  }
});

licenseRouter.post("/heartbeat", async (req, res) => {
  try {
    const body = heartbeatSchema.parse(req.body);
    const license = await findLicenseByKey(body.key);

    if (license && license.machineId === body.machineId) {
      await insertHeartbeat({
        licenseId: license.id,
        machineId: body.machineId,
        appVersion: body.appVersion,
        ipAddress: req.ip ?? req.socket.remoteAddress ?? "unknown",
        usageStats: body.usageStats
      });
    }

    return res.json(successResponse({ received: true }));
  } catch (error) {
    console.error("Heartbeat processing error:", error);
    return res.json(successResponse({ received: true }));
  }
});

licenseRouter.post("/deactivate-machine", async (req, res, next) => {
  try {
    const body = deactivateSchema.parse(req.body);
    verifyAdminToken(body.adminToken);

    const license = await findLicenseByKey(body.key);

    if (!license) {
      return res.status(404).json(errorResponse("LICENSE_NOT_FOUND", "License key was not found."));
    }

    if (license.machineId !== body.machineId) {
      return res.status(409).json(errorResponse("MACHINE_MISMATCH", "License is not activated on this device."));
    }

    await db
      .update(licenses)
      .set({ machineId: null, activatedAt: null, updatedAt: new Date() })
      .where(eq(licenses.id, license.id));

    return res.json(successResponse({ deactivated: true }));
  } catch (error) {
    if (error instanceof z.ZodError) {
      return res.status(400).json(errorResponse("VALIDATION_ERROR", error.errors[0]?.message ?? "Invalid request."));
    }

    if (error instanceof Error && (error.name === "JsonWebTokenError" || error.name === "TokenExpiredError" || error.name === "NotBeforeError")) {
      return res.status(401).json(errorResponse("INVALID_TOKEN", "Admin token is invalid or expired."));
    }

    return next(error);
  }
});
