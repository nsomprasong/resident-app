ALTER TABLE "employees" ADD COLUMN "is_active" BOOLEAN NOT NULL DEFAULT true;

CREATE INDEX "employees_is_active_idx" ON "employees"("is_active");
