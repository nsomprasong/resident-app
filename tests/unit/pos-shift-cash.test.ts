import assert from "node:assert/strict";
import test from "node:test";

import { calculateExpectedCash } from "../../lib/pos/calculations";

test("POS expected cash includes sales and cash movements", () => {
  const expected = calculateExpectedCash({
    openingFloat: 100,
    cashSales: [250.5, 10],
    cashIns: [20],
    cashOuts: [15],
    cashRefunds: [5.5],
  });
  assert.equal(expected.toFixed(2), "360.00");
});
