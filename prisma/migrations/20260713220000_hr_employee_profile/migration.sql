-- Phase 18.3: HR employee profile fields + departments/positions

CREATE TYPE "EmploymentType" AS ENUM ('DAILY', 'MONTHLY');
CREATE TYPE "EmployeeHrStatus" AS ENUM (
  'ACTIVE',
  'PROBATION',
  'SUSPENDED',
  'RESIGNED',
  'TERMINATED',
  'ARCHIVED'
);

CREATE TABLE "departments" (
  "id" UUID NOT NULL DEFAULT gen_random_uuid(),
  "name" TEXT NOT NULL,
  "is_active" BOOLEAN NOT NULL DEFAULT true,
  "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updated_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "departments_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "departments_name_key" ON "departments"("name");
CREATE INDEX "departments_is_active_idx" ON "departments"("is_active");

CREATE TABLE "positions" (
  "id" UUID NOT NULL DEFAULT gen_random_uuid(),
  "name" TEXT NOT NULL,
  "department_id" UUID,
  "is_active" BOOLEAN NOT NULL DEFAULT true,
  "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updated_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "positions_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "positions_is_active_idx" ON "positions"("is_active");
CREATE UNIQUE INDEX "positions_department_id_name_key" ON "positions"("department_id", "name");

ALTER TABLE "positions"
  ADD CONSTRAINT "positions_department_id_fkey"
  FOREIGN KEY ("department_id") REFERENCES "departments"("id")
  ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE "employees"
  ADD COLUMN "employee_code" TEXT,
  ADD COLUMN "first_name" TEXT,
  ADD COLUMN "last_name" TEXT,
  ADD COLUMN "nickname" TEXT,
  ADD COLUMN "photo_url" TEXT,
  ADD COLUMN "birth_date" DATE,
  ADD COLUMN "national_id" TEXT,
  ADD COLUMN "address" TEXT,
  ADD COLUMN "emergency_contact_name" TEXT,
  ADD COLUMN "emergency_contact_phone" TEXT,
  ADD COLUMN "employment_type" "EmploymentType" NOT NULL DEFAULT 'MONTHLY',
  ADD COLUMN "department_id" UUID,
  ADD COLUMN "position_id" UUID,
  ADD COLUMN "manager_employee_id" UUID,
  ADD COLUMN "branch_name" TEXT,
  ADD COLUMN "hired_at" DATE,
  ADD COLUMN "probation_ends_at" DATE,
  ADD COLUMN "ended_at" DATE,
  ADD COLUMN "hr_status" "EmployeeHrStatus" NOT NULL DEFAULT 'ACTIVE',
  ADD COLUMN "bank_account_name" TEXT,
  ADD COLUMN "bank_account_number" TEXT,
  ADD COLUMN "bank_name" TEXT,
  ADD COLUMN "prompt_pay" TEXT,
  ADD COLUMN "notes" TEXT;

-- Backfill identity fields without changing employee UUIDs
WITH numbered AS (
  SELECT
    "id",
    "name",
    "is_active",
    ROW_NUMBER() OVER (ORDER BY "created_at", "id") AS rn
  FROM "employees"
)
UPDATE "employees" AS e
SET
  "employee_code" = 'EMP-' || LPAD(numbered.rn::text, 4, '0'),
  "first_name" = numbered."name",
  "last_name" = '',
  "hr_status" = CASE
    WHEN numbered."is_active" THEN 'ACTIVE'::"EmployeeHrStatus"
    ELSE 'ARCHIVED'::"EmployeeHrStatus"
  END
FROM numbered
WHERE e."id" = numbered."id";

CREATE UNIQUE INDEX "employees_employee_code_key" ON "employees"("employee_code");
CREATE INDEX "employees_hr_status_idx" ON "employees"("hr_status");
CREATE INDEX "employees_employment_type_idx" ON "employees"("employment_type");
CREATE INDEX "employees_department_id_idx" ON "employees"("department_id");
CREATE INDEX "employees_position_id_idx" ON "employees"("position_id");

ALTER TABLE "employees"
  ADD CONSTRAINT "employees_department_id_fkey"
  FOREIGN KEY ("department_id") REFERENCES "departments"("id")
  ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE "employees"
  ADD CONSTRAINT "employees_position_id_fkey"
  FOREIGN KEY ("position_id") REFERENCES "positions"("id")
  ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE "employees"
  ADD CONSTRAINT "employees_manager_employee_id_fkey"
  FOREIGN KEY ("manager_employee_id") REFERENCES "employees"("id")
  ON DELETE SET NULL ON UPDATE CASCADE;
