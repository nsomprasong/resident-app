import assert from "node:assert/strict";
import { describe, it } from "node:test";

import {
  isValidRoleCode,
  normalizeRoleCode,
  parseRoleInput,
} from "@/lib/settings/roles";

describe("parseRoleInput", () => {
  it("requires code and displayName on create", () => {
    const result = parseRoleInput({}, "create");
    assert.equal(result.ok, false);
    if (!result.ok) {
      assert.ok(result.issues.some((issue) => issue.path === "code"));
      assert.ok(result.issues.some((issue) => issue.path === "displayName"));
    }
  });

  it("normalizes and accepts valid create payload", () => {
    const result = parseRoleInput(
      { code: " supervisor ", displayName: " หัวหน้างาน " },
      "create",
    );
    assert.equal(result.ok, true);
    if (result.ok) {
      assert.equal(result.data.code, "SUPERVISOR");
      assert.equal(result.data.displayName, "หัวหน้างาน");
    }
  });

  it("rejects invalid role codes", () => {
    const result = parseRoleInput(
      { code: "1BAD", displayName: "Bad" },
      "create",
    );
    assert.equal(result.ok, false);
    if (!result.ok) {
      assert.ok(result.issues.some((issue) => issue.path === "code"));
    }
  });

  it("rejects code changes on update", () => {
    const result = parseRoleInput(
      { code: "OTHER", displayName: "อื่น" },
      "update",
    );
    assert.equal(result.ok, false);
    if (!result.ok) {
      assert.ok(result.issues.some((issue) => issue.path === "code"));
    }
  });

  it("allows isActive-only update", () => {
    const result = parseRoleInput({ isActive: false }, "update");
    assert.equal(result.ok, true);
    if (result.ok) {
      assert.equal(result.data.isActive, false);
    }
  });
});

describe("role code helpers", () => {
  it("normalizes and validates codes", () => {
    assert.equal(normalizeRoleCode(" admin "), "ADMIN");
    assert.equal(isValidRoleCode("ADMIN"), true);
    assert.equal(isValidRoleCode("ROLE_2"), true);
    assert.equal(isValidRoleCode("bad-code"), false);
  });
});
