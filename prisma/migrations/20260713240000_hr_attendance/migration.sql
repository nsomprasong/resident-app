-- Phase 18.5: attendance records, adjustments, lock periods

CREATE TYPE "AttendanceStatus" AS ENUM ('OPEN', 'COMPLETE', 'INCOMPLETE', 'ABSENT', 'LOCKED');
CREATE TYPE "AttendanceAdjustmentType" AS ENUM ('CLOCK_CORRECTION', 'OT_REQUEST', 'MANUAL_ENTRY');
CREATE TYPE "AttendanceAdjustmentStatus" AS ENUM ('PENDING', 'APPROVED', 'REJECTED');

CREATE TABLE "attendance_records" (
  "id" UUID NOT NULL DEFAULT gen_random_uuid(),
  "employee_id" UUID NOT NULL,
  "work_schedule_id" UUID,
  "work_date" DATE NOT NULL,
  "clock_in" TIMESTAMP(3),
  "clock_out" TIMESTAMP(3),
  "break_start" TIMESTAMP(3),
  "break_end" TIMESTAMP(3),
  "scheduled_start" TIMESTAMP(3),
  "scheduled_end" TIMESTAMP(3),
  "worked_minutes" INTEGER NOT NULL DEFAULT 0,
  "break_minutes" INTEGER NOT NULL DEFAULT 0,
  "late_minutes" INTEGER NOT NULL DEFAULT 0,
  "early_leave_minutes" INTEGER NOT NULL DEFAULT 0,
  "ot_minutes" INTEGER NOT NULL DEFAULT 0,
  "ot_approved_minutes" INTEGER NOT NULL DEFAULT 0,
  "is_holiday_work" BOOLEAN NOT NULL DEFAULT false,
  "status" "AttendanceStatus" NOT NULL DEFAULT 'OPEN',
  "notes" TEXT,
  "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updated_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "attendance_records_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "attendance_records_employee_id_work_date_work_schedule_id_key"
  ON "attendance_records"("employee_id", "work_date", "work_schedule_id");
CREATE INDEX "attendance_records_work_date_status_idx" ON "attendance_records"("work_date", "status");
CREATE INDEX "attendance_records_employee_id_work_date_idx" ON "attendance_records"("employee_id", "work_date");

ALTER TABLE "attendance_records"
  ADD CONSTRAINT "attendance_records_employee_id_fkey"
  FOREIGN KEY ("employee_id") REFERENCES "employees"("id")
  ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "attendance_records"
  ADD CONSTRAINT "attendance_records_work_schedule_id_fkey"
  FOREIGN KEY ("work_schedule_id") REFERENCES "work_schedules"("id")
  ON DELETE SET NULL ON UPDATE CASCADE;

CREATE TABLE "attendance_adjustments" (
  "id" UUID NOT NULL DEFAULT gen_random_uuid(),
  "attendance_record_id" UUID NOT NULL,
  "type" "AttendanceAdjustmentType" NOT NULL,
  "status" "AttendanceAdjustmentStatus" NOT NULL DEFAULT 'PENDING',
  "reason" TEXT NOT NULL,
  "proposed_clock_in" TIMESTAMP(3),
  "proposed_clock_out" TIMESTAMP(3),
  "proposed_break_start" TIMESTAMP(3),
  "proposed_break_end" TIMESTAMP(3),
  "proposed_ot_minutes" INTEGER,
  "requested_by_id" UUID NOT NULL,
  "reviewed_by_id" UUID,
  "reviewed_at" TIMESTAMP(3),
  "review_note" TEXT,
  "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updated_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "attendance_adjustments_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "attendance_adjustments_attendance_record_id_status_idx"
  ON "attendance_adjustments"("attendance_record_id", "status");
CREATE INDEX "attendance_adjustments_status_created_at_idx"
  ON "attendance_adjustments"("status", "created_at");

ALTER TABLE "attendance_adjustments"
  ADD CONSTRAINT "attendance_adjustments_attendance_record_id_fkey"
  FOREIGN KEY ("attendance_record_id") REFERENCES "attendance_records"("id")
  ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "attendance_adjustments"
  ADD CONSTRAINT "attendance_adjustments_requested_by_id_fkey"
  FOREIGN KEY ("requested_by_id") REFERENCES "employees"("id")
  ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "attendance_adjustments"
  ADD CONSTRAINT "attendance_adjustments_reviewed_by_id_fkey"
  FOREIGN KEY ("reviewed_by_id") REFERENCES "employees"("id")
  ON DELETE SET NULL ON UPDATE CASCADE;

CREATE TABLE "attendance_periods" (
  "id" UUID NOT NULL DEFAULT gen_random_uuid(),
  "period_start" DATE NOT NULL,
  "period_end" DATE NOT NULL,
  "locked_at" TIMESTAMP(3),
  "locked_by_id" UUID,
  "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updated_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "attendance_periods_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "attendance_periods_period_start_period_end_key"
  ON "attendance_periods"("period_start", "period_end");
CREATE INDEX "attendance_periods_period_start_period_end_idx"
  ON "attendance_periods"("period_start", "period_end");

ALTER TABLE "attendance_periods"
  ADD CONSTRAINT "attendance_periods_locked_by_id_fkey"
  FOREIGN KEY ("locked_by_id") REFERENCES "employees"("id")
  ON DELETE SET NULL ON UPDATE CASCADE;
