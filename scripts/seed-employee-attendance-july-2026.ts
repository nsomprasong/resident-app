import "dotenv/config";

import {
  SEED_BATCH_KEY,
  assertSeedEnvironment,
  parseSeedCliArgs,
} from "@/lib/hr/seed/attendance-payroll-july-2026-constants";
import { runJuly2026AttendancePayrollSeed } from "@/lib/hr/seed/attendance-payroll-july-2026-runner";
import { prisma } from "../lib/prisma";

function printSummary(
  stats: Awaited<ReturnType<typeof runJuly2026AttendancePayrollSeed>>,
  dryRun: boolean,
) {
  console.log("");
  console.log(dryRun ? "=== Dry Run สรุป ===" : "=== Seed สำเร็จ ===");
  console.log(`Seed batch: ${SEED_BATCH_KEY}`);
  console.log(`พนักงาน: ${stats.employees.length} คน`);
  for (const line of stats.employees) console.log(`  ${line}`);
  console.log(`กะ: ${stats.templates.join(", ")}`);
  console.log(`รอบตาราง: ${stats.schedulePeriodId ?? "(จะสร้าง)"}`);
  console.log(`ScheduledShift: ${stats.scheduledShifts}`);
  console.log(`AttendanceRecord: ${stats.attendanceRecords}`);
  console.log(`LeaveRequest: ${stats.leaveRequests}`);
  console.log(`กะทำแทน: ${stats.replacements}`);
  console.log(`กะควบ (วัน): ${stats.doubleShiftDays}`);
  console.log(`OT รอตรวจ: ${stats.otSuggested}`);
  console.log(`PayrollPeriod: ${stats.payrollPeriodId ?? "(จะสร้าง)"}`);
  console.log(`PayrollAdjustment: ${stats.payrollAdjustments}`);
}

async function main() {
  assertSeedEnvironment();
  const args = parseSeedCliArgs(process.argv.slice(2));
  if (args.dryRun) {
    console.log("โหมด dry-run — ไม่เขียนฐานข้อมูล");
  }

  const stats = await runJuly2026AttendancePayrollSeed(prisma, args);
  printSummary(stats, args.dryRun);
}

main()
  .catch((error) => {
    console.error(error instanceof Error ? error.message : error);
    process.exitCode = 1;
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
