import assert from "node:assert/strict";
import { describe, it } from "node:test";

import { parseProductTypeInput } from "@/lib/settings/product-types";

describe("parseProductTypeInput", () => {
  it("requires name", () => {
    const result = parseProductTypeInput({});
    assert.equal(result.ok, false);
  });

  it("trims name", () => {
    const result = parseProductTypeInput({ name: "  เสื้อผ้า  " });
    assert.equal(result.ok, true);
    if (result.ok) assert.equal(result.name, "เสื้อผ้า");
  });
});
