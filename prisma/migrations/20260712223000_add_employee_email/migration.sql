ALTER TABLE "employees" ADD COLUMN "email" TEXT;

CREATE UNIQUE INDEX "employees_email_key" ON "employees"("email");
