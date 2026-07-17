import { NextResponse } from "next/server";

import { logAccessDenial } from "@/lib/auth/access-denial";
import { getCurrentUser } from "@/lib/auth/current-user";

export async function GET() {
  try {
    const currentUser = await getCurrentUser();

    if (!currentUser) {
      return NextResponse.json(
        { message: "Authentication required" },
        { status: 401 },
      );
    }

    if (!currentUser.employee) {
      logAccessDenial("EMPLOYEE_NOT_FOUND", {
        authUserId: currentUser.user.id,
      });
      return NextResponse.json(
        {
          message: "Employee access is not configured",
          code: "EMPLOYEE_NOT_FOUND",
        },
        { status: 403 },
      );
    }

    if (!currentUser.employee.isActive) {
      logAccessDenial("EMPLOYEE_DISABLED", {
        employeeId: currentUser.employee.id,
      });
      return NextResponse.json(
        {
          message: "Employee account is disabled",
          code: "EMPLOYEE_DISABLED",
        },
        { status: 403 },
      );
    }

    if (!currentUser.employee.authUserId) {
      logAccessDenial("EMPLOYEE_NOT_FOUND", {
        employeeId: currentUser.employee.id,
        reason: "AUTH_USER_NOT_LINKED",
      });
      return NextResponse.json(
        {
          message: "Employee auth link is incomplete",
          code: "EMPLOYEE_NOT_FOUND",
        },
        { status: 403 },
      );
    }

    const role = currentUser.employee.role ?? null;
    if (!role) {
      logAccessDenial("ROLE_NOT_ASSIGNED", {
        employeeId: currentUser.employee.id,
      });
      return NextResponse.json(
        {
          message: "Employee role is not assigned",
          code: "ROLE_NOT_ASSIGNED",
        },
        { status: 403 },
      );
    }

    if (!role.isActive) {
      logAccessDenial("ROLE_INACTIVE", {
        employeeId: currentUser.employee.id,
        role: role.code ?? null,
      });
      return NextResponse.json(
        {
          message: "Employee role is inactive",
          code: "ROLE_INACTIVE",
        },
        { status: 403 },
      );
    }

    const permissions = Array.isArray(role.permissions)
      ? role.permissions.filter(
          (code): code is string => typeof code === "string" && code.length > 0,
        )
      : [];

    if (permissions.length === 0) {
      logAccessDenial("PERMISSIONS_EMPTY", {
        employeeId: currentUser.employee.id,
        role: role.code ?? null,
      });
      return NextResponse.json(
        {
          message: "Employee has no permissions",
          code: "PERMISSIONS_EMPTY",
        },
        { status: 403 },
      );
    }

    return NextResponse.json({
      employee: {
        id: currentUser.employee.id,
        authUserId: currentUser.employee.authUserId ?? null,
        username: currentUser.employee.username ?? null,
        phone: currentUser.employee.phone ?? null,
        email: currentUser.employee.email ?? null,
        firstName: currentUser.employee.firstName ?? null,
        lastName: currentUser.employee.lastName ?? null,
        name: currentUser.employee.name ?? "",
        role: role.code ?? null,
        roleDisplayName: role.displayName ?? "",
        permissions,
        isActive: Boolean(currentUser.employee.isActive),
        mustResetPassword: Boolean(currentUser.employee.mustResetPassword),
        profile: {
          name: currentUser.employee.name ?? "",
          email: currentUser.employee.email ?? null,
          phone: currentUser.employee.phone ?? null,
          username: currentUser.employee.username ?? null,
        },
      },
    });
  } catch (error) {
    console.error("GET /api/auth/me failed", error);
    return NextResponse.json(
      { message: "Access verification is temporarily unavailable" },
      { status: 503 },
    );
  }
}
