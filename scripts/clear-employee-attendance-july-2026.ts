import "dotenv/config";

import { SEED_BATCH_KEY } from "@/lib/hr/seed/attendance-payroll-july-2026-constants";
import {
  assertSeedEnvironment,
  parseSeedCliArgs,
} from "@/lib/hr/seed/attendance-payroll-july-2026-constants";
import { clearJuly2026AttendancePayrollSeed } from "@/lib/hr/seed/attendance-payroll-july-2026-runner";
import { prisma } from "../lib/prisma";

async function main() {
  assertSeedEnvironment();
  const dryRun = parseSeedCliArgs(process.argv.slice(2)).dryRun;
  if (dryRun) {
    console.log("โหมด dry-run — แสดงจำนวนที่จะลบเท่านั้น");
  }

  const counts = await clearJuly2026AttendancePayrollSeed(prisma, dryRun);
  console.log("");
  console.log(`ล้าง Seed batch: ${SEED_BATCH_KEY}`);
  for (const [key, value] of Object.entries(counts)) {
    console.log(`  ${key}: ${value}`);
  }
  if (dryRun) {
    console.log("(ยังไม่ได้ลบจริง — รันโดยไม่ใส่ --dry-run เพื่อลบ)");
  }
}

main()
  .catch((error) => {
    console.error(error instanceof Error ? error.message : error);
    process.exitCode = 1;
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
