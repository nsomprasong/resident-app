-- Record who completed a room inspection after checkout
ALTER TABLE "room_inspections"
  ADD COLUMN IF NOT EXISTS "completed_by_id" UUID;

CREATE INDEX IF NOT EXISTS "room_inspections_completed_by_id_idx"
  ON "room_inspections"("completed_by_id");

ALTER TABLE "room_inspections"
  DROP CONSTRAINT IF EXISTS "room_inspections_completed_by_id_fkey";

ALTER TABLE "room_inspections"
  ADD CONSTRAINT "room_inspections_completed_by_id_fkey"
    FOREIGN KEY ("completed_by_id") REFERENCES "employees"("id")
    ON DELETE SET NULL ON UPDATE CASCADE;
