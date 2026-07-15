import { NextResponse } from "next/server";

import { getCurrentUser } from "@/lib/auth/current-user";

export async function GET() {
  const currentUser = await getCurrentUser();

  if (!currentUser) {
    return NextResponse.json(
      { message: "Authentication required" },
      { status: 401 },
    );
  }

  if (!currentUser.employee) {
    return NextResponse.json(
      { message: "Employee access is not configured" },
      { status: 403 },
    );
  }

  if (!currentUser.employee.isActive) {
    return NextResponse.json(
      { message: "Employee account is disabled" },
      { status: 403 },
    );
  }

  if (!currentUser.employee.role || !currentUser.employee.role.isActive) {
    return NextResponse.json(
      { message: "Employee role is not configured" },
      { status: 403 },
    );
  }

  return NextResponse.json({
    employee: {
      id: currentUser.employee.id,
      authUserId: currentUser.employee.authUserId,
      username: currentUser.employee.username,
      phone: currentUser.employee.phone,
      email: currentUser.employee.email,
      firstName: currentUser.employee.firstName,
      lastName: currentUser.employee.lastName,
      name: currentUser.employee.name,
      role: currentUser.employee.role.code,
      roleDisplayName: currentUser.employee.role.displayName,
      permissions: currentUser.employee.role.permissions,
      isActive: currentUser.employee.isActive,
      mustResetPassword: currentUser.employee.mustResetPassword,
    },
  });
}
