import {
  apiErrorResponse,
  readJsonObject,
  validationErrorResponse,
} from "@/lib/api/validation";
import { recordAuditLog } from "@/lib/audit/audit-log";
import { getCurrentUser } from "@/lib/auth/current-user";
import { prisma } from "@/lib/prisma";
import { createClient } from "@/lib/supabase/server";
import { NextRequest, NextResponse } from "next/server";

const MIN_PASSWORD_LENGTH = 8;

export async function POST(request: NextRequest) {
  try {
    const currentUser = await getCurrentUser();
    if (!currentUser?.employee) {
      return apiErrorResponse("กรุณาเข้าสู่ระบบ", 401, "UNAUTHORIZED");
    }
    if (!currentUser.employee.mustResetPassword) {
      return apiErrorResponse(
        "บัญชีนี้ไม่ต้องตั้งรหัสผ่านใหม่",
        400,
        "RESET_NOT_REQUIRED",
      );
    }

    const parsed = await readJsonObject(request);
    if (!parsed.ok) return parsed.response;

    const password =
      typeof parsed.body.password === "string" ? parsed.body.password : "";
    const confirmPassword =
      typeof parsed.body.confirmPassword === "string"
        ? parsed.body.confirmPassword
        : "";

    if (password.length < MIN_PASSWORD_LENGTH) {
      return validationErrorResponse("รหัสผ่านสั้นเกินไป", [
        {
          path: "password",
          message: `รหัสผ่านต้องมีอย่างน้อย ${MIN_PASSWORD_LENGTH} ตัวอักษร`,
        },
      ]);
    }
    if (password !== confirmPassword) {
      return validationErrorResponse("รหัสผ่านไม่ตรงกัน", [
        { path: "confirmPassword", message: "ยืนยันรหัสผ่านไม่ตรงกัน" },
      ]);
    }

    const supabase = await createClient();
    const { error } = await supabase.auth.updateUser({ password });
    if (error) {
      console.error("set-password updateUser failed", error);
      return apiErrorResponse(
        "บันทึกรหัสผ่านไม่สำเร็จ",
        500,
        "INTERNAL_ERROR",
      );
    }

    await prisma.employee.update({
      where: { id: currentUser.employee.id },
      data: { mustResetPassword: false },
    });

    await recordAuditLog({
      actor: {
        employeeId: currentUser.employee.id,
        authUserId: currentUser.user.id,
      },
      action: "EMPLOYEE_PASSWORD_SET",
      entityType: "EMPLOYEE",
      entityId: currentUser.employee.id,
      metadata: { reason: "forced_reset" },
    });

    return NextResponse.json({ ok: true });
  } catch (error) {
    console.error("POST /api/auth/set-password failed", error);
    return apiErrorResponse("บันทึกรหัสผ่านไม่สำเร็จ", 500, "INTERNAL_ERROR");
  }
}
