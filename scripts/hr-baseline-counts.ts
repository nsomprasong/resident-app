import "dotenv/config";
import { prisma } from "../lib/prisma";

async function main() {
  const result = {
    capturedAt: new Date().toISOString(),
    employees: await prisma.employee.count(),
    employeesWithAuth: await prisma.employee.count({
      where: { authUserId: { not: null } },
    }),
    employeesWithRole: await prisma.employee.count({
      where: { roleId: { not: null } },
    }),
    employeesWithHourlyRate: await prisma.employee.count({
      where: { hourlyRate: { not: null } },
    }),
    employeesActive: await prisma.employee.count({
      where: { isActive: true },
    }),
    workShifts: await prisma.workShift.count(),
    roles: await prisma.role.count(),
    permissions: await prisma.permission.count(),
    rolePermissions: await prisma.rolePermission.count(),
    auditLogsWithEmployeeActor: await prisma.auditLog.count({
      where: { actorEmployeeId: { not: null } },
    }),
  };
  console.log(JSON.stringify(result, null, 2));
}

main()
  .catch((error) => {
    console.error(error);
    process.exitCode = 1;
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
