import { Prisma } from "@/generated/prisma/client";
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
  canActorMutateSupportEmployee,
  isProtectedSupportEmail,
  isProtectedSupportEmployeeRecord,
  supportAccountForbiddenResponseMessage,
} from "@/lib/auth/support-account";
import { prisma } from "@/lib/prisma";
import {
  isUuid,
  parseEmployeeInput,
  serializeEmployee,
} from "@/lib/settings/employees";
import {
  ensureEmployeeAuthProvisioned,
  resolveAuthUserIdForEmail,
  updateAuthUserPhone,
} from "@/lib/supabase/admin";
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

    if (
      !(await canActorMutateSupportEmployee(
        {
          email: currentUser?.user.email,
          authUserId: currentUser?.user.id,
        },
        existing,
      ))
    ) {
      return apiErrorResponse(
        supportAccountForbiddenResponseMessage(),
        403,
        "SUPPORT_ACCOUNT_PROTECTED",
      );
    }

    if (await isProtectedSupportEmployeeRecord(existing)) {
      if (validated.data.isActive === false) {
        return apiErrorResponse(
          "ห้ามปิดใช้งานบัญชี support ของระบบ",
          403,
          "SUPPORT_ACCOUNT_PROTECTED",
        );
      }
      if ("roleId" in validated.data && validated.data.roleId === null) {
        return apiErrorResponse(
          "ห้ามถอด role ของบัญชี support ของระบบ",
          403,
          "SUPPORT_ACCOUNT_PROTECTED",
        );
      }
    }

    if (
      "email" in validated.data &&
      typeof validated.data.email === "string" &&
      isProtectedSupportEmail(validated.data.email) &&
      !canActorAccessSupportEmployee(
        currentUser?.user.email,
        validated.data.email,
      )
    ) {
      return apiErrorResponse(
        supportAccountForbiddenResponseMessage(),
        403,
        "SUPPORT_ACCOUNT_PROTECTED",
      );
    }

    const isSelf = currentUser?.employee?.id === existing.id;
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

    const roleCheck = await assertRoleAssignable(
      validated.data.roleId,
      currentUser?.user.email,
    );
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

    const fieldsToUpdate: {
      name?: string;
      email?: string | null;
      username?: string | null;
      phone?: string | null;
      roleId?: string | null;
      isActive?: boolean;
    } = {};
    if (validated.data.name !== undefined) fieldsToUpdate.name = validated.data.name;
    if (validated.data.email !== undefined) fieldsToUpdate.email = validated.data.email;
    if (validated.data.username !== undefined) {
      fieldsToUpdate.username = validated.data.username;
    }
    if (validated.data.phone !== undefined) fieldsToUpdate.phone = validated.data.phone;
    if (validated.data.roleId !== undefined) fieldsToUpdate.roleId = validated.data.roleId;
    if (validated.data.isActive !== undefined) {
      fieldsToUpdate.isActive = validated.data.isActive;
    }

    const updateData: {
      name?: string;
      email?: string | null;
      username?: string | null;
      phone?: string | null;
      authUserId?: string;
      roleId?: string | null;
      isActive?: boolean;
      mustResetPassword?: boolean;
    } = { ...fieldsToUpdate };

    let authUserCreated = false;

    if ("username" in validated.data && validated.data.username) {
      const usernameOwner = await prisma.employee.findFirst({
        where: {
          username: validated.data.username,
          id: { not: employeeId },
        },
        select: { id: true },
      });
      if (usernameOwner) {
        return validationErrorResponse("Username นี้ถูกใช้แล้ว", [
          { path: "username", message: "Username ซ้ำ" },
        ]);
      }
    }

    if ("phone" in validated.data && validated.data.phone) {
      const phoneOwner = await prisma.employee.findFirst({
        where: {
          phone: validated.data.phone,
          id: { not: employeeId },
        },
        select: { id: true },
      });
      if (phoneOwner) {
        return validationErrorResponse("เบอร์โทรนี้ถูกใช้แล้ว", [
          { path: "phone", message: "เบอร์โทรซ้ำ" },
        ]);
      }

      // Best-effort only — phone Auth is often disabled; never block role/profile saves.
      if (existing.authUserId && existing.username) {
        const phoneUpdate = await updateAuthUserPhone({
          authUserId: existing.authUserId,
          phone: validated.data.phone,
        });
        if (!phoneUpdate.ok) {
          console.warn(
            "PATCH /api/employees phone sync skipped",
            phoneUpdate.message,
          );
        }
      }
    }

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

      // Username Auth accounts: contact email is NOT the Auth identity.
      // Never rebind authUserId via resolveAuthUserIdForEmail — that orphans
      // the username@employee-auth.local mailbox (self-register password).
      if (existing.username) {
        updateData.email = email;
      } else {
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
    }

    // Prefer keeping an existing Auth link. Do not fail role/profile saves when
    // Auth re-provision is unavailable — admin can reset password later.
    if (nextActive) {
      const ensured = await ensureEmployeeAuthProvisioned({
        authUserId: updateData.authUserId ?? existing.authUserId,
        username:
          updateData.username !== undefined
            ? updateData.username
            : existing.username,
        phone:
          updateData.phone !== undefined ? updateData.phone : existing.phone,
        contactEmail:
          updateData.email !== undefined ? updateData.email : existing.email,
      });
      if (!ensured.ok) {
        if (!(updateData.authUserId ?? existing.authUserId)) {
          return apiErrorResponse(
            ensured.message,
            502,
            "AUTH_PROVISION_FAILED",
          );
        }
        console.warn(
          "PATCH /api/employees auth provision soft-fail",
          ensured.message,
        );
      } else {
        if (ensured.authUserId !== existing.authUserId) {
          const authOwner = await prisma.employee.findFirst({
            where: {
              authUserId: ensured.authUserId,
              id: { not: employeeId },
            },
            select: { id: true },
          });
          if (authOwner) {
            return validationErrorResponse(
              "Auth user นี้ถูกผูกกับพนักงานอื่นแล้ว",
              [{ path: "authUserId", message: "authUserId ซ้ำ" }],
            );
          }
          updateData.authUserId = ensured.authUserId;
        }

        if (ensured.created) {
          authUserCreated = true;
          updateData.mustResetPassword = true;
        }
      }
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
        username: employee.username,
        phone: employee.phone,
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
      if (target.includes("username")) {
        return validationErrorResponse("Username นี้ถูกใช้แล้ว", [
          { path: "username", message: "Username ซ้ำ" },
        ]);
      }
      if (target.includes("phone")) {
        return validationErrorResponse("เบอร์โทรนี้ถูกใช้แล้ว", [
          { path: "phone", message: "เบอร์โทรซ้ำ" },
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
