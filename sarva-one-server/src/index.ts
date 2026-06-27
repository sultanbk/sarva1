import "dotenv/config";
import cors from "cors";
import express, { type NextFunction, type Request, type Response } from "express";
import helmet from "helmet";
import { pool } from "./db/connection.js";
import { adminRouter } from "./routes/admin.js";
import { licenseRouter } from "./routes/license.js";
import { errorResponse, successResponse } from "./services/licenseService.js";

const app = express();
const port = Number(process.env.PORT ?? 3000);

app.set("trust proxy", 1);
app.use(helmet());

const allowedOrigins = [
  process.env.ADMIN_ORIGIN ?? "https://sarvaone-admin.vercel.app",
  "http://localhost:5173",
  "http://localhost:3000"
].filter(Boolean);

app.use(
  cors({
    origin: (origin, callback) => {
      if (!origin || allowedOrigins.includes(origin)) {
        callback(null, true);
      } else {
        callback(new Error("Not allowed by CORS"));
      }
    },
    credentials: true
  })
);
app.use(express.json({ limit: "1mb" }));

app.get("/health", (_req, res) => {
  res.json(successResponse({ ok: true }));
});

app.use("/api/license", licenseRouter);
app.use("/api/admin", adminRouter);

app.use((_req, res) => {
  res.status(404).json(errorResponse("VALIDATION_ERROR", "Route not found."));
});

app.use((error: unknown, _req: Request, res: Response, _next: NextFunction) => {
  console.error(error);
  const errMsg = error instanceof Error ? error.message : String(error);
  res.status(500).json(errorResponse("SERVER_MISCONFIGURED", `Unexpected server error: ${errMsg}`));
});

const server = app.listen(port, () => {
  console.log(`Sarva One server listening on port ${port}`);
});

const shutdown = async () => {
  server.close(async () => {
    await pool.end();
    process.exit(0);
  });
};

process.on("SIGINT", shutdown);
process.on("SIGTERM", shutdown);
