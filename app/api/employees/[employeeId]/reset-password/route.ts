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
import {
  createAdminClient,
  createTemporaryPassword,
} from "@/lib/supabase/admin";
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
        phone: true,
        username: true,
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
        "พนักงานยังไม่มีบัญชี Auth",
        400,
        "NO_AUTH_USER",
      );
    }

    // Legacy email Auth: ticket login without password (unchanged).
    if (existing.email) {
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
        metadata: { name: existing.name, mode: "email_ticket" },
      });

      return NextResponse.json({
        ok: true,
        mustResetPassword: employee.mustResetPassword,
        message:
          "ตั้งค่าแล้ว — ผู้ใช้ใส่อีเมลแล้วกดเข้าสู่ระบบ จะถูกพาไปตั้งรหัสผ่านใหม่โดยไม่ต้องใส่รหัสเดิม",
      });
    }

    // Phone Auth: admin-issued temporary password (no SMS OTP in this phase).
    if (!existing.phone) {
      return apiErrorResponse(
        "พนักงานยังไม่มีเบอร์โทรสำหรับรีเซ็ตรหัสผ่าน",
        400,
        "NO_PHONE",
      );
    }

    const temporaryPassword = createTemporaryPassword();
    const admin = createAdminClient();
    const { error } = await admin.auth.admin.updateUserById(existing.authUserId, {
      password: temporaryPassword,
    });
    if (error) {
      return apiErrorResponse(
        `รีเซ็ตรหัสผ่าน Auth ไม่สำเร็จ: ${error.message}`,
        502,
        "AUTH_PASSWORD_RESET_FAILED",
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
      metadata: {
        name: existing.name,
        mode: "phone_temp_password",
        username: existing.username,
      },
    });

    return NextResponse.json({
      ok: true,
      mustResetPassword: employee.mustResetPassword,
      temporaryPassword,
      message:
        "สร้างรหัสผ่านชั่วคราวแล้ว — ส่งให้พนักงานใช้เข้าสู่ระบบ แล้วเปลี่ยนรหัสผ่านทันที",
    });
  } catch (error) {
    console.error("POST /api/employees/[employeeId]/reset-password failed", error);
    return apiErrorResponse("รีเซ็ตรหัสผ่านไม่สำเร็จ", 500, "INTERNAL_ERROR");
  }
}
