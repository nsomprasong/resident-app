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

function serializeType(item: {
  id: string;
  code: string;
  name: string;
  description: string | null;
  isPaid: boolean;
  requiresAttachment: boolean;
  defaultAllowanceDays: { toString(): string };
  isActive: boolean;
}) {
  return {
    id: item.id,
    code: item.code,
    name: item.name,
    description: item.description,
    isPaid: item.isPaid,
    requiresAttachment: item.requiresAttachment,
    defaultAllowanceDays: decimalDays(item.defaultAllowanceDays),
    isActive: item.isActive,
  };
}

export async function GET() {
  try {
    const types = await prisma.leaveType.findMany({
      orderBy: [{ isActive: "desc" }, { name: "asc" }],
    });
    return NextResponse.json(types.map(serializeType));
  } catch (error) {
    console.error("GET /api/hr/leave-types failed", error);
    return apiErrorResponse("ไม่สามารถโหลดประเภทลาได้", 500, "INTERNAL_ERROR");
  }
}

export async function POST(request: Request) {
  try {
    const currentUser = await getCurrentUser();
    const permissions = currentUser?.employee?.role?.permissions ?? [];
    if (!permissions.includes("hr.settings.manage")) {
      return apiErrorResponse("ไม่มีสิทธิ์ตั้งค่าประเภทลา", 403, "FORBIDDEN");
    }

    const parsed = await readJsonObject(request);
    if (!parsed.ok) return parsed.response;

    const issues: ValidationIssue[] = [];
    const code =
      typeof parsed.body.code === "string"
        ? parsed.body.code.trim().toUpperCase()
        : "";
    const name =
      typeof parsed.body.name === "string" ? parsed.body.name.trim() : "";
    const defaultAllowanceDays = Number(parsed.body.defaultAllowanceDays ?? 0);
    if (!/^[A-Z0-9_]{2,32}$/.test(code)) {
      issues.push({ path: "code", message: "รหัสต้องเป็น A-Z 0-9 _" });
    }
    if (!name) issues.push({ path: "name", message: "กรุณาระบุชื่อ" });
    if (!Number.isFinite(defaultAllowanceDays) || defaultAllowanceDays < 0) {
      issues.push({ path: "defaultAllowanceDays", message: "สิทธิไม่ถูกต้อง" });
    }
    if (issues.length) {
      return validationErrorResponse("กรุณาตรวจสอบประเภทลา", issues);
    }

    const created = await prisma.leaveType.create({
      data: {
        code,
        name,
        description:
          typeof parsed.body.description === "string"
            ? parsed.body.description.trim() || null
            : null,
        isPaid:
          typeof parsed.body.isPaid === "boolean" ? parsed.body.isPaid : true,
        requiresAttachment:
          typeof parsed.body.requiresAttachment === "boolean"
            ? parsed.body.requiresAttachment
            : false,
        defaultAllowanceDays,
        isActive:
          typeof parsed.body.isActive === "boolean"
            ? parsed.body.isActive
            : true,
      },
    });

    await recordAuditLog({
      actor: {
        employeeId: currentUser?.employee?.id,
        authUserId: currentUser?.user.id,
      },
      action: "HR_LEAVE_TYPE_CREATED",
      entityType: "LEAVE_TYPE",
      entityId: created.id,
      metadata: { code },
    });

    return NextResponse.json(serializeType(created), { status: 201 });
  } catch (error) {
    if (
      typeof error === "object" &&
      error !== null &&
      "code" in error &&
      error.code === "P2002"
    ) {
      return apiErrorResponse("รหัสประเภทลาซ้ำ", 409, "CONFLICT");
    }
    console.error("POST /api/hr/leave-types failed", error);
    return apiErrorResponse("ไม่สามารถสร้างประเภทลาได้", 500, "INTERNAL_ERROR");
  }
}
