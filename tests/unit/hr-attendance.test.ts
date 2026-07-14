import assert from "node:assert/strict";
import { describe, it } from "node:test";

import {
  calculateAttendanceMetrics,
  isDateInLockedPeriod,
} from "@/lib/hr/attendance";

describe("hr attendance metrics", () => {
  it("calculates worked hours, late, early leave and OT", () => {
    const metrics = calculateAttendanceMetrics({
      scheduledStart: new Date("2026-07-13T01:00:00.000Z"),
      scheduledEnd: new Date("2026-07-13T10:00:00.000Z"),
      clockIn: new Date("2026-07-13T01:15:00.000Z"),
      clockOut: new Date("2026-07-13T11:00:00.000Z"),
      breakStart: new Date("2026-07-13T05:00:00.000Z"),
      breakEnd: new Date("2026-07-13T06:00:00.000Z"),
    });
    assert.equal(metrics.status, "COMPLETE");
    assert.equal(metrics.breakMinutes, 60);
    assert.equal(metrics.workedMinutes, 525);
    assert.equal(metrics.lateMinutes, 15);
    assert.equal(metrics.earlyLeaveMinutes, 0);
    assert.equal(metrics.otMinutes, 60);
  });

  it("marks open, incomplete and absent correctly", () => {
    assert.equal(calculateAttendanceMetrics({}).status, "OPEN");
    assert.equal(
      calculateAttendanceMetrics({ clockIn: new Date() }).status,
      "INCOMPLETE",
    );
    assert.equal(
      calculateAttendanceMetrics({ markAbsent: true }).status,
      "ABSENT",
    );
  });

  it("detects locked periods", () => {
    const locked = isDateInLockedPeriod(new Date("2026-07-13T00:00:00.000Z"), [
      {
        periodStart: new Date("2026-07-01T00:00:00.000Z"),
        periodEnd: new Date("2026-07-15T00:00:00.000Z"),
        lockedAt: new Date("2026-07-16T00:00:00.000Z"),
      },
    ]);
    assert.equal(locked, true);
  });
});
