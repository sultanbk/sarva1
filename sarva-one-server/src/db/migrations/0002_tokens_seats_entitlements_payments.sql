ALTER TABLE "licenses" ADD COLUMN IF NOT EXISTS "max_seats" integer DEFAULT 1 NOT NULL;

CREATE TABLE IF NOT EXISTS "license_activations" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
  "license_id" uuid NOT NULL REFERENCES "licenses"("id") ON DELETE cascade,
  "machine_id_hash" varchar(255) NOT NULL,
  "hostname" varchar(255),
  "app_version" varchar(50),
  "activated_at" timestamp with time zone DEFAULT now() NOT NULL,
  "last_seen_at" timestamp with time zone,
  "deactivated_at" timestamp with time zone
);

CREATE UNIQUE INDEX IF NOT EXISTS "license_activations_license_machine_idx"
  ON "license_activations" ("license_id", "machine_id_hash");
CREATE INDEX IF NOT EXISTS "license_activations_license_active_idx"
  ON "license_activations" ("license_id", "deactivated_at");

INSERT INTO "license_activations" ("license_id", "machine_id_hash", "activated_at", "last_seen_at")
SELECT "id", encode(digest("machine_id", 'sha256'), 'hex'), COALESCE("activated_at", now()), "activated_at"
FROM "licenses"
WHERE "machine_id" IS NOT NULL
ON CONFLICT DO NOTHING;

CREATE TABLE IF NOT EXISTS "plans" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
  "code" varchar(50) UNIQUE NOT NULL,
  "name" varchar(255) NOT NULL,
  "monthly_price" integer DEFAULT 0 NOT NULL,
  "is_active" boolean DEFAULT true NOT NULL,
  "created_at" timestamp with time zone DEFAULT now() NOT NULL
);

CREATE TABLE IF NOT EXISTS "plan_entitlements" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
  "plan_id" uuid NOT NULL REFERENCES "plans"("id") ON DELETE cascade,
  "entitlement_key" varchar(100) NOT NULL,
  "value_type" varchar(20) NOT NULL,
  "boolean_value" boolean,
  "number_value" integer,
  "text_value" text
);

CREATE UNIQUE INDEX IF NOT EXISTS "plan_entitlements_plan_key_idx"
  ON "plan_entitlements" ("plan_id", "entitlement_key");

INSERT INTO "plans" ("code", "name", "monthly_price")
VALUES
  ('starter', 'Starter', 0),
  ('growth', 'Growth', 0),
  ('pro', 'Pro', 0),
  ('custom', 'Custom', 0)
ON CONFLICT ("code") DO NOTHING;

CREATE TABLE IF NOT EXISTS "payment_events" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
  "license_id" uuid REFERENCES "licenses"("id") ON DELETE set null,
  "provider" varchar(50) NOT NULL,
  "provider_payment_id" varchar(255),
  "provider_order_id" varchar(255),
  "amount" integer NOT NULL,
  "currency" varchar(10) DEFAULT 'INR' NOT NULL,
  "status" varchar(50) NOT NULL,
  "raw_payload" jsonb,
  "created_at" timestamp with time zone DEFAULT now() NOT NULL
);

CREATE INDEX IF NOT EXISTS "payment_events_license_created_at_idx"
  ON "payment_events" ("license_id", "created_at" DESC);
CREATE INDEX IF NOT EXISTS "payment_events_provider_payment_idx"
  ON "payment_events" ("provider", "provider_payment_id");
