import assert from "node:assert/strict";
import { describe, it } from "node:test";

import {
  bedLayoutLabel,
  normalizeBedTypeInput,
  resolveBedLayout,
} from "@/lib/settings/bed-types";
import { parseRoomTypeInput } from "@/lib/settings/room-types";

describe("bed layouts", () => {
  it("resolves single double triple and quad labels", () => {
    assert.equal(resolveBedLayout("เตียงเดี่ยว")?.capacity, 1);
    assert.equal(resolveBedLayout("เตียงคู่")?.capacity, 2);
    assert.equal(resolveBedLayout("3 เตียง")?.capacity, 3);
    assert.equal(resolveBedLayout("4 เตียง")?.capacity, 4);
    assert.equal(resolveBedLayout("บ้านรวมพัก")?.capacity, 12);
    assert.equal(resolveBedLayout("dorm")?.code, "DORM");
    assert.equal(resolveBedLayout("คู่")?.code, "DOUBLE");
    assert.equal(bedLayoutLabel("triple"), "3 เตียง");
  });

  it("normalizes aliases to canonical labels", () => {
    assert.equal(normalizeBedTypeInput("เดี่ยว"), "เตียงเดี่ยว");
    assert.equal(normalizeBedTypeInput("4"), "4 เตียง");
    assert.equal(normalizeBedTypeInput("รวมพัก"), "บ้านรวมพัก");
  });
});

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

  it("accepts custom capacity independent of bed layout", () => {
    const result = parseRoomTypeInput(
      {
        name: " Deluxe ",
        description: "วิวดี",
        basePrice: 2500,
        capacity: 5,
        bedType: "3 เตียง",
      },
      "create",
    );
    assert.equal(result.ok, true);
    if (result.ok) {
      assert.equal(result.data.name, "Deluxe");
      assert.equal(result.data.basePrice, 2500);
      assert.equal(result.data.bedType, "3 เตียง");
      assert.equal(result.data.capacity, 5);
    }
  });

  it("defaults capacity from bed layout when omitted on create", () => {
    const result = parseRoomTypeInput(
      {
        name: "Triple",
        basePrice: 1600,
        bedType: "3 เตียง",
      },
      "create",
    );
    assert.equal(result.ok, true);
    if (result.ok) {
      assert.equal(result.data.capacity, 3);
    }
  });
  it("rejects unknown bed types", () => {
    const result = parseRoomTypeInput(
      {
        name: "Odd",
        basePrice: 1000,
        capacity: 2,
        bedType: "เตียงคิงไซส์",
      },
      "create",
    );
    assert.equal(result.ok, false);
    if (!result.ok) {
      assert.ok(result.issues.some((issue) => issue.path === "bedType"));
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
