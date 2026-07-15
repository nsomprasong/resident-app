import assert from "node:assert/strict";
import { describe, it } from "node:test";

import {
  GENERIC_LOGIN_ERROR,
  isValidUsername,
  looksLikeEmail,
  looksLikePhone,
  normalizeThaiPhone,
  normalizeUsername,
  resolveLoginIdentifier,
} from "@/lib/auth/login-identifier";

describe("login-identifier helpers", () => {
  it("detects email", () => {
    assert.equal(looksLikeEmail("a@b.com"), true);
    assert.equal(looksLikeEmail("staff"), false);
  });

  it("detects and normalizes thai phones", () => {
    assert.equal(looksLikePhone("0812345678"), true);
    assert.equal(looksLikePhone("+66812345678"), true);
    assert.equal(normalizeThaiPhone("0812345678"), "+66812345678");
    assert.equal(normalizeThaiPhone("66812345678"), "+66812345678");
    assert.equal(normalizeThaiPhone("bad"), null);
  });

  it("normalizes usernames", () => {
    assert.equal(normalizeUsername("  SomChai "), "somchai");
    assert.equal(isValidUsername("ab"), false);
    assert.equal(isValidUsername("somchai.w"), true);
  });

  it("resolves identifier kinds", () => {
    const email = resolveLoginIdentifier("User@Example.com");
    assert.equal(email.ok, true);
    if (email.ok) {
      assert.equal(email.kind, "email");
      assert.equal(email.email, "user@example.com");
    }

    const phone = resolveLoginIdentifier("0812345678");
    assert.equal(phone.ok, true);
    if (phone.ok) assert.equal(phone.kind, "phone");

    const username = resolveLoginIdentifier("somchai.w");
    assert.equal(username.ok, true);
    if (username.ok) assert.equal(username.kind, "username");
  });

  it("exposes a generic login error constant", () => {
    assert.match(GENERIC_LOGIN_ERROR, /รหัสผ่านไม่ถูกต้อง/);
  });
});
