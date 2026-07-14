-- Phase 18.7: compensation + payroll periods/entries/adjustments/payslips

CREATE TYPE "PayrollPeriodType" AS ENUM ('DAILY', 'WEEKLY', 'SEMI_MONTHLY', 'MONTHLY', 'CUSTOM');
CREATE TYPE "PayrollPeriodStatus" AS ENUM ('DRAFT', 'CALCULATED', 'REVIEWED', 'APPROVED', 'PAID');
CREATE TYPE "PayrollAdjustmentType" AS ENUM ('BONUS', 'DEDUCTION', 'ADVANCE', 'OTHER_EARNING');

CREATE TABLE "employee_compensations" (
  "id" UUID NOT NULL DEFAULT gen_random_uuid(),
  "employee_id" UUID NOT NULL,
  "employment_type" "EmploymentType" NOT NULL,
  "daily_rate" DECIMAL(12,2) NOT NULL DEFAULT 0,
  "hourly_rate" DECIMAL(12,2) NOT NULL DEFAULT 0,
  "monthly_salary" DECIMAL(12,2) NOT NULL DEFAULT 0,
  "position_allowance" DECIMAL(12,2) NOT NULL DEFAULT 0,
  "meal_allowance" DECIMAL(12,2) NOT NULL DEFAULT 0,
  "housing_allowance" DECIMAL(12,2) NOT NULL DEFAULT 0,
  "travel_allowance" DECIMAL(12,2) NOT NULL DEFAULT 0,
  "effective_from" DATE NOT NULL,
  "effective_to" DATE,
  "is_active" BOOLEAN NOT NULL DEFAULT true,
  "notes" TEXT,
  "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updated_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "employee_compensations_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "employee_compensations_employee_id_is_active_effective_from_idx"
  ON "employee_compensations"("employee_id", "is_active", "effective_from");
CREATE INDEX "employee_compensations_employment_type_is_active_idx"
  ON "employee_compensations"("employment_type", "is_active");

ALTER TABLE "employee_compensations"
  ADD CONSTRAINT "employee_compensations_employee_id_fkey"
  FOREIGN KEY ("employee_id") REFERENCES "employees"("id")
  ON DELETE CASCADE ON UPDATE CASCADE;

-- Backfill from legacy hourly_rate where present
INSERT INTO "employee_compensations" (
  "employee_id", "employment_type", "hourly_rate", "effective_from", "is_active"
)
SELECT
  e."id",
  e."employment_type",
  COALESCE(e."hourly_rate", 0),
  COALESCE(e."hired_at", CURRENT_DATE),
  true
FROM "employees" e
WHERE NOT EXISTS (
  SELECT 1 FROM "employee_compensations" c WHERE c."employee_id" = e."id"
);

CREATE TABLE "payroll_settings" (
  "id" UUID NOT NULL DEFAULT gen_random_uuid(),
  "key" TEXT NOT NULL,
  "value" TEXT NOT NULL,
  "label_th" TEXT,
  "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updated_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "payroll_settings_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "payroll_settings_key_key" ON "payroll_settings"("key");

INSERT INTO "payroll_settings" ("id", "key", "value", "label_th")
VALUES
  (gen_random_uuid(), 'ot_multiplier', '1.5', 'อัตรา OT คูณ'),
  (gen_random_uuid(), 'holiday_multiplier', '2', 'อัตราทำงานวันหยุดคูณ'),
  (gen_random_uuid(), 'late_deduction_per_minute', '0', 'หักมาสายต่อนาที'),
  (gen_random_uuid(), 'standard_work_minutes_per_day', '480', 'นาทีทำงานมาตรฐานต่อวัน');

CREATE TABLE "payroll_periods" (
  "id" UUID NOT NULL DEFAULT gen_random_uuid(),
  "name" TEXT NOT NULL,
  "period_type" "PayrollPeriodType" NOT NULL,
  "period_start" DATE NOT NULL,
  "period_end" DATE NOT NULL,
  "status" "PayrollPeriodStatus" NOT NULL DEFAULT 'DRAFT',
  "locked_at" TIMESTAMP(3),
  "calculated_at" TIMESTAMP(3),
  "reviewed_at" TIMESTAMP(3),
  "approved_at" TIMESTAMP(3),
  "paid_at" TIMESTAMP(3),
  "calculated_by_id" UUID,
  "reviewed_by_id" UUID,
  "approved_by_id" UUID,
  "paid_by_id" UUID,
  "notes" TEXT,
  "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updated_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "payroll_periods_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "payroll_periods_period_start_period_end_idx"
  ON "payroll_periods"("period_start", "period_end");
CREATE INDEX "payroll_periods_status_period_start_idx"
  ON "payroll_periods"("status", "period_start");

ALTER TABLE "payroll_periods"
  ADD CONSTRAINT "payroll_periods_calculated_by_id_fkey"
  FOREIGN KEY ("calculated_by_id") REFERENCES "employees"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "payroll_periods"
  ADD CONSTRAINT "payroll_periods_reviewed_by_id_fkey"
  FOREIGN KEY ("reviewed_by_id") REFERENCES "employees"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "payroll_periods"
  ADD CONSTRAINT "payroll_periods_approved_by_id_fkey"
  FOREIGN KEY ("approved_by_id") REFERENCES "employees"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "payroll_periods"
  ADD CONSTRAINT "payroll_periods_paid_by_id_fkey"
  FOREIGN KEY ("paid_by_id") REFERENCES "employees"("id") ON DELETE SET NULL ON UPDATE CASCADE;

CREATE TABLE "payroll_entries" (
  "id" UUID NOT NULL DEFAULT gen_random_uuid(),
  "period_id" UUID NOT NULL,
  "employee_id" UUID NOT NULL,
  "employment_type" "EmploymentType" NOT NULL,
  "base_pay" DECIMAL(12,2) NOT NULL DEFAULT 0,
  "ot_pay" DECIMAL(12,2) NOT NULL DEFAULT 0,
  "holiday_pay" DECIMAL(12,2) NOT NULL DEFAULT 0,
  "allowances" DECIMAL(12,2) NOT NULL DEFAULT 0,
  "bonuses" DECIMAL(12,2) NOT NULL DEFAULT 0,
  "deductions" DECIMAL(12,2) NOT NULL DEFAULT 0,
  "advances" DECIMAL(12,2) NOT NULL DEFAULT 0,
  "unpaid_leave_deduction" DECIMAL(12,2) NOT NULL DEFAULT 0,
  "absence_deduction" DECIMAL(12,2) NOT NULL DEFAULT 0,
  "late_deduction" DECIMAL(12,2) NOT NULL DEFAULT 0,
  "gross_pay" DECIMAL(12,2) NOT NULL DEFAULT 0,
  "net_pay" DECIMAL(12,2) NOT NULL DEFAULT 0,
  "worked_minutes" INTEGER NOT NULL DEFAULT 0,
  "ot_minutes" INTEGER NOT NULL DEFAULT 0,
  "absent_days" DECIMAL(8,2) NOT NULL DEFAULT 0,
  "unpaid_leave_days" DECIMAL(8,2) NOT NULL DEFAULT 0,
  "late_minutes" INTEGER NOT NULL DEFAULT 0,
  "notes" TEXT,
  "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updated_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "payroll_entries_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "payroll_entries_period_id_employee_id_key"
  ON "payroll_entries"("period_id", "employee_id");
CREATE INDEX "payroll_entries_employee_id_period_id_idx"
  ON "payroll_entries"("employee_id", "period_id");

ALTER TABLE "payroll_entries"
  ADD CONSTRAINT "payroll_entries_period_id_fkey"
  FOREIGN KEY ("period_id") REFERENCES "payroll_periods"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "payroll_entries"
  ADD CONSTRAINT "payroll_entries_employee_id_fkey"
  FOREIGN KEY ("employee_id") REFERENCES "employees"("id") ON DELETE CASCADE ON UPDATE CASCADE;

CREATE TABLE "payroll_adjustments" (
  "id" UUID NOT NULL DEFAULT gen_random_uuid(),
  "period_id" UUID NOT NULL,
  "entry_id" UUID,
  "employee_id" UUID NOT NULL,
  "type" "PayrollAdjustmentType" NOT NULL,
  "amount" DECIMAL(12,2) NOT NULL,
  "reason" TEXT NOT NULL,
  "created_by_id" UUID NOT NULL,
  "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updated_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "payroll_adjustments_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "payroll_adjustments_period_id_employee_id_idx"
  ON "payroll_adjustments"("period_id", "employee_id");
CREATE INDEX "payroll_adjustments_entry_id_idx" ON "payroll_adjustments"("entry_id");

ALTER TABLE "payroll_adjustments"
  ADD CONSTRAINT "payroll_adjustments_period_id_fkey"
  FOREIGN KEY ("period_id") REFERENCES "payroll_periods"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "payroll_adjustments"
  ADD CONSTRAINT "payroll_adjustments_entry_id_fkey"
  FOREIGN KEY ("entry_id") REFERENCES "payroll_entries"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "payroll_adjustments"
  ADD CONSTRAINT "payroll_adjustments_employee_id_fkey"
  FOREIGN KEY ("employee_id") REFERENCES "employees"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "payroll_adjustments"
  ADD CONSTRAINT "payroll_adjustments_created_by_id_fkey"
  FOREIGN KEY ("created_by_id") REFERENCES "employees"("id") ON DELETE CASCADE ON UPDATE CASCADE;

CREATE TABLE "payroll_payslips" (
  "id" UUID NOT NULL DEFAULT gen_random_uuid(),
  "period_id" UUID NOT NULL,
  "entry_id" UUID NOT NULL,
  "employee_id" UUID NOT NULL,
  "payload" JSONB NOT NULL,
  "issued_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updated_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "payroll_payslips_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "payroll_payslips_entry_id_key" ON "payroll_payslips"("entry_id");
CREATE INDEX "payroll_payslips_period_id_employee_id_idx"
  ON "payroll_payslips"("period_id", "employee_id");

ALTER TABLE "payroll_payslips"
  ADD CONSTRAINT "payroll_payslips_period_id_fkey"
  FOREIGN KEY ("period_id") REFERENCES "payroll_periods"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "payroll_payslips"
  ADD CONSTRAINT "payroll_payslips_entry_id_fkey"
  FOREIGN KEY ("entry_id") REFERENCES "payroll_entries"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "payroll_payslips"
  ADD CONSTRAINT "payroll_payslips_employee_id_fkey"
  FOREIGN KEY ("employee_id") REFERENCES "employees"("id") ON DELETE CASCADE ON UPDATE CASCADE;
