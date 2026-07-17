import assert from "node:assert/strict";
import { describe, it } from "node:test";

import {
  parseFoodSetInput,
  parseTourGroupFoodSetInput,
} from "@/lib/settings/food-sets";

const productA = "11111111-1111-4111-8111-111111111111";
const productB = "22222222-2222-4222-8222-222222222222";

describe("parseFoodSetInput", () => {
  it("requires name and items on create", () => {
    const result = parseFoodSetInput({}, "create");
    assert.equal(result.ok, false);
    if (result.ok) return;
    assert.equal(
      result.issues.some((issue) => issue.path === "name"),
      true,
    );
    assert.equal(
      result.issues.some((issue) => issue.path === "items"),
      true,
    );
  });

  it("accepts a valid set", () => {
    const result = parseFoodSetInput(
      {
        name: "Set 1",
        description: "กรุ๊ปเช้า",
        items: [
          { productId: productA, quantity: 2 },
          { productId: productB, quantity: 1 },
        ],
      },
      "create",
    );
    assert.equal(result.ok, true);
    if (!result.ok) return;
    assert.equal(result.data.name, "Set 1");
    assert.equal(result.data.items?.length, 2);
  });

  it("rejects duplicate products", () => {
    const result = parseFoodSetInput(
      {
        name: "Set 1",
        items: [
          { productId: productA, quantity: 1 },
          { productId: productA, quantity: 2 },
        ],
      },
      "create",
    );
    assert.equal(result.ok, false);
  });
});

describe("parseTourGroupFoodSetInput", () => {
  it("requires isExtra on items", () => {
    const result = parseTourGroupFoodSetInput({
      name: "ชุดกรุ๊ป ก",
      items: [{ productId: productA, quantity: 1 }],
    });
    assert.equal(result.ok, false);
  });

  it("accepts per-group customization", () => {
    const result = parseTourGroupFoodSetInput({
      name: "ชุดกรุ๊ป ก",
      sourceFoodSetId: productA,
      items: [
        { productId: productA, quantity: 3, isExtra: false },
        { productId: productB, quantity: 1, isExtra: true },
      ],
    });
    assert.equal(result.ok, true);
    if (!result.ok) return;
    assert.equal(result.data.sourceFoodSetId, productA);
    assert.equal(result.data.items[1]?.isExtra, true);
  });
});
