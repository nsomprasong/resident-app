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
      employeeCode: true,
      isActive: true,
      mustResetPassword: true,
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

  return {
    id: employee.id,
    name: displayEmployeeName(employee),
    isActive: employee.isActive,
    mustResetPassword: employee.mustResetPassword,
    role: employee.roleRecord
      ? {
          code: employee.roleRecord.code,
          displayName: employee.roleRecord.displayName,
          isActive: employee.roleRecord.isActive,
          permissions: employee.roleRecord.permissions.map(
            ({ permission }) => permission.code,
          ),
        }
      : null,
  };
}
