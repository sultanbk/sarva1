import type { NextFunction, Request, Response } from "express";
import jwt from "jsonwebtoken";
import { errorResponse } from "../services/licenseService.js";

export type AdminJwtPayload = {
  id: string;
  email: string;
  name: string;
};

declare global {
  namespace Express {
    interface Request {
      admin?: AdminJwtPayload;
    }
  }
}

const jwtSecret = () => {
  if (!process.env.JWT_SECRET) {
    throw new Error("JWT_SECRET is required");
  }

  return process.env.JWT_SECRET;
};

export function signAdminToken(payload: AdminJwtPayload) {
  return jwt.sign(payload, jwtSecret(), { expiresIn: "12h" });
}

export function verifyAdminToken(token: string): AdminJwtPayload {
  return jwt.verify(token, jwtSecret()) as AdminJwtPayload;
}

export function requireApiKey(req: Request, res: Response, next: NextFunction) {
  const configuredApiKey = process.env.API_KEY;
  const receivedApiKey = req.header("X-API-Key");

  if (!configuredApiKey) {
    return res.status(500).json(errorResponse("SERVER_MISCONFIGURED", "API key is not configured."));
  }

  if (!receivedApiKey || receivedApiKey !== configuredApiKey) {
    return res.status(401).json(errorResponse("INVALID_API_KEY", "A valid X-API-Key header is required."));
  }

  return next();
}

export function requireAdminAuth(req: Request, res: Response, next: NextFunction) {
  const authorization = req.header("Authorization");

  if (!authorization?.startsWith("Bearer ")) {
    return res.status(401).json(errorResponse("UNAUTHORIZED", "Bearer token is required."));
  }

  try {
    req.admin = verifyAdminToken(authorization.slice("Bearer ".length));
    return next();
  } catch {
    return res.status(401).json(errorResponse("INVALID_TOKEN", "Admin token is invalid or expired."));
  }
}
