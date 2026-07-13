import assert from "node:assert/strict";
import { describe, it } from "node:test";

import { parseRoomTypeInput } from "@/lib/settings/room-types";

describe("parseRoomTypeInput", () => {
  it("requires core fields on create", () => {
    const result = parseRoomTypeInput({}, "create");
    assert.equal(result.ok, false);
    if (!result.ok) {
      assert.ok(result.issues.some((issue) => issue.path === "name"));
      assert.ok(result.issues.some((issue) => issue.path === "basePrice"));
      assert.ok(result.issues.some((issue) => issue.path === "capacity"));
    }
  });

  it("accepts valid create payload", () => {
    const result = parseRoomTypeInput(
      {
        name: " Deluxe ",
        description: "วิวดี",
        basePrice: 2500,
        capacity: 3,
        bedType: "คู่",
      },
      "create",
    );
    assert.equal(result.ok, true);
    if (result.ok) {
      assert.equal(result.data.name, "Deluxe");
      assert.equal(result.data.basePrice, 2500);
      assert.equal(result.data.capacity, 3);
    }
  });

  it("rejects duplicate-name guard fields on update when empty body", () => {
    const result = parseRoomTypeInput({}, "update");
    assert.equal(result.ok, false);
  });

  it("allows isActive-only update", () => {
    const result = parseRoomTypeInput({ isActive: false }, "update");
    assert.equal(result.ok, true);
    if (result.ok) {
      assert.equal(result.data.isActive, false);
    }
  });
});
