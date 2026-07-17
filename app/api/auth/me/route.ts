import { NextResponse } from "next/server";

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
      return NextResponse.json(
        {
          message: "Employee access is not configured",
          code: "EMPLOYEE_NOT_LINKED",
        },
        { status: 403 },
      );
    }

    if (!currentUser.employee.isActive) {
      return NextResponse.json(
        {
          message: "Employee account is disabled",
          code: "EMPLOYEE_DISABLED",
        },
        { status: 403 },
      );
    }

    if (!currentUser.employee.authUserId) {
      return NextResponse.json(
        {
          message: "Employee auth link is incomplete",
          code: "AUTH_USER_NOT_LINKED",
        },
        { status: 403 },
      );
    }

    if (!currentUser.employee.role || !currentUser.employee.role.isActive) {
      return NextResponse.json(
        {
          message: "Employee role is not configured",
          code: "ROLE_NOT_CONFIGURED",
        },
        { status: 403 },
      );
    }

    const permissions = Array.isArray(currentUser.employee.role.permissions)
      ? currentUser.employee.role.permissions.filter(
          (code): code is string => typeof code === "string" && code.length > 0,
        )
      : [];

    return NextResponse.json({
      employee: {
        id: currentUser.employee.id,
        authUserId: currentUser.employee.authUserId,
        username: currentUser.employee.username ?? null,
        phone: currentUser.employee.phone ?? null,
        email: currentUser.employee.email ?? null,
        firstName: currentUser.employee.firstName ?? null,
        lastName: currentUser.employee.lastName ?? null,
        name: currentUser.employee.name ?? "",
        role: currentUser.employee.role.code ?? "",
        roleDisplayName: currentUser.employee.role.displayName ?? "",
        permissions,
        isActive: currentUser.employee.isActive,
        mustResetPassword: Boolean(currentUser.employee.mustResetPassword),
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
