import assert from "node:assert/strict";
import { describe, it } from "node:test";

import {
  bangkokDateTimeFromParts,
  canDirectEditAttendanceTime,
  isoToBangkokTimeInput,
} from "@/lib/hr/attendance-time-edit";

describe("attendance-time-edit", () => {
  it("converts Bangkok wall time on work date to UTC", () => {
    const date = bangkokDateTimeFromParts("2026-07-14", "09:05");
    assert.ok(date);
    assert.equal(date.toISOString(), "2026-07-14T02:05:00.000Z");
  });

  it("round-trips through isoToBangkokTimeInput", () => {
    const iso = "2026-07-14T02:05:00.000Z";
    assert.equal(isoToBangkokTimeInput(iso), "09:05");
  });

  it("allows manage or approve permission", () => {
    assert.equal(
      canDirectEditAttendanceTime(["hr.attendance.manage"]),
      true,
    );
    assert.equal(
      canDirectEditAttendanceTime(["hr.attendance.approve"]),
      true,
    );
    assert.equal(canDirectEditAttendanceTime(["hr.employee.view"]), false);
  });
});
