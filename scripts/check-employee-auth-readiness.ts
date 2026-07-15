/**
 * Read-only readiness report for employee auth migration.
 * Does NOT modify any data.
 *
 * Usage: npx tsx scripts/check-employee-auth-readiness.ts
 */

import "dotenv/config";

function countDuplicates(values: Array<string | null>) {
  const map = new Map<string, number>();
  for (const value of values) {
    if (!value) continue;
    map.set(value, (map.get(value) ?? 0) + 1);
  }
  return [...map.entries()].filter(([, count]) => count > 1);
}

async function main() {
  const { prisma } = await import("../lib/prisma");

  const employees = await prisma.employee.findMany({
    select: {
      id: true,
      name: true,
      email: true,
      username: true,
      phone: true,
      authUserId: true,
      isActive: true,
    },
  });

  const total = employees.length;
  const withEmail = employees.filter((item) => Boolean(item.email)).length;
  const withUsername = employees.filter((item) => Boolean(item.username)).length;
  const withoutUsername = total - withUsername;
  const withPhone = employees.filter((item) => Boolean(item.phone)).length;
  const withoutPhone = total - withPhone;
  const withoutAuth = employees.filter((item) => !item.authUserId);

  const usernameDupes = countDuplicates(employees.map((item) => item.username));
  const phoneDupes = countDuplicates(employees.map((item) => item.phone));

  console.log("=== Employee Auth Readiness (read-only) ===");
  console.log(`จำนวนพนักงานทั้งหมด: ${total}`);
  console.log(`จำนวนพนักงานที่ Login ด้วย Email เดิม (มี email): ${withEmail}`);
  console.log(`จำนวนที่มี Username: ${withUsername}`);
  console.log(`จำนวนที่ไม่มี Username: ${withoutUsername}`);
  console.log(`จำนวนที่มี Phone: ${withPhone}`);
  console.log(`จำนวนที่ไม่มี Phone: ${withoutPhone}`);
  console.log(`Employee ที่ไม่มี authUserId: ${withoutAuth.length}`);
  console.log(`Username ซ้ำ: ${usernameDupes.length}`);
  for (const [value, count] of usernameDupes.slice(0, 20)) {
    console.log(`  - ${value} × ${count}`);
  }
  console.log(`Phone ซ้ำ: ${phoneDupes.length}`);
  for (const [value, count] of phoneDupes.slice(0, 20)) {
    console.log(`  - ${value} × ${count}`);
  }

  if (withoutAuth.length) {
    console.log("ตัวอย่าง Employee ที่ไม่มี authUserId:");
    for (const item of withoutAuth.slice(0, 10)) {
      console.log(`  - ${item.id} ${item.name} email=${item.email ?? "-"}`);
    }
  }

  console.log(
    "หมายเหตุ: การตรวจ Supabase Auth user ที่หายไปต้องใช้ service role — ยังไม่ยิง Auth API ในสคริปต์นี้เพื่อความปลอดภัย",
  );

  await prisma.$disconnect();
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
