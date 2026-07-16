import {
  apiErrorResponse,
  readJsonObject,
  validationErrorResponse,
} from "@/lib/api/validation";
import { recordAuditLog } from "@/lib/audit/audit-log";
import {
  ticketMatchesEmployee,
  verifyPasswordResetTicket,
} from "@/lib/auth/password-reset-ticket";
import { getCurrentUser } from "@/lib/auth/current-user";
import { prisma } from "@/lib/prisma";
import { createAdminClient } from "@/lib/supabase/admin";
import { createClient } from "@/lib/supabase/server";
import { NextRequest, NextResponse } from "next/server";

const MIN_PASSWORD_LENGTH = 8;

export async function POST(request: NextRequest) {
  try {
    const parsed = await readJsonObject(request);
    if (!parsed.ok) return parsed.response;

    const password =
      typeof parsed.body.password === "string" ? parsed.body.password : "";
    const confirmPassword =
      typeof parsed.body.confirmPassword === "string"
        ? parsed.body.confirmPassword
        : "";
    const ticket =
      typeof parsed.body.ticket === "string" ? parsed.body.ticket.trim() : "";

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

    if (ticket) {
      const payload = verifyPasswordResetTicket(ticket);
      if (!payload) {
        return apiErrorResponse(
          "ลิงก์ตั้งรหัสผ่านหมดอายุหรือไม่ถูกต้อง กรุณาเข้าสู่ระบบใหม่",
          401,
          "INVALID_TICKET",
        );
      }

      const employee = await prisma.employee.findUnique({
        where: { id: payload.employeeId },
        select: {
          id: true,
          email: true,
          phone: true,
          isActive: true,
          roleId: true,
          mustResetPassword: true,
          authUserId: true,
        },
      });

      if (
        !employee?.isActive ||
        !employee.roleId ||
        !employee.mustResetPassword ||
        !employee.authUserId ||
        employee.authUserId !== payload.authUserId ||
        !ticketMatchesEmployee(payload, employee)
      ) {
        return apiErrorResponse(
          "บัญชีนี้ไม่ต้องตั้งรหัสผ่านใหม่ หรือข้อมูลไม่ตรงกัน",
          400,
          "RESET_NOT_REQUIRED",
        );
      }

      const admin = createAdminClient();
      const { error: updateError } = await admin.auth.admin.updateUserById(
        employee.authUserId,
        { password },
      );
      if (updateError) {
        console.error("set-password ticket updateUserById failed", updateError);
        return apiErrorResponse(
          "บันทึกรหัสผ่านไม่สำเร็จ",
          500,
          "INTERNAL_ERROR",
        );
      }

      await prisma.employee.update({
        where: { id: employee.id },
        data: { mustResetPassword: false },
      });

      await recordAuditLog({
        actor: {
          employeeId: employee.id,
          authUserId: employee.authUserId,
        },
        action: "EMPLOYEE_PASSWORD_SET",
        entityType: "EMPLOYEE",
        entityId: employee.id,
        metadata: { reason: "forced_reset_ticket" },
      });

      const supabase = await createClient();
      await supabase.auth.signOut();

      return NextResponse.json({
        ok: true,
        requireLogin: true,
        message: "ตั้งรหัสผ่านสำเร็จ กรุณาเข้าสู่ระบบด้วยรหัสผ่านใหม่",
      });
    }

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

    await supabase.auth.signOut();

    return NextResponse.json({
      ok: true,
      requireLogin: true,
      message: "ตั้งรหัสผ่านสำเร็จ กรุณาเข้าสู่ระบบด้วยรหัสผ่านใหม่",
    });
  } catch (error) {
    console.error("POST /api/auth/set-password failed", error);
    return apiErrorResponse("บันทึกรหัสผ่านไม่สำเร็จ", 500, "INTERNAL_ERROR");
  }
}
