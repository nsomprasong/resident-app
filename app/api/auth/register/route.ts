import {
  apiErrorResponse,
  readJsonObject,
  validationErrorResponse,
  type ValidationIssue,
} from "@/lib/api/validation";
import { recordAuditLog } from "@/lib/audit/audit-log";
import { provisionUsernamePhoneAuth } from "@/lib/auth/provision-username-employee";
import {
  isValidUsername,
  normalizeThaiPhone,
  normalizeUsername,
} from "@/lib/auth/login-identifier";
import { nextEmployeeCode } from "@/lib/hr/employee-codes";
import { buildEmployeeDisplayName } from "@/lib/hr/employees";
import { prisma } from "@/lib/prisma";
import {
  isValidEmployeeEmail,
  normalizeEmployeeEmail,
} from "@/lib/settings/employees";
import { deleteAuthUserById } from "@/lib/supabase/admin";
import { NextRequest, NextResponse } from "next/server";

/**
 * Public self-register — same Auth principle as Settings / HR employee create:
 * username-bound Auth mailbox + temporary password + mustResetPassword.
 * Account stays inactive until an admin assigns a role and activates it;
 * first login then uses Username only to set a password.
 */
export async function POST(request: NextRequest) {
  let createdAuthUserId: string | null = null;

  try {
    const parsed = await readJsonObject(request);
    if (!parsed.ok) return parsed.response;

    const issues: ValidationIssue[] = [];
    const firstName =
      typeof parsed.body.firstName === "string"
        ? parsed.body.firstName.trim()
        : "";
    const lastName =
      typeof parsed.body.lastName === "string"
        ? parsed.body.lastName.trim()
        : "";
    const notesRaw =
      typeof parsed.body.notes === "string" ? parsed.body.notes.trim() : "";
    const usernameRaw =
      typeof parsed.body.username === "string"
        ? parsed.body.username.trim()
        : "";
    const phoneRaw =
      typeof parsed.body.phone === "string" ? parsed.body.phone.trim() : "";
    const emailRaw =
      typeof parsed.body.email === "string" ? parsed.body.email.trim() : "";

    // Backward-compatible: old clients sent a single `name` field.
    const legacyName =
      typeof parsed.body.name === "string" ? parsed.body.name.trim() : "";

    let resolvedFirstName = firstName;
    let resolvedLastName = lastName;
    if (!resolvedFirstName && legacyName) {
      const parts = legacyName.split(/\s+/).filter(Boolean);
      resolvedFirstName = parts[0] ?? "";
      resolvedLastName = parts.slice(1).join(" ");
    }

    if (!resolvedFirstName || resolvedFirstName.length > 80) {
      issues.push({ path: "firstName", message: "กรุณาระบุชื่อ" });
    }

    if (resolvedLastName.length > 80) {
      issues.push({ path: "lastName", message: "นามสกุลยาวเกินไป" });
    }

    const username = normalizeUsername(usernameRaw);
    if (!usernameRaw) {
      issues.push({ path: "username", message: "กรุณาระบุ Username" });
    } else if (!isValidUsername(username)) {
      issues.push({
        path: "username",
        message: "Username ต้องเป็น a-z 0-9 . _ - ความยาว 3–40 ตัว",
      });
    }

    const phone = normalizeThaiPhone(phoneRaw);
    if (!phoneRaw) {
      issues.push({ path: "phone", message: "กรุณาระบุเบอร์โทรศัพท์" });
    } else if (!phone) {
      issues.push({ path: "phone", message: "รูปแบบเบอร์โทรไม่ถูกต้อง" });
    }

    let email: string | null = null;
    if (emailRaw) {
      email = normalizeEmployeeEmail(emailRaw);
      if (!email || !isValidEmployeeEmail(email)) {
        issues.push({ path: "email", message: "อีเมลไม่ถูกต้อง" });
      }
    }

    if (notesRaw.length > 2000) {
      issues.push({ path: "notes", message: "หมายเหตุยาวเกินไป" });
    }

    if (issues.length) {
      return validationErrorResponse("กรุณาตรวจสอบข้อมูลลงทะเบียน", issues);
    }

    if (!phone || !username) {
      return validationErrorResponse("กรุณาตรวจสอบข้อมูลลงทะเบียน", issues);
    }

    const [usernameOwner, phoneOwner, emailOwner] = await Promise.all([
      prisma.employee.findUnique({
        where: { username },
        select: { id: true },
      }),
      prisma.employee.findUnique({
        where: { phone },
        select: { id: true },
      }),
      email
        ? prisma.employee.findUnique({
            where: { email },
            select: { id: true },
          })
        : Promise.resolve(null),
    ]);

    if (usernameOwner) {
      return apiErrorResponse(
        "Username นี้มีในระบบแล้ว กรุณาเข้าสู่ระบบ หรือติดต่อผู้ดูแล",
        409,
        "USERNAME_EXISTS",
      );
    }
    if (phoneOwner) {
      return apiErrorResponse(
        "เบอร์โทรนี้มีในระบบแล้ว กรุณาเข้าสู่ระบบ หรือติดต่อผู้ดูแล",
        409,
        "PHONE_EXISTS",
      );
    }
    if (emailOwner) {
      return apiErrorResponse(
        "อีเมลนี้มีในระบบแล้ว กรุณาเข้าสู่ระบบ หรือติดต่อผู้ดูแล",
        409,
        "EMAIL_EXISTS",
      );
    }

    const authResolved = await provisionUsernamePhoneAuth({ username, phone });
    if (!authResolved.ok) {
      if (authResolved.code === "AUTH_EXISTS") {
        return apiErrorResponse(
          "บัญชีนี้มีในระบบแล้ว กรุณาเข้าสู่ระบบ หรือติดต่อผู้ดูแล",
          409,
          "AUTH_EXISTS",
        );
      }
      console.error("self-register provisionUsernamePhoneAuth failed", authResolved);
      return apiErrorResponse(
        authResolved.message,
        502,
        "AUTH_PROVISION_FAILED",
      );
    }
    createdAuthUserId = authResolved.authUserId;

    const name = buildEmployeeDisplayName(resolvedFirstName, resolvedLastName);
    const employeeCode = await nextEmployeeCode();

    try {
      const employee = await prisma.employee.create({
        data: {
          name,
          firstName: resolvedFirstName,
          lastName: resolvedLastName || "",
          employeeCode,
          notes: notesRaw || null,
          username,
          phone,
          // Contact only — Auth login uses username-bound mailbox (Settings principle).
          email,
          authUserId: authResolved.authUserId,
          roleId: null,
          isActive: false,
          mustResetPassword: true,
          employmentType: "MONTHLY",
          hrStatus: "ACTIVE",
        },
      });

      createdAuthUserId = null;

      await recordAuditLog({
        actor: { authUserId: authResolved.authUserId },
        action: "EMPLOYEE_SELF_REGISTERED",
        entityType: "EMPLOYEE",
        entityId: employee.id,
        metadata: {
          username,
          phone,
          email,
          firstName: resolvedFirstName,
          lastName: resolvedLastName || "",
          name,
          employeeCode,
          authMode: "username_auth_email",
          mustResetPassword: true,
        },
      });

      return NextResponse.json(
        {
          message:
            "ลงทะเบียนสำเร็จแล้ว รอผู้ดูแลกำหนดสิทธิ์และเปิดใช้งาน จากนั้นเข้าสู่ระบบด้วย Username เพื่อตั้งรหัสผ่านครั้งแรก",
        },
        { status: 201 },
      );
    } catch (error) {
      await deleteAuthUserById(authResolved.authUserId);
      createdAuthUserId = null;
      throw error;
    }
  } catch (error) {
    if (createdAuthUserId) {
      await deleteAuthUserById(createdAuthUserId);
    }
    console.error("POST /api/auth/register failed", error);
    return apiErrorResponse("ลงทะเบียนไม่สำเร็จ", 500, "INTERNAL_ERROR");
  }
}
