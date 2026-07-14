import { apiErrorResponse } from "@/lib/api/validation";
import { createEmployeeDocumentSignedUrl } from "@/lib/hr/document-storage";
import { prisma } from "@/lib/prisma";
import { NextResponse } from "next/server";

function isUuid(value: string) {
  return /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(
    value,
  );
}

type Params = { params: Promise<{ documentId: string }> };

export async function GET(_request: Request, { params }: Params) {
  try {
    const { documentId } = await params;
    if (!isUuid(documentId)) {
      return apiErrorResponse("รหัสเอกสารไม่ถูกต้อง", 400, "VALIDATION_ERROR");
    }
    const existing = await prisma.employeeDocument.findUnique({
      where: { id: documentId },
    });
    if (!existing) {
      return apiErrorResponse("ไม่พบเอกสาร", 404, "NOT_FOUND");
    }
    const signedUrl = await createEmployeeDocumentSignedUrl(
      existing.storagePath,
      120,
    );
    return NextResponse.json({
      id: existing.id,
      fileName: existing.fileName,
      contentType: existing.contentType,
      signedUrl,
      expiresInSeconds: 120,
    });
  } catch (error) {
    console.error("GET /api/hr/documents/[documentId]/download failed", error);
    return apiErrorResponse("ไม่สามารถสร้างลิงก์ดาวน์โหลดได้", 500, "INTERNAL_ERROR");
  }
}
