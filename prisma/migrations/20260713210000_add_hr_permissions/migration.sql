-- Phase 18.2: HR permission codes (Thai descriptions) + role grants
INSERT INTO "permissions" ("id", "code", "description", "created_at", "updated_at")
VALUES
  (gen_random_uuid(), 'hr.employee.view', 'ดูข้อมูลพนักงาน', CURRENT_TIMESTAMP, CURRENT_TIMESTAMP),
  (gen_random_uuid(), 'hr.employee.create', 'เพิ่มพนักงาน', CURRENT_TIMESTAMP, CURRENT_TIMESTAMP),
  (gen_random_uuid(), 'hr.employee.update', 'แก้ไขข้อมูลพนักงาน', CURRENT_TIMESTAMP, CURRENT_TIMESTAMP),
  (gen_random_uuid(), 'hr.employee.archive', 'ระงับหรือเก็บพนักงาน', CURRENT_TIMESTAMP, CURRENT_TIMESTAMP),
  (gen_random_uuid(), 'hr.sensitive.view', 'ดูข้อมูลส่วนบุคคลที่สำคัญ', CURRENT_TIMESTAMP, CURRENT_TIMESTAMP),
  (gen_random_uuid(), 'hr.compensation.view', 'ดูค่าจ้างและเงินเดือน', CURRENT_TIMESTAMP, CURRENT_TIMESTAMP),
  (gen_random_uuid(), 'hr.schedule.manage', 'จัดการตารางงาน', CURRENT_TIMESTAMP, CURRENT_TIMESTAMP),
  (gen_random_uuid(), 'hr.attendance.manage', 'จัดการเวลาเข้า–ออกงาน', CURRENT_TIMESTAMP, CURRENT_TIMESTAMP),
  (gen_random_uuid(), 'hr.attendance.approve', 'อนุมัติการแก้ไขเวลาและ OT', CURRENT_TIMESTAMP, CURRENT_TIMESTAMP),
  (gen_random_uuid(), 'hr.leave.request', 'ยื่นคำขอลา', CURRENT_TIMESTAMP, CURRENT_TIMESTAMP),
  (gen_random_uuid(), 'hr.leave.approve', 'อนุมัติคำขอลา', CURRENT_TIMESTAMP, CURRENT_TIMESTAMP),
  (gen_random_uuid(), 'hr.payroll.calculate', 'คำนวณค่าจ้างและเงินเดือน', CURRENT_TIMESTAMP, CURRENT_TIMESTAMP),
  (gen_random_uuid(), 'hr.payroll.approve', 'อนุมัติการจ่ายเงิน', CURRENT_TIMESTAMP, CURRENT_TIMESTAMP),
  (gen_random_uuid(), 'hr.payroll.mark_paid', 'บันทึกการจ่ายเงินแล้ว', CURRENT_TIMESTAMP, CURRENT_TIMESTAMP),
  (gen_random_uuid(), 'hr.document.manage', 'จัดการเอกสารพนักงาน', CURRENT_TIMESTAMP, CURRENT_TIMESTAMP),
  (gen_random_uuid(), 'hr.report.view', 'ดูรายงานบุคลากร', CURRENT_TIMESTAMP, CURRENT_TIMESTAMP),
  (gen_random_uuid(), 'hr.settings.manage', 'ตั้งค่าระบบบุคลากร', CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)
ON CONFLICT ("code") DO UPDATE
SET "description" = EXCLUDED."description",
    "updated_at" = CURRENT_TIMESTAMP;

-- ADMIN: all HR permissions
INSERT INTO "role_permissions" ("role_id", "permission_id")
SELECT r."id", p."id"
FROM "roles" AS r
CROSS JOIN "permissions" AS p
WHERE r."code" = 'ADMIN'
  AND p."code" LIKE 'hr.%'
ON CONFLICT ("role_id", "permission_id") DO NOTHING;

-- MANAGER: operational HR (no archive / payroll approve / mark paid)
INSERT INTO "role_permissions" ("role_id", "permission_id")
SELECT r."id", p."id"
FROM "roles" AS r
CROSS JOIN "permissions" AS p
WHERE r."code" = 'MANAGER'
  AND p."code" IN (
    'hr.employee.view',
    'hr.employee.create',
    'hr.employee.update',
    'hr.sensitive.view',
    'hr.compensation.view',
    'hr.schedule.manage',
    'hr.attendance.manage',
    'hr.attendance.approve',
    'hr.leave.request',
    'hr.leave.approve',
    'hr.payroll.calculate',
    'hr.document.manage',
    'hr.report.view',
    'hr.settings.manage'
  )
ON CONFLICT ("role_id", "permission_id") DO NOTHING;

-- ACCOUNTING: payroll visibility
INSERT INTO "role_permissions" ("role_id", "permission_id")
SELECT r."id", p."id"
FROM "roles" AS r
CROSS JOIN "permissions" AS p
WHERE r."code" = 'ACCOUNTING'
  AND p."code" IN (
    'hr.compensation.view',
    'hr.payroll.calculate',
    'hr.report.view'
  )
ON CONFLICT ("role_id", "permission_id") DO NOTHING;
