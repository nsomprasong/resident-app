import assert from "node:assert/strict";
import test from "node:test";

import {
  formatPosSku,
  parsePosSkuNumber,
} from "../../lib/pos/sequences";

test("formats POS SKU as SKU-0001 running number", () => {
  assert.equal(formatPosSku(1), "SKU-0001");
  assert.equal(formatPosSku(12), "SKU-0012");
  assert.equal(formatPosSku(9999), "SKU-9999");
  assert.equal(formatPosSku(10000), "SKU-10000");
});

test("parses POS SKU running number", () => {
  assert.equal(parsePosSkuNumber("SKU-0001"), 1);
  assert.equal(parsePosSkuNumber("sku-0042"), 42);
  assert.equal(parsePosSkuNumber("PROD-0001"), null);
  assert.equal(parsePosSkuNumber("SKU-"), null);
});
