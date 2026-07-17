import assert from "node:assert/strict";
import { describe, it } from "node:test";

import { resolveApiPermission } from "@/lib/auth/authorization";

describe("guest search API permission", () => {
  it("requires booking.read", () => {
    assert.equal(resolveApiPermission("GET", "/api/guests"), "booking.read");
  });
});
