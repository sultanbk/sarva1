import "dotenv/config";
import { readdir, readFile } from "node:fs/promises";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { pool } from "./connection.js";

const here = dirname(fileURLToPath(import.meta.url));
const migrationsDir = join(here, "migrations");

try {
  // 1. Create custom migrations tracking table
  await pool.query(`
    CREATE TABLE IF NOT EXISTS "__custom_migrations" (
      id SERIAL PRIMARY KEY,
      name VARCHAR(255) UNIQUE NOT NULL,
      applied_at TIMESTAMP WITH TIME ZONE DEFAULT NOW() NOT NULL
    )
  `);

  // 2. Baselining: if the 'licenses' table already exists but we have no migration logs,
  // baseline '0000_initial_schema.sql' so we don't try to recreate existing tables/enums.
  const tableCheck = await pool.query(`
    SELECT EXISTS (
      SELECT FROM information_schema.tables 
      WHERE table_name = 'licenses'
    )
  `);
  const licensesExist = tableCheck.rows[0]?.exists;

  const migrationCheck = await pool.query('SELECT COUNT(*) as count FROM "__custom_migrations"');
  const migrationCount = Number(migrationCheck.rows[0]?.count ?? 0);

  if (licensesExist && migrationCount === 0) {
    console.log("ℹ️ Existing schema detected. Baselining initial migration...");
    await pool.query(
      'INSERT INTO "__custom_migrations" (name) VALUES ($1) ON CONFLICT DO NOTHING',
      ["0000_initial_schema.sql"]
    );
  }

  // 3. Read and execute migrations sequentially
  const migrationFiles = (await readdir(migrationsDir))
    .filter((file) => file.endsWith(".sql"))
    .sort();

  for (const file of migrationFiles) {
    // Check if already applied
    const check = await pool.query('SELECT 1 FROM "__custom_migrations" WHERE name = $1', [file]);
    if (check.rows.length > 0) {
      console.log(`⏭️ Skipping already applied migration ${file}.`);
      continue;
    }

    console.log(`⏳ Applying migration ${file}...`);
    const migrationPath = join(migrationsDir, file);
    const sql = await readFile(migrationPath, "utf8");
    await pool.query(sql);
    
    // Record execution
    await pool.query('INSERT INTO "__custom_migrations" (name) VALUES ($1)', [file]);
    console.log(`✅ Applied migration ${file}.`);
  }

  console.log("🎉 Database migration completed.");
} catch (error) {
  console.error("❌ Database migration failed:", error);
  process.exit(1);
} finally {
  await pool.end();
}
