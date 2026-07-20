import "dotenv/config";
import { db, pool } from "./src/db/connection.js";
import { licenses } from "./src/db/schema.js";

async function run() {
  try {
    await db.insert(licenses).values({
      key: "SARVA-2OBG-7VLK-U1DC-33P4",
      shopName: "Fashion",
      ownerName: "Fashion Owner",
      phone: "9988776655",
      email: "fashion@example.com",
      plan: "pro",
      status: "active",
      machineId: "8cd682b3-122c-4758-97f3-01d6b55bcf26",
      activatedAt: new Date("2026-06-27T08:00:52.184Z"),
      expiresAt: new Date("2026-07-27T06:46:39.708Z"),
      gracePeriodDays: 7,
      createdBy: "admin@sarvaone.com",
      notes: "Imported from client SQLite cache"
    });
    console.log("Fashion license successfully imported into local database.");
  } catch (error) {
    console.error("Failed to insert license:", error);
  } finally {
    await pool.end();
  }
}

run();
