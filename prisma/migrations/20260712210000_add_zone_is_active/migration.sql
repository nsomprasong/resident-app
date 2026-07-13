ALTER TABLE "zones" ADD COLUMN "is_active" BOOLEAN NOT NULL DEFAULT true;

CREATE INDEX "zones_is_active_idx" ON "zones"("is_active");
