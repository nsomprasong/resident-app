-- Additive: username + unique phone (nullable unique allows many NULLs).
-- Do not drop/rename email or other identity columns.

ALTER TABLE "employees" ADD COLUMN IF NOT EXISTS "username" TEXT;

CREATE UNIQUE INDEX IF NOT EXISTS "employees_username_key" ON "employees"("username");

-- Only create phone unique index when no duplicate non-null phones exist.
DO $$
BEGIN
  IF EXISTS (
    SELECT 1
    FROM "employees"
    WHERE "phone" IS NOT NULL
    GROUP BY "phone"
    HAVING COUNT(*) > 1
  ) THEN
    RAISE NOTICE 'Skipped employees_phone_key: duplicate phone values exist. Resolve via scripts/check-employee-auth-readiness.ts';
  ELSIF NOT EXISTS (
    SELECT 1 FROM pg_class c
    JOIN pg_namespace n ON n.oid = c.relnamespace
    WHERE c.relkind = 'i'
      AND c.relname = 'employees_phone_key'
  ) THEN
    CREATE UNIQUE INDEX "employees_phone_key" ON "employees"("phone");
  END IF;
END $$;
