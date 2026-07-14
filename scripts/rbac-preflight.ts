import "dotenv/config";

async function main() {
  const { prisma } = await import("../lib/prisma");

  try {
    const [employeeCount, roleCount, permissionCount, matrixCount, linkedCount, missingRoleCount] =
      await Promise.all([
        prisma.employee.count(),
        prisma.role.count(),
        prisma.permission.count(),
        prisma.rolePermission.count(),
        prisma.employee.count({ where: { roleId: { not: null } } }),
        prisma.employee.count({ where: { roleId: null } }),
      ]);

    let invalidReferenceRejected = false;
    try {
      await prisma.employee.updateMany({
        where: { roleId: null },
        data: { roleId: "00000000-0000-0000-0000-000000000000" },
      });
    } catch (error: unknown) {
      invalidReferenceRejected =
        typeof error === "object" &&
        error !== null &&
        "code" in error &&
        error.code === "P2003";
    }

    const result = {
      employees: employeeCount,
      roles: roleCount,
      permissions: permissionCount,
      rolePermissions: matrixCount,
      employeesWithRole: linkedCount,
      employeesWithoutRole: missingRoleCount,
      invalidReferenceRejected,
    };

    console.log(JSON.stringify(result, null, 2));

    if (
      roleCount !== 6 ||
      permissionCount !== 42 ||
      matrixCount !== 108 ||
      employeeCount !== 8 ||
      linkedCount !== 7 ||
      missingRoleCount !== 1 ||
      !invalidReferenceRejected
    ) {
      throw new Error("Relational RBAC reconciliation failed");
    }
  } finally {
    await prisma.$disconnect();
  }
}

void main();
