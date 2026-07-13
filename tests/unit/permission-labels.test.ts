import assert from "node:assert/strict";
import { describe, it } from "node:test";

import { permissions } from "@/lib/auth/authorization";
import {
  assertAllPermissionsHaveThaiLabels,
  permissionThaiLabels,
  resolvePermissionThaiLabel,
} from "@/lib/auth/permission-labels";

describe("permissionThaiLabels", () => {
  it("covers every approved permission code", () => {
    assert.equal(assertAllPermissionsHaveThaiLabels(), true);
    assert.equal(Object.keys(permissionThaiLabels).length, permissions.length);
  });

  it("resolves Thai labels without changing codes", () => {
    assert.equal(resolvePermissionThaiLabel("booking.read"), "ดูการจอง");
    assert.equal(
      resolvePermissionThaiLabel("authorization.manage"),
      "จัดการบทบาทและสิทธิ์",
    );
    assert.equal(resolvePermissionThaiLabel("unknown.permission"), null);
  });

  it("keeps label map keys identical to permission codes", () => {
    for (const code of permissions) {
      assert.equal(code in permissionThaiLabels, true);
      assert.ok(permissionThaiLabels[code].length > 0);
    }
  });
});
