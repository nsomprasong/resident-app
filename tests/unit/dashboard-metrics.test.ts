import assert from "node:assert/strict";
import test from "node:test";

import { calculateNetRevenue, calculateRate } from "../../lib/dashboard/metrics";

test("dashboard rate calculation handles empty totals and rounds percentages", () => {
  assert.equal(calculateRate(0, 0), 0);
  assert.equal(calculateRate(1, 3), 33);
  assert.equal(calculateRate(2, 3), 67);
});

test("dashboard net revenue adds paid payments and subtracts refunds", () => {
  assert.equal(
    calculateNetRevenue([
      { amount: "1000.00", status: "PAID" },
      { amount: 250, status: "REFUNDED" },
      { amount: 999, status: "PENDING" },
    ]),
    750,
  );
});
