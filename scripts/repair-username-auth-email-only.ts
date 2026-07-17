/**
 * Replace a username employee's Auth user with an email-only account
 * (no phone identity) — matches the working `test` shape.
 *
 * Sets mustResetPassword=true so they set a new password via username-only login.
 *
 * Usage: npx tsx scripts/repair-username-auth-email-only.ts beebee
 */
import "dotenv/config";
import { randomBytes } from "node:crypto";

import { authLoginEmailForUsername } from "../lib/auth/login-identifier";
import { prisma } from "../lib/prisma";
import { createAdminClient } from "../lib/supabase/admin";

async function repair(username: string) {
  const emp = await prisma.employee.findUnique({
    where: { username },
    select: {
      id: true,
      username: true,
      authUserId: true,
      phone: true,
      isActive: true,
      roleId: true,
    },
  });
  if (!emp?.username) {
    console.log(username, "NOT FOUND");
    return;
  }
  if (!emp.roleId || !emp.isActive) {
    console.log(username, "skip: inactive or no role");
    return;
  }

  const admin = createAdminClient();
  const authEmail = authLoginEmailForUsername(emp.username);
  const tempPassword = `Tmp-${randomBytes(12).toString("base64url")}!a1`;

  if (emp.authUserId) {
    const old = await admin.auth.admin.getUserById(emp.authUserId);
    console.log("old auth", {
      id: old.data.user?.id,
      email: old.data.user?.email,
      phone: old.data.user?.phone,
      providers: (old.data.user?.identities ?? []).map((i) => i.provider),
    });
  }

  // Remove any Auth users that own this mailbox or the current authUserId.
  const listed = await admin.auth.admin.listUsers({ page: 1, perPage: 200 });
  const toDelete = (listed.data?.users ?? []).filter((u) => {
    const email = (u.email ?? "").toLowerCase();
    return (
      u.id === emp.authUserId ||
      email === authEmail.toLowerCase()
    );
  });
  for (const u of toDelete) {
    const del = await admin.auth.admin.deleteUser(u.id);
    console.log("deleted auth", u.id, u.email, del.error?.message ?? "ok");
  }

  const created = await admin.auth.admin.createUser({
    email: authEmail,
    password: tempPassword,
    email_confirm: true,
    user_metadata: {
      provisioned_by: "repair_email_only",
      username: emp.username,
      employee_phone: emp.phone,
    },
  });
  if (created.error || !created.data.user?.id) {
    throw new Error(created.error?.message ?? "create email-only user failed");
  }

  await prisma.employee.update({
    where: { id: emp.id },
    data: {
      authUserId: created.data.user.id,
      mustResetPassword: true,
      sessionEpoch: 1,
    },
  });

  const verify = await admin.auth.admin.getUserById(created.data.user.id);
  console.log(
    JSON.stringify(
      {
        username: emp.username,
        repaired: true,
        newAuthUserId: created.data.user.id,
        authEmail,
        mustResetPassword: true,
        verify: {
          email: verify.data.user?.email,
          phone: verify.data.user?.phone ?? "",
          providers: (verify.data.user?.identities ?? []).map((i) => i.provider),
        },
        nextStep:
          "Login ด้วย username อย่างเดียว (ไม่ใส่รหัสผ่าน) เพื่อไปตั้งรหัสผ่านใหม่",
      },
      null,
      2,
    ),
  );
}

async function main() {
  const usernames = process.argv.slice(2);
  if (usernames.length === 0) {
    console.error(
      "Usage: npx tsx scripts/repair-username-auth-email-only.ts <username…>",
    );
    process.exit(1);
  }
  for (const username of usernames) {
    await repair(username);
  }
  await prisma.$disconnect();
}

main().catch(async (e) => {
  console.error(e);
  await prisma.$disconnect();
  process.exit(1);
});
