import type { Employee, Role } from "@/generated/prisma/client";

import type { ValidationIssue } from "@/lib/api/validation";
import {
  isValidUsername,
  normalizeThaiPhone,
  normalizeUsername,
} from "@/lib/auth/login-identifier";
import { displayEmployeeName } from "@/lib/hr/employees";
import type { EmployeeRecord } from "@/lib/settings/employees-shared";

export type { EmployeeRecord } from "@/lib/settings/employees-shared";

type EmployeeWithRole = Employee & {
  roleRecord: Pick<Role, "id" | "code" | "displayName" | "isActive"> | null;
};

export function serializeEmployee(employee: EmployeeWithRole): EmployeeRecord {
  return {
    id: employee.id,
    name: displayEmployeeName(employee),
    email: employee.email,
    username: employee.username,
    phone: employee.phone,
    authUserId: employee.authUserId,
    roleId: employee.roleRecord?.id ?? employee.roleId,
    roleCode: employee.roleRecord?.code ?? null,
    roleDisplayName: employee.roleRecord?.displayName ?? null,
    roleIsActive: employee.roleRecord?.isActive ?? null,
    isActive: employee.isActive,
    mustResetPassword: employee.mustResetPassword,
    usesEmailLogin: Boolean(employee.email),
  };
}

type FieldSource = Record<string, unknown>;

function readTrimmedString(
  source: FieldSource,
  key: string,
): string | undefined {
  const value = source[key];
  if (value === undefined) return undefined;
  return typeof value === "string" ? value.trim() : "";
}

function readBoolean(
  source: FieldSource,
  key: string,
): boolean | undefined {
  const value = source[key];
  if (value === undefined) return undefined;
  return typeof value === "boolean" ? value : undefined;
}

const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export function normalizeEmployeeEmail(value: string): string {
  return value.trim().toLowerCase();
}

export function isValidEmployeeEmail(value: string): boolean {
  return EMAIL_PATTERN.test(value) && value.length <= 254;
}

export function isUuid(value: string): boolean {
  return /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(
    value,
  );
}

export type ParsedEmployeeInput = {
  name?: string;
  email?: string | null;
  username?: string | null;
  phone?: string | null;
  password?: string;
  passwordConfirm?: string;
  roleId?: string | null;
  isActive?: boolean;
};

export function parseEmployeeInput(
  body: FieldSource,
  mode: "create" | "update",
):
  | { ok: true; data: ParsedEmployeeInput }
  | { ok: false; issues: ValidationIssue[] } {
  const issues: ValidationIssue[] = [];
  const data: ParsedEmployeeInput = {};

  const name = readTrimmedString(body, "name");
  if (mode === "create" || name !== undefined) {
    if (!name) {
      issues.push({ path: "name", message: "กรุณาระบุชื่อพนักงาน" });
    } else if (name.length > 120) {
      issues.push({ path: "name", message: "ชื่อยาวเกินไป" });
    } else {
      data.name = name;
    }
  }

  if (mode === "create" || "username" in body) {
    const usernameRaw = readTrimmedString(body, "username");
    if (mode === "create") {
      if (usernameRaw) {
        const username = normalizeUsername(usernameRaw);
        if (!isValidUsername(username)) {
          issues.push({
            path: "username",
            message: "Username ต้องเป็น a-z 0-9 . _ - ความยาว 3–40 ตัว",
          });
        } else {
          data.username = username;
        }
      }
    } else if (usernameRaw === undefined || usernameRaw === "") {
      data.username = null;
    } else {
      const username = normalizeUsername(usernameRaw);
      if (!isValidUsername(username)) {
        issues.push({
          path: "username",
          message: "Username ต้องเป็น a-z 0-9 . _ - ความยาว 3–40 ตัว",
        });
      } else {
        data.username = username;
      }
    }
  }

  if (mode === "create" || "email" in body) {
    const emailRaw = readTrimmedString(body, "email");
    if (mode === "create") {
      if (emailRaw) {
        const email = normalizeEmployeeEmail(emailRaw);
        if (!isValidEmployeeEmail(email)) {
          issues.push({ path: "email", message: "รูปแบบอีเมลไม่ถูกต้อง" });
        } else {
          data.email = email;
        }
      }
    } else if (emailRaw === undefined || emailRaw === "") {
      data.email = null;
    } else {
      const email = normalizeEmployeeEmail(emailRaw);
      if (!isValidEmployeeEmail(email)) {
        issues.push({ path: "email", message: "รูปแบบอีเมลไม่ถูกต้อง" });
      } else {
        data.email = email;
      }
    }
  }

  if (mode === "create" || "phone" in body) {
    const phoneRaw = readTrimmedString(body, "phone");
    if (mode === "create") {
      if (phoneRaw) {
        const phone = normalizeThaiPhone(phoneRaw);
        if (!phone) {
          issues.push({ path: "phone", message: "รูปแบบเบอร์โทรไม่ถูกต้อง" });
        } else {
          data.phone = phone;
        }
      }
    } else if (phoneRaw === undefined || phoneRaw === "") {
      data.phone = null;
    } else {
      const phone = normalizeThaiPhone(phoneRaw);
      if (!phone) {
        issues.push({ path: "phone", message: "รูปแบบเบอร์โทรไม่ถูกต้อง" });
      } else {
        data.phone = phone;
      }
    }
  }

  if (mode === "create" || "password" in body) {
    const password = readTrimmedString(body, "password");
    const passwordConfirm = readTrimmedString(body, "passwordConfirm");
    if (password) {
      if (password.length < 8) {
        issues.push({
          path: "password",
          message: "รหัสผ่านต้องมีอย่างน้อย 8 ตัวอักษร",
        });
      } else {
        data.password = password;
      }
      if (passwordConfirm !== undefined && passwordConfirm !== password) {
        issues.push({
          path: "passwordConfirm",
          message: "รหัสผ่านยืนยันไม่ตรงกัน",
        });
      } else if (passwordConfirm) {
        data.passwordConfirm = passwordConfirm;
      }
    }
  }

  if (mode === "create") {
    const phoneAuth =
      Boolean(data.username) && Boolean(data.phone) && Boolean(data.password);
    const emailAuth = Boolean(data.email);

    if (!phoneAuth && !emailAuth) {
      issues.push({
        path: "body",
        message:
          "ต้องระบุ Username + เบอร์โทร + รหัสผ่าน (พนักงานใหม่) หรืออีเมล (บัญชีเดิม)",
      });
    }

    if (phoneAuth && data.email) {
      issues.push({
        path: "email",
        message: "พนักงานใหม่แบบ Username/Phone ไม่ต้องใส่อีเมล",
      });
    }
  }

  if ("authUserId" in body) {
    issues.push({
      path: "authUserId",
      message:
        "ไม่รองรับการตั้งหรือถอด authUserId โดยตรง — ใช้การผูกผ่านเบอร์โทรหรืออีเมล",
    });
  }

  if ("roleId" in body) {
    const roleId = readTrimmedString(body, "roleId");
    if (roleId === undefined || roleId === "") {
      data.roleId = null;
    } else if (!isUuid(roleId)) {
      issues.push({ path: "roleId", message: "roleId ไม่ถูกต้อง" });
    } else {
      data.roleId = roleId.toLowerCase();
    }
  }

  const isActive = readBoolean(body, "isActive");
  if (isActive !== undefined) {
    data.isActive = isActive;
  } else if ("isActive" in body) {
    issues.push({ path: "isActive", message: "isActive ต้องเป็น boolean" });
  }

  if (mode === "update" && Object.keys(data).length === 0) {
    issues.push({ path: "body", message: "ไม่มีข้อมูลที่จะอัปเดต" });
  }

  if (issues.length) {
    return { ok: false, issues };
  }

  return { ok: true, data };
}
