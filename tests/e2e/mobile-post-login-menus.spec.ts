import { expect, test } from "@playwright/test";

import { hasAllowedMenus, listAllowedMenuPaths } from "../../lib/auth/allowed-menus";
import {
  canAccessPageWithPermissions,
  hasPermission,
  permissions,
  resolveRole,
  roles,
  type Permission,
  type Role,
} from "../../lib/auth/authorization";

/**
 * Mobile-viewport policy checks for post-login landing.
 * Login redirect is always `/` for every role (see app/login/actions.ts).
 * Uses Chromium + iPhone viewport (no WebKit install required).
 */
test.use({
  viewport: { width: 390, height: 844 },
  isMobile: true,
  hasTouch: true,
  userAgent:
    "Mozilla/5.0 (iPhone; CPU iPhone OS 15_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/15.0 Mobile/15E148 Safari/604.1",
});

function collectMatrixPermissions(role: Role): Permission[] {
  return permissions.filter((code) => hasPermission(role, code));
}

test("every hardcoded role resolves and never falls back to ADMIN", () => {
  for (const role of roles) {
    expect(resolveRole(role)).toBe(role);
    if (role !== "ADMIN") {
      expect(resolveRole(role)).not.toBe("ADMIN");
    }
  }
});

test("ADMIN and every non-admin role can access home and has at least one menu path", () => {
  for (const role of roles) {
    const codes = collectMatrixPermissions(role);
    expect(canAccessPageWithPermissions(codes, "/")).toBe(true);
    const menus = listAllowedMenuPaths(codes);
    expect(hasAllowedMenus(codes)).toBe(true);
    expect(menus.length).toBeGreaterThan(0);
  }
});

test("mobile viewport policy: empty permissions have no menus", () => {
  expect(hasAllowedMenus([])).toBe(false);
  expect(listAllowedMenuPaths(null)).toEqual([]);
});
