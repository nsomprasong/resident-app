import assert from "node:assert/strict";
import test from "node:test";

import { calculateSaleTotals } from "../../lib/pos/calculations";

test("POS sale totals apply item and bill discounts exactly", () => {
  const result = calculateSaleTotals([
    { quantity: 2, unitPrice: 19.5, discount: 1 },
    { quantity: 1, unitPrice: 10, discount: 0 },
  ], 2);
  assert.equal(result.subtotal.toFixed(2), "49.00");
  assert.equal(result.itemDiscountTotal.toFixed(2), "1.00");
  assert.equal(result.netTotal.toFixed(2), "46.00");
});
