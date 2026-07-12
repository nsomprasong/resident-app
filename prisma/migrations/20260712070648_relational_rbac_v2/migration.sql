-- AlterTable
ALTER TABLE "employees" ADD COLUMN     "role_id" UUID;

-- CreateTable
CREATE TABLE "roles" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "code" TEXT NOT NULL,
    "display_name" TEXT NOT NULL,
    "is_active" BOOLEAN NOT NULL DEFAULT true,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "roles_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "permissions" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "code" TEXT NOT NULL,
    "description" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "permissions_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "role_permissions" (
    "role_id" UUID NOT NULL,
    "permission_id" UUID NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "role_permissions_pkey" PRIMARY KEY ("role_id","permission_id")
);

-- CreateIndex
CREATE UNIQUE INDEX "roles_code_key" ON "roles"("code");

-- CreateIndex
CREATE UNIQUE INDEX "permissions_code_key" ON "permissions"("code");

-- CreateIndex
CREATE INDEX "role_permissions_permission_id_idx" ON "role_permissions"("permission_id");

-- CreateIndex
CREATE INDEX "employees_role_id_idx" ON "employees"("role_id");

-- AddForeignKey
ALTER TABLE "role_permissions" ADD CONSTRAINT "role_permissions_role_id_fkey" FOREIGN KEY ("role_id") REFERENCES "roles"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "role_permissions" ADD CONSTRAINT "role_permissions_permission_id_fkey" FOREIGN KEY ("permission_id") REFERENCES "permissions"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "employees" ADD CONSTRAINT "employees_role_id_fkey" FOREIGN KEY ("role_id") REFERENCES "roles"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- Seed canonical roles. Codes are authorization identities; display names are localized labels.
INSERT INTO "roles" ("code", "display_name", "is_active", "updated_at")
VALUES
    ('ADMIN', 'ผู้ดูแลระบบ', true, CURRENT_TIMESTAMP),
    ('MANAGER', 'ผู้จัดการ', true, CURRENT_TIMESTAMP),
    ('RECEPTION', 'พนักงานต้อนรับ', true, CURRENT_TIMESTAMP),
    ('HOUSEKEEPING', 'แม่บ้าน', true, CURRENT_TIMESTAMP),
    ('KITCHEN', 'ครัว', true, CURRENT_TIMESTAMP),
    ('ACCOUNTING', 'บัญชี/แคชเชียร์', true, CURRENT_TIMESTAMP)
ON CONFLICT ("code") DO NOTHING;

-- Seed only permissions defined by the current authorization policy.
INSERT INTO "permissions" ("code", "updated_at")
VALUES
    ('booking.read', CURRENT_TIMESTAMP),
    ('booking.write', CURRENT_TIMESTAMP),
    ('booking.lifecycle', CURRENT_TIMESTAMP),
    ('resource.read', CURRENT_TIMESTAMP),
    ('resource.manage', CURRENT_TIMESTAMP),
    ('order.read', CURRENT_TIMESTAMP),
    ('order.write', CURRENT_TIMESTAMP),
    ('order.kitchen', CURRENT_TIMESTAMP),
    ('payment.read', CURRENT_TIMESTAMP),
    ('payment.collect', CURRENT_TIMESTAMP),
    ('payment.refund', CURRENT_TIMESTAMP),
    ('payment_channel.manage', CURRENT_TIMESTAMP),
    ('inspection.read', CURRENT_TIMESTAMP),
    ('inspection.write', CURRENT_TIMESTAMP),
    ('inspection.complete', CURRENT_TIMESTAMP),
    ('catalog.read', CURRENT_TIMESTAMP),
    ('catalog.manage', CURRENT_TIMESTAMP),
    ('employee.read', CURRENT_TIMESTAMP),
    ('employee.manage', CURRENT_TIMESTAMP),
    ('wage.read', CURRENT_TIMESTAMP),
    ('report.read', CURRENT_TIMESTAMP),
    ('settings.manage', CURRENT_TIMESTAMP),
    ('authorization.manage', CURRENT_TIMESTAMP)
ON CONFLICT ("code") DO NOTHING;

-- Copy the current role-permission matrix without broadening access.
WITH matrix("role_code", "permission_code") AS (
    VALUES
        ('ADMIN', 'booking.read'), ('ADMIN', 'booking.write'), ('ADMIN', 'booking.lifecycle'),
        ('ADMIN', 'resource.read'), ('ADMIN', 'resource.manage'), ('ADMIN', 'order.read'),
        ('ADMIN', 'order.write'), ('ADMIN', 'order.kitchen'), ('ADMIN', 'payment.read'),
        ('ADMIN', 'payment.collect'), ('ADMIN', 'payment.refund'), ('ADMIN', 'payment_channel.manage'),
        ('ADMIN', 'inspection.read'), ('ADMIN', 'inspection.write'), ('ADMIN', 'inspection.complete'),
        ('ADMIN', 'catalog.read'), ('ADMIN', 'catalog.manage'), ('ADMIN', 'employee.read'),
        ('ADMIN', 'employee.manage'), ('ADMIN', 'wage.read'), ('ADMIN', 'report.read'),
        ('ADMIN', 'settings.manage'), ('ADMIN', 'authorization.manage'),
        ('RECEPTION', 'booking.read'), ('RECEPTION', 'booking.write'), ('RECEPTION', 'booking.lifecycle'),
        ('RECEPTION', 'resource.read'), ('RECEPTION', 'order.read'), ('RECEPTION', 'order.write'),
        ('RECEPTION', 'payment.read'), ('RECEPTION', 'payment.collect'),
        ('RECEPTION', 'inspection.read'), ('RECEPTION', 'catalog.read'),
        ('HOUSEKEEPING', 'booking.read'), ('HOUSEKEEPING', 'inspection.read'),
        ('HOUSEKEEPING', 'inspection.write'), ('HOUSEKEEPING', 'inspection.complete'),
        ('HOUSEKEEPING', 'catalog.read'),
        ('KITCHEN', 'order.read'), ('KITCHEN', 'order.kitchen'),
        ('ACCOUNTING', 'booking.read'), ('ACCOUNTING', 'order.read'),
        ('ACCOUNTING', 'payment.read'), ('ACCOUNTING', 'payment.collect'),
        ('ACCOUNTING', 'payment.refund'), ('ACCOUNTING', 'payment_channel.manage'),
        ('ACCOUNTING', 'report.read'),
        ('MANAGER', 'booking.read'), ('MANAGER', 'booking.write'), ('MANAGER', 'booking.lifecycle'),
        ('MANAGER', 'resource.read'), ('MANAGER', 'resource.manage'), ('MANAGER', 'order.read'),
        ('MANAGER', 'order.write'), ('MANAGER', 'order.kitchen'), ('MANAGER', 'payment.read'),
        ('MANAGER', 'payment.collect'), ('MANAGER', 'payment.refund'), ('MANAGER', 'payment_channel.manage'),
        ('MANAGER', 'inspection.read'), ('MANAGER', 'inspection.write'), ('MANAGER', 'inspection.complete'),
        ('MANAGER', 'catalog.read'), ('MANAGER', 'catalog.manage'), ('MANAGER', 'employee.read'),
        ('MANAGER', 'wage.read'), ('MANAGER', 'report.read'), ('MANAGER', 'settings.manage')
)
INSERT INTO "role_permissions" ("role_id", "permission_id")
SELECT r."id", p."id"
FROM matrix m
JOIN "roles" r ON r."code" = m."role_code"
JOIN "permissions" p ON p."code" = m."permission_code"
ON CONFLICT ("role_id", "permission_id") DO NOTHING;

-- Backfill only verified role values. UNKNOWN_E2E intentionally remains NULL.
UPDATE "employees" e
SET "role_id" = r."id"
FROM "roles" r
WHERE r."code" = CASE e."role"
    WHEN 'ผู้ดูแลระบบ' THEN 'ADMIN'
    WHEN 'ADMIN' THEN 'ADMIN'
    WHEN 'MANAGER' THEN 'MANAGER'
    WHEN 'RECEPTION' THEN 'RECEPTION'
    WHEN 'HOUSEKEEPING' THEN 'HOUSEKEEPING'
    WHEN 'KITCHEN' THEN 'KITCHEN'
    WHEN 'ACCOUNTING' THEN 'ACCOUNTING'
    ELSE NULL
END;
