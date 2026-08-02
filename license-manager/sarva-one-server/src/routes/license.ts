import { Router } from "express";
import { z } from "zod";
import { db } from "../db/connection.js";
import { licenses } from "../db/schema.js";
import { requireApiKey } from "../middleware/auth.js";
import { clientLogRateLimit, licenseRateLimit } from "../middleware/rateLimit.js";
import {
  errorResponse,
  expiryState,
  findLicenseByKey,
  insertClientLogs,
  insertHeartbeat,
  isMachineActivated,
  isMachineBlocked,
  publicKeyPayload,
  publicLicensePayload,
  recordLicenseEvent,
  setMachineAndActivate,
  successResponse
} from "../services/licenseService.js";
import { eq } from "drizzle-orm";

export const licenseRouter = Router();

licenseRouter.use(requireApiKey);

const activationSchema = z.object({
  key: z.string().min(1),
  machineId: z.string().min(1),
  appVersion: z.string().min(1),
  hostname: z.string().min(1).optional()
});

const heartbeatSchema = activationSchema.extend({
  usageStats: z
    .object({
      billsToday: z.number().int().nonnegative().optional(),
      totalBills: z.number().int().nonnegative().optional(),
      totalCustomers: z.number().int().nonnegative().optional(),
      totalProducts: z.number().int().nonnegative().optional()
    })
    .optional(),
  systemMetadata: z
    .object({
      osPlatform: z.string(),
      osRelease: z.string(),
      cpuModel: z.string(),
      cpuCores: z.number().int(),
      totalMemoryGB: z.number().int(),
      freeMemoryGB: z.number().int(),
      timezone: z.string(),
      chromeVersion: z.string(),
      electronVersion: z.string(),
      dbSizeMB: z.number()
    })
    .optional()
});

const logEntrySchema = z.object({
  level: z.enum(["debug", "info", "warn", "error", "fatal"]),
  message: z.string().min(1).max(2000),
  source: z.string().min(1).max(100).optional(),
  stackTrace: z.string().max(4000).optional(),
  metadata: z
    .record(z.unknown())
    .refine((value) => JSON.stringify(value ?? {}).length <= 4000, "metadata exceeds 4000 characters")
    .optional(),
  clientTs: z.string().datetime({ offset: true }).optional()
});

const logsSchema = z.object({
  key: z.string().min(1),
  machineId: z.string().min(1).max(255),
  appVersion: z.string().min(1).max(50),
  logs: z.array(logEntrySchema).min(1).max(100)
});

licenseRouter.get("/public-key", licenseRateLimit, (_req, res) => {
  return res.json(successResponse(publicKeyPayload()));
});

licenseRouter.post("/activate", licenseRateLimit, async (req, res, next) => {
  try {
    const body = activationSchema.parse(req.body);
    const license = await findLicenseByKey(body.key);

    if (!license) {
      return res.status(404).json(errorResponse("LICENSE_NOT_FOUND", "License key was not found."));
    }

    if (!["trial", "active"].includes(license.status)) {
      return res.status(403).json(errorResponse("LICENSE_INACTIVE", "License is not available for activation."));
    }

    if (await isMachineBlocked(body.machineId)) {
      return res.status(403).json(errorResponse("MACHINE_BLOCKED", "This device has been blocked by the administrator."));
    }

    const state = expiryState(license);

    if (state.status === "expired") {
      return res.status(403).json(errorResponse("LICENSE_EXPIRED", "License has expired."));
    }

    const activationResult = await setMachineAndActivate(license, body.machineId, body.appVersion, body.hostname);

    if (!activationResult.license) {
      await recordLicenseEvent({
        licenseId: license.id,
        actorType: "client",
        actorId: body.machineId,
        eventType: activationResult.error === "MAX_SEATS_EXCEEDED" ? "license.max_seats_exceeded" : "license.machine_mismatch",
        metadata: { endpoint: "activate", appVersion: body.appVersion, maxSeats: license.maxSeats },
        ipAddress: req.ip ?? req.socket.remoteAddress ?? "unknown"
      });

      if (activationResult.error === "MAX_SEATS_EXCEEDED") {
        return res.status(409).json(errorResponse("MAX_SEATS_EXCEEDED", "License has reached its active machine limit."));
      }

      return res.status(409).json(errorResponse("MACHINE_MISMATCH", "License already activated on another device."));
    }

    await recordLicenseEvent({
      licenseId: activationResult.license.id,
      actorType: "client",
      actorId: body.machineId,
      eventType: "license.activated",
      metadata: { appVersion: body.appVersion, hostname: body.hostname },
      ipAddress: req.ip ?? req.socket.remoteAddress ?? "unknown"
    });

    return res.json(
      successResponse({
        ...publicLicensePayload(activationResult.license)
      })
    );
  } catch (error) {
    if (error instanceof z.ZodError) {
      return res.status(400).json(errorResponse("VALIDATION_ERROR", error.errors[0]?.message ?? "Invalid request."));
    }

    return next(error);
  }
});

licenseRouter.post("/validate", licenseRateLimit, async (req, res, next) => {
  try {
    const body = activationSchema.parse(req.body);
    const license = await findLicenseByKey(body.key);

    if (!license) {
      return res.status(404).json(errorResponse("LICENSE_NOT_FOUND", "License key was not found."));
    }

    if (await isMachineBlocked(body.machineId)) {
      return res.status(403).json(errorResponse("MACHINE_BLOCKED", "This device has been blocked by the administrator."));
    }

    if (!(await isMachineActivated(license, body.machineId))) {
      await recordLicenseEvent({
        licenseId: license.id,
        actorType: "client",
        actorId: body.machineId,
        eventType: "license.validation_failed",
        metadata: { reason: "machine_mismatch", appVersion: body.appVersion },
        ipAddress: req.ip ?? req.socket.remoteAddress ?? "unknown"
      });
      return res.status(409).json(errorResponse("MACHINE_MISMATCH", "License is not activated on this device."));
    }

    return res.json(
      successResponse({
        ...publicLicensePayload(license)
      })
    );
  } catch (error) {
    if (error instanceof z.ZodError) {
      return res.status(400).json(errorResponse("VALIDATION_ERROR", error.errors[0]?.message ?? "Invalid request."));
    }

    return next(error);
  }
});

licenseRouter.post("/heartbeat", licenseRateLimit, async (req, res) => {
  try {
    const body = heartbeatSchema.parse(req.body);
    const license = await findLicenseByKey(body.key);

    if (!license) {
      return res.status(404).json(errorResponse("LICENSE_NOT_FOUND", "License key was not found."));
    }

    if (await isMachineBlocked(body.machineId)) {
      return res.status(403).json(errorResponse("MACHINE_BLOCKED", "This device has been blocked by the administrator."));
    }

    if (!(await isMachineActivated(license, body.machineId))) {
      return res.status(409).json(errorResponse("MACHINE_MISMATCH", "License is not activated on this device."));
    }

    if (license.status === "suspended") {
      return res.status(403).json(errorResponse("LICENSE_SUSPENDED", "License is suspended."));
    }

    await insertHeartbeat({
      licenseId: license.id,
      machineId: body.machineId,
      appVersion: body.appVersion,
      ipAddress: req.ip ?? req.socket.remoteAddress ?? "unknown",
      usageStats: body.usageStats,
      systemMetadata: body.systemMetadata
    });

    return res.json(successResponse({ received: true }));
  } catch (error) {
    console.error("Heartbeat processing error:", error);
    return res.json(successResponse({ received: true }));
  }
});

licenseRouter.post("/logs", clientLogRateLimit, async (req, res) => {
  try {
    const body = logsSchema.parse(req.body);
    const license = await findLicenseByKey(body.key);
    if (!license) return res.status(404).json(errorResponse("LICENSE_NOT_FOUND", "License key was not found."));
    if (await isMachineBlocked(body.machineId)) return res.status(403).json(errorResponse("MACHINE_BLOCKED", "This device has been blocked by the administrator."));
    if (!(await isMachineActivated(license, body.machineId))) return res.status(409).json(errorResponse("MACHINE_MISMATCH", "License is not activated on this device."));
    await insertClientLogs({
      licenseId: license.id,
      machineId: body.machineId,
      appVersion: body.appVersion,
      ipAddress: req.ip ?? req.socket.remoteAddress ?? "unknown",
      entries: body.logs
    });
    return res.json(successResponse({ received: body.logs.length }));
  } catch (error) {
    console.error("Client log processing error:", error);
    return res.json(successResponse({ received: 0 }));
  }
});
