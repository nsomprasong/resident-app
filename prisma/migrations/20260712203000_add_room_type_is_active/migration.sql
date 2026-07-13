ALTER TABLE "room_types" ADD COLUMN "is_active" BOOLEAN NOT NULL DEFAULT true;

CREATE INDEX "room_types_is_active_idx" ON "room_types"("is_active");
