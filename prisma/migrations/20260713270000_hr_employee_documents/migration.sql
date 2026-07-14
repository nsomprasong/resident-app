-- Phase 18.8: employee documents metadata (files live in private Supabase Storage bucket)

CREATE TYPE "EmployeeDocumentType" AS ENUM (
  'CONTRACT',
  'NATIONAL_ID',
  'BANK_ACCOUNT',
  'CERTIFICATE',
  'LEAVE_DOCUMENT',
  'OTHER'
);

CREATE TABLE "employee_documents" (
  "id" UUID NOT NULL DEFAULT gen_random_uuid(),
  "employee_id" UUID NOT NULL,
  "document_type" "EmployeeDocumentType" NOT NULL,
  "title" TEXT NOT NULL,
  "file_name" TEXT NOT NULL,
  "content_type" TEXT NOT NULL,
  "size_bytes" INTEGER NOT NULL,
  "storage_bucket" TEXT NOT NULL,
  "storage_path" TEXT NOT NULL,
  "issued_at" DATE,
  "expires_at" DATE,
  "notes" TEXT,
  "uploaded_by_id" UUID NOT NULL,
  "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updated_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "employee_documents_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "employee_documents_employee_id_document_type_idx"
  ON "employee_documents"("employee_id", "document_type");
CREATE INDEX "employee_documents_expires_at_idx" ON "employee_documents"("expires_at");
CREATE INDEX "employee_documents_storage_bucket_storage_path_idx"
  ON "employee_documents"("storage_bucket", "storage_path");

ALTER TABLE "employee_documents"
  ADD CONSTRAINT "employee_documents_employee_id_fkey"
  FOREIGN KEY ("employee_id") REFERENCES "employees"("id")
  ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "employee_documents"
  ADD CONSTRAINT "employee_documents_uploaded_by_id_fkey"
  FOREIGN KEY ("uploaded_by_id") REFERENCES "employees"("id")
  ON DELETE CASCADE ON UPDATE CASCADE;
