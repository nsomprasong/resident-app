import assert from "node:assert/strict";
import { describe, it } from "node:test";

import {
  accessDenialMessage,
  isAccessDenialCode,
} from "@/lib/auth/access-denial";
import {
  canAccessPage,
  canAccessPageWithPermissions,
  hasPermission,
  resolveRole,
  roles,
  type Role,
} from "@/lib/auth/authorization";
import { filterHrNavItems, filterSelfNavItems } from "@/lib/hr/nav";

describe("auth access denial helpers", () => {
  it("recognizes denial codes and returns Thai messages", () => {
    assert.equal(isAccessDenialCode("EMPLOYEE_NOT_FOUND"), true);
    assert.equal(isAccessDenialCode("ROLE_NOT_ASSIGNED"), true);
    assert.equal(isAccessDenialCode("ROLE_INACTIVE"), true);
    assert.equal(isAccessDenialCode("PERMISSIONS_EMPTY"), true);
    assert.equal(isAccessDenialCode("EMPLOYEE_NOT_LINKED"), false);
    assert.match(accessDenialMessage("ROLE_NOT_ASSIGNED"), /บทบาท/);
    assert.match(accessDenialMessage("PERMISSIONS_EMPTY"), /สิทธิ์/);
  });
});

describe("role matrix covers ADMIN and every non-admin role", () => {
  it("resolves every hardcoded role without falling back to ADMIN", () => {
    for (const role of roles) {
      assert.equal(resolveRole(role), role);
    }
    assert.equal(resolveRole("OWNER"), "OWNER");
    assert.equal(resolveRole("SUPERMARKET"), "SUPERMARKET");
    assert.notEqual(resolveRole("OWNER"), "ADMIN");
    assert.notEqual(resolveRole("MANAGER"), "ADMIN");
    assert.notEqual(resolveRole("SUPERMARKET"), "ADMIN");
  });

  it("hasPermission never throws for known or unknown role values", () => {
    for (const role of roles) {
      assert.equal(typeof hasPermission(role, "booking.read"), "boolean");
    }
    assert.equal(
      hasPermission("NOT_A_ROLE" as Role, "booking.read"),
      false,
    );
  });

  it("OWNER and SUPERMARKET can access expected pages via role matrix", () => {
    assert.equal(canAccessPage("ADMIN", "/"), true);
    assert.equal(canAccessPage("OWNER", "/"), true);
    assert.equal(canAccessPage("OWNER", "/booking"), true);
    assert.equal(canAccessPage("OWNER", "/settings"), true);
    assert.equal(canAccessPage("OWNER", "/system/data-reset"), false);
    assert.equal(canAccessPage("SUPERMARKET", "/"), true);
    assert.equal(canAccessPage("SUPERMARKET", "/pos"), true);
    assert.equal(canAccessPage("SUPERMARKET", "/booking"), false);
    assert.equal(canAccessPage("MANAGER", "/hr"), true);
    assert.equal(canAccessPage("RECEPTION", "/booking"), true);
    assert.equal(canAccessPage("HOUSEKEEPING", "/houseKeeperMinibar"), true);
    assert.equal(canAccessPage("KITCHEN", "/kitchen"), true);
    assert.equal(canAccessPage("ACCOUNTING", "/dashboard"), true);
  });

  it("null/undefined permissions never throw in menu/page filters", () => {
    assert.deepEqual(filterHrNavItems(null), []);
    assert.deepEqual(filterSelfNavItems(undefined), []);
    assert.equal(canAccessPageWithPermissions(null, "/"), true);
    assert.equal(canAccessPageWithPermissions([], "/booking"), false);
    assert.equal(
      canAccessPageWithPermissions(["booking.read"], "/booking"),
      true,
    );
  });
});
