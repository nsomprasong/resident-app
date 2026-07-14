import "dotenv/config";

import { prisma } from "../lib/prisma";

/**
 * Ensures every active/probation employee has an active compensation row.
 * Backfills from employees.hourly_rate / employmentType without changing UUIDs.
 */
async function main() {
  const employees = await prisma.employee.findMany({
    where: {
      isActive: true,
      hrStatus: { in: ["ACTIVE", "PROBATION"] },
      compensations: { none: { isActive: true } },
    },
    select: {
      id: true,
      employmentType: true,
      hourlyRate: true,
      hiredAt: true,
    },
  });

  let created = 0;
  for (const employee of employees) {
    await prisma.employeeCompensation.create({
      data: {
        employeeId: employee.id,
        employmentType: employee.employmentType,
        hourlyRate: employee.hourlyRate ?? 0,
        dailyRate: 0,
        monthlySalary: 0,
        effectiveFrom: employee.hiredAt ?? new Date(),
        isActive: true,
        notes: "Backfill Phase 18.10",
      },
    });
    created += 1;
  }

  console.log(
    JSON.stringify(
      {
        missingBefore: employees.length,
        created,
      },
      null,
      2,
    ),
  );
}

main()
  .catch((error) => {
    console.error(error);
    process.exitCode = 1;
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
