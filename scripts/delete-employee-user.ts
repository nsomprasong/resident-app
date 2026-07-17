/**
 * Delete employee + Supabase Auth user by username/email/name match.
 * Usage: npx tsx scripts/delete-employee-user.ts onuma
 */
import "dotenv/config";

import { authLoginEmailForUsername } from "../lib/auth/login-identifier";
import { prisma } from "../lib/prisma";
import { createAdminClient } from "../lib/supabase/admin";

async function findTargets(query: string) {
  const q = query.trim();
  return prisma.employee.findMany({
    where: {
      OR: [
        { username: { equals: q, mode: "insensitive" } },
        { email: { equals: q, mode: "insensitive" } },
        { username: { contains: q, mode: "insensitive" } },
        { email: { contains: q, mode: "insensitive" } },
        { name: { contains: q, mode: "insensitive" } },
        { nickname: { contains: q, mode: "insensitive" } },
      ],
    },
    select: {
      id: true,
      username: true,
      email: true,
      name: true,
      authUserId: true,
      isActive: true,
      hrStatus: true,
      roleId: true,
      phone: true,
    },
    orderBy: { name: "asc" },
  });
}

async function collectAuthIds(emp: {
  authUserId: string | null;
  username: string | null;
  email: string | null;
}) {
  const admin = createAdminClient();
  const authIds = new Set<string>();
  if (emp.authUserId) authIds.add(emp.authUserId);

  const emails = new Set<string>();
  if (emp.username) {
    emails.add(authLoginEmailForUsername(emp.username).toLowerCase());
  }
  if (emp.email) emails.add(emp.email.toLowerCase());

  if (emails.size > 0) {
    const listed = await admin.auth.admin.listUsers({ page: 1, perPage: 200 });
    for (const user of listed.data?.users ?? []) {
      const email = (user.email ?? "").toLowerCase();
      if (emails.has(email)) authIds.add(user.id);
    }
  }

  return { admin, authIds: [...authIds] };
}

async function hardDeleteEmployee(employeeId: string) {
  await prisma.$transaction(async (tx) => {
    await tx.$executeRaw`SELECT set_config('app.allow_audit_purge', 'on', true)`;

    await tx.employee.updateMany({
      where: { managerEmployeeId: employeeId },
      data: { managerEmployeeId: null },
    });
    await tx.roomInspection.updateMany({
      where: { completedById: employeeId },
      data: { completedById: null },
    });
    await tx.payment.updateMany({
      where: { createdById: employeeId },
      data: { createdById: null },
    });
    await tx.payment.updateMany({
      where: { verifiedById: employeeId },
      data: { verifiedById: null },
    });
    await tx.paymentStatusHistory.updateMany({
      where: { actorId: employeeId },
      data: { actorId: null },
    });
    await tx.paymentRefund.updateMany({
      where: { createdById: employeeId },
      data: { createdById: null },
    });
    await tx.promptPayAccount.updateMany({
      where: { createdById: employeeId },
      data: { createdById: null },
    });
    await tx.promptPayAccount.updateMany({
      where: { updatedById: employeeId },
      data: { updatedById: null },
    });
    await tx.auditLog.updateMany({
      where: { actorEmployeeId: employeeId },
      data: { actorEmployeeId: null },
    });
    await tx.attendancePeriod.updateMany({
      where: { lockedById: employeeId },
      data: { lockedById: null },
    });
    await tx.attendanceAdjustment.updateMany({
      where: { reviewedById: employeeId },
      data: { reviewedById: null },
    });
    await tx.leaveRequest.updateMany({
      where: { reviewedById: employeeId },
      data: { reviewedById: null },
    });
    await tx.payrollPeriod.updateMany({
      where: { calculatedById: employeeId },
      data: { calculatedById: null },
    });
    await tx.payrollPeriod.updateMany({
      where: { reviewedById: employeeId },
      data: { reviewedById: null },
    });
    await tx.payrollPeriod.updateMany({
      where: { approvedById: employeeId },
      data: { approvedById: null },
    });
    await tx.payrollPeriod.updateMany({
      where: { paidById: employeeId },
      data: { paidById: null },
    });
    await tx.schedulePeriod.updateMany({
      where: { createdById: employeeId },
      data: { createdById: null },
    });
    await tx.schedulePeriod.updateMany({
      where: { updatedById: employeeId },
      data: { updatedById: null },
    });

    await tx.employee.delete({ where: { id: employeeId } });
  });
}

async function deactivateEmployee(emp: {
  id: string;
  username: string | null;
  email: string | null;
}) {
  const stamp = Date.now();
  await prisma.employee.update({
    where: { id: emp.id },
    data: {
      isActive: false,
      authUserId: null,
      username: emp.username ? `deleted_${emp.username}_${stamp}` : null,
      email: emp.email ? `deleted_${stamp}_${emp.email}` : null,
      hrStatus: "TERMINATED",
      endedAt: new Date(),
      mustResetPassword: false,
      roleId: null,
    },
  });
}

async function deleteEmployee(emp: Awaited<ReturnType<typeof findTargets>>[number]) {
  console.log("Deleting employee", {
    id: emp.id,
    username: emp.username,
    email: emp.email,
    name: emp.name,
    authUserId: emp.authUserId,
  });

  const { admin, authIds } = await collectAuthIds(emp);

  try {
    await hardDeleteEmployee(emp.id);
    console.log("deleted employee row", emp.id);
  } catch (error) {
    console.error("hard delete failed — deactivating instead:", error);
    await deactivateEmployee(emp);
    console.log("deactivated employee row", emp.id);
  }

  for (const authUserId of authIds) {
    const result = await admin.auth.admin.deleteUser(authUserId);
    console.log("deleted auth", authUserId, result.error?.message ?? "ok");
  }
}

async function main() {
  const query = process.argv[2]?.trim();
  if (!query) {
    console.error(
      "Usage: npx tsx scripts/delete-employee-user.ts <username|email|name>",
    );
    process.exit(1);
  }

  const matches = await findTargets(query);
  if (matches.length === 0) {
    console.log("NOT FOUND:", query);
    process.exit(1);
  }

  const exact = matches.filter(
    (item) =>
      item.username?.toLowerCase() === query.toLowerCase() ||
      item.email?.toLowerCase() === query.toLowerCase(),
  );
  const targets = exact.length > 0 ? exact : matches;

  if (targets.length > 1) {
    console.log("Multiple matches — refusing to delete:");
    console.log(JSON.stringify(targets, null, 2));
    process.exit(1);
  }

  await deleteEmployee(targets[0]!);

  const leftover = await findTargets(query);
  const stillExact = leftover.filter(
    (item) =>
      item.username?.toLowerCase() === query.toLowerCase() ||
      item.email?.toLowerCase() === query.toLowerCase(),
  );
  console.log(
    "verify leftover exact matches:",
    stillExact.length === 0 ? "none" : stillExact,
  );
}

main()
  .catch((error) => {
    console.error(error);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
