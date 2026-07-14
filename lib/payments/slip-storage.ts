import { createAdminClient } from "@/lib/supabase/admin";

export const PAYMENT_SLIPS_BUCKET = "payment-slips";
export const PAYMENT_SLIP_MAX_BYTES = 8 * 1024 * 1024;
export const PAYMENT_SLIP_ALLOWED_TYPES = [
  "image/jpeg",
  "image/png",
  "image/webp",
  "application/pdf",
] as const;

export async function ensurePrivatePaymentSlipsBucket() {
  const admin = createAdminClient();
  const { data: buckets, error: listError } = await admin.storage.listBuckets();
  if (listError) {
    throw new Error(listError.message);
  }
  const exists = buckets?.some((bucket) => bucket.name === PAYMENT_SLIPS_BUCKET);
  if (!exists) {
    const { error: createError } = await admin.storage.createBucket(
      PAYMENT_SLIPS_BUCKET,
      {
        public: false,
        fileSizeLimit: PAYMENT_SLIP_MAX_BYTES,
        allowedMimeTypes: [...PAYMENT_SLIP_ALLOWED_TYPES],
      },
    );
    if (createError) {
      throw new Error(createError.message);
    }
  }
  return admin;
}

export async function uploadPaymentSlipObject(input: {
  objectPath: string;
  bytes: Uint8Array;
  contentType: string;
}) {
  const admin = await ensurePrivatePaymentSlipsBucket();
  const { error } = await admin.storage
    .from(PAYMENT_SLIPS_BUCKET)
    .upload(input.objectPath, input.bytes, {
      contentType: input.contentType,
      upsert: false,
    });
  if (error) {
    throw new Error(error.message);
  }
  return admin;
}

export async function createPaymentSlipSignedUrl(
  storagePath: string,
  expiresInSeconds = 60,
) {
  const admin = await ensurePrivatePaymentSlipsBucket();
  const { data, error } = await admin.storage
    .from(PAYMENT_SLIPS_BUCKET)
    .createSignedUrl(storagePath, expiresInSeconds);
  if (error || !data?.signedUrl) {
    throw new Error(error?.message ?? "สร้างลิงก์ดูสลิปไม่สำเร็จ");
  }
  return data.signedUrl;
}
