import { Prisma } from "@/generated/prisma/client";
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
  parseEmployeeInput,
  serializeEmployee,
} from "@/lib/settings/employees";
import { resolveAuthUserIdForEmail } from "@/lib/supabase/admin";
import { NextRequest, NextResponse } from "next/server";

type RouteContext = {
  params: Promise<{ employeeId: string }>;
};

const employeeInclude = {
  roleRecord: {
    select: {
      id: true,
      code: true,
      displayName: true,
      isActive: true,
    },
  },
} as const;

async function assertRoleAssignable(roleId: string | null | undefined) {
  if (roleId === undefined) return { ok: true as const };
  if (roleId === null) return { ok: true as const };

  const role = await prisma.role.findUnique({
    where: { id: roleId },
    select: { id: true, isActive: true },
  });

  if (!role) {
    return {
      ok: false as const,
      response: validationErrorResponse("ไม่พบ role ที่ระบุ", [
        { path: "roleId", message: "role ไม่มีในระบบ" },
      ]),
    };
  }

  if (!role.isActive) {
    return {
      ok: false as const,
      response: validationErrorResponse("ไม่สามารถกำหนด role ที่ปิดใช้งาน", [
        { path: "roleId", message: "role ถูกปิดใช้งาน" },
      ]),
    };
  }

  return { ok: true as const };
}

export async function PATCH(request: NextRequest, context: RouteContext) {
  try {
    const { employeeId } = await context.params;
    if (!isUuid(employeeId)) {
      return apiErrorResponse("ไม่พบพนักงาน", 404, "NOT_FOUND");
    }

    const currentUser = await getCurrentUser();
    const parsed = await readJsonObject(request);
    if (!parsed.ok) return parsed.response;

    const validated = parseEmployeeInput(parsed.body, "update");
    if (!validated.ok) {
      return validationErrorResponse(
        "กรุณาตรวจสอบข้อมูลพนักงาน",
        validated.issues,
      );
    }

    const existing = await prisma.employee.findUnique({
      where: { id: employeeId },
      include: employeeInclude,
    });
    if (!existing) {
      return apiErrorResponse("ไม่พบพนักงาน", 404, "NOT_FOUND");
    }

    const isSelf = currentUser?.employee?.id === existing.id;
    if (isSelf && "authUserId" in validated.data && validated.data.authUserId === null) {
      return validationErrorResponse(
        "ไม่สามารถถอดการผูก Auth ของบัญชีที่กำลังใช้งานอยู่",
        [{ path: "authUserId", message: "ห้ามถอด mapping ของตัวเอง" }],
      );
    }
    if (isSelf && "roleId" in validated.data && validated.data.roleId === null) {
      return validationErrorResponse(
        "ไม่สามารถลบ role ของบัญชีที่กำลังใช้งานอยู่",
        [{ path: "roleId", message: "ห้ามลบ role ของตัวเอง" }],
      );
    }
    if (isSelf && validated.data.isActive === false) {
      return validationErrorResponse(
        "ไม่สามารถปิดใช้งานบัญชีที่กำลังใช้งานอยู่",
        [{ path: "isActive", message: "ห้ามปิดใช้งานตัวเอง" }],
      );
    }

    const roleCheck = await assertRoleAssignable(validated.data.roleId);
    if (!roleCheck.ok) return roleCheck.response;

    const nextActive =
      validated.data.isActive !== undefined
        ? validated.data.isActive
        : existing.isActive;
    const nextRoleId =
      validated.data.roleId !== undefined
        ? validated.data.roleId
        : existing.roleId;
    if (nextActive && !nextRoleId) {
      return validationErrorResponse(
        "ต้องกำหนดสิทธิ์ (role) ก่อนเปิดใช้งานบัญชี",
        [{ path: "roleId", message: "กรุณาเลือก role ก่อนเปิดใช้งาน" }],
      );
    }

    const updateData: {
      name?: string;
      email?: string | null;
      phone?: string | null;
      authUserId?: string | null;
      roleId?: string | null;
      isActive?: boolean;
    } = { ...validated.data };

    let authUserCreated = false;

    if ("email" in validated.data && validated.data.email) {
      const email = validated.data.email;
      const emailOwner = await prisma.employee.findFirst({
        where: { email, id: { not: employeeId } },
        select: { id: true },
      });
      if (emailOwner) {
        return validationErrorResponse("อีเมลนี้ถูกใช้โดยพนักงานอื่นแล้ว", [
          { path: "email", message: "อีเมลซ้ำ" },
        ]);
      }

      const authResolved = await resolveAuthUserIdForEmail(email);
      if (!authResolved.ok) {
        return apiErrorResponse(
          authResolved.message,
          502,
          "AUTH_PROVISION_FAILED",
        );
      }

      const authOwner = await prisma.employee.findFirst({
        where: {
          authUserId: authResolved.authUserId,
          id: { not: employeeId },
        },
        select: { id: true },
      });
      if (authOwner) {
        return validationErrorResponse(
          "Auth user นี้ถูกผูกกับพนักงานอื่นแล้ว",
          [{ path: "email", message: "authUserId ซ้ำ" }],
        );
      }

      updateData.email = email;
      updateData.authUserId = authResolved.authUserId;
      authUserCreated = authResolved.created;
    }

    const employee = await prisma.employee.update({
      where: { id: employeeId },
      data: updateData,
      include: employeeInclude,
    });

    await recordAuditLog({
      actor: {
        employeeId: currentUser?.employee?.id,
        authUserId: currentUser?.user.id,
      },
      action: "EMPLOYEE_UPDATED",
      entityType: "EMPLOYEE",
      entityId: employee.id,
      metadata: {
        name: employee.name,
        email: employee.email,
        roleId: employee.roleId,
        hasAuthMapping: Boolean(employee.authUserId),
        isActive: employee.isActive,
        authUserCreated,
      },
    });

    return NextResponse.json(serializeEmployee(employee));
  } catch (error) {
    if (
      error instanceof Prisma.PrismaClientKnownRequestError &&
      error.code === "P2002"
    ) {
      const target = Array.isArray(error.meta?.target)
        ? error.meta.target.join(",")
        : String(error.meta?.target ?? "");
      if (target.includes("email")) {
        return validationErrorResponse("อีเมลนี้ถูกใช้โดยพนักงานอื่นแล้ว", [
          { path: "email", message: "อีเมลซ้ำ" },
        ]);
      }
      return validationErrorResponse("authUserId นี้ถูกผูกกับพนักงานอื่นแล้ว", [
        { path: "authUserId", message: "authUserId ซ้ำ" },
      ]);
    }
    console.error("PATCH /api/employees/[employeeId] failed", error);
    return apiErrorResponse("อัปเดตพนักงานไม่สำเร็จ", 500, "INTERNAL_ERROR");
  }
}
