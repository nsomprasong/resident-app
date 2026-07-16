import assert from "node:assert/strict";
import { describe, it } from "node:test";

import { resolveTimePeriodFromList } from "@/lib/hr/shift-time-period-resolve";

describe("resolveTimePeriodFromList", () => {
  const periods = [
    {
      effectiveFrom: new Date(Date.UTC(1970, 0, 1)),
      startMinutes: 480,
      endMinutes: 1020,
      breakMinutes: 60,
      lateGraceMinutes: 0,
      earlyLeaveGraceMinutes: 0,
    },
    {
      effectiveFrom: new Date(Date.UTC(2026, 6, 16)),
      startMinutes: 480,
      endMinutes: 900,
      breakMinutes: 60,
      lateGraceMinutes: 0,
      earlyLeaveGraceMinutes: 0,
    },
  ];

  it("keeps historical times before an effective change", () => {
    const resolved = resolveTimePeriodFromList(
      periods,
      new Date(Date.UTC(2026, 6, 15)),
    );
    assert.equal(resolved?.endMinutes, 1020);
  });

  it("applies the new period on/after effectiveFrom", () => {
    const resolved = resolveTimePeriodFromList(
      periods,
      new Date(Date.UTC(2026, 6, 16)),
    );
    assert.equal(resolved?.endMinutes, 900);
  });
});
