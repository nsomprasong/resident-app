import { apiErrorResponse } from "@/lib/api/validation";
import { recordAuditLog } from "@/lib/audit/audit-log";
import { getCurrentUser } from "@/lib/auth/current-user";
import {
  extensionForImageMime,
  asUploadFile,
  resolveImageMime,
} from "@/lib/media/image-mime";
import { createAdminClient } from "@/lib/supabase/admin";
import { NextRequest, NextResponse } from "next/server";

const BUCKET = "pos-product-images";
const MAX_BYTES = 8 * 1024 * 1024;

async function ensurePublicBucket() {
  const admin = createAdminClient();
  const { data: buckets, error: listError } = await admin.storage.listBuckets();
  if (listError) throw new Error(listError.message);
  const existing = buckets?.find((bucket) => bucket.name === BUCKET);
  if (!existing) {
    const { error: createError } = await admin.storage.createBucket(BUCKET, {
      public: true,
      fileSizeLimit: MAX_BYTES,
      allowedMimeTypes: [
        "image/jpeg",
        "image/png",
        "image/webp",
        "image/gif",
      ],
    });
    if (createError) throw new Error(createError.message);
  } else if (!existing.public) {
    const { error: updateError } = await admin.storage.updateBucket(BUCKET, {
      public: true,
      fileSizeLimit: MAX_BYTES,
      allowedMimeTypes: [
        "image/jpeg",
        "image/png",
        "image/webp",
        "image/gif",
      ],
    });
    if (updateError) throw new Error(updateError.message);
  }
  return admin;
}

export async function POST(request: NextRequest) {
  try {
    const currentUser = await getCurrentUser();
    if (
      !currentUser?.employee?.role?.permissions.includes("pos.product.manage")
    ) {
      return apiErrorResponse("ไม่มีสิทธิ์", 403, "FORBIDDEN");
    }

    const formData = await request.formData();
    const fileValue = asUploadFile(formData.get("file"));
    if (!fileValue || fileValue.size <= 0) {
      return apiErrorResponse("กรุณาเลือกรูปภาพ", 400, "VALIDATION_ERROR");
    }
    if (fileValue.size > MAX_BYTES) {
      return apiErrorResponse("ขนาดรูปต้องไม่เกิน 8 MB", 400, "VALIDATION_ERROR");
    }

    const bytes = new Uint8Array(await fileValue.arrayBuffer());
    const contentType = resolveImageMime({
      type: fileValue.type,
      name: fileValue.name || "capture.jpg",
      bytes,
    });
    if (!contentType) {
      return apiErrorResponse(
        "รองรับเฉพาะไฟล์ JPG, PNG, WEBP หรือ GIF",
        400,
        "VALIDATION_ERROR",
      );
    }

    const admin = await ensurePublicBucket();
    const ext = extensionForImageMime(contentType);
    const objectPath = `${Date.now()}-${crypto.randomUUID()}.${ext}`;
    const { error: uploadError } = await admin.storage
      .from(BUCKET)
      .upload(objectPath, bytes, {
        contentType,
        upsert: false,
      });
    if (uploadError) {
      console.error("POS product image upload failed", uploadError);
      return apiErrorResponse(
        `อัปโหลดรูปไม่สำเร็จ: ${uploadError.message}`,
        500,
        "INTERNAL_ERROR",
      );
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
      action: "POS_PRODUCT_IMAGE_UPLOADED",
      entityType: "POS_PRODUCT_IMAGE",
      entityId: objectPath,
      metadata: {
        bucket: BUCKET,
        contentType,
        size: fileValue.size,
      },
    });

    return NextResponse.json({ imageUrl }, { status: 201 });
  } catch (error) {
    console.error("POST /api/pos/images failed", error);
    const message =
      error instanceof Error &&
      error.message.includes("SUPABASE_SERVICE_ROLE_KEY")
        ? "ยังไม่ได้ตั้งค่าอัปโหลดรูปบนเซิร์ฟเวอร์"
        : error instanceof Error
          ? error.message
          : "อัปโหลดรูปไม่สำเร็จ";
    return apiErrorResponse(message, 500, "INTERNAL_ERROR");
  }
}
