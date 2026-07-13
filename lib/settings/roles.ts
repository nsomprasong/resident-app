import type { Role } from "@/generated/prisma/client";

import type { ValidationIssue } from "@/lib/api/validation";
import type { RoleRecord } from "@/lib/settings/roles-shared";

export type { RoleRecord } from "@/lib/settings/roles-shared";

type RoleWithCount = Role & {
  _count: { employees: number };
};

export function serializeRole(role: RoleWithCount): RoleRecord {
  return {
    id: role.id,
    code: role.code,
    displayName: role.displayName,
    isActive: role.isActive,
    employeeCount: role._count.employees,
  };
}

type RoleFieldSource = Record<string, unknown>;

function readTrimmedString(
  source: RoleFieldSource,
  key: string,
): string | undefined {
  const value = source[key];
  if (value === undefined) return undefined;
  return typeof value === "string" ? value.trim() : "";
}

function readBoolean(
  source: RoleFieldSource,
  key: string,
): boolean | undefined {
  const value = source[key];
  if (value === undefined) return undefined;
  return typeof value === "boolean" ? value : undefined;
}

const ROLE_CODE_PATTERN = /^[A-Z][A-Z0-9_]{0,63}$/;

export function normalizeRoleCode(value: string): string {
  return value.trim().toUpperCase();
}

export function isValidRoleCode(value: string): boolean {
  return ROLE_CODE_PATTERN.test(value);
}

export type ParsedRoleInput = {
  code?: string;
  displayName?: string;
  isActive?: boolean;
};

export function parseRoleInput(
  body: RoleFieldSource,
  mode: "create" | "update",
): { ok: true; data: ParsedRoleInput } | { ok: false; issues: ValidationIssue[] } {
  const issues: ValidationIssue[] = [];
  const data: ParsedRoleInput = {};

  if (mode === "create") {
    const rawCode = readTrimmedString(body, "code");
    if (!rawCode) {
      issues.push({ path: "code", message: "กรุณาระบุรหัส role" });
    } else {
      const code = normalizeRoleCode(rawCode);
      if (!isValidRoleCode(code)) {
        issues.push({
          path: "code",
          message:
            "รหัส role ต้องขึ้นต้นด้วยตัวอักษร A-Z และใช้ได้เฉพาะ A-Z, 0-9, _",
        });
      } else {
        data.code = code;
      }
    }
  } else if ("code" in body) {
    issues.push({
      path: "code",
      message: "ไม่สามารถเปลี่ยนรหัส role หลังสร้างแล้ว",
    });
  }

  const displayName = readTrimmedString(body, "displayName");
  if (mode === "create" || displayName !== undefined) {
    if (!displayName) {
      issues.push({ path: "displayName", message: "กรุณาระบุชื่อที่แสดง" });
    } else if (displayName.length > 120) {
      issues.push({
        path: "displayName",
        message: "ชื่อที่แสดงยาวเกินไป",
      });
    } else {
      data.displayName = displayName;
    }
  }

  const isActive = readBoolean(body, "isActive");
  if (isActive !== undefined) {
    data.isActive = isActive;
  }

  if (mode === "update" && Object.keys(data).length === 0 && issues.length === 0) {
    issues.push({ path: "body", message: "ไม่มีข้อมูลที่จะอัปเดต" });
  }

  if (issues.length) {
    return { ok: false, issues };
  }

  return { ok: true, data };
}

export function isUuid(value: string): boolean {
  return /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(
    value,
  );
}
