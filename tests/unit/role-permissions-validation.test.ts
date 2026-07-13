import assert from "node:assert/strict";
import { describe, it } from "node:test";

import { parseRolePermissionInput } from "@/lib/settings/role-permissions";

describe("parseRolePermissionInput", () => {
  it("requires permissionCodes array", () => {
    const result = parseRolePermissionInput({});
    assert.equal(result.ok, false);
    if (!result.ok) {
      assert.ok(
        result.issues.some((issue) => issue.path === "permissionCodes"),
      );
    }
  });

  it("dedupes and trims codes", () => {
    const result = parseRolePermissionInput({
      permissionCodes: [" booking.read ", "booking.write", "booking.read"],
    });
    assert.equal(result.ok, true);
    if (result.ok) {
      assert.deepEqual(result.data.permissionCodes, [
        "booking.read",
        "booking.write",
      ]);
    }
  });

  it("rejects non-string entries", () => {
    const result = parseRolePermissionInput({
      permissionCodes: ["booking.read", 1],
    });
    assert.equal(result.ok, false);
    if (!result.ok) {
      assert.ok(
        result.issues.some((issue) => issue.path === "permissionCodes[1]"),
      );
    }
  });

  it("allows empty permission list", () => {
    const result = parseRolePermissionInput({ permissionCodes: [] });
    assert.equal(result.ok, true);
    if (result.ok) {
      assert.deepEqual(result.data.permissionCodes, []);
    }
  });
});
