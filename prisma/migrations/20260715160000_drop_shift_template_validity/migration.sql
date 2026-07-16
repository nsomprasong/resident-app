-- Shifts are permanent; remove validity window.

DROP INDEX IF EXISTS "shift_templates_valid_from_valid_to_idx";

ALTER TABLE "shift_templates"
DROP COLUMN IF EXISTS "valid_from",
DROP COLUMN IF EXISTS "valid_to";
