import { apiErrorResponse } from "@/lib/api/validation";
import { recordAuditLog } from "@/lib/audit/audit-log";
import { getCurrentUser } from "@/lib/auth/current-user";
import { prisma } from "@/lib/prisma";
import { NextRequest, NextResponse } from "next/server";

type RouteContext = {
  params: Promise<{ templateId: string; employeeId: string }>;
};

export async function DELETE(_: NextRequest, { params }: RouteContext) {
  try {
    const { templateId, employeeId } = await params;
    const currentUser = await getCurrentUser();

    const membership = await prisma.shiftMembership.findFirst({
      where: { shiftTemplateId: templateId, employeeId },
      select: {
        id: true,
        employeeId: true,
        shiftTemplateId: true,
        shiftTemplate: { select: { name: true } },
      },
    });
    if (!membership) {
      return apiErrorResponse("ไม่พบสมาชิกในกะนี้", 404, "NOT_FOUND");
    }

    await prisma.$transaction(async (tx) => {
      await tx.shiftMembership.delete({ where: { id: membership.id } });
      await tx.employee.updateMany({
        where: {
          id: employeeId,
          defaultShiftTemplateId: templateId,
        },
        data: { defaultShiftTemplateId: null },
      });
    });

    await recordAuditLog({
      actor: {
        employeeId: currentUser?.employee?.id,
        authUserId: currentUser?.user.id,
      },
      action: "HR_SHIFT_MEMBER_REMOVED",
      entityType: "SHIFT_MEMBERSHIP",
      entityId: membership.id,
      metadata: {
        shiftTemplateId: templateId,
        employeeId,
        shiftName: membership.shiftTemplate.name,
      },
    });

    return NextResponse.json({ ok: true });
  } catch (error) {
    console.error("DELETE shift-template member failed", error);
    return apiErrorResponse("ไม่สามารถถอดสมาชิกกะได้", 500, "INTERNAL_ERROR");
  }
}
