import {
  apiErrorResponse,
  readJsonObject,
  validationErrorResponse,
  type ValidationIssue,
} from "@/lib/api/validation";
import { recordAuditLog } from "@/lib/audit/audit-log";
import { prisma } from "@/lib/prisma";
import {
  isValidEmployeeEmail,
  normalizeEmployeeEmail,
} from "@/lib/settings/employees";
import { createAdminClient } from "@/lib/supabase/admin";
import { NextRequest, NextResponse } from "next/server";

const MIN_PASSWORD_LENGTH = 8;

export async function POST(request: NextRequest) {
  try {
    const parsed = await readJsonObject(request);
    if (!parsed.ok) return parsed.response;

    const issues: ValidationIssue[] = [];
    const name =
      typeof parsed.body.name === "string" ? parsed.body.name.trim() : "";
    const emailRaw =
      typeof parsed.body.email === "string" ? parsed.body.email.trim() : "";
    const password =
      typeof parsed.body.password === "string" ? parsed.body.password : "";
    const phoneRaw =
      typeof parsed.body.phone === "string" ? parsed.body.phone.trim() : "";

    if (!name || name.length > 120) {
      issues.push({ path: "name", message: "กรุณาระบุชื่อ" });
    }

    const email = normalizeEmployeeEmail(emailRaw);
    if (!email || !isValidEmployeeEmail(email)) {
      issues.push({ path: "email", message: "อีเมลไม่ถูกต้อง" });
    }

    if (!password || password.length < MIN_PASSWORD_LENGTH) {
      issues.push({
        path: "password",
        message: `รหัสผ่านต้องมีอย่างน้อย ${MIN_PASSWORD_LENGTH} ตัวอักษร`,
      });
    }

    if (issues.length) {
      return validationErrorResponse("กรุณาตรวจสอบข้อมูลลงทะเบียน", issues);
    }

    const existingEmployee = await prisma.employee.findFirst({
      where: { email },
      select: { id: true },
    });
    if (existingEmployee) {
      return apiErrorResponse(
        "อีเมลนี้มีในระบบแล้ว กรุณาเข้าสู่ระบบ หรือติดต่อผู้ดูแล",
        409,
        "EMAIL_EXISTS",
      );
    }

    const admin = createAdminClient();
    const { data: created, error: createError } =
      await admin.auth.admin.createUser({
        email,
        password,
        email_confirm: true,
        user_metadata: {
          provisioned_by: "self_register",
          name,
        },
      });

    if (createError || !created.user?.id) {
      const message = createError?.message ?? "";
      if (
        message.toLowerCase().includes("already") ||
        message.toLowerCase().includes("registered")
      ) {
        return apiErrorResponse(
          "อีเมลนี้มีในระบบแล้ว กรุณาเข้าสู่ระบบ หรือติดต่อผู้ดูแล",
          409,
          "EMAIL_EXISTS",
        );
      }
      console.error("self-register createUser failed", createError);
      return apiErrorResponse("ลงทะเบียนไม่สำเร็จ", 500, "INTERNAL_ERROR");
    }

    const authUserId = created.user.id;

    try {
      const employee = await prisma.employee.create({
        data: {
          name,
          email,
          phone: phoneRaw || null,
          authUserId,
          roleId: null,
          isActive: false,
          mustResetPassword: false,
        },
      });

      await recordAuditLog({
        actor: { authUserId },
        action: "EMPLOYEE_SELF_REGISTERED",
        entityType: "EMPLOYEE",
        entityId: employee.id,
        metadata: { email, name },
      });

      return NextResponse.json(
        {
          message:
            "ลงทะเบียนสำเร็จแล้ว รอผู้ดูแลระบบกำหนดสิทธิ์และเปิดใช้งานก่อนเข้าใช้งาน",
        },
        { status: 201 },
      );
    } catch (error) {
      await admin.auth.admin.deleteUser(authUserId).catch(() => undefined);
      throw error;
    }
  } catch (error) {
    console.error("POST /api/auth/register failed", error);
    return apiErrorResponse("ลงทะเบียนไม่สำเร็จ", 500, "INTERNAL_ERROR");
  }
}
