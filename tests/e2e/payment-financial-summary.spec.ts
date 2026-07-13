import { expect, test } from "@playwright/test";

import { calculateBookingFinancialSummary } from "../../lib/payments/financial-summary";

test("booking financial summary separates gross paid, refunds, net paid, and outstanding", () => {
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

  expect(summary).toEqual({
    chargeTotal: 1500,
    extraOrderTotal: 240,
    paidTotal: 800,
    refundedTotal: 200,
    netPaidTotal: 600,
    grandTotal: 1740,
    outstandingTotal: 1140,
    refundableTotal: 600,
  });
});

test("booking financial summary reports zero outstanding only when net paid covers grand total", () => {
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

  expect(unpaid.outstandingTotal).toBe(1);
  expect(fullyPaid.outstandingTotal).toBe(0);
});
