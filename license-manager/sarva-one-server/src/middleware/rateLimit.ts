import rateLimit from "express-rate-limit";
import { errorResponse } from "../services/licenseService.js";

export const licenseRateLimit = rateLimit({
  windowMs: 60 * 1000,
  limit: 10,
  standardHeaders: true,
  legacyHeaders: false,
  handler: (_req, res) => {
    res.status(429).json(errorResponse("RATE_LIMITED", "Too many license requests. Please try again soon."));
  }
});

export const adminRateLimit = rateLimit({
  windowMs: 60 * 1000,
  limit: 100,
  standardHeaders: true,
  legacyHeaders: false,
  handler: (_req, res) => {
    res.status(429).json(errorResponse("RATE_LIMITED", "Too many admin requests. Please try again soon."));
  }
});
