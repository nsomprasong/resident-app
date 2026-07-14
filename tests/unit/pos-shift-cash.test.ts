import assert from "node:assert/strict";
import test from "node:test";

import {
  calculateExpectedCash,
  summarizeShiftPayments,
} from "../../lib/pos/calculations";

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

test("POS shift payment summary groups by method and skips cancelled sales", () => {
  const summary = summarizeShiftPayments([
    {
      status: "COMPLETED",
      netTotal: 100,
      payments: [
        { method: "CASH", amount: 40 },
        { method: "PROMPTPAY", amount: 60 },
      ],
      refunds: [],
    },
    {
      status: "CANCELLED",
      netTotal: 50,
      payments: [{ method: "CASH", amount: 50 }],
      refunds: [],
    },
    {
      status: "COMPLETED",
      netTotal: 80,
      payments: [{ method: "ROOM_CHARGE", amount: 80 }],
      refunds: [],
    },
  ]);

  assert.equal(summary.billCount, 2);
  assert.equal(summary.netSales.toFixed(2), "180.00");
  assert.equal(summary.paymentTotals.CASH.toFixed(2), "40.00");
  assert.equal(summary.paymentTotals.PROMPTPAY.toFixed(2), "60.00");
  assert.equal(summary.paymentTotals.ROOM_CHARGE.toFixed(2), "80.00");
  assert.equal(summary.paymentTotals.TRANSFER.toFixed(2), "0.00");
});
