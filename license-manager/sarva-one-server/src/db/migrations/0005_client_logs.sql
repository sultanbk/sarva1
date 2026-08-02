DO $$ BEGIN
  CREATE TYPE "log_level" AS ENUM ('debug', 'info', 'warn', 'error', 'fatal');
EXCEPTION
  WHEN duplicate_object THEN null;
END $$;

CREATE TABLE IF NOT EXISTS "client_logs" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
  "license_id" uuid NOT NULL REFERENCES "licenses"("id") ON DELETE cascade,
  "machine_id" varchar(255) NOT NULL,
  "app_version" varchar(50) NOT NULL,
  "level" "log_level" DEFAULT 'info' NOT NULL,
  "message" text NOT NULL,
  "source" varchar(100),
  "stack_trace" text,
  "metadata" jsonb,
  "ip_address" varchar(100),
  "client_ts" timestamp with time zone,
  "created_at" timestamp with time zone DEFAULT now() NOT NULL
);

CREATE INDEX IF NOT EXISTS "client_logs_license_created_idx" ON "client_logs" ("license_id", "created_at" DESC);
CREATE INDEX IF NOT EXISTS "client_logs_license_level_created_idx" ON "client_logs" ("license_id", "level", "created_at" DESC);
CREATE INDEX IF NOT EXISTS "client_logs_created_at_idx" ON "client_logs" ("created_at");
