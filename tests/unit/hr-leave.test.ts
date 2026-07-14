import assert from "node:assert/strict";
import { describe, it } from "node:test";

import {
  availableLeaveDays,
  computeLeaveDaysRequested,
  eachDateKeyInclusive,
  rangesOverlapInclusive,
} from "@/lib/hr/leave";

describe("hr leave", () => {
  it("computes full-day and half-day requests", () => {
    assert.equal(
      computeLeaveDaysRequested({
        startDate: new Date("2026-07-13T00:00:00.000Z"),
        endDate: new Date("2026-07-15T00:00:00.000Z"),
        duration: "FULL_DAY",
      }),
      3,
    );
    assert.equal(
      computeLeaveDaysRequested({
        startDate: new Date("2026-07-13T00:00:00.000Z"),
        endDate: new Date("2026-07-13T00:00:00.000Z"),
        duration: "HALF_DAY_AM",
      }),
      0.5,
    );
  });

  it("rejects half-day spanning multiple dates", () => {
    assert.throws(() =>
      computeLeaveDaysRequested({
        startDate: new Date("2026-07-13T00:00:00.000Z"),
        endDate: new Date("2026-07-14T00:00:00.000Z"),
        duration: "HALF_DAY_PM",
      }),
    );
  });

  it("tracks available balance and overlaps", () => {
    assert.equal(
      availableLeaveDays({ entitled: 6, used: 2, pending: 1 }),
      3,
    );
    assert.equal(
      rangesOverlapInclusive(
        new Date("2026-07-13T00:00:00.000Z"),
        new Date("2026-07-15T00:00:00.000Z"),
        new Date("2026-07-15T00:00:00.000Z"),
        new Date("2026-07-16T00:00:00.000Z"),
      ),
      true,
    );
    assert.deepEqual(eachDateKeyInclusive("2026-07-13", "2026-07-14"), [
      "2026-07-13",
      "2026-07-14",
    ]);
  });
});
