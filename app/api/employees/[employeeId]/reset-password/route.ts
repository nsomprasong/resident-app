import {
  apiErrorResponse,
} from "@/lib/api/validation";
import { recordAuditLog } from "@/lib/audit/audit-log";
import { getCurrentUser } from "@/lib/auth/current-user";
import {
  canActorMutateSupportEmployee,
  supportAccountForbiddenResponseMessage,
} from "@/lib/auth/support-account";
import { prisma } from "@/lib/prisma";
import { isUuid } from "@/lib/settings/employees";
import { NextRequest, NextResponse } from "next/server";

type RouteContext = {
  params: Promise<{ employeeId: string }>;
};

export async function POST(_request: NextRequest, context: RouteContext) {
  try {
    const currentUser = await getCurrentUser();
    const { employeeId } = await context.params;
    if (!isUuid(employeeId)) {
      return apiErrorResponse("ไม่พบพนักงาน", 404, "NOT_FOUND");
    }

    const existing = await prisma.employee.findUnique({
      where: { id: employeeId },
      select: {
        id: true,
        name: true,
        email: true,
        authUserId: true,
        isActive: true,
      },
    });
    if (!existing) {
      return apiErrorResponse("ไม่พบพนักงาน", 404, "NOT_FOUND");
    }

    if (
      !(await canActorMutateSupportEmployee(
        {
          email: currentUser?.user.email,
          authUserId: currentUser?.user.id,
        },
        existing,
      ))
    ) {
      return apiErrorResponse(
        supportAccountForbiddenResponseMessage(),
        403,
        "SUPPORT_ACCOUNT_PROTECTED",
      );
    }

    if (!existing.authUserId) {
      return apiErrorResponse(
        "พนักงานยังไม่มีบัญชี Auth — ผูกอีเมลก่อนรีเซ็ต",
        400,
        "NO_AUTH_USER",
      );
    }
    if (!existing.email) {
      return apiErrorResponse(
        "พนักงานยังไม่มีอีเมล — ระบุอีเมลก่อนรีเซ็ต",
        400,
        "NO_EMAIL",
      );
    }

    const employee = await prisma.employee.update({
      where: { id: employeeId },
      data: { mustResetPassword: true },
      select: { id: true, mustResetPassword: true },
    });

    await recordAuditLog({
      actor: {
        employeeId: currentUser?.employee?.id,
        authUserId: currentUser?.user.id,
      },
      action: "EMPLOYEE_PASSWORD_RESET_REQUESTED",
      entityType: "EMPLOYEE",
      entityId: employee.id,
      metadata: { name: existing.name },
    });

    return NextResponse.json({
      ok: true,
      mustResetPassword: employee.mustResetPassword,
      message:
        "ตั้งค่าแล้ว — ผู้ใช้ใส่อีเมลแล้วกดเข้าสู่ระบบ จะถูกพาไปตั้งรหัสผ่านใหม่โดยไม่ต้องใส่รหัสเดิม",
    });
  } catch (error) {
    console.error("POST /api/employees/[employeeId]/reset-password failed", error);
    return apiErrorResponse("รีเซ็ตรหัสผ่านไม่สำเร็จ", 500, "INTERNAL_ERROR");
  }
}
