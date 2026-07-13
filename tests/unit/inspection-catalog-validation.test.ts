import assert from "node:assert/strict";
import { describe, it } from "node:test";

import { parseInspectionCatalogInput } from "@/lib/settings/inspection-catalog";

describe("parseInspectionCatalogInput", () => {
  it("requires fields on create", () => {
    const result = parseInspectionCatalogInput({}, "create");
    assert.equal(result.ok, false);
  });

  it("accepts valid create payload", () => {
    const result = parseInspectionCatalogInput(
      {
        name: " ขวดน้ำ ",
        type: "MINIBAR",
        unitPrice: 40,
      },
      "create",
    );
    assert.equal(result.ok, true);
    if (result.ok) {
      assert.equal(result.data.name, "ขวดน้ำ");
      assert.equal(result.data.type, "MINIBAR");
      assert.equal(result.data.unitPrice, 40);
    }
  });

  it("allows isActive-only update", () => {
    const result = parseInspectionCatalogInput({ isActive: false }, "update");
    assert.equal(result.ok, true);
  });
});
