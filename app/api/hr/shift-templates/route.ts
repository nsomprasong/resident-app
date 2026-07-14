import {
  apiErrorResponse,
  readJsonObject,
  validationErrorResponse,
} from "@/lib/api/validation";
import { recordAuditLog } from "@/lib/audit/audit-log";
import { getCurrentUser } from "@/lib/auth/current-user";
import {
  parseShiftTemplateInput,
  serializeShiftTemplate,
} from "@/lib/hr/shift-templates";
import { prisma } from "@/lib/prisma";
import { NextRequest, NextResponse } from "next/server";

export async function GET() {
  try {
    const templates = await prisma.shiftTemplate.findMany({
      orderBy: [{ isActive: "desc" }, { startMinutes: "asc" }, { name: "asc" }],
    });
    return NextResponse.json(templates.map(serializeShiftTemplate));
  } catch (error) {
    console.error("GET /api/hr/shift-templates failed", error);
    return apiErrorResponse("ไม่สามารถโหลดกะได้", 500, "INTERNAL_ERROR");
  }
}

export async function POST(request: NextRequest) {
  try {
    const currentUser = await getCurrentUser();
    const parsed = await readJsonObject(request);
    if (!parsed.ok) return parsed.response;

    const validated = parseShiftTemplateInput(parsed.body, "create");
    if (!validated.ok) {
      return validationErrorResponse("กรุณาตรวจสอบข้อมูลกะ", validated.issues);
    }

    const created = await prisma.shiftTemplate.create({
      data: {
        name: validated.data.name!,
        code: validated.data.code,
        startMinutes: validated.data.startMinutes!,
        endMinutes: validated.data.endMinutes!,
        breakMinutes: validated.data.breakMinutes ?? 0,
        lateGraceMinutes: validated.data.lateGraceMinutes ?? 0,
        earlyLeaveGraceMinutes: validated.data.earlyLeaveGraceMinutes ?? 0,
        requiredHeadcount: validated.data.requiredHeadcount ?? 1,
        color: validated.data.color,
        isActive: validated.data.isActive ?? true,
      },
    });

    await recordAuditLog({
      actor: {
        employeeId: currentUser?.employee?.id,
        authUserId: currentUser?.user.id,
      },
      action: "HR_SHIFT_TEMPLATE_CREATED",
      entityType: "SHIFT_TEMPLATE",
      entityId: created.id,
      metadata: { name: created.name },
    });

    return NextResponse.json(serializeShiftTemplate(created), { status: 201 });
  } catch (error) {
    if (
      typeof error === "object" &&
      error !== null &&
      "code" in error &&
      error.code === "P2002"
    ) {
      return apiErrorResponse("รหัสกะซ้ำ", 409, "CONFLICT");
    }
    console.error("POST /api/hr/shift-templates failed", error);
    return apiErrorResponse("ไม่สามารถสร้างกะได้", 500, "INTERNAL_ERROR");
  }
}
