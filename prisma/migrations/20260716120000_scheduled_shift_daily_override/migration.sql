-- Additive: mark per-day schedule exceptions so bulk assign does not overwrite them.
ALTER TABLE "scheduled_shifts"
ADD COLUMN IF NOT EXISTS "is_daily_override" BOOLEAN NOT NULL DEFAULT false;
