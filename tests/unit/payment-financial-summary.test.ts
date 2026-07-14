import assert from "node:assert/strict";
import test from "node:test";

import { calculateBookingFinancialSummary } from "../../lib/payments/financial-summary";

test("financial summary separates gross paid, refunds, net paid, and outstanding", () => {
  const summary = calculateBookingFinancialSummary({
    charges: [{ amount: "1000.00" }, { amount: 500 }],
    orders: [
      {
        items: [
          { unitPrice: "120.00", quantity: 2, isExtra: true },
          { unitPrice: "90.00", quantity: 1, isExtra: false },
        ],
      },
    ],
    payments: [
      { amount: "800.00", status: "PAID" },
      { amount: "200.00", status: "REFUNDED" },
      { amount: "300.00", status: "PENDING" },
    ],
  });

  assert.deepEqual(summary, {
    chargeTotal: 1500,
    extraOrderTotal: 240,
    paidTotal: 800,
    refundedTotal: 200,
    pendingTotal: 0,
    netPaidTotal: 600,
    grandTotal: 1740,
    outstandingTotal: 1140,
    refundableTotal: 600,
  });
});

test("financial summary counts VERIFIED and pending PromptPay statuses", () => {
  const summary = calculateBookingFinancialSummary({
    charges: [{ amount: 1000 }],
    orders: [],
    payments: [
      { amount: 400, status: "VERIFIED" },
      { amount: 100, status: "PENDING_VERIFICATION" },
      { amount: 50, status: "AWAITING_PAYMENT" },
    ],
    paymentRefunds: [{ amount: 50 }],
  });

  assert.equal(summary.paidTotal, 400);
  assert.equal(summary.pendingTotal, 150);
  assert.equal(summary.refundedTotal, 50);
  assert.equal(summary.netPaidTotal, 350);
  assert.equal(summary.outstandingTotal, 650);
});

test("financial summary reports zero outstanding only when net paid covers grand total", () => {
  const unpaid = calculateBookingFinancialSummary({
    charges: [{ amount: 1000 }],
    orders: [],
    payments: [{ amount: 999, status: "PAID" }],
  });
  const fullyPaid = calculateBookingFinancialSummary({
    charges: [{ amount: 1000 }],
    orders: [],
    payments: [{ amount: 1000, status: "PAID" }],
  });

  assert.equal(unpaid.outstandingTotal, 1);
  assert.equal(fullyPaid.outstandingTotal, 0);
});
