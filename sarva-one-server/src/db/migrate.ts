import "dotenv/config";
import { readFile } from "node:fs/promises";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { pool } from "./connection.js";

const here = dirname(fileURLToPath(import.meta.url));
const migrationPath = join(here, "migrations", "0000_initial_schema.sql");

try {
  const sql = await readFile(migrationPath, "utf8");
  await pool.query(sql);
  console.log("Database migration completed.");
} finally {
  await pool.end();
}
