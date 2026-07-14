import {
  apiErrorResponse,
  readJsonObject,
  validationErrorResponse,
} from "@/lib/api/validation";
import { recordAuditLog } from "@/lib/audit/audit-log";
import { getCurrentUser } from "@/lib/auth/current-user";
import {
  assertActorMayAssignRoleCode,
  canActorAccessSupportEmployee,
  isProtectedSupportEmail,
  protectedSupportEmployeeWhere,
  supportAccountForbiddenResponseMessage,
} from "@/lib/auth/support-account";
import { prisma } from "@/lib/prisma";
import { parseEmployeeInput, serializeEmployee } from "@/lib/settings/employees";
import { resolveAuthUserIdForEmail } from "@/lib/supabase/admin";
import { Prisma } from "@/generated/prisma/client";
import { NextRequest, NextResponse } from "next/server";

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

async function assertRoleAssignable(
  roleId: string | null | undefined,
  actorEmail: string | null | undefined,
) {
  if (roleId === undefined) return { ok: true as const };
  if (roleId === null) return { ok: true as const };

  const role = await prisma.role.findUnique({
    where: { id: roleId },
    select: { id: true, isActive: true, code: true },
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

  const adminRoleCheck = assertActorMayAssignRoleCode(actorEmail, role.code);
  if (!adminRoleCheck.ok) {
    return {
      ok: false as const,
      response: apiErrorResponse(
        adminRoleCheck.message,
        403,
        "SYSTEM_ADMIN_ROLE_PROTECTED",
      ),
    };
  }

  return { ok: true as const };
}

export async function GET() {
  try {
    const currentUser = await getCurrentUser();
    const where = await protectedSupportEmployeeWhere({
      email: currentUser?.user.email,
      authUserId: currentUser?.user.id,
    });
    const employees = await prisma.employee.findMany({
      where,
      include: employeeInclude,
      orderBy: { name: "asc" },
    });
    return NextResponse.json(employees.map(serializeEmployee));
  } catch (error) {
    console.error("GET /api/employees failed", error);
    return apiErrorResponse(
      "ไม่สามารถโหลดพนักงานได้",
      500,
      "INTERNAL_ERROR",
    );
  }
}

export async function POST(request: NextRequest) {
  try {
    const currentUser = await getCurrentUser();
    const parsed = await readJsonObject(request);
    if (!parsed.ok) return parsed.response;

    const validated = parseEmployeeInput(parsed.body, "create");
    if (!validated.ok) {
      return validationErrorResponse(
        "กรุณาตรวจสอบข้อมูลพนักงาน",
        validated.issues,
      );
    }

    const { name, phone, email, roleId } = validated.data;
    if (!name || !email) {
      return validationErrorResponse("กรุณาตรวจสอบข้อมูลพนักงาน", [
        { path: "body", message: "ข้อมูลไม่ครบ" },
      ]);
    }

    if (
      isProtectedSupportEmail(email) &&
      !canActorAccessSupportEmployee(currentUser?.user.email, email)
    ) {
      const existingSupport = await prisma.employee.findFirst({
        where: { email: { equals: email, mode: "insensitive" } },
        select: { id: true },
      });
      if (existingSupport) {
        return apiErrorResponse(
          supportAccountForbiddenResponseMessage(),
          403,
          "SUPPORT_ACCOUNT_PROTECTED",
        );
      }
    }

    const roleCheck = await assertRoleAssignable(
      roleId ?? null,
      currentUser?.user.email,
    );
    if (!roleCheck.ok) return roleCheck.response;

    const emailOwner = await prisma.employee.findUnique({
      where: { email },
      select: { id: true },
    });
    if (emailOwner) {
      return validationErrorResponse("อีเมลนี้ถูกใช้โดยพนักงานอื่นแล้ว", [
        { path: "email", message: "อีเมลซ้ำ" },
      ]);
    }

    const authResolved = await resolveAuthUserIdForEmail(email);
    if (!authResolved.ok) {
      return apiErrorResponse(authResolved.message, 502, "AUTH_PROVISION_FAILED");
    }

    const authOwner = await prisma.employee.findUnique({
      where: { authUserId: authResolved.authUserId },
      select: { id: true, name: true },
    });
    if (authOwner) {
      return validationErrorResponse(
        "Auth user นี้ถูกผูกกับพนักงานอื่นแล้ว",
        [{ path: "email", message: "authUserId ซ้ำ" }],
      );
    }

    const employee = await prisma.employee.create({
      data: {
        name,
        email,
        phone: phone ?? null,
        authUserId: authResolved.authUserId,
        roleId: roleId ?? null,
      },
      include: employeeInclude,
    });

    await recordAuditLog({
      actor: {
        employeeId: currentUser?.employee?.id,
        authUserId: currentUser?.user.id,
      },
      action: "EMPLOYEE_CREATED",
      entityType: "EMPLOYEE",
      entityId: employee.id,
      metadata: {
        name: employee.name,
        email: employee.email,
        roleId: employee.roleId,
        hasAuthMapping: Boolean(employee.authUserId),
        authUserCreated: authResolved.created,
      },
    });

    return NextResponse.json(serializeEmployee(employee), { status: 201 });
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
    console.error("POST /api/employees failed", error);
    return apiErrorResponse("เพิ่มพนักงานไม่สำเร็จ", 500, "INTERNAL_ERROR");
  }
}
