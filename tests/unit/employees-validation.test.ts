import assert from "node:assert/strict";
import { describe, it } from "node:test";

import {
  isValidEmployeeEmail,
  normalizeEmployeeEmail,
  parseEmployeeInput,
} from "@/lib/settings/employees";

describe("parseEmployeeInput", () => {
  it("accepts create with username + phone without password", () => {
    const result = parseEmployeeInput(
      {
        name: "Somchai",
        username: "SomChai.W",
        phone: "0812345678",
        roleId: "00000000-0000-4000-8000-000000000001",
      },
      "create",
    );
    assert.equal(result.ok, true);
    if (result.ok) {
      assert.equal(result.data.username, "somchai.w");
      assert.equal(result.data.phone, "+66812345678");
      assert.equal(result.data.password, undefined);
    }
  });

  it("still accepts create with email for legacy path", () => {
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
      assert.equal(result.data.phone, "+66812345678");
    }
  });

  it("rejects create without identity", () => {
    const result = parseEmployeeInput({ name: "X" }, "create");
    assert.equal(result.ok, false);
    if (!result.ok) {
      assert.ok(result.issues.some((issue) => issue.path === "body"));
    }
  });

  it("allows optional email as contact on phone-auth create", () => {
    const result = parseEmployeeInput(
      {
        name: "Somchai",
        username: "somchai",
        phone: "0812345678",
        email: "a@b.com",
      },
      "create",
    );
    assert.equal(result.ok, true);
    if (result.ok) {
      assert.equal(result.data.email, "a@b.com");
      assert.equal(result.data.username, "somchai");
    }
  });

  it("rejects invalid email on create when provided", () => {
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
