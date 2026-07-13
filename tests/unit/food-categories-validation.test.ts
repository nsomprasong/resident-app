import assert from "node:assert/strict";
import { describe, it } from "node:test";

import { parseFoodCategoryInput } from "@/lib/settings/food-categories";

describe("parseFoodCategoryInput", () => {
  it("requires name", () => {
    const result = parseFoodCategoryInput({});
    assert.equal(result.ok, false);
  });

  it("trims name", () => {
    const result = parseFoodCategoryInput({ name: "  ทอด  " });
    assert.equal(result.ok, true);
    if (result.ok) assert.equal(result.name, "ทอด");
  });
});
