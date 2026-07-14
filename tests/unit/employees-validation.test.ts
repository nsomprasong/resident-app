import assert from "node:assert/strict";
import { describe, it } from "node:test";

import {
  isValidEmployeeEmail,
  normalizeEmployeeEmail,
  parseEmployeeInput,
} from "@/lib/settings/employees";

describe("parseEmployeeInput", () => {
  it("requires name and email on create", () => {
    const result = parseEmployeeInput({}, "create");
    assert.equal(result.ok, false);
    if (!result.ok) {
      assert.ok(result.issues.some((issue) => issue.path === "name"));
      assert.ok(result.issues.some((issue) => issue.path === "email"));
    }
  });

  it("accepts create with email for auth linking", () => {
    const result = parseEmployeeInput(
      {
        name: "  Alice ",
        email: "  Alice@Example.com ",
        phone: " 0812345678 ",
        roleId: "00000000-0000-4000-8000-000000000001",
      },
      "create",
    );
    assert.equal(result.ok, true);
    if (result.ok) {
      assert.equal(result.data.name, "Alice");
      assert.equal(result.data.email, "alice@example.com");
      assert.equal(result.data.phone, "0812345678");
      assert.equal(result.data.roleId, "00000000-0000-4000-8000-000000000001");
    }
  });

  it("rejects invalid email on create", () => {
    const result = parseEmployeeInput(
      { name: "Alice", email: "not-an-email" },
      "create",
    );
    assert.equal(result.ok, false);
    if (!result.ok) {
      assert.ok(result.issues.some((issue) => issue.path === "email"));
    }
  });

  it("rejects client authUserId and clears roleId with empty string", () => {
    const rejected = parseEmployeeInput({ authUserId: "" }, "update");
    assert.equal(rejected.ok, false);
    if (!rejected.ok) {
      assert.ok(rejected.issues.some((issue) => issue.path === "authUserId"));
    }

    const result = parseEmployeeInput({ roleId: "" }, "update");
    assert.equal(result.ok, true);
    if (result.ok) {
      assert.equal(result.data.roleId, null);
    }
  });

  it("allows isActive-only update", () => {
    const result = parseEmployeeInput({ isActive: false }, "update");
    assert.equal(result.ok, true);
    if (result.ok) {
      assert.equal(result.data.isActive, false);
    }
  });
});

describe("employee email helpers", () => {
  it("normalizes and validates emails", () => {
    assert.equal(normalizeEmployeeEmail("  A@B.Com "), "a@b.com");
    assert.equal(isValidEmployeeEmail("a@b.com"), true);
    assert.equal(isValidEmployeeEmail("bad"), false);
  });
});
