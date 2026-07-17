import assert from "node:assert/strict";
import { describe, it } from "node:test";

import {
  hasAllowedMenus,
  listAllowedMenuPaths,
} from "@/lib/auth/allowed-menus";
import { canUseGeolocation, safeMatchMedia } from "@/lib/browser/safe-apis";

describe("allowed menus after login", () => {
  it("ADMIN and non-admin roles with real permission sets have menus", () => {
    assert.equal(hasAllowedMenus(["authorization.manage", "booking.read"]), true);
    assert.equal(hasAllowedMenus(["booking.read", "ops.read", "settings.manage"]), true);
    assert.equal(hasAllowedMenus(["hr.attendance.self", "pos.view"]), true);
    assert.equal(hasAllowedMenus(["pos.view"]), true);
    assert.equal(hasAllowedMenus([]), false);
    assert.equal(hasAllowedMenus(null), false);
  });

  it("listAllowedMenuPaths never throws on null permissions", () => {
    assert.deepEqual(listAllowedMenuPaths(undefined), []);
    assert.ok(listAllowedMenuPaths(["booking.read"]).includes("/booking"));
  });
});

describe("safe browser APIs", () => {
  it("does not throw when window APIs are absent (node test env)", () => {
    assert.equal(canUseGeolocation(), false);
    assert.equal(safeMatchMedia("(max-width: 768px)"), null);
  });
});
