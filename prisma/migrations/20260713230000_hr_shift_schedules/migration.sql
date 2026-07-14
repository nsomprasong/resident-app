-- Phase 18.4: shift templates, work schedules, holiday calendar
-- Legacy work_shifts kept intact for migration compatibility

CREATE TYPE "WorkScheduleStatus" AS ENUM ('ASSIGNED', 'CANCELLED');

CREATE TABLE "shift_templates" (
  "id" UUID NOT NULL DEFAULT gen_random_uuid(),
  "code" TEXT,
  "name" TEXT NOT NULL,
  "start_minutes" INTEGER NOT NULL,
  "end_minutes" INTEGER NOT NULL,
  "break_minutes" INTEGER NOT NULL DEFAULT 0,
  "required_headcount" INTEGER NOT NULL DEFAULT 1,
  "color" TEXT,
  "is_active" BOOLEAN NOT NULL DEFAULT true,
  "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updated_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "shift_templates_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "shift_templates_code_key" ON "shift_templates"("code");
CREATE INDEX "shift_templates_is_active_name_idx" ON "shift_templates"("is_active", "name");

CREATE TABLE "work_schedules" (
  "id" UUID NOT NULL DEFAULT gen_random_uuid(),
  "employee_id" UUID NOT NULL,
  "shift_template_id" UUID,
  "work_date" DATE NOT NULL,
  "starts_at" TIMESTAMP(3) NOT NULL,
  "ends_at" TIMESTAMP(3) NOT NULL,
  "notes" TEXT,
  "status" "WorkScheduleStatus" NOT NULL DEFAULT 'ASSIGNED',
  "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updated_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "work_schedules_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "work_schedules_employee_id_work_date_idx" ON "work_schedules"("employee_id", "work_date");
CREATE INDEX "work_schedules_work_date_status_idx" ON "work_schedules"("work_date", "status");
CREATE INDEX "work_schedules_shift_template_id_work_date_idx" ON "work_schedules"("shift_template_id", "work_date");
CREATE INDEX "work_schedules_starts_at_ends_at_idx" ON "work_schedules"("starts_at", "ends_at");

ALTER TABLE "work_schedules"
  ADD CONSTRAINT "work_schedules_employee_id_fkey"
  FOREIGN KEY ("employee_id") REFERENCES "employees"("id")
  ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "work_schedules"
  ADD CONSTRAINT "work_schedules_shift_template_id_fkey"
  FOREIGN KEY ("shift_template_id") REFERENCES "shift_templates"("id")
  ON DELETE SET NULL ON UPDATE CASCADE;

CREATE TABLE "holiday_calendar" (
  "id" UUID NOT NULL DEFAULT gen_random_uuid(),
  "name" TEXT NOT NULL,
  "holiday_date" DATE NOT NULL,
  "is_day_off" BOOLEAN NOT NULL DEFAULT true,
  "notes" TEXT,
  "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updated_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "holiday_calendar_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "holiday_calendar_holiday_date_name_key" ON "holiday_calendar"("holiday_date", "name");
CREATE INDEX "holiday_calendar_holiday_date_idx" ON "holiday_calendar"("holiday_date");
