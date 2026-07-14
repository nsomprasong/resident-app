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

export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ templateId: string }> },
) {
  try {
    const { templateId } = await params;
    const currentUser = await getCurrentUser();
    const parsed = await readJsonObject(request);
    if (!parsed.ok) return parsed.response;

    const existing = await prisma.shiftTemplate.findUnique({
      where: { id: templateId },
      select: { id: true },
    });
    if (!existing) {
      return apiErrorResponse("ไม่พบกะ", 404, "NOT_FOUND");
    }

    const validated = parseShiftTemplateInput(parsed.body, "update");
    if (!validated.ok) {
      return validationErrorResponse("กรุณาตรวจสอบข้อมูลกะ", validated.issues);
    }

    const updated = await prisma.shiftTemplate.update({
      where: { id: templateId },
      data: validated.data,
    });

    await recordAuditLog({
      actor: {
        employeeId: currentUser?.employee?.id,
        authUserId: currentUser?.user.id,
      },
      action: "HR_SHIFT_TEMPLATE_UPDATED",
      entityType: "SHIFT_TEMPLATE",
      entityId: updated.id,
      metadata: { fields: Object.keys(validated.data) },
    });

    return NextResponse.json(serializeShiftTemplate(updated));
  } catch (error) {
    console.error("PATCH /api/hr/shift-templates/[id] failed", error);
    return apiErrorResponse("ไม่สามารถบันทึกกะได้", 500, "INTERNAL_ERROR");
  }
}
