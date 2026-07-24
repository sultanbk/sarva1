import "dotenv/config";
import { db, pool } from "./src/db/connection.js";
import { licenses } from "./src/db/schema.js";

async function run() {
  try {
    const list = await db.select().from(licenses);
    console.log("Licenses in database:");
    console.log(JSON.stringify(list, null, 2));
  } catch (error) {
    console.error("Failed to query licenses:", error);
  } finally {
    await pool.end();
  }
}

run();
