import assert from "node:assert/strict";
import { describe, it } from "node:test";

import { parseProductInput } from "@/lib/settings/products";

const typeId = "11111111-1111-4111-8111-111111111111";
const categoryId = "22222222-2222-4222-8222-222222222222";

describe("parseProductInput", () => {
  it("requires fields on create", () => {
    const result = parseProductInput({}, "create");
    assert.equal(result.ok, false);
  });

  it("accepts valid create payload", () => {
    const result = parseProductInput(
      {
        name: " ข้าวผัด ",
        price: 80,
        typeId,
        categoryId,
        isMinibar: false,
      },
      "create",
    );
    assert.equal(result.ok, true);
    if (result.ok) {
      assert.equal(result.data.name, "ข้าวผัด");
      assert.equal(result.data.typeId, typeId);
      assert.equal(result.data.isMinibar, false);
    }
  });

  it("defaults isMinibar false on create", () => {
    const result = parseProductInput(
      {
        name: "น้ำเปล่า",
        price: 20,
        typeId,
      },
      "create",
    );
    assert.equal(result.ok, true);
    if (result.ok) assert.equal(result.data.isMinibar, false);
  });

  it("allows isActive-only update", () => {
    const result = parseProductInput({ isActive: false }, "update");
    assert.equal(result.ok, true);
  });
});
