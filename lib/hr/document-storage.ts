import { createAdminClient } from "@/lib/supabase/admin";
import {
  EMPLOYEE_DOCUMENT_ALLOWED_TYPES,
  EMPLOYEE_DOCUMENT_MAX_BYTES,
} from "@/lib/hr/documents";

export const EMPLOYEE_DOCUMENTS_BUCKET = "employee-documents";

export async function ensurePrivateEmployeeDocumentsBucket() {
  const admin = createAdminClient();
  const { data: buckets, error: listError } = await admin.storage.listBuckets();
  if (listError) {
    throw new Error(listError.message);
  }
  const exists = buckets?.some(
    (bucket) => bucket.name === EMPLOYEE_DOCUMENTS_BUCKET,
  );
  if (!exists) {
    const { error: createError } = await admin.storage.createBucket(
      EMPLOYEE_DOCUMENTS_BUCKET,
      {
        public: false,
        fileSizeLimit: EMPLOYEE_DOCUMENT_MAX_BYTES,
        allowedMimeTypes: [...EMPLOYEE_DOCUMENT_ALLOWED_TYPES],
      },
    );
    if (createError) {
      throw new Error(createError.message);
    }
  }
  return admin;
}

export async function uploadEmployeeDocumentObject(input: {
  objectPath: string;
  bytes: Uint8Array;
  contentType: string;
}) {
  const admin = await ensurePrivateEmployeeDocumentsBucket();
  const { error } = await admin.storage
    .from(EMPLOYEE_DOCUMENTS_BUCKET)
    .upload(input.objectPath, input.bytes, {
      contentType: input.contentType,
      upsert: false,
    });
  if (error) {
    throw new Error(error.message);
  }
  return admin;
}

export async function createEmployeeDocumentSignedUrl(
  storagePath: string,
  expiresInSeconds = 60,
) {
  const admin = await ensurePrivateEmployeeDocumentsBucket();
  const { data, error } = await admin.storage
    .from(EMPLOYEE_DOCUMENTS_BUCKET)
    .createSignedUrl(storagePath, expiresInSeconds);
  if (error || !data?.signedUrl) {
    throw new Error(error?.message ?? "สร้างลิงก์ดาวน์โหลดไม่สำเร็จ");
  }
  return data.signedUrl;
}

export async function deleteEmployeeDocumentObject(storagePath: string) {
  const admin = await ensurePrivateEmployeeDocumentsBucket();
  const { error } = await admin.storage
    .from(EMPLOYEE_DOCUMENTS_BUCKET)
    .remove([storagePath]);
  if (error) {
    throw new Error(error.message);
  }
}
