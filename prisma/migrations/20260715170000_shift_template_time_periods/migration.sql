-- Versioned shift times so edits do not rewrite historical days.

CREATE TABLE IF NOT EXISTS "shift_template_time_periods" (
  "id" UUID NOT NULL DEFAULT gen_random_uuid(),
  "shift_template_id" UUID NOT NULL,
  "effective_from" DATE NOT NULL,
  "start_minutes" INTEGER NOT NULL,
  "end_minutes" INTEGER NOT NULL,
  "break_minutes" INTEGER NOT NULL DEFAULT 0,
  "late_grace_minutes" INTEGER NOT NULL DEFAULT 0,
  "early_leave_grace_minutes" INTEGER NOT NULL DEFAULT 0,
  "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updated_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "shift_template_time_periods_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX IF NOT EXISTS "shift_template_time_periods_shift_template_id_effective_from_key"
ON "shift_template_time_periods" ("shift_template_id", "effective_from");

CREATE INDEX IF NOT EXISTS "shift_template_time_periods_shift_template_id_effective_from_idx"
ON "shift_template_time_periods" ("shift_template_id", "effective_from");

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'shift_template_time_periods_shift_template_id_fkey'
  ) THEN
    ALTER TABLE "shift_template_time_periods"
    ADD CONSTRAINT "shift_template_time_periods_shift_template_id_fkey"
    FOREIGN KEY ("shift_template_id") REFERENCES "shift_templates"("id")
    ON DELETE CASCADE ON UPDATE CASCADE;
  END IF;
END $$;

-- Seed baseline period from current template columns (far past = applies historically).
INSERT INTO "shift_template_time_periods" (
  "id",
  "shift_template_id",
  "effective_from",
  "start_minutes",
  "end_minutes",
  "break_minutes",
  "late_grace_minutes",
  "early_leave_grace_minutes",
  "created_at",
  "updated_at"
)
SELECT
  gen_random_uuid(),
  t."id",
  DATE '1970-01-01',
  t."start_minutes",
  t."end_minutes",
  t."break_minutes",
  t."late_grace_minutes",
  t."early_leave_grace_minutes",
  CURRENT_TIMESTAMP,
  CURRENT_TIMESTAMP
FROM "shift_templates" t
WHERE NOT EXISTS (
  SELECT 1
  FROM "shift_template_time_periods" p
  WHERE p."shift_template_id" = t."id"
);
