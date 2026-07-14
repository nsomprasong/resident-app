import { Prisma } from "@/generated/prisma/client";
import {
  apiErrorResponse,
  readJsonObject,
  validationErrorResponse,
} from "@/lib/api/validation";
import { recordAuditLog } from "@/lib/audit/audit-log";
import { getCurrentUser } from "@/lib/auth/current-user";
import {
  SYSTEM_ADMIN_ROLE_CODE,
  canActorManageSystemAdminRole,
  systemAdminRoleForbiddenMessage,
} from "@/lib/auth/support-account";
import { prisma } from "@/lib/prisma";
import { isUuid, parseRoleInput, serializeRole } from "@/lib/settings/roles";
import { NextRequest, NextResponse } from "next/server";

type RouteContext = {
  params: Promise<{ roleId: string }>;
};

export async function PATCH(request: NextRequest, context: RouteContext) {
  try {
    const currentUser = await getCurrentUser();
    if (
      !currentUser?.employee?.role?.permissions.includes("authorization.manage")
    ) {
      return apiErrorResponse("ไม่มีสิทธิ์", 403, "FORBIDDEN");
    }

    const { roleId } = await context.params;
    if (!isUuid(roleId)) {
      return apiErrorResponse("ไม่พบ role", 404, "NOT_FOUND");
    }

    const parsed = await readJsonObject(request);
    if (!parsed.ok) return parsed.response;

    const validated = parseRoleInput(parsed.body, "update");
    if (!validated.ok) {
      return validationErrorResponse("กรุณาตรวจสอบข้อมูล role", validated.issues);
    }

    const existing = await prisma.role.findUnique({
      where: { id: roleId },
      include: { _count: { select: { employees: true } } },
    });
    if (!existing) {
      return apiErrorResponse("ไม่พบ role", 404, "NOT_FOUND");
    }

    if (
      existing.code === SYSTEM_ADMIN_ROLE_CODE &&
      !canActorManageSystemAdminRole(currentUser.user.email)
    ) {
      return apiErrorResponse(
        systemAdminRoleForbiddenMessage(),
        403,
        "SYSTEM_ADMIN_ROLE_PROTECTED",
      );
    }

    if (
      validated.data.isActive === false &&
      currentUser?.employee?.role?.code === existing.code
    ) {
      return validationErrorResponse("ไม่สามารถปิดใช้งาน role ของบัญชีที่กำลังใช้งานอยู่", [
        { path: "isActive", message: "ห้ามปิด role ของตัวเอง" },
      ]);
    }

    const role = await prisma.role.update({
      where: { id: roleId },
      data: validated.data,
      include: { _count: { select: { employees: true } } },
    });

    await recordAuditLog({
      actor: {
        employeeId: currentUser?.employee?.id,
        authUserId: currentUser?.user.id,
      },
      action: "ROLE_UPDATED",
      entityType: "ROLE",
      entityId: role.id,
      metadata: {
        code: role.code,
        displayName: role.displayName,
        isActive: role.isActive,
        employeeCount: role._count.employees,
      },
    });

    return NextResponse.json(serializeRole(role));
  } catch (error) {
    if (
      error instanceof Prisma.PrismaClientKnownRequestError &&
      error.code === "P2002"
    ) {
      return validationErrorResponse("รหัส role นี้มีอยู่แล้ว", [
        { path: "code", message: "รหัสซ้ำ" },
      ]);
    }
    console.error("PATCH /api/roles/[roleId] failed", error);
    return apiErrorResponse("อัปเดต role ไม่สำเร็จ", 500, "INTERNAL_ERROR");
  }
}
