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
      name: currentUser.employee.name,
      role: currentUser.employee.role.code,
      roleDisplayName: currentUser.employee.role.displayName,
      permissions: currentUser.employee.role.permissions,
    },
  });
}
