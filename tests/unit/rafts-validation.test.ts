import assert from "node:assert/strict";
import { describe, it } from "node:test";

import { parseRaftInput } from "@/lib/settings/rafts";

describe("parseRaftInput", () => {
  it("requires fields on create", () => {
    const result = parseRaftInput({}, "create");
    assert.equal(result.ok, false);
  });

  it("accepts valid create payload", () => {
    const result = parseRaftInput(
      {
        number: " R-01 ",
        name: "แพใหญ่",
        capacity: 12,
        basePrice: 1500,
        status: "AVAILABLE",
      },
      "create",
    );
    assert.equal(result.ok, true);
    if (result.ok) {
      assert.equal(result.data.number, "R-01");
      assert.equal(result.data.name, "แพใหญ่");
    }
  });

  it("allows status-only update", () => {
    const result = parseRaftInput({ status: "MAINTENANCE" }, "update");
    assert.equal(result.ok, true);
  });
});
