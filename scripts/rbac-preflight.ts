import "dotenv/config";

async function main() {
  const { prisma } = await import("../lib/prisma");

  try {
    const legacyRoles = await prisma.employee.groupBy({
      by: ["role"],
      _count: { _all: true },
      orderBy: { role: "asc" },
    });

    console.log(
      JSON.stringify(
        legacyRoles.map(({ role, _count }) => ({
          role,
          count: _count._all,
        })),
        null,
        2,
      ),
    );

    const [roleCount, permissionCount, matrixCount, linkedCount, missingRoleCount] =
      await Promise.all([
        prisma.role.count(),
        prisma.permission.count(),
        prisma.rolePermission.count(),
        prisma.employee.count({ where: { roleId: { not: null } } }),
        prisma.employee.count({ where: { roleId: null } }),
      ]);

    const unknownFixtureCount = await prisma.employee.count({
      where: { role: "UNKNOWN_E2E", roleId: null },
    });

    let invalidReferenceRejected = false;
    try {
      await prisma.employee.updateMany({
        where: { role: "UNKNOWN_E2E" },
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
      roles: roleCount,
      permissions: permissionCount,
      rolePermissions: matrixCount,
      employeesWithRole: linkedCount,
      employeesWithoutRole: missingRoleCount,
      unknownFixtureWithoutRole: unknownFixtureCount,
      invalidReferenceRejected,
    };

    console.log(JSON.stringify(result, null, 2));

    if (
      roleCount !== 6 ||
      permissionCount !== 23 ||
      matrixCount !== 68 ||
      unknownFixtureCount !== 1 ||
      !invalidReferenceRejected
    ) {
      throw new Error("Relational RBAC reconciliation failed");
    }
  } finally {
    await prisma.$disconnect();
  }
}

void main();
