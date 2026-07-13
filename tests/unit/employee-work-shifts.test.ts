import assert from "node:assert/strict";
import test from "node:test";

import {
  calculateEstimatedWage,
  calculateShiftHours,
  calculateTotalShiftHours,
} from "../../lib/employees/work-shifts";

test("calculates shift hours rounded to two decimals", () => {
  assert.equal(
    calculateShiftHours({
      startsAt: new Date("2026-07-12T01:00:00.000Z"),
      endsAt: new Date("2026-07-12T09:30:00.000Z"),
    }),
    8.5,
  );
});

test("ignores invalid negative shift durations", () => {
  assert.equal(
    calculateShiftHours({
      startsAt: new Date("2026-07-12T09:00:00.000Z"),
      endsAt: new Date("2026-07-12T08:00:00.000Z"),
    }),
    0,
  );
});

test("calculates total hours and estimated wages from hourly rates", () => {
  const shifts = [
    {
      startsAt: new Date("2026-07-12T01:00:00.000Z"),
      endsAt: new Date("2026-07-12T05:00:00.000Z"),
      hourlyRate: "100.00",
    },
    {
      startsAt: new Date("2026-07-13T01:00:00.000Z"),
      endsAt: new Date("2026-07-13T04:30:00.000Z"),
      hourlyRate: 120,
    },
  ];

  assert.equal(calculateTotalShiftHours(shifts), 7.5);
  assert.equal(calculateEstimatedWage(shifts), 820);
});

test("estimated wage skips shifts without hourly rate", () => {
  assert.equal(
    calculateEstimatedWage([
      {
        startsAt: new Date("2026-07-12T01:00:00.000Z"),
        endsAt: new Date("2026-07-12T05:00:00.000Z"),
        hourlyRate: null,
      },
    ]),
    0,
  );
});
