-- Idempotent re-apply if earlier migration already granted data.reset
INSERT INTO "permissions" ("id", "code", "description", "created_at", "updated_at")
VALUES (
  gen_random_uuid(),
  'data.reset',
  'ล้างข้อมูลเริ่มต้นใหม่',
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
  AND p."code" = 'data.reset'
ON CONFLICT ("role_id", "permission_id") DO NOTHING;
