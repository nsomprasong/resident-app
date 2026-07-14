-- Add audit.read for viewing system audit logs (ADMIN by default)
INSERT INTO "permissions" ("id", "code", "description", "created_at", "updated_at")
VALUES (
  gen_random_uuid(),
  'audit.read',
  'ดูบันทึกตรวจสอบระบบ',
  CURRENT_TIMESTAMP,
  CURRENT_TIMESTAMP
)
ON CONFLICT ("code") DO UPDATE
SET "description" = EXCLUDED."description",
    "updated_at" = CURRENT_TIMESTAMP;

INSERT INTO "role_permissions" ("role_id", "permission_id")
SELECT r."id", p."id"
FROM "roles" AS r
CROSS JOIN "permissions" AS p
WHERE r."code" = 'ADMIN'
  AND p."code" = 'audit.read'
ON CONFLICT ("role_id", "permission_id") DO NOTHING;
