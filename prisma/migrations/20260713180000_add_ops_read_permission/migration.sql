-- Add ops.read for staff today-ops dashboard; grant to every role
INSERT INTO "permissions" ("id", "code", "description", "created_at", "updated_at")
VALUES (
  gen_random_uuid(),
  'ops.read',
  'ดูภาพรวมงานวันนี้',
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
WHERE p."code" = 'ops.read'
ON CONFLICT ("role_id", "permission_id") DO NOTHING;
