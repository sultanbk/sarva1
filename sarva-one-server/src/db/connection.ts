import { drizzle } from "drizzle-orm/node-postgres";
import pg from "pg";
import * as schema from "./schema.js";

const { Pool } = pg;

if (!process.env.DATABASE_URL) {
  throw new Error("DATABASE_URL is required");
}

const databaseSsl =
  process.env.DATABASE_SSL === "true" || process.env.NODE_ENV === "production";

export const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: databaseSsl ? { rejectUnauthorized: false } : undefined
});

export const db = drizzle(pool, { schema });
