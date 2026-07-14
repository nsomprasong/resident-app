import type { Prisma } from "@/generated/prisma/client";

import {
  apiErrorResponse,
  validationErrorResponse,
  type ValidationIssue,
} from "@/lib/api/validation";
import { recordAuditLog } from "@/lib/audit/audit-log";
import { getCurrentUser } from "@/lib/auth/current-user";
import {
  deleteEmployeeDocumentObject,
  EMPLOYEE_DOCUMENTS_BUCKET,
  uploadEmployeeDocumentObject,
} from "@/lib/hr/document-storage";
import {
  classifyDocumentExpiry,
  DOCUMENT_EXPIRY_WARNING_DAYS,
  EMPLOYEE_DOCUMENT_MAX_BYTES,
  EMPLOYEE_DOCUMENT_TYPE_LABELS,
  extensionForDocumentMime,
  isAllowedEmployeeDocumentType,
  isEmployeeDocumentType,
  sanitizeOriginalFileName,
  type EmployeeDocumentTypeCode,
} from "@/lib/hr/documents";
import { displayEmployeeName } from "@/lib/hr/employees";
import { dateKeyUtc, parseDateKey } from "@/lib/hr/schedules";
import { prisma } from "@/lib/prisma";
import { NextRequest, NextResponse } from "next/server";

function isUuid(value: string) {
  return /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(
    value,
  );
}

function serializeDocument(
  item: Prisma.EmployeeDocumentGetPayload<{
    include: {
      employee: {
        select: {
          id: true;
          name: true;
          firstName: true;
          lastName: true;
          employeeCode: true;
        };
      };
    };
  }>,
  warningDays: number,
) {
  const expiryStatus = classifyDocumentExpiry(item.expiresAt, {
    warningDays,
  });
  return {
    id: item.id,
    employeeId: item.employeeId,
    employeeName: displayEmployeeName(item.employee),
    employeeCode: item.employee.employeeCode,
    documentType: item.documentType,
    documentTypeLabel: EMPLOYEE_DOCUMENT_TYPE_LABELS[item.documentType],
    title: item.title,
    fileName: item.fileName,
    contentType: item.contentType,
    sizeBytes: item.sizeBytes,
    issuedAt: item.issuedAt ? dateKeyUtc(item.issuedAt) : null,
    expiresAt: item.expiresAt ? dateKeyUtc(item.expiresAt) : null,
    notes: item.notes,
    expiryStatus,
    createdAt: item.createdAt.toISOString(),
  };
}

export async function GET(request: NextRequest) {
  try {
    const employeeId = request.nextUrl.searchParams.get("employeeId");
    const documentType = request.nextUrl.searchParams.get("documentType");
    const expiringWithinDaysRaw =
      request.nextUrl.searchParams.get("expiringWithinDays");
    const warningDays = expiringWithinDaysRaw
      ? Number(expiringWithinDaysRaw)
      : DOCUMENT_EXPIRY_WARNING_DAYS;

    const where: Prisma.EmployeeDocumentWhereInput = {};
    if (employeeId) {
      if (!isUuid(employeeId)) {
        return apiErrorResponse("รหัสพนักงานไม่ถูกต้อง", 400, "VALIDATION_ERROR");
      }
      where.employeeId = employeeId;
    }
    if (documentType) {
      if (!isEmployeeDocumentType(documentType)) {
        return apiErrorResponse("ประเภทเอกสารไม่ถูกต้อง", 400, "VALIDATION_ERROR");
      }
      where.documentType = documentType;
    }
    if (
      expiringWithinDaysRaw !== null &&
      (!Number.isFinite(warningDays) || warningDays < 0)
    ) {
      return apiErrorResponse("จำนวนวันแจ้งเตือนไม่ถูกต้อง", 400, "VALIDATION_ERROR");
    }

    if (expiringWithinDaysRaw !== null) {
      const now = new Date();
      const today = new Date(
        Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate()),
      );
      const until = new Date(today.getTime() + warningDays * 86_400_000);
      where.expiresAt = { not: null, lte: until };
    }

    const items = await prisma.employeeDocument.findMany({
      where,
      include: {
        employee: {
          select: {
            id: true,
            name: true,
            firstName: true,
            lastName: true,
            employeeCode: true,
          },
        },
      },
      orderBy: [{ expiresAt: "asc" }, { createdAt: "desc" }],
      take: 200,
    });

    const serialized = items.map((item) =>
      serializeDocument(item, warningDays),
    );
    const alerts = serialized.filter(
      (item) =>
        item.expiryStatus === "EXPIRED" ||
        item.expiryStatus === "EXPIRING_SOON",
    );

    return NextResponse.json({
      warningDays,
      items: serialized,
      alerts,
    });
  } catch (error) {
    console.error("GET /api/hr/documents failed", error);
    return apiErrorResponse("ไม่สามารถโหลดเอกสารได้", 500, "INTERNAL_ERROR");
  }
}

export async function POST(request: NextRequest) {
  try {
    const currentUser = await getCurrentUser();
    const actorEmployeeId = currentUser?.employee?.id;
    if (!actorEmployeeId) {
      return apiErrorResponse("ไม่พบบัญชีพนักงานของผู้ใช้", 403, "FORBIDDEN");
    }

    const formData = await request.formData();
    const fileValue = formData.get("file");
    const issues: ValidationIssue[] = [];

    const employeeId =
      typeof formData.get("employeeId") === "string"
        ? String(formData.get("employeeId")).trim()
        : "";
    const documentTypeRaw =
      typeof formData.get("documentType") === "string"
        ? String(formData.get("documentType")).trim()
        : "";
    const title =
      typeof formData.get("title") === "string"
        ? String(formData.get("title")).trim()
        : "";
    const notesRaw = formData.get("notes");
    const notes =
      typeof notesRaw === "string" ? notesRaw.trim() || null : null;
    const issuedAtRaw =
      typeof formData.get("issuedAt") === "string"
        ? String(formData.get("issuedAt")).trim()
        : "";
    const expiresAtRaw =
      typeof formData.get("expiresAt") === "string"
        ? String(formData.get("expiresAt")).trim()
        : "";

    if (!isUuid(employeeId)) {
      issues.push({ path: "employeeId", message: "รหัสพนักงานไม่ถูกต้อง" });
    }
    if (!isEmployeeDocumentType(documentTypeRaw)) {
      issues.push({ path: "documentType", message: "ประเภทเอกสารไม่ถูกต้อง" });
    }
    if (!title) {
      issues.push({ path: "title", message: "กรุณาระบุชื่อเอกสาร" });
    }
    if (!(fileValue instanceof File)) {
      issues.push({ path: "file", message: "กรุณาเลือกไฟล์" });
    }

    const issuedAt = issuedAtRaw ? parseDateKey(issuedAtRaw) : null;
    const expiresAt = expiresAtRaw ? parseDateKey(expiresAtRaw) : null;
    if (issuedAtRaw && !issuedAt) {
      issues.push({ path: "issuedAt", message: "วันที่ออกไม่ถูกต้อง" });
    }
    if (expiresAtRaw && !expiresAt) {
      issues.push({ path: "expiresAt", message: "วันหมดอายุไม่ถูกต้อง" });
    }
    if (issues.length || !(fileValue instanceof File)) {
      return validationErrorResponse("กรุณาตรวจสอบเอกสาร", issues);
    }

    if (!isAllowedEmployeeDocumentType(fileValue.type)) {
      return apiErrorResponse(
        "รองรับ PDF, JPG, PNG, WEBP, DOC, DOCX เท่านั้น",
        400,
        "VALIDATION_ERROR",
      );
    }
    if (fileValue.size <= 0 || fileValue.size > EMPLOYEE_DOCUMENT_MAX_BYTES) {
      return apiErrorResponse(
        "ขนาดไฟล์ต้องไม่เกิน 10 MB",
        400,
        "VALIDATION_ERROR",
      );
    }

    const employee = await prisma.employee.findUnique({
      where: { id: employeeId },
    });
    if (!employee) {
      return apiErrorResponse("ไม่พบพนักงาน", 404, "NOT_FOUND");
    }

    const documentType = documentTypeRaw as EmployeeDocumentTypeCode;
    const originalName = sanitizeOriginalFileName(fileValue.name || "document");
    const ext = extensionForDocumentMime(fileValue.type);
    const objectPath = `${employeeId}/${documentType}/${Date.now()}-${crypto.randomUUID()}.${ext}`;
    const bytes = new Uint8Array(await fileValue.arrayBuffer());

    await uploadEmployeeDocumentObject({
      objectPath,
      bytes,
      contentType: fileValue.type,
    });

    const created = await prisma.employeeDocument.create({
      data: {
        employeeId,
        documentType,
        title,
        fileName: originalName,
        contentType: fileValue.type,
        sizeBytes: fileValue.size,
        storageBucket: EMPLOYEE_DOCUMENTS_BUCKET,
        storagePath: objectPath,
        issuedAt,
        expiresAt,
        notes,
        uploadedById: actorEmployeeId,
      },
      include: {
        employee: {
          select: {
            id: true,
            name: true,
            firstName: true,
            lastName: true,
            employeeCode: true,
          },
        },
      },
    });

    await recordAuditLog({
      actor: {
        employeeId: actorEmployeeId,
        authUserId: currentUser.user.id,
      },
      action: "HR_DOCUMENT_UPLOADED",
      entityType: "EMPLOYEE_DOCUMENT",
      entityId: created.id,
      metadata: {
        employeeId,
        documentType,
        storagePath: objectPath,
        contentType: fileValue.type,
        sizeBytes: fileValue.size,
      },
    });

    return NextResponse.json(
      serializeDocument(created, DOCUMENT_EXPIRY_WARNING_DAYS),
      { status: 201 },
    );
  } catch (error) {
    console.error("POST /api/hr/documents failed", error);
    const message =
      error instanceof Error &&
      error.message.includes("SUPABASE_SERVICE_ROLE_KEY")
        ? "ยังไม่ได้ตั้งค่าอัปโหลดเอกสารบนเซิร์ฟเวอร์"
        : "อัปโหลดเอกสารไม่สำเร็จ";
    return apiErrorResponse(message, 500, "INTERNAL_ERROR");
  }
}

export async function DELETE(request: NextRequest) {
  try {
    const currentUser = await getCurrentUser();
    const actorEmployeeId = currentUser?.employee?.id;
    if (!actorEmployeeId) {
      return apiErrorResponse("ไม่พบบัญชีพนักงานของผู้ใช้", 403, "FORBIDDEN");
    }

    const documentId = request.nextUrl.searchParams.get("id");
    if (!documentId || !isUuid(documentId)) {
      return apiErrorResponse("รหัสเอกสารไม่ถูกต้อง", 400, "VALIDATION_ERROR");
    }

    const existing = await prisma.employeeDocument.findUnique({
      where: { id: documentId },
    });
    if (!existing) {
      return apiErrorResponse("ไม่พบเอกสาร", 404, "NOT_FOUND");
    }

    await deleteEmployeeDocumentObject(existing.storagePath);
    await prisma.employeeDocument.delete({ where: { id: documentId } });

    await recordAuditLog({
      actor: {
        employeeId: actorEmployeeId,
        authUserId: currentUser.user.id,
      },
      action: "HR_DOCUMENT_DELETED",
      entityType: "EMPLOYEE_DOCUMENT",
      entityId: documentId,
      metadata: {
        employeeId: existing.employeeId,
        storagePath: existing.storagePath,
      },
    });

    return NextResponse.json({ id: documentId, deleted: true });
  } catch (error) {
    console.error("DELETE /api/hr/documents failed", error);
    return apiErrorResponse("ลบเอกสารไม่สำเร็จ", 500, "INTERNAL_ERROR");
  }
}
