import type { Permission } from "@/generated/prisma/client";

import { resolvePermissionThaiLabel } from "@/lib/auth/permission-labels";
import type { ValidationIssue } from "@/lib/api/validation";
import type {
  PermissionRecord,
  RolePermissionMapping,
} from "@/lib/settings/role-permissions-shared";

export type { PermissionRecord, RolePermissionMapping } from "@/lib/settings/role-permissions-shared";

export function serializePermission(permission: Permission): PermissionRecord {
  return {
    id: permission.id,
    code: permission.code,
    description:
      permission.description ?? resolvePermissionThaiLabel(permission.code),
  };
}

export function serializeRolePermissionMapping(input: {
  roleId: string;
  roleCode: string;
  displayName: string;
  permissionCodes: string[];
}): RolePermissionMapping {
  return {
    roleId: input.roleId,
    roleCode: input.roleCode,
    displayName: input.displayName,
    permissionCodes: [...input.permissionCodes].sort(),
  };
}

type FieldSource = Record<string, unknown>;

export type ParsedRolePermissionInput = {
  permissionCodes: string[];
};

export function parseRolePermissionInput(
  body: FieldSource,
):
  | { ok: true; data: ParsedRolePermissionInput }
  | { ok: false; issues: ValidationIssue[] } {
  const issues: ValidationIssue[] = [];
  const raw = body.permissionCodes;

  if (!Array.isArray(raw)) {
    return {
      ok: false,
      issues: [
        {
          path: "permissionCodes",
          message: "permissionCodes ต้องเป็นรายการรหัสสิทธิ์",
        },
      ],
    };
  }

  const codes: string[] = [];
  const seen = new Set<string>();

  for (const [index, value] of raw.entries()) {
    if (typeof value !== "string" || !value.trim()) {
      issues.push({
        path: `permissionCodes[${index}]`,
        message: "รหัสสิทธิ์ไม่ถูกต้อง",
      });
      continue;
    }

    const code = value.trim();
    if (seen.has(code)) continue;
    seen.add(code);
    codes.push(code);
  }

  if (issues.length) {
    return { ok: false, issues };
  }

  return { ok: true, data: { permissionCodes: codes } };
}

export function isUuid(value: string): boolean {
  return /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(
    value,
  );
}
