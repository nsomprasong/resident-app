import {
  apiErrorResponse,
} from "@/lib/api/validation";
import { recordAuditLog } from "@/lib/audit/audit-log";
import { getCurrentUser } from "@/lib/auth/current-user";
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
        authUserId: true,
        isActive: true,
      },
    });
    if (!existing) {
      return apiErrorResponse("ไม่พบพนักงาน", 404, "NOT_FOUND");
    }
    if (!existing.authUserId) {
      return apiErrorResponse(
        "พนักงานยังไม่มีบัญชี Auth — ผูกอีเมลก่อนรีเซ็ต",
        400,
        "NO_AUTH_USER",
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
        "ตั้งค่าแล้ว — ครั้งถัดไปที่ผู้ใช้นี้เข้าสู่ระบบ จะถูกพาไปตั้งรหัสผ่านใหม่",
    });
  } catch (error) {
    console.error("POST /api/employees/[employeeId]/reset-password failed", error);
    return apiErrorResponse("รีเซ็ตรหัสผ่านไม่สำเร็จ", 500, "INTERNAL_ERROR");
  }
}
