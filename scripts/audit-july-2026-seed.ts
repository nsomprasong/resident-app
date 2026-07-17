import "dotenv/config";

import { prisma } from "../lib/prisma";
import {
  SEED_SOURCE,
  seedMarkerPrefix,
} from "@/lib/hr/seed/attendance-payroll-july-2026-constants";
import { dateKeyUtc } from "@/lib/hr/schedules";

async function main() {
  const from = new Date("2026-07-01T00:00:00.000Z");
  const to = new Date("2026-07-16T00:00:00.000Z");
  const marker = seedMarkerPrefix();

  const seedRecords = await prisma.attendanceRecord.findMany({
    where: {
      workDate: { gte: from, lte: to },
      OR: [{ source: SEED_SOURCE }, { notes: { contains: marker } }],
    },
    select: {
      workDate: true,
      employeeId: true,
      status: true,
      clockIn: true,
      clockOut: true,
      employee: { select: { employeeCode: true, name: true } },
    },
    orderBy: [{ workDate: "asc" }],
  });

  const byDate = new Map<string, number>();
  const employees = new Map<string, string>();
  for (const row of seedRecords) {
    const dk = dateKeyUtc(row.workDate);
    byDate.set(dk, (byDate.get(dk) ?? 0) + 1);
    employees.set(
      row.employeeId,
      row.employee.employeeCode ?? row.employee.name,
    );
  }

  const allInRange = await prisma.attendanceRecord.count({
    where: { workDate: { gte: from, lte: to } },
  });

  const shifts = await prisma.scheduledShift.count({
    where: {
      workDate: { gte: from, lte: to },
      note: { contains: marker },
    },
  });

  function needsReview(row: (typeof seedRecords)[number]) {
    return (
      row.status === "PENDING_REVIEW" ||
      row.status === "OPEN" ||
      row.status === "INCOMPLETE" ||
      (row.clockIn !== null && row.clockOut === null)
    );
  }

  const reviewRows = seedRecords.filter(needsReview);
  const reviewByDate = new Map<string, number>();
  const reviewEmployees = new Map<string, string>();
  for (const row of reviewRows) {
    const dk = dateKeyUtc(row.workDate);
    reviewByDate.set(dk, (reviewByDate.get(dk) ?? 0) + 1);
    reviewEmployees.set(
      row.employeeId,
      row.employee.employeeCode ?? row.employee.name,
    );
  }

  console.log(
    JSON.stringify(
      {
        seedAttendanceJul1_16: seedRecords.length,
        allAttendanceJul1_16: allInRange,
        seedScheduledShiftsJul1_16: shifts,
        distinctSeedEmployees: employees.size,
        employeeCodes: [...employees.values()].sort(),
        daysWithSeedAttendance: byDate.size,
        countByDate: Object.fromEntries([...byDate.entries()].sort()),
        needsReviewFilterCount: reviewRows.length,
        needsReviewEmployees: [...reviewEmployees.values()].sort(),
        needsReviewByDate: Object.fromEntries([...reviewByDate.entries()].sort()),
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
