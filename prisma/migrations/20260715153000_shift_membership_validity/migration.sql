-- Permanent shift membership + validity window on templates

ALTER TABLE "shift_templates"
ADD COLUMN IF NOT EXISTS "valid_from" DATE,
ADD COLUMN IF NOT EXISTS "valid_to" DATE;

UPDATE "shift_templates"
SET
  "valid_from" = COALESCE("valid_from", CURRENT_DATE),
  "valid_to" = COALESCE("valid_to", (CURRENT_DATE + INTERVAL '1 year')::date)
WHERE "valid_from" IS NULL OR "valid_to" IS NULL;

ALTER TABLE "shift_templates"
ALTER COLUMN "valid_from" SET NOT NULL,
ALTER COLUMN "valid_to" SET NOT NULL;

CREATE INDEX IF NOT EXISTS "shift_templates_valid_from_valid_to_idx"
ON "shift_templates" ("valid_from", "valid_to");

CREATE TABLE IF NOT EXISTS "shift_memberships" (
  "id" UUID NOT NULL DEFAULT gen_random_uuid(),
  "shift_template_id" UUID NOT NULL,
  "employee_id" UUID NOT NULL,
  "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updated_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "shift_memberships_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX IF NOT EXISTS "shift_memberships_employee_id_key"
ON "shift_memberships" ("employee_id");

CREATE UNIQUE INDEX IF NOT EXISTS "shift_memberships_shift_template_id_employee_id_key"
ON "shift_memberships" ("shift_template_id", "employee_id");

CREATE INDEX IF NOT EXISTS "shift_memberships_shift_template_id_idx"
ON "shift_memberships" ("shift_template_id");

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'shift_memberships_shift_template_id_fkey'
  ) THEN
    ALTER TABLE "shift_memberships"
    ADD CONSTRAINT "shift_memberships_shift_template_id_fkey"
    FOREIGN KEY ("shift_template_id") REFERENCES "shift_templates"("id")
    ON DELETE CASCADE ON UPDATE CASCADE;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'shift_memberships_employee_id_fkey'
  ) THEN
    ALTER TABLE "shift_memberships"
    ADD CONSTRAINT "shift_memberships_employee_id_fkey"
    FOREIGN KEY ("employee_id") REFERENCES "employees"("id")
    ON DELETE CASCADE ON UPDATE CASCADE;
  END IF;
END $$;

-- Backfill membership from employee default shift when present.
INSERT INTO "shift_memberships" ("id", "shift_template_id", "employee_id", "created_at", "updated_at")
SELECT gen_random_uuid(), e."default_shift_template_id", e."id", CURRENT_TIMESTAMP, CURRENT_TIMESTAMP
FROM "employees" e
WHERE e."default_shift_template_id" IS NOT NULL
  AND NOT EXISTS (
    SELECT 1 FROM "shift_memberships" m WHERE m."employee_id" = e."id"
  )
ON CONFLICT ("employee_id") DO NOTHING;
