import assert from "node:assert/strict";
import test from "node:test";

import {
  canActorAccessSupportEmployee,
  canActorManageSystemAdminRole,
  getProtectedSupportEmails,
  isProtectedSupportEmail,
  protectedSupportEmployeeListFilter,
  systemAdminRoleListFilter,
} from "@/lib/auth/support-account";

test("protects configured support emails case-insensitively", () => {
  process.env.SUPPORT_ACCOUNT_EMAILS = "Support@Example.com, other@test.com";
  assert.deepEqual(getProtectedSupportEmails(), [
    "support@example.com",
    "other@test.com",
  ]);
  assert.equal(isProtectedSupportEmail("SUPPORT@example.com"), true);
  assert.equal(isProtectedSupportEmail("nobody@example.com"), false);
});

test("only the support actor can access a support employee", () => {
  process.env.SUPPORT_ACCOUNT_EMAILS = "nsomprasong@gmail.com";
  assert.equal(
    canActorAccessSupportEmployee("admin@x.com", "nsomprasong@gmail.com"),
    false,
  );
  assert.equal(
    canActorAccessSupportEmployee(
      "nsomprasong@gmail.com",
      "nsomprasong@gmail.com",
    ),
    true,
  );
  assert.equal(
    canActorAccessSupportEmployee("admin@x.com", "staff@x.com"),
    true,
  );
});

test("list filter hides support from others but not from support actor", () => {
  process.env.SUPPORT_ACCOUNT_EMAILS = "nsomprasong@gmail.com";

  const hiddenFromOthers = protectedSupportEmployeeListFilter("manager@x.com");
  assert.ok(Array.isArray(hiddenFromOthers.OR));
  assert.equal(hiddenFromOthers.OR.length, 2);

  const visibleToSelf = protectedSupportEmployeeListFilter(
    "nsomprasong@gmail.com",
  );
  assert.equal(visibleToSelf.OR, undefined);
});

test("system admin role is hidden from non-support actors", () => {
  process.env.SUPPORT_ACCOUNT_EMAILS = "nsomprasong@gmail.com";
  assert.equal(canActorManageSystemAdminRole("manager@x.com"), false);
  assert.equal(canActorManageSystemAdminRole("nsomprasong@gmail.com"), true);
  assert.deepEqual(systemAdminRoleListFilter("manager@x.com"), {
    NOT: { code: "ADMIN" },
  });
  assert.deepEqual(systemAdminRoleListFilter("nsomprasong@gmail.com"), {});
});
