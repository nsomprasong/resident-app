import assert from "node:assert/strict";
import { describe, it } from "node:test";

import {
  formatAttendanceClockTime,
  formatThaiDate,
  formatThaiDateRange,
  formatThaiDateTime,
  formatThaiTime,
} from "@/lib/format/date";

describe("thai date display format วว/ดด/ปปปป", () => {
  it("formats a date key as dd/mm/yyyy buddhist era", () => {
    // 2026-07-14 UTC date-only → พ.ศ. 2569
    assert.equal(formatThaiDate("2026-07-14"), "14/07/2569");
  });

  it("formats a date range", () => {
    assert.equal(
      formatThaiDateRange("2026-07-14", "2026-07-16"),
      "14/07/2569 – 16/07/2569",
    );
  });

  it("formats date-time in Bangkok", () => {
    const text = formatThaiDateTime("2026-07-14T10:05:00.000Z");
    assert.match(text, /^\d{2}\/\d{2}\/\d{4} \d{2}:\d{2}$/);
    assert.equal(text.slice(0, 10), "14/07/2569");
  });

  it("formats wall-clock time in UTC for schedules", () => {
    assert.equal(
      formatThaiTime("2026-07-14T08:30:00.000Z", { timeZone: "UTC" }),
      "08:30",
    );
  });

  it("formats real clock-in instants in Asia/Bangkok", () => {
    // 11:05 น. Bangkok → 04:05Z stored
    assert.equal(
      formatAttendanceClockTime("2026-07-19T04:05:00.000Z"),
      "11:05",
    );
  });
});
