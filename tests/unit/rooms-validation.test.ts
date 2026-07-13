import assert from "node:assert/strict";
import { describe, it } from "node:test";

import { parseRoomInput } from "@/lib/settings/rooms";

const zoneId = "11111111-1111-4111-8111-111111111111";
const roomTypeId = "22222222-2222-4222-8222-222222222222";

describe("parseRoomInput", () => {
  it("requires fields on create", () => {
    const result = parseRoomInput({}, "create");
    assert.equal(result.ok, false);
  });

  it("accepts valid create payload", () => {
    const result = parseRoomInput(
      {
        number: " 101 ",
        zoneId,
        roomTypeId,
        floor: 2,
        status: "AVAILABLE",
      },
      "create",
    );
    assert.equal(result.ok, true);
    if (result.ok) {
      assert.equal(result.data.number, "101");
      assert.equal(result.data.zoneId, zoneId);
    }
  });

  it("allows status-only update", () => {
    const result = parseRoomInput({ status: "MAINTENANCE" }, "update");
    assert.equal(result.ok, true);
    if (result.ok) {
      assert.equal(result.data.status, "MAINTENANCE");
    }
  });
});
