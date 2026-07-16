-- Single active login session per employee (JWT claim must match).
ALTER TABLE "employees"
ADD COLUMN IF NOT EXISTS "session_epoch" INTEGER NOT NULL DEFAULT 0;
