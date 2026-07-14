import assert from "node:assert/strict";
import test from "node:test";

import { summarizeCashVariances } from "../../lib/pos/calculations";

test("POS cash variance report totals over and short separately", () => {
  const summary = summarizeCashVariances([
    { cashVariance: 50 },
    { cashVariance: -20 },
    { cashVariance: -10 },
    { cashVariance: 0 },
  ]);

  assert.equal(summary.shiftCount, 4);
  assert.equal(summary.cashOver.toFixed(2), "50.00");
  assert.equal(summary.cashShort.toFixed(2), "30.00");
  assert.equal(summary.cashVarianceNet.toFixed(2), "20.00");
});
