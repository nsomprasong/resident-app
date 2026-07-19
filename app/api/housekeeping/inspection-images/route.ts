import { apiErrorResponse } from "@/lib/api/validation";
import { recordAuditLog } from "@/lib/audit/audit-log";
import { getCurrentUser } from "@/lib/auth/current-user";
import { createAdminClient } from "@/lib/supabase/admin";
import { NextRequest, NextResponse } from "next/server";

const BUCKET = "inspection-images";
const MAX_BYTES = 3 * 1024 * 1024;
const ALLOWED_TYPES = new Set([
  "image/jpeg",
  "image/png",
  "image/webp",
  "image/gif",
]);

function extensionForMime(mime: string): string {
  switch (mime) {
    case "image/jpeg":
      return "jpg";
    case "image/png":
      return "png";
    case "image/webp":
      return "webp";
    case "image/gif":
      return "gif";
    default:
      return "bin";
  }
}

async function ensurePublicBucket() {
  const admin = createAdminClient();
  const { data: buckets, error: listError } = await admin.storage.listBuckets();
  if (listError) {
    throw new Error(listError.message);
  }
  const exists = buckets?.some((bucket) => bucket.name === BUCKET);
  if (!exists) {
    const { error: createError } = await admin.storage.createBucket(BUCKET, {
      public: true,
      fileSizeLimit: MAX_BYTES,
      allowedMimeTypes: [...ALLOWED_TYPES],
    });
    if (createError) {
      throw new Error(createError.message);
    }
  }
  return admin;
}

export async function POST(request: NextRequest) {
  try {
    const currentUser = await getCurrentUser();
    if (!currentUser) {
      return apiErrorResponse("กรุณาเข้าสู่ระบบ", 401, "UNAUTHORIZED");
    }

    const formData = await request.formData();
    const fileValue = formData.get("file");
    if (!(fileValue instanceof File)) {
      return apiErrorResponse("กรุณาเลือกรูปภาพ", 400, "VALIDATION_ERROR");
    }

    if (!ALLOWED_TYPES.has(fileValue.type)) {
      return apiErrorResponse(
        "รองรับเฉพาะไฟล์ JPG, PNG, WEBP หรือ GIF",
        400,
        "VALIDATION_ERROR",
      );
    }

    if (fileValue.size <= 0 || fileValue.size > MAX_BYTES) {
      return apiErrorResponse(
        "ขนาดรูปต้องไม่เกิน 3 MB",
        400,
        "VALIDATION_ERROR",
      );
    }

    const admin = await ensurePublicBucket();
    const ext = extensionForMime(fileValue.type);
    const objectPath = `${Date.now()}-${crypto.randomUUID()}.${ext}`;
    const bytes = new Uint8Array(await fileValue.arrayBuffer());

    const { error: uploadError } = await admin.storage
      .from(BUCKET)
      .upload(objectPath, bytes, {
        contentType: fileValue.type,
        upsert: false,
      });

    if (uploadError) {
      console.error("inspection image upload failed", uploadError);
      return apiErrorResponse("อัปโหลดรูปไม่สำเร็จ", 500, "INTERNAL_ERROR");
    }

    const { data: publicData } = admin.storage
      .from(BUCKET)
      .getPublicUrl(objectPath);

    const imageUrl = publicData.publicUrl;

    await recordAuditLog({
      actor: {
        employeeId: currentUser.employee?.id,
        authUserId: currentUser.user.id,
      },
      action: "INSPECTION_IMAGE_UPLOADED",
      entityType: "INSPECTION_IMAGE",
      entityId: objectPath,
      metadata: {
        bucket: BUCKET,
        contentType: fileValue.type,
        size: fileValue.size,
      },
    });

    return NextResponse.json({ imageUrl }, { status: 201 });
  } catch (error) {
    console.error("POST /api/housekeeping/inspection-images failed", error);
    const message =
      error instanceof Error &&
      error.message.includes("SUPABASE_SERVICE_ROLE_KEY")
        ? "ยังไม่ได้ตั้งค่าอัปโหลดรูปบนเซิร์ฟเวอร์"
        : "อัปโหลดรูปไม่สำเร็จ";
    return apiErrorResponse(message, 500, "INTERNAL_ERROR");
  }
}
