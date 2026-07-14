import {
  apiErrorResponse,
  readJsonObject,
  validationErrorResponse,
  type ValidationIssue,
} from "@/lib/api/validation";
import { recordAuditLog } from "@/lib/audit/audit-log";
import { getCurrentUser } from "@/lib/auth/current-user";
import { decimalDays } from "@/lib/hr/leave";
import { prisma } from "@/lib/prisma";
import { NextResponse } from "next/server";

type Params = { params: Promise<{ typeId: string }> };

function isUuid(value: string) {
  return /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(
    value,
  );
}

export async function PATCH(request: Request, { params }: Params) {
  try {
    const { typeId } = await params;
    if (!isUuid(typeId)) {
      return apiErrorResponse("รหัสประเภทลาไม่ถูกต้อง", 400, "VALIDATION_ERROR");
    }

    const currentUser = await getCurrentUser();
    const permissions = currentUser?.employee?.role?.permissions ?? [];
    if (!permissions.includes("hr.settings.manage")) {
      return apiErrorResponse("ไม่มีสิทธิ์ตั้งค่าประเภทลา", 403, "FORBIDDEN");
    }

    const parsed = await readJsonObject(request);
    if (!parsed.ok) return parsed.response;
    const issues: ValidationIssue[] = [];
    const data: {
      name?: string;
      description?: string | null;
      isPaid?: boolean;
      requiresAttachment?: boolean;
      defaultAllowanceDays?: number;
      isActive?: boolean;
    } = {};

    if (parsed.body.name !== undefined) {
      const name =
        typeof parsed.body.name === "string" ? parsed.body.name.trim() : "";
      if (!name) issues.push({ path: "name", message: "ชื่อว่างไม่ได้" });
      else data.name = name;
    }
    if (parsed.body.description !== undefined) {
      data.description =
        typeof parsed.body.description === "string"
          ? parsed.body.description.trim() || null
          : null;
    }
    if (typeof parsed.body.isPaid === "boolean") data.isPaid = parsed.body.isPaid;
    if (typeof parsed.body.requiresAttachment === "boolean") {
      data.requiresAttachment = parsed.body.requiresAttachment;
    }
    if (parsed.body.defaultAllowanceDays !== undefined) {
      const value = Number(parsed.body.defaultAllowanceDays);
      if (!Number.isFinite(value) || value < 0) {
        issues.push({ path: "defaultAllowanceDays", message: "สิทธิไม่ถูกต้อง" });
      } else {
        data.defaultAllowanceDays = value;
      }
    }
    if (typeof parsed.body.isActive === "boolean") {
      data.isActive = parsed.body.isActive;
    }
    if (issues.length) {
      return validationErrorResponse("กรุณาตรวจสอบประเภทลา", issues);
    }

    const updated = await prisma.leaveType.update({
      where: { id: typeId },
      data,
    });

    await recordAuditLog({
      actor: {
        employeeId: currentUser?.employee?.id,
        authUserId: currentUser?.user.id,
      },
      action: "HR_LEAVE_TYPE_UPDATED",
      entityType: "LEAVE_TYPE",
      entityId: updated.id,
      metadata: data,
    });

    return NextResponse.json({
      id: updated.id,
      code: updated.code,
      name: updated.name,
      description: updated.description,
      isPaid: updated.isPaid,
      requiresAttachment: updated.requiresAttachment,
      defaultAllowanceDays: decimalDays(updated.defaultAllowanceDays),
      isActive: updated.isActive,
    });
  } catch (error) {
    if (
      typeof error === "object" &&
      error !== null &&
      "code" in error &&
      error.code === "P2025"
    ) {
      return apiErrorResponse("ไม่พบประเภทลา", 404, "NOT_FOUND");
    }
    console.error("PATCH /api/hr/leave-types/[typeId] failed", error);
    return apiErrorResponse("ไม่สามารถแก้ไขประเภทลาได้", 500, "INTERNAL_ERROR");
  }
}
