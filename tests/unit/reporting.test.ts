import assert from "node:assert/strict";
import test from "node:test";

import {
  endOfUtcMonth,
  formatReportDate,
  startOfUtcMonth,
  toCsv,
} from "../../lib/reports/reporting";

test("report date helpers return UTC month boundaries", () => {
  const date = new Date("2026-07-12T12:34:56.000Z");

  assert.equal(formatReportDate(startOfUtcMonth(date)), "2026-07-01");
  assert.equal(formatReportDate(endOfUtcMonth(date)), "2026-08-01");
});

test("CSV export escapes commas, quotes, and newlines", () => {
  const csv = toCsv(
    ["reference", "customer", "amount"],
    [
      { reference: "B-1", customer: "Acme, Inc.", amount: 100 },
      { reference: "B-2", customer: 'Guest "VIP"', amount: -50 },
    ],
  );

  assert.equal(
    csv,
    'reference,customer,amount\r\nB-1,"Acme, Inc.",100\r\nB-2,"Guest ""VIP""",-50',
  );
});
