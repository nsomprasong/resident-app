-- Phase 21: geofence attendance, shift grace, employee pay/default shift, self-service permissions

ALTER TABLE "shift_templates"
  ADD COLUMN IF NOT EXISTS "late_grace_minutes" INTEGER NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS "early_leave_grace_minutes" INTEGER NOT NULL DEFAULT 0;

ALTER TABLE "work_schedules"
  ADD COLUMN IF NOT EXISTS "is_day_off" BOOLEAN NOT NULL DEFAULT false;

ALTER TABLE "employees"
  ADD COLUMN IF NOT EXISTS "ot_hourly_rate" DECIMAL(10, 2),
  ADD COLUMN IF NOT EXISTS "pay_day_of_month" INTEGER,
  ADD COLUMN IF NOT EXISTS "default_shift_template_id" UUID;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'employees_default_shift_template_id_fkey'
  ) THEN
    ALTER TABLE "employees"
      ADD CONSTRAINT "employees_default_shift_template_id_fkey"
      FOREIGN KEY ("default_shift_template_id") REFERENCES "shift_templates"("id")
      ON DELETE SET NULL ON UPDATE CASCADE;
  END IF;
END $$;

CREATE INDEX IF NOT EXISTS "employees_default_shift_template_id_idx"
  ON "employees"("default_shift_template_id");

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'AttendanceEventType') THEN
    CREATE TYPE "AttendanceEventType" AS ENUM ('CHECK_IN', 'CHECK_OUT');
  END IF;
END $$;

CREATE TABLE IF NOT EXISTS "attendance_events" (
  "id" UUID NOT NULL DEFAULT gen_random_uuid(),
  "employee_id" UUID NOT NULL,
  "attendance_record_id" UUID,
  "type" "AttendanceEventType" NOT NULL,
  "occurred_at" TIMESTAMP(3) NOT NULL,
  "latitude" DECIMAL(10, 7) NOT NULL,
  "longitude" DECIMAL(10, 7) NOT NULL,
  "distance_meters" DECIMAL(10, 2) NOT NULL,
  "accuracy_meters" DECIMAL(10, 2),
  "user_agent" TEXT,
  "note" TEXT,
  "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "attendance_events_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "attendance_events_employee_id_fkey"
    FOREIGN KEY ("employee_id") REFERENCES "employees"("id") ON DELETE CASCADE ON UPDATE CASCADE,
  CONSTRAINT "attendance_events_attendance_record_id_fkey"
    FOREIGN KEY ("attendance_record_id") REFERENCES "attendance_records"("id") ON DELETE SET NULL ON UPDATE CASCADE
);

CREATE INDEX IF NOT EXISTS "attendance_events_employee_id_occurred_at_idx"
  ON "attendance_events"("employee_id", "occurred_at");
CREATE INDEX IF NOT EXISTS "attendance_events_attendance_record_id_type_idx"
  ON "attendance_events"("attendance_record_id", "type");

CREATE TABLE IF NOT EXISTS "hr_attendance_settings" (
  "id" TEXT NOT NULL DEFAULT 'default',
  "latitude" DECIMAL(10, 7) NOT NULL DEFAULT 0,
  "longitude" DECIMAL(10, 7) NOT NULL DEFAULT 0,
  "radius_meters" INTEGER NOT NULL DEFAULT 50,
  "max_accuracy_meters" INTEGER NOT NULL DEFAULT 80,
  "timezone" TEXT NOT NULL DEFAULT 'Asia/Bangkok',
  "allow_clock_without_schedule" BOOLEAN NOT NULL DEFAULT false,
  "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updated_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "hr_attendance_settings_pkey" PRIMARY KEY ("id")
);

INSERT INTO "hr_attendance_settings" (
  "id", "latitude", "longitude", "radius_meters", "max_accuracy_meters", "timezone", "allow_clock_without_schedule"
) VALUES (
  'default', 0, 0, 50, 80, 'Asia/Bangkok', false
) ON CONFLICT ("id") DO NOTHING;

INSERT INTO "permissions" ("id", "code", "description", "created_at", "updated_at")
VALUES
  (gen_random_uuid(), 'hr.attendance.self', 'ลงเวลาและดูเวลาของตนเอง', CURRENT_TIMESTAMP, CURRENT_TIMESTAMP),
  (gen_random_uuid(), 'hr.leave.self', 'ส่งและดูคำขอลาของตนเอง', CURRENT_TIMESTAMP, CURRENT_TIMESTAMP),
  (gen_random_uuid(), 'hr.overtime.manage', 'ตรวจสอบและอนุมัติ OT', CURRENT_TIMESTAMP, CURRENT_TIMESTAMP),
  (gen_random_uuid(), 'hr.payroll_summary.view', 'ดูสรุปค่าแรงรอบจ่ายเงิน', CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)
ON CONFLICT ("code") DO UPDATE
SET "description" = EXCLUDED."description",
    "updated_at" = CURRENT_TIMESTAMP;

-- Grant new self-service permissions broadly to active roles that use the app
INSERT INTO "role_permissions" ("role_id", "permission_id")
SELECT r."id", p."id"
FROM "roles" AS r
CROSS JOIN "permissions" AS p
WHERE r."is_active" = true
  AND p."code" IN ('hr.attendance.self', 'hr.leave.self')
ON CONFLICT ("role_id", "permission_id") DO NOTHING;

INSERT INTO "role_permissions" ("role_id", "permission_id")
SELECT r."id", p."id"
FROM "roles" AS r
CROSS JOIN "permissions" AS p
WHERE r."code" IN ('ADMIN', 'MANAGER')
  AND p."code" IN ('hr.overtime.manage', 'hr.payroll_summary.view')
ON CONFLICT ("role_id", "permission_id") DO NOTHING;

INSERT INTO "role_permissions" ("role_id", "permission_id")
SELECT r."id", p."id"
FROM "roles" AS r
CROSS JOIN "permissions" AS p
WHERE r."code" = 'ACCOUNTING'
  AND p."code" = 'hr.payroll_summary.view'
ON CONFLICT ("role_id", "permission_id") DO NOTHING;
