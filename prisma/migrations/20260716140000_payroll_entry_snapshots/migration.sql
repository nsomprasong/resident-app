-- Additive Phase 21: freeze wage/OT rates and surface replacement/double counts on payroll entries.
ALTER TABLE "payroll_entries"
ADD COLUMN IF NOT EXISTS "hourly_rate_snapshot" DECIMAL(12,2),
ADD COLUMN IF NOT EXISTS "ot_hourly_rate_snapshot" DECIMAL(12,2),
ADD COLUMN IF NOT EXISTS "ot_multiplier_snapshot" DECIMAL(8,4),
ADD COLUMN IF NOT EXISTS "daily_rate_snapshot" DECIMAL(12,2),
ADD COLUMN IF NOT EXISTS "monthly_salary_snapshot" DECIMAL(12,2),
ADD COLUMN IF NOT EXISTS "replacement_shift_count" INTEGER NOT NULL DEFAULT 0,
ADD COLUMN IF NOT EXISTS "double_shift_count" INTEGER NOT NULL DEFAULT 0;
