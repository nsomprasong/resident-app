const MAX_DIMENSION = 1600;
const MAX_BYTES = 2.5 * 1024 * 1024;

function isBrowserImageType(type: string) {
  return (
    type === "image/jpeg" ||
    type === "image/jpg" ||
    type === "image/png" ||
    type === "image/webp" ||
    type === "image/gif"
  );
}

/**
 * Resize/compress a camera or gallery image to JPEG for reliable upload.
 * Shows better success on phones where photos are HEIC/large/empty MIME.
 */
export async function prepareImageForUpload(file: File): Promise<File> {
  if (typeof createImageBitmap !== "function" || typeof document === "undefined") {
    return file;
  }

  let bitmap: ImageBitmap;
  try {
    bitmap = await createImageBitmap(file);
  } catch {
    if (file.size > 0 && file.size <= 3 * 1024 * 1024 && isBrowserImageType(file.type)) {
      return file;
    }
    throw new Error("ไม่สามารถอ่านไฟล์รูปได้ กรุณาใช้ JPG หรือ PNG");
  }

  try {
    const scale = Math.min(
      1,
      MAX_DIMENSION / Math.max(bitmap.width, bitmap.height),
    );
    const width = Math.max(1, Math.round(bitmap.width * scale));
    const height = Math.max(1, Math.round(bitmap.height * scale));
    const canvas = document.createElement("canvas");
    canvas.width = width;
    canvas.height = height;
    const context = canvas.getContext("2d");
    if (!context) {
      throw new Error("แปลงรูปไม่สำเร็จ");
    }
    context.drawImage(bitmap, 0, 0, width, height);

    let quality = 0.88;
    let blob: Blob | null = null;
    while (quality >= 0.45) {
      blob = await new Promise<Blob | null>((resolve) => {
        canvas.toBlob(resolve, "image/jpeg", quality);
      });
      if (!blob) break;
      if (blob.size <= MAX_BYTES) break;
      quality -= 0.12;
    }

    if (!blob || blob.size <= 0) {
      throw new Error("แปลงรูปไม่สำเร็จ");
    }

    const baseName = file.name.replace(/\.[^.]+$/, "").trim() || "product";
    return new File([blob], `${baseName}.jpg`, {
      type: "image/jpeg",
      lastModified: Date.now(),
    });
  } finally {
    bitmap.close();
  }
}
