import assert from "node:assert/strict";
import { describe, it } from "node:test";

import { parseZoneInput } from "@/lib/settings/zones";

describe("parseZoneInput", () => {
  it("requires name on create", () => {
    const result = parseZoneInput({}, "create");
    assert.equal(result.ok, false);
    if (!result.ok) {
      assert.ok(result.issues.some((issue) => issue.path === "name"));
    }
  });

  it("accepts valid create payload", () => {
    const result = parseZoneInput({ name: "  Building A " }, "create");
    assert.equal(result.ok, true);
    if (result.ok) {
      assert.equal(result.data.name, "Building A");
    }
  });

  it("allows isActive-only update", () => {
    const result = parseZoneInput({ isActive: false }, "update");
    assert.equal(result.ok, true);
    if (result.ok) {
      assert.equal(result.data.isActive, false);
    }
  });
});
