-- Map existing licenses to professional/pro before altering enum values
UPDATE "licenses" SET "plan" = 'pro' WHERE "plan" = 'custom';

-- Rename the enum values
ALTER TYPE "plan" RENAME VALUE 'growth' TO 'professional';
ALTER TYPE "plan" RENAME VALUE 'pro' TO 'enterprise';

-- Clean up and update plans table
DELETE FROM "plans" WHERE "code" IN ('growth', 'pro', 'custom');

INSERT INTO "plans" ("code", "name", "monthly_price")
VALUES
  ('professional', 'Professional', 0),
  ('enterprise', 'Enterprise', 0)
ON CONFLICT ("code") DO NOTHING;

-- Clear plan entitlements to trigger automatic re-seeding on next startup
DELETE FROM "plan_entitlements";
