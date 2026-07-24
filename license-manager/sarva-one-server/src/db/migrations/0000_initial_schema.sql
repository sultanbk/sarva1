CREATE EXTENSION IF NOT EXISTS "pgcrypto";

DO $$ BEGIN
  CREATE TYPE "plan" AS ENUM ('starter', 'growth', 'pro', 'custom');
EXCEPTION
  WHEN duplicate_object THEN null;
END $$;

DO $$ BEGIN
  CREATE TYPE "status" AS ENUM ('trial', 'active', 'expired', 'suspended');
EXCEPTION
  WHEN duplicate_object THEN null;
END $$;

CREATE TABLE IF NOT EXISTS "licenses" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
  "key" varchar(25) UNIQUE NOT NULL,
  "shop_name" varchar(255) NOT NULL,
  "owner_name" varchar(255) NOT NULL,
  "phone" varchar(50) NOT NULL,
  "email" varchar(255) NOT NULL,
  "plan" "plan" NOT NULL,
  "status" "status" DEFAULT 'trial' NOT NULL,
  "machine_id" varchar(255),
  "activated_at" timestamp with time zone,
  "expires_at" timestamp with time zone NOT NULL,
  "grace_period_days" integer DEFAULT 7 NOT NULL,
  "created_at" timestamp with time zone DEFAULT now() NOT NULL,
  "updated_at" timestamp with time zone DEFAULT now() NOT NULL,
  "created_by" varchar(255) NOT NULL,
  "notes" text
);

ALTER TABLE "licenses" ALTER COLUMN "key" TYPE varchar(25);

CREATE TABLE IF NOT EXISTS "heartbeats" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
  "license_id" uuid NOT NULL REFERENCES "licenses"("id") ON DELETE cascade,
  "machine_id" varchar(255) NOT NULL,
  "app_version" varchar(50) NOT NULL,
  "bills_today" integer DEFAULT 0 NOT NULL,
  "total_bills" integer DEFAULT 0 NOT NULL,
  "total_customers" integer DEFAULT 0 NOT NULL,
  "total_products" integer DEFAULT 0 NOT NULL,
  "ip_address" varchar(100) NOT NULL,
  "created_at" timestamp with time zone DEFAULT now() NOT NULL
);

CREATE TABLE IF NOT EXISTS "admin_users" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
  "email" varchar(255) UNIQUE NOT NULL,
  "password_hash" varchar(255) NOT NULL,
  "name" varchar(255) NOT NULL,
  "created_at" timestamp with time zone DEFAULT now() NOT NULL
);

CREATE INDEX IF NOT EXISTS "heartbeats_license_created_at_idx" ON "heartbeats" ("license_id", "created_at" DESC);
CREATE INDEX IF NOT EXISTS "licenses_status_idx" ON "licenses" ("status");
CREATE INDEX IF NOT EXISTS "licenses_plan_idx" ON "licenses" ("plan");
