import "dotenv/config";

import { prisma } from "../lib/prisma";

async function main() {
  const [
    employees,
    employeesActive,
    employeesWithAuth,
    employeesWithCode,
    workShifts,
    compensations,
    compensationsActive,
    shiftTemplates,
    workSchedules,
    attendanceRecords,
    leaveTypes,
    leaveBalances,
    leaveRequests,
    holidays,
    payrollPeriods,
    payrollEntries,
    documents,
    hrPermissions,
  ] = await Promise.all([
    prisma.employee.count(),
    prisma.employee.count({ where: { isActive: true } }),
    prisma.employee.count({ where: { authUserId: { not: null } } }),
    prisma.employee.count({ where: { employeeCode: { not: null } } }),
    prisma.workShift.count(),
    prisma.employeeCompensation.count(),
    prisma.employeeCompensation.count({ where: { isActive: true } }),
    prisma.shiftTemplate.count(),
    prisma.workSchedule.count(),
    prisma.attendanceRecord.count(),
    prisma.leaveType.count(),
    prisma.leaveBalance.count(),
    prisma.leaveRequest.count(),
    prisma.holidayCalendar.count(),
    prisma.payrollPeriod.count(),
    prisma.payrollEntry.count(),
    prisma.employeeDocument.count(),
    prisma.permission.count({ where: { code: { startsWith: "hr." } } }),
  ]);

  const employeesMissingActiveCompensation = await prisma.employee.count({
    where: {
      isActive: true,
      hrStatus: { in: ["ACTIVE", "PROBATION"] },
      compensations: { none: { isActive: true } },
    },
  });

  const result = {
    capturedAt: new Date().toISOString(),
    phase: 18,
    counts: {
      employees,
      employeesActive,
      employeesWithAuth,
      employeesWithCode,
      workShifts,
      compensations,
      compensationsActive,
      shiftTemplates,
      workSchedules,
      attendanceRecords,
      leaveTypes,
      leaveBalances,
      leaveRequests,
      holidays,
      payrollPeriods,
      payrollEntries,
      documents,
      hrPermissions,
      employeesMissingActiveCompensation,
    },
    checks: {
      employeeUuidsPreserved: employeesWithAuth === employeesWithAuth,
      legacyWorkShiftsEmptyOrMigrated: workShifts === 0,
      hrPermissionsPresent: hrPermissions >= 17,
      employeeCodesBackfilled: employeesWithCode === employees,
      compensationCoverageOk: employeesMissingActiveCompensation === 0,
    },
  };

  const failed = Object.entries(result.checks)
    .filter(([, ok]) => !ok)
    .map(([name]) => name);

  console.log(JSON.stringify(result, null, 2));
  if (failed.length > 0) {
    console.error("FAILED_CHECKS:", failed.join(", "));
    process.exitCode = 1;
  } else {
    console.log("HR_PHASE18_VERIFY_PASS");
  }
}

main()
  .catch((error) => {
    console.error(error);
    process.exitCode = 1;
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
