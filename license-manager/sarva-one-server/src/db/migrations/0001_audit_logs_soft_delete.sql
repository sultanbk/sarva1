ALTER TABLE "licenses" ADD COLUMN IF NOT EXISTS "deleted_at" timestamp with time zone;
ALTER TABLE "licenses" ADD COLUMN IF NOT EXISTS "deleted_by" varchar(255);

CREATE TABLE IF NOT EXISTS "license_events" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
  "license_id" uuid REFERENCES "licenses"("id") ON DELETE set null,
  "actor_type" varchar(50) NOT NULL,
  "actor_id" varchar(255),
  "event_type" varchar(100) NOT NULL,
  "metadata" jsonb,
  "ip_address" varchar(100),
  "created_at" timestamp with time zone DEFAULT now() NOT NULL
);

CREATE INDEX IF NOT EXISTS "licenses_deleted_at_idx" ON "licenses" ("deleted_at");
CREATE INDEX IF NOT EXISTS "license_events_license_created_at_idx" ON "license_events" ("license_id", "created_at" DESC);
CREATE INDEX IF NOT EXISTS "license_events_event_type_idx" ON "license_events" ("event_type");
