import { displayEmployeeName } from "@/lib/hr/employees";
import { prisma } from "@/lib/prisma";

export async function findEmployeeAuthorization(authUserId: string) {
  const employee = await prisma.employee.findUnique({
    where: { authUserId },
    select: {
      id: true,
      name: true,
      firstName: true,
      lastName: true,
      nickname: true,
      email: true,
      username: true,
      phone: true,
      authUserId: true,
      employeeCode: true,
      isActive: true,
      mustResetPassword: true,
      sessionEpoch: true,
      roleRecord: {
        select: {
          code: true,
          displayName: true,
          isActive: true,
          permissions: {
            select: { permission: { select: { code: true } } },
          },
        },
      },
    },
  });

  if (!employee) return null;

  const permissions = (employee.roleRecord?.permissions ?? [])
    .map((row) => row.permission?.code)
    .filter((code): code is string => typeof code === "string" && code.length > 0);

  return {
    id: employee.id,
    authUserId: employee.authUserId,
    username: employee.username,
    phone: employee.phone,
    email: employee.email,
    firstName: employee.firstName,
    lastName: employee.lastName,
    name: displayEmployeeName(employee),
    isActive: employee.isActive,
    mustResetPassword: employee.mustResetPassword,
    sessionEpoch: employee.sessionEpoch,
    role: employee.roleRecord
      ? {
          code: employee.roleRecord.code,
          displayName: employee.roleRecord.displayName,
          isActive: employee.roleRecord.isActive,
          permissions,
        }
      : null,
  };
}
