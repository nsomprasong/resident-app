-- Phase 21: flexible half-month schedule periods and scheduled shifts.
CREATE TYPE "SchedulePeriodStatus" AS ENUM ('DRAFT', 'PUBLISHED', 'CLOSED');
CREATE TYPE "ScheduledShiftAssignmentType" AS ENUM ('NORMAL', 'REPLACEMENT', 'DOUBLE_SHIFT', 'EXTRA_SHIFT');
CREATE TYPE "ScheduledShiftStatus" AS ENUM ('SCHEDULED', 'CANCELLED', 'COMPLETED', 'ABSENT', 'LEAVE', 'REPLACED');
CREATE TYPE "ScheduleChangeType" AS ENUM ('CREATE', 'UPDATE', 'CANCEL', 'REPLACE', 'COPY', 'PUBLISH', 'CLOSE');

ALTER TYPE "AttendanceStatus" ADD VALUE IF NOT EXISTS 'PENDING_REVIEW';

CREATE TABLE "schedule_periods" (
  "id" UUID NOT NULL DEFAULT gen_random_uuid(),
  "name" TEXT NOT NULL,
  "start_date" DATE NOT NULL,
  "end_date" DATE NOT NULL,
  "status" "SchedulePeriodStatus" NOT NULL DEFAULT 'DRAFT',
  "published_at" TIMESTAMP(3),
  "closed_at" TIMESTAMP(3),
  "created_by_id" UUID,
  "updated_by_id" UUID,
  "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updated_at" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "schedule_periods_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "schedule_periods_dates_valid" CHECK ("start_date" <= "end_date")
);

CREATE TABLE "scheduled_shifts" (
  "id" UUID NOT NULL DEFAULT gen_random_uuid(),
  "schedule_period_id" UUID NOT NULL,
  "employee_id" UUID NOT NULL,
  "shift_template_id" UUID,
  "work_date" DATE NOT NULL,
  "planned_start" TIMESTAMP(3) NOT NULL,
  "planned_end" TIMESTAMP(3) NOT NULL,
  "break_minutes" INTEGER NOT NULL DEFAULT 0,
  "late_grace_minutes" INTEGER NOT NULL DEFAULT 0,
  "assignment_type" "ScheduledShiftAssignmentType" NOT NULL DEFAULT 'NORMAL',
  "status" "ScheduledShiftStatus" NOT NULL DEFAULT 'SCHEDULED',
  "replaced_employee_id" UUID,
  "source_scheduled_shift_id" UUID,
  "note" TEXT,
  "created_by_id" UUID,
  "updated_by_id" UUID,
  "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updated_at" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "scheduled_shifts_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "scheduled_shifts_times_valid" CHECK ("planned_end" > "planned_start"),
  CONSTRAINT "scheduled_shifts_break_valid" CHECK ("break_minutes" >= 0),
  CONSTRAINT "scheduled_shifts_late_grace_valid" CHECK ("late_grace_minutes" >= 0)
);

CREATE TABLE "schedule_change_logs" (
  "id" UUID NOT NULL DEFAULT gen_random_uuid(),
  "schedule_period_id" UUID,
  "scheduled_shift_id" UUID,
  "change_type" "ScheduleChangeType" NOT NULL,
  "before_data" JSONB,
  "after_data" JSONB,
  "reason" TEXT,
  "changed_by_id" UUID NOT NULL,
  "changed_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "schedule_change_logs_pkey" PRIMARY KEY ("id")
);

ALTER TABLE "attendance_records"
  ADD COLUMN "scheduled_shift_id" UUID,
  ADD COLUMN "source" TEXT;

CREATE INDEX "schedule_periods_start_date_end_date_idx" ON "schedule_periods"("start_date", "end_date");
CREATE INDEX "schedule_periods_status_idx" ON "schedule_periods"("status");
CREATE INDEX "scheduled_shifts_schedule_period_id_work_date_idx" ON "scheduled_shifts"("schedule_period_id", "work_date");
CREATE INDEX "scheduled_shifts_employee_id_work_date_idx" ON "scheduled_shifts"("employee_id", "work_date");
CREATE INDEX "scheduled_shifts_status_idx" ON "scheduled_shifts"("status");
CREATE INDEX "schedule_change_logs_schedule_period_id_idx" ON "schedule_change_logs"("schedule_period_id");
CREATE INDEX "schedule_change_logs_scheduled_shift_id_idx" ON "schedule_change_logs"("scheduled_shift_id");
CREATE INDEX "schedule_change_logs_changed_by_id_changed_at_idx" ON "schedule_change_logs"("changed_by_id", "changed_at");
CREATE INDEX "attendance_records_scheduled_shift_id_idx" ON "attendance_records"("scheduled_shift_id");

ALTER TABLE "schedule_periods"
  ADD CONSTRAINT "schedule_periods_created_by_id_fkey" FOREIGN KEY ("created_by_id") REFERENCES "employees"("id") ON DELETE SET NULL ON UPDATE CASCADE,
  ADD CONSTRAINT "schedule_periods_updated_by_id_fkey" FOREIGN KEY ("updated_by_id") REFERENCES "employees"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "scheduled_shifts"
  ADD CONSTRAINT "scheduled_shifts_schedule_period_id_fkey" FOREIGN KEY ("schedule_period_id") REFERENCES "schedule_periods"("id") ON DELETE CASCADE ON UPDATE CASCADE,
  ADD CONSTRAINT "scheduled_shifts_employee_id_fkey" FOREIGN KEY ("employee_id") REFERENCES "employees"("id") ON DELETE CASCADE ON UPDATE CASCADE,
  ADD CONSTRAINT "scheduled_shifts_shift_template_id_fkey" FOREIGN KEY ("shift_template_id") REFERENCES "shift_templates"("id") ON DELETE SET NULL ON UPDATE CASCADE,
  ADD CONSTRAINT "scheduled_shifts_replaced_employee_id_fkey" FOREIGN KEY ("replaced_employee_id") REFERENCES "employees"("id") ON DELETE SET NULL ON UPDATE CASCADE,
  ADD CONSTRAINT "scheduled_shifts_source_scheduled_shift_id_fkey" FOREIGN KEY ("source_scheduled_shift_id") REFERENCES "scheduled_shifts"("id") ON DELETE SET NULL ON UPDATE CASCADE,
  ADD CONSTRAINT "scheduled_shifts_created_by_id_fkey" FOREIGN KEY ("created_by_id") REFERENCES "employees"("id") ON DELETE SET NULL ON UPDATE CASCADE,
  ADD CONSTRAINT "scheduled_shifts_updated_by_id_fkey" FOREIGN KEY ("updated_by_id") REFERENCES "employees"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "schedule_change_logs"
  ADD CONSTRAINT "schedule_change_logs_schedule_period_id_fkey" FOREIGN KEY ("schedule_period_id") REFERENCES "schedule_periods"("id") ON DELETE SET NULL ON UPDATE CASCADE,
  ADD CONSTRAINT "schedule_change_logs_scheduled_shift_id_fkey" FOREIGN KEY ("scheduled_shift_id") REFERENCES "scheduled_shifts"("id") ON DELETE SET NULL ON UPDATE CASCADE,
  ADD CONSTRAINT "schedule_change_logs_changed_by_id_fkey" FOREIGN KEY ("changed_by_id") REFERENCES "employees"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "attendance_records"
  ADD CONSTRAINT "attendance_records_scheduled_shift_id_fkey" FOREIGN KEY ("scheduled_shift_id") REFERENCES "scheduled_shifts"("id") ON DELETE SET NULL ON UPDATE CASCADE;

INSERT INTO "permissions" ("id", "code", "description", "created_at", "updated_at")
VALUES
  (gen_random_uuid(), 'hr.payroll.adjust', 'ปรับยอดค่าจ้าง', CURRENT_TIMESTAMP, CURRENT_TIMESTAMP),
  (gen_random_uuid(), 'hr.payroll.unlock', 'ปลดล็อกรอบค่าจ้าง', CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)
ON CONFLICT ("code") DO UPDATE
SET "description" = EXCLUDED."description",
    "updated_at" = CURRENT_TIMESTAMP;

INSERT INTO "role_permissions" ("role_id", "permission_id")
SELECT r."id", p."id"
FROM "roles" AS r
CROSS JOIN "permissions" AS p
WHERE r."code" IN ('ADMIN', 'ACCOUNTING')
  AND p."code" IN ('hr.payroll.adjust', 'hr.payroll.unlock')
ON CONFLICT ("role_id", "permission_id") DO NOTHING;
