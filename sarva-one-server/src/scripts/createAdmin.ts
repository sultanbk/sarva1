import "dotenv/config";
import bcrypt from "bcryptjs";
import { eq } from "drizzle-orm";
import { db, pool } from "../db/connection.js";
import { adminUsers } from "../db/schema.js";

const [, , email, password, name = "Sarva Admin"] = process.argv;

if (!email || !password) {
  console.error("Usage: npm run admin:create -- admin@example.com StrongPassword \"Admin Name\"");
  process.exitCode = 1;
  await pool.end();
  process.exit();
}

try {
  const existing = await db.query.adminUsers.findFirst({
    where: eq(adminUsers.email, email)
  });

  if (existing) {
    console.error("Admin user already exists for this email.");
    process.exitCode = 1;
  } else {
    const passwordHash = await bcrypt.hash(password, 12);
    const [created] = await db
      .insert(adminUsers)
      .values({
        email,
        passwordHash,
        name
      })
      .returning({
        id: adminUsers.id,
        email: adminUsers.email,
        name: adminUsers.name
      });

    console.log(`Admin created: ${created.email} (${created.id})`);
  }
} finally {
  await pool.end();
}
