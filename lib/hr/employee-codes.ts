import { prisma } from "@/lib/prisma";

/** Next auto employee code in `EMP-0001` form (server-only). */
export async function nextEmployeeCode(): Promise<string> {
  const latest = await prisma.employee.findFirst({
    where: { employeeCode: { startsWith: "EMP-" } },
    orderBy: { employeeCode: "desc" },
    select: { employeeCode: true },
  });
  const current = Number(latest?.employeeCode?.replace("EMP-", "") ?? "0");
  const next = Number.isFinite(current) ? current + 1 : 1;
  return `EMP-${String(next).padStart(4, "0")}`;
}
