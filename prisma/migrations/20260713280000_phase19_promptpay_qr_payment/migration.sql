-- Phase 19: PromptPay QR payment accounts, payment extensions, permissions

-- Enums
ALTER TYPE "PaymentStatus" ADD VALUE IF NOT EXISTS 'AWAITING_PAYMENT';
ALTER TYPE "PaymentStatus" ADD VALUE IF NOT EXISTS 'PENDING_VERIFICATION';
ALTER TYPE "PaymentStatus" ADD VALUE IF NOT EXISTS 'VERIFIED';
ALTER TYPE "PaymentStatus" ADD VALUE IF NOT EXISTS 'CANCELLED';
ALTER TYPE "PaymentStatus" ADD VALUE IF NOT EXISTS 'REJECTED';
ALTER TYPE "PaymentStatus" ADD VALUE IF NOT EXISTS 'PARTIALLY_REFUNDED';

ALTER TYPE "PaymentMethod" ADD VALUE IF NOT EXISTS 'PROMPTPAY_QR';

DO $$ BEGIN
  CREATE TYPE "PromptPayIdType" AS ENUM ('PHONE', 'NATIONAL_ID_OR_TAX_ID', 'EWALLET');
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
  CREATE TYPE "PaymentPurpose" AS ENUM ('DEPOSIT', 'PARTIAL', 'FULL', 'OTHER');
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

-- PromptPay accounts
CREATE TABLE IF NOT EXISTS "promptpay_accounts" (
  "id" UUID NOT NULL DEFAULT gen_random_uuid(),
  "display_name" TEXT NOT NULL,
  "id_type" "PromptPayIdType" NOT NULL,
  "identifier" TEXT NOT NULL,
  "account_name" TEXT NOT NULL,
  "bank_name" TEXT,
  "is_active" BOOLEAN NOT NULL DEFAULT true,
  "is_primary" BOOLEAN NOT NULL DEFAULT false,
  "notes" TEXT,
  "created_by_id" UUID,
  "updated_by_id" UUID,
  "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updated_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "promptpay_accounts_pkey" PRIMARY KEY ("id")
);

CREATE INDEX IF NOT EXISTS "promptpay_accounts_is_active_is_primary_idx"
  ON "promptpay_accounts"("is_active", "is_primary");
CREATE INDEX IF NOT EXISTS "promptpay_accounts_id_type_idx"
  ON "promptpay_accounts"("id_type");

CREATE UNIQUE INDEX IF NOT EXISTS "promptpay_accounts_one_primary_active"
  ON "promptpay_accounts" ((true))
  WHERE "is_primary" = true AND "is_active" = true;

ALTER TABLE "promptpay_accounts"
  DROP CONSTRAINT IF EXISTS "promptpay_accounts_created_by_id_fkey",
  DROP CONSTRAINT IF EXISTS "promptpay_accounts_updated_by_id_fkey";

ALTER TABLE "promptpay_accounts"
  ADD CONSTRAINT "promptpay_accounts_created_by_id_fkey"
    FOREIGN KEY ("created_by_id") REFERENCES "employees"("id") ON DELETE SET NULL ON UPDATE CASCADE,
  ADD CONSTRAINT "promptpay_accounts_updated_by_id_fkey"
    FOREIGN KEY ("updated_by_id") REFERENCES "employees"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- Extend payments
ALTER TABLE "payments"
  ADD COLUMN IF NOT EXISTS "payment_number" TEXT,
  ADD COLUMN IF NOT EXISTS "currency" TEXT NOT NULL DEFAULT 'THB',
  ADD COLUMN IF NOT EXISTS "purpose" "PaymentPurpose",
  ADD COLUMN IF NOT EXISTS "promptpay_account_id" UUID,
  ADD COLUMN IF NOT EXISTS "promptpay_account_name_snapshot" TEXT,
  ADD COLUMN IF NOT EXISTS "promptpay_identifier_masked" TEXT,
  ADD COLUMN IF NOT EXISTS "submitted_at" TIMESTAMP(3),
  ADD COLUMN IF NOT EXISTS "verified_at" TIMESTAMP(3),
  ADD COLUMN IF NOT EXISTS "verified_by_id" UUID,
  ADD COLUMN IF NOT EXISTS "created_by_id" UUID,
  ADD COLUMN IF NOT EXISTS "slip_storage_bucket" TEXT,
  ADD COLUMN IF NOT EXISTS "slip_storage_path" TEXT,
  ADD COLUMN IF NOT EXISTS "slip_file_name" TEXT,
  ADD COLUMN IF NOT EXISTS "slip_content_type" TEXT,
  ADD COLUMN IF NOT EXISTS "slip_size_bytes" INTEGER,
  ADD COLUMN IF NOT EXISTS "note" TEXT,
  ADD COLUMN IF NOT EXISTS "cancelled_at" TIMESTAMP(3),
  ADD COLUMN IF NOT EXISTS "cancel_reason" TEXT,
  ADD COLUMN IF NOT EXISTS "updated_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP;

CREATE UNIQUE INDEX IF NOT EXISTS "payments_payment_number_key" ON "payments"("payment_number");
CREATE INDEX IF NOT EXISTS "payments_status_created_at_idx" ON "payments"("status", "created_at");
CREATE INDEX IF NOT EXISTS "payments_promptpay_account_id_idx" ON "payments"("promptpay_account_id");

ALTER TABLE "payments"
  DROP CONSTRAINT IF EXISTS "payments_promptpay_account_id_fkey",
  DROP CONSTRAINT IF EXISTS "payments_verified_by_id_fkey",
  DROP CONSTRAINT IF EXISTS "payments_created_by_id_fkey";

ALTER TABLE "payments"
  ADD CONSTRAINT "payments_promptpay_account_id_fkey"
    FOREIGN KEY ("promptpay_account_id") REFERENCES "promptpay_accounts"("id") ON DELETE RESTRICT ON UPDATE CASCADE,
  ADD CONSTRAINT "payments_verified_by_id_fkey"
    FOREIGN KEY ("verified_by_id") REFERENCES "employees"("id") ON DELETE SET NULL ON UPDATE CASCADE,
  ADD CONSTRAINT "payments_created_by_id_fkey"
    FOREIGN KEY ("created_by_id") REFERENCES "employees"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- Status history
CREATE TABLE IF NOT EXISTS "payment_status_history" (
  "id" UUID NOT NULL DEFAULT gen_random_uuid(),
  "payment_id" UUID NOT NULL,
  "from_status" "PaymentStatus",
  "to_status" "PaymentStatus" NOT NULL,
  "note" TEXT,
  "actor_id" UUID,
  "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "payment_status_history_pkey" PRIMARY KEY ("id")
);

CREATE INDEX IF NOT EXISTS "payment_status_history_payment_id_created_at_idx"
  ON "payment_status_history"("payment_id", "created_at");

ALTER TABLE "payment_status_history"
  DROP CONSTRAINT IF EXISTS "payment_status_history_payment_id_fkey",
  DROP CONSTRAINT IF EXISTS "payment_status_history_actor_id_fkey";

ALTER TABLE "payment_status_history"
  ADD CONSTRAINT "payment_status_history_payment_id_fkey"
    FOREIGN KEY ("payment_id") REFERENCES "payments"("id") ON DELETE CASCADE ON UPDATE CASCADE,
  ADD CONSTRAINT "payment_status_history_actor_id_fkey"
    FOREIGN KEY ("actor_id") REFERENCES "employees"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- Refunds linked to verified PromptPay payments
CREATE TABLE IF NOT EXISTS "payment_refunds" (
  "id" UUID NOT NULL DEFAULT gen_random_uuid(),
  "payment_id" UUID NOT NULL,
  "booking_id" UUID NOT NULL,
  "amount" DECIMAL(10,2) NOT NULL,
  "reason" TEXT,
  "created_by_id" UUID,
  "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "payment_refunds_pkey" PRIMARY KEY ("id")
);

CREATE INDEX IF NOT EXISTS "payment_refunds_payment_id_idx" ON "payment_refunds"("payment_id");
CREATE INDEX IF NOT EXISTS "payment_refunds_booking_id_created_at_idx" ON "payment_refunds"("booking_id", "created_at");

ALTER TABLE "payment_refunds"
  DROP CONSTRAINT IF EXISTS "payment_refunds_payment_id_fkey",
  DROP CONSTRAINT IF EXISTS "payment_refunds_booking_id_fkey",
  DROP CONSTRAINT IF EXISTS "payment_refunds_created_by_id_fkey";

ALTER TABLE "payment_refunds"
  ADD CONSTRAINT "payment_refunds_payment_id_fkey"
    FOREIGN KEY ("payment_id") REFERENCES "payments"("id") ON DELETE RESTRICT ON UPDATE CASCADE,
  ADD CONSTRAINT "payment_refunds_booking_id_fkey"
    FOREIGN KEY ("booking_id") REFERENCES "bookings"("id") ON DELETE CASCADE ON UPDATE CASCADE,
  ADD CONSTRAINT "payment_refunds_created_by_id_fkey"
    FOREIGN KEY ("created_by_id") REFERENCES "employees"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- Permissions (Thai descriptions)
INSERT INTO "permissions" ("id", "code", "description", "created_at", "updated_at")
VALUES
  (gen_random_uuid(), 'payment.view', 'ดูรายการรับชำระเงิน', CURRENT_TIMESTAMP, CURRENT_TIMESTAMP),
  (gen_random_uuid(), 'payment.create', 'สร้างรายการรับชำระเงิน', CURRENT_TIMESTAMP, CURRENT_TIMESTAMP),
  (gen_random_uuid(), 'payment.submit', 'ส่งหลักฐานการชำระเงิน', CURRENT_TIMESTAMP, CURRENT_TIMESTAMP),
  (gen_random_uuid(), 'payment.verify', 'ตรวจสอบและยืนยันการชำระเงิน', CURRENT_TIMESTAMP, CURRENT_TIMESTAMP),
  (gen_random_uuid(), 'payment.cancel', 'ยกเลิกรายการรับชำระเงิน', CURRENT_TIMESTAMP, CURRENT_TIMESTAMP),
  (gen_random_uuid(), 'payment.receipt.print', 'พิมพ์หรือดาวน์โหลดหลักฐานรับเงิน', CURRENT_TIMESTAMP, CURRENT_TIMESTAMP),
  (gen_random_uuid(), 'payment.promptpay_settings.view', 'ดูการตั้งค่าพร้อมเพย์', CURRENT_TIMESTAMP, CURRENT_TIMESTAMP),
  (gen_random_uuid(), 'payment.promptpay_settings.manage', 'จัดการบัญชีพร้อมเพย์', CURRENT_TIMESTAMP, CURRENT_TIMESTAMP),
  (gen_random_uuid(), 'payment.report.view', 'ดูรายงานการรับชำระเงิน', CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)
ON CONFLICT ("code") DO UPDATE
SET "description" = EXCLUDED."description",
    "updated_at" = CURRENT_TIMESTAMP;

-- Note: payment.refund already exists from RBAC v2

-- ADMIN: all new payment.* 
INSERT INTO "role_permissions" ("role_id", "permission_id")
SELECT r."id", p."id"
FROM "roles" AS r
CROSS JOIN "permissions" AS p
WHERE r."code" = 'ADMIN'
  AND p."code" IN (
    'payment.view', 'payment.create', 'payment.submit', 'payment.verify',
    'payment.cancel', 'payment.receipt.print',
    'payment.promptpay_settings.view', 'payment.promptpay_settings.manage',
    'payment.report.view'
  )
ON CONFLICT ("role_id", "permission_id") DO NOTHING;

-- MANAGER
INSERT INTO "role_permissions" ("role_id", "permission_id")
SELECT r."id", p."id"
FROM "roles" AS r
CROSS JOIN "permissions" AS p
WHERE r."code" = 'MANAGER'
  AND p."code" IN (
    'payment.view', 'payment.create', 'payment.submit', 'payment.verify',
    'payment.cancel', 'payment.receipt.print',
    'payment.promptpay_settings.view', 'payment.promptpay_settings.manage',
    'payment.report.view'
  )
ON CONFLICT ("role_id", "permission_id") DO NOTHING;

-- ACCOUNTING
INSERT INTO "role_permissions" ("role_id", "permission_id")
SELECT r."id", p."id"
FROM "roles" AS r
CROSS JOIN "permissions" AS p
WHERE r."code" = 'ACCOUNTING'
  AND p."code" IN (
    'payment.view', 'payment.create', 'payment.submit', 'payment.verify',
    'payment.cancel', 'payment.receipt.print',
    'payment.promptpay_settings.view', 'payment.promptpay_settings.manage',
    'payment.report.view'
  )
ON CONFLICT ("role_id", "permission_id") DO NOTHING;

-- RECEPTION: create/submit/view/print (no verify/settings manage)
INSERT INTO "role_permissions" ("role_id", "permission_id")
SELECT r."id", p."id"
FROM "roles" AS r
CROSS JOIN "permissions" AS p
WHERE r."code" = 'RECEPTION'
  AND p."code" IN (
    'payment.view', 'payment.create', 'payment.submit',
    'payment.cancel', 'payment.receipt.print',
    'payment.promptpay_settings.view'
  )
ON CONFLICT ("role_id", "permission_id") DO NOTHING;
