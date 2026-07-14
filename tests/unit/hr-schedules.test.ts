import assert from "node:assert/strict";
import { describe, it } from "node:test";

import {
  buildScheduleRange,
  findEmployeeScheduleOverlaps,
  findUnderstaffedShifts,
  parseTimeToMinutes,
  rangesOverlap,
  weekRangeContaining,
} from "@/lib/hr/schedules";

describe("hr schedules", () => {
  it("parses times and builds overnight ranges", () => {
    assert.equal(parseTimeToMinutes("08:30"), 510);
    const day = buildScheduleRange(new Date("2026-07-13T00:00:00.000Z"), 22 * 60, 6 * 60);
    assert.ok(day);
    assert.equal(day.startsAt.toISOString(), "2026-07-13T22:00:00.000Z");
    assert.equal(day.endsAt.toISOString(), "2026-07-14T06:00:00.000Z");
  });

  it("detects overlaps for the same employee", () => {
    const a = {
      employeeId: "e1",
      startsAt: new Date("2026-07-13T01:00:00.000Z"),
      endsAt: new Date("2026-07-13T05:00:00.000Z"),
    };
    const b = {
      id: "s2",
      employeeId: "e1",
      startsAt: new Date("2026-07-13T04:00:00.000Z"),
      endsAt: new Date("2026-07-13T08:00:00.000Z"),
    };
    assert.equal(rangesOverlap(a, b), true);
    assert.equal(findEmployeeScheduleOverlaps(a, [b]).length, 1);
  });

  it("flags understaffed template slots", () => {
    const result = findUnderstaffedShifts({
      templates: [
        { id: "t1", name: "เช้า", requiredHeadcount: 2, isActive: true },
      ],
      schedules: [
        {
          employeeId: "e1",
          shiftTemplateId: "t1",
          workDate: new Date("2026-07-13T00:00:00.000Z"),
          startsAt: new Date("2026-07-13T01:00:00.000Z"),
          endsAt: new Date("2026-07-13T09:00:00.000Z"),
          status: "ASSIGNED",
        },
      ],
      workDates: ["2026-07-13"],
    });
    assert.equal(result.length, 1);
    assert.equal(result[0]?.shortage, 1);
  });

  it("resolves week range monday-sunday", () => {
    const range = weekRangeContaining("2026-07-15"); // Wednesday
    assert.deepEqual(range, { from: "2026-07-13", to: "2026-07-19" });
  });
});
