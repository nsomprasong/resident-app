/**
 * Repair Auth login emails that used invalid local-parts (e.g. bb.@employee-auth.local).
 * Usage: npx tsx scripts/repair-auth-login-emails.ts
 */
import "dotenv/config";
import { PrismaPg } from "@prisma/adapter-pg";
import { readFileSync } from "node:fs";
import { join } from "node:path";

import { PrismaClient } from "../generated/prisma/client";
import { authLoginEmailForUsername } from "../lib/auth/login-identifier";
import { ensureAuthLoginEmail } from "../lib/supabase/admin";

const connectionString = process.env.DATABASE_URL;
if (!connectionString) throw new Error("no DATABASE_URL");
const databaseUrl = new URL(connectionString);
databaseUrl.searchParams.delete("sslmode");
const ca = readFileSync(join(process.cwd(), "certs", "prod-ca-2021.crt"), "utf8");
const prisma = new PrismaClient({
  adapter: new PrismaPg({
    connectionString: databaseUrl.toString(),
    ssl: { ca, rejectUnauthorized: true },
  }),
});

async function main() {
  const employees = await prisma.employee.findMany({
    where: { authUserId: { not: null }, username: { not: null } },
    select: { id: true, username: true, authUserId: true, email: true },
  });

  for (const employee of employees) {
    if (!employee.username || !employee.authUserId) continue;
    const expected = authLoginEmailForUsername(employee.username);
    const result = await ensureAuthLoginEmail({
      authUserId: employee.authUserId,
      username: employee.username,
    });
    console.log(
      JSON.stringify({
        username: employee.username,
        employeeEmail: employee.email,
        expectedAuthEmail: expected,
        result,
      }),
    );
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
