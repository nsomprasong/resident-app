import {
  apiErrorResponse,
  readJsonObject,
  validationErrorResponse,
} from "@/lib/api/validation";
import { recordAuditLog } from "@/lib/audit/audit-log";
import { getCurrentUser } from "@/lib/auth/current-user";
import { prisma } from "@/lib/prisma";
import {
  isUuid,
  parseRolePermissionInput,
  serializeRolePermissionMapping,
} from "@/lib/settings/role-permissions";
import { NextRequest, NextResponse } from "next/server";

type RouteContext = {
  params: Promise<{ roleId: string }>;
};

async function loadRolePermissionCodes(roleId: string) {
  const role = await prisma.role.findUnique({
    where: { id: roleId },
    select: {
      id: true,
      code: true,
      displayName: true,
      permissions: {
        select: { permission: { select: { code: true } } },
      },
    },
  });

  if (!role) return null;

  return serializeRolePermissionMapping({
    roleId: role.id,
    roleCode: role.code,
    displayName: role.displayName,
    permissionCodes: role.permissions.map(({ permission }) => permission.code),
  });
}

export async function GET(_request: NextRequest, context: RouteContext) {
  try {
    const { roleId } = await context.params;
    if (!isUuid(roleId)) {
      return apiErrorResponse("ไม่พบ role", 404, "NOT_FOUND");
    }

    const mapping = await loadRolePermissionCodes(roleId);
    if (!mapping) {
      return apiErrorResponse("ไม่พบ role", 404, "NOT_FOUND");
    }

    return NextResponse.json(mapping);
  } catch (error) {
    console.error("GET /api/roles/[roleId]/permissions failed", error);
    return apiErrorResponse(
      "ไม่สามารถโหลดสิทธิ์ของ role ได้",
      500,
      "INTERNAL_ERROR",
    );
  }
}

export async function PUT(request: NextRequest, context: RouteContext) {
  try {
    const { roleId } = await context.params;
    if (!isUuid(roleId)) {
      return apiErrorResponse("ไม่พบ role", 404, "NOT_FOUND");
    }

    const currentUser = await getCurrentUser();
    const parsed = await readJsonObject(request);
    if (!parsed.ok) return parsed.response;

    const validated = parseRolePermissionInput(parsed.body);
    if (!validated.ok) {
      return validationErrorResponse(
        "กรุณาตรวจสอบรายการสิทธิ์",
        validated.issues,
      );
    }

    const role = await prisma.role.findUnique({
      where: { id: roleId },
      select: { id: true, code: true, displayName: true },
    });
    if (!role) {
      return apiErrorResponse("ไม่พบ role", 404, "NOT_FOUND");
    }

    const requestedCodes = validated.data.permissionCodes;

    if (
      currentUser?.employee?.role?.code === role.code &&
      !requestedCodes.includes("authorization.manage")
    ) {
      return validationErrorResponse(
        "ไม่สามารถถอด authorization.manage จาก role ของบัญชีที่กำลังใช้งานอยู่",
        [{ path: "permissionCodes", message: "ห้ามถอดสิทธิ์จัดการสิทธิ์ของตัวเอง" }],
      );
    }

    const catalog = await prisma.permission.findMany({
      select: { id: true, code: true },
    });
    const byCode = new Map(catalog.map((item) => [item.code, item.id]));
    const unknown = requestedCodes.filter((code) => !byCode.has(code));
    if (unknown.length) {
      return validationErrorResponse("พบรหัสสิทธิ์ที่ไม่มีในระบบ", [
        {
          path: "permissionCodes",
          message: `ไม่รู้จัก: ${unknown.join(", ")}`,
        },
      ]);
    }

    if (!requestedCodes.includes("authorization.manage")) {
      const otherManagers = await prisma.rolePermission.count({
        where: {
          roleId: { not: roleId },
          permission: { code: "authorization.manage" },
          role: { isActive: true },
        },
      });
      if (otherManagers === 0) {
        return validationErrorResponse(
          "ต้องมีอย่างน้อยหนึ่ง role ที่เปิดใช้งานและมี authorization.manage",
          [
            {
              path: "permissionCodes",
              message: "ห้ามถอดสิทธิ์จัดการสิทธิ์ชุดสุดท้าย",
            },
          ],
        );
      }
    }

    const permissionIds = requestedCodes.map((code) => byCode.get(code)!);

    await prisma.$transaction(async (tx) => {
      await tx.rolePermission.deleteMany({ where: { roleId } });
      if (permissionIds.length) {
        await tx.rolePermission.createMany({
          data: permissionIds.map((permissionId) => ({
            roleId,
            permissionId,
          })),
        });
      }
    });

    const mapping = await loadRolePermissionCodes(roleId);
    if (!mapping) {
      return apiErrorResponse("ไม่พบ role", 404, "NOT_FOUND");
    }

    await recordAuditLog({
      actor: {
        employeeId: currentUser?.employee?.id,
        authUserId: currentUser?.user.id,
      },
      action: "ROLE_PERMISSIONS_UPDATED",
      entityType: "ROLE",
      entityId: role.id,
      metadata: {
        code: role.code,
        permissionCodes: mapping.permissionCodes,
        permissionCount: mapping.permissionCodes.length,
      },
    });

    return NextResponse.json(mapping);
  } catch (error) {
    console.error("PUT /api/roles/[roleId]/permissions failed", error);
    return apiErrorResponse(
      "อัปเดตสิทธิ์ของ role ไม่สำเร็จ",
      500,
      "INTERNAL_ERROR",
    );
  }
}
