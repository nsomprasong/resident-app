-- Phase 18.6: leave types, balances, requests

CREATE TYPE "LeaveDuration" AS ENUM ('FULL_DAY', 'HALF_DAY_AM', 'HALF_DAY_PM');
CREATE TYPE "LeaveRequestStatus" AS ENUM ('PENDING', 'APPROVED', 'REJECTED', 'CANCELLED');

CREATE TABLE "leave_types" (
  "id" UUID NOT NULL DEFAULT gen_random_uuid(),
  "code" TEXT NOT NULL,
  "name" TEXT NOT NULL,
  "description" TEXT,
  "is_paid" BOOLEAN NOT NULL DEFAULT true,
  "requires_attachment" BOOLEAN NOT NULL DEFAULT false,
  "default_allowance_days" DECIMAL(8,2) NOT NULL DEFAULT 0,
  "is_active" BOOLEAN NOT NULL DEFAULT true,
  "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updated_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "leave_types_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "leave_types_code_key" ON "leave_types"("code");
CREATE INDEX "leave_types_is_active_name_idx" ON "leave_types"("is_active", "name");

CREATE TABLE "leave_balances" (
  "id" UUID NOT NULL DEFAULT gen_random_uuid(),
  "employee_id" UUID NOT NULL,
  "leave_type_id" UUID NOT NULL,
  "year" INTEGER NOT NULL,
  "entitled" DECIMAL(8,2) NOT NULL DEFAULT 0,
  "used" DECIMAL(8,2) NOT NULL DEFAULT 0,
  "pending" DECIMAL(8,2) NOT NULL DEFAULT 0,
  "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updated_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "leave_balances_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "leave_balances_employee_id_leave_type_id_year_key"
  ON "leave_balances"("employee_id", "leave_type_id", "year");
CREATE INDEX "leave_balances_employee_id_year_idx" ON "leave_balances"("employee_id", "year");
CREATE INDEX "leave_balances_leave_type_id_year_idx" ON "leave_balances"("leave_type_id", "year");

ALTER TABLE "leave_balances"
  ADD CONSTRAINT "leave_balances_employee_id_fkey"
  FOREIGN KEY ("employee_id") REFERENCES "employees"("id")
  ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "leave_balances"
  ADD CONSTRAINT "leave_balances_leave_type_id_fkey"
  FOREIGN KEY ("leave_type_id") REFERENCES "leave_types"("id")
  ON DELETE CASCADE ON UPDATE CASCADE;

CREATE TABLE "leave_requests" (
  "id" UUID NOT NULL DEFAULT gen_random_uuid(),
  "employee_id" UUID NOT NULL,
  "leave_type_id" UUID NOT NULL,
  "start_date" DATE NOT NULL,
  "end_date" DATE NOT NULL,
  "duration" "LeaveDuration" NOT NULL DEFAULT 'FULL_DAY',
  "days_requested" DECIMAL(8,2) NOT NULL,
  "reason" TEXT,
  "attachment_url" TEXT,
  "attachment_name" TEXT,
  "status" "LeaveRequestStatus" NOT NULL DEFAULT 'PENDING',
  "requested_by_id" UUID NOT NULL,
  "reviewed_by_id" UUID,
  "reviewed_at" TIMESTAMP(3),
  "review_note" TEXT,
  "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updated_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "leave_requests_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "leave_requests_employee_id_start_date_end_date_idx"
  ON "leave_requests"("employee_id", "start_date", "end_date");
CREATE INDEX "leave_requests_status_created_at_idx"
  ON "leave_requests"("status", "created_at");
CREATE INDEX "leave_requests_leave_type_id_status_idx"
  ON "leave_requests"("leave_type_id", "status");

ALTER TABLE "leave_requests"
  ADD CONSTRAINT "leave_requests_employee_id_fkey"
  FOREIGN KEY ("employee_id") REFERENCES "employees"("id")
  ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "leave_requests"
  ADD CONSTRAINT "leave_requests_leave_type_id_fkey"
  FOREIGN KEY ("leave_type_id") REFERENCES "leave_types"("id")
  ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "leave_requests"
  ADD CONSTRAINT "leave_requests_requested_by_id_fkey"
  FOREIGN KEY ("requested_by_id") REFERENCES "employees"("id")
  ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "leave_requests"
  ADD CONSTRAINT "leave_requests_reviewed_by_id_fkey"
  FOREIGN KEY ("reviewed_by_id") REFERENCES "employees"("id")
  ON DELETE SET NULL ON UPDATE CASCADE;

-- Seed configurable leave types (not hardcoded in app logic)
INSERT INTO "leave_types"
  ("id", "code", "name", "description", "is_paid", "requires_attachment", "default_allowance_days", "is_active")
VALUES
  (gen_random_uuid(), 'ANNUAL', 'ลาพักร้อน', 'สิทธิลาประจำปี', true, false, 6, true),
  (gen_random_uuid(), 'SICK', 'ลาป่วย', 'ลาป่วย มีใบรับรองเมื่อเกินเกณฑ์', true, true, 30, true),
  (gen_random_uuid(), 'UNPAID', 'ลาไม่รับค่าจ้าง', 'ลาโดยไม่รับค่าจ้าง', false, false, 0, true),
  (gen_random_uuid(), 'PERSONAL', 'ลากิจ', 'ลากิจส่วนตัว', true, false, 3, true);
