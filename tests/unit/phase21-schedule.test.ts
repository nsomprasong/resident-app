import assert from "node:assert/strict";
import { describe, it } from "node:test";

import {
  computeSemiMonthlyRanges,
  periodsOverlap,
} from "@/lib/hr/schedule-periods";
import {
  buildSnapshotFromTemplate,
  canAssignMultiple,
  detectOverlap,
} from "@/lib/hr/scheduled-shifts";
import {
  attendanceStatusForMatch,
  findCandidateScheduledShifts,
  pickNearest,
} from "@/lib/hr/attendance-matching";
import {
  planBulkAssignShifts,
  WEEKDAY_PRESETS,
} from "@/lib/hr/schedule-bulk-assign";
import { planGenerateFromDefaultShifts } from "@/lib/hr/schedule-generate-plan";
import { readFileSync } from "node:fs";
import { join } from "node:path";

describe("schedule periods", () => {
  it("builds semi-monthly ranges", () => {
    const ranges = computeSemiMonthlyRanges(2026, 7);
    assert.equal(ranges.length, 2);
    assert.equal(ranges[0]?.startDate.toISOString().slice(0, 10), "2026-07-01");
    assert.equal(ranges[0]?.endDate.toISOString().slice(0, 10), "2026-07-15");
    assert.equal(ranges[1]?.endDate.toISOString().slice(0, 10), "2026-07-31");
  });

  it("detects overlapping periods", () => {
    assert.equal(
      periodsOverlap(
        {
          startDate: new Date("2026-07-01T00:00:00.000Z"),
          endDate: new Date("2026-07-15T00:00:00.000Z"),
        },
        [
          {
            id: "a",
            startDate: new Date("2026-07-10T00:00:00.000Z"),
            endDate: new Date("2026-07-20T00:00:00.000Z"),
          },
        ],
      ),
      true,
    );
  });
});

describe("scheduled shifts", () => {
  it("snapshots times from template including overnight", () => {
    const snapshot = buildSnapshotFromTemplate(
      22 * 60,
      6 * 60,
      new Date("2026-07-01T00:00:00.000Z"),
      30,
    );
    assert.ok(snapshot);
    assert.equal(snapshot!.plannedEnd.getTime() - snapshot!.plannedStart.getTime(), 8 * 60 * 60_000);
  });

  it("allows multiple non-overlapping shifts", () => {
    const morning = {
      employeeId: "e1",
      plannedStart: new Date("2026-07-01T01:00:00.000Z"),
      plannedEnd: new Date("2026-07-01T09:00:00.000Z"),
    };
    const afternoon = {
      employeeId: "e1",
      plannedStart: new Date("2026-07-01T09:00:00.000Z"),
      plannedEnd: new Date("2026-07-01T17:00:00.000Z"),
    };
    assert.equal(canAssignMultiple(afternoon, [morning]), true);
    assert.equal(detectOverlap(morning, [{ ...afternoon, id: "x" }]).length, 0);
  });

  it("flags overlapping shifts", () => {
    const a = {
      employeeId: "e1",
      plannedStart: new Date("2026-07-01T01:00:00.000Z"),
      plannedEnd: new Date("2026-07-01T10:00:00.000Z"),
    };
    const b = {
      id: "b",
      employeeId: "e1",
      plannedStart: new Date("2026-07-01T09:00:00.000Z"),
      plannedEnd: new Date("2026-07-01T17:00:00.000Z"),
      status: "SCHEDULED",
    };
    assert.equal(detectOverlap(a, [b]).length, 1);
  });
});

describe("generate from default shifts", () => {
  it("creates jobs from defaultShiftTemplateId and skips no-default / inactive / existing", () => {
    const plan = planGenerateFromDefaultShifts({
      dateKeys: ["2026-07-01", "2026-07-02"],
      employees: [
        {
          id: "e1",
          isActive: true,
          hrStatus: "ACTIVE",
          defaultShiftTemplateId: "t1",
        },
        {
          id: "e2",
          isActive: true,
          hrStatus: "ACTIVE",
          defaultShiftTemplateId: null,
        },
        {
          id: "e3",
          isActive: false,
          hrStatus: "ACTIVE",
          defaultShiftTemplateId: "t1",
        },
        {
          id: "e4",
          isActive: true,
          hrStatus: "ACTIVE",
          defaultShiftTemplateId: "t-inactive",
        },
      ],
      activeTemplateIds: new Set(["t1"]),
      existingEmployeeDateKeys: new Set(["e1|2026-07-01"]),
    });

    assert.equal(plan.jobs.length, 1);
    assert.deepEqual(plan.jobs[0], {
      employeeId: "e1",
      shiftTemplateId: "t1",
      dateKey: "2026-07-02",
    });
    assert.equal(plan.skippedNoDefault, 1);
    assert.equal(plan.skippedInactive, 1);
    assert.equal(plan.skippedInactiveTemplate, 1);
    assert.equal(plan.skippedExisting, 1);
  });

  it("changing default shift plan does not rewrite existing day keys", () => {
    const existing = new Set(["e1|2026-07-01"]);
    const before = planGenerateFromDefaultShifts({
      dateKeys: ["2026-07-01"],
      employees: [
        {
          id: "e1",
          isActive: true,
          hrStatus: "ACTIVE",
          defaultShiftTemplateId: "t1",
        },
      ],
      activeTemplateIds: new Set(["t1", "t2"]),
      existingEmployeeDateKeys: existing,
    });
    assert.equal(before.jobs.length, 0);
    assert.equal(before.skippedExisting, 1);

    const afterDefaultChange = planGenerateFromDefaultShifts({
      dateKeys: ["2026-07-01"],
      employees: [
        {
          id: "e1",
          isActive: true,
          hrStatus: "ACTIVE",
          defaultShiftTemplateId: "t2",
        },
      ],
      activeTemplateIds: new Set(["t1", "t2"]),
      existingEmployeeDateKeys: existing,
    });
    assert.equal(afterDefaultChange.jobs.length, 0);
    assert.equal(afterDefaultChange.skippedExisting, 1);
  });
});

describe("bulk assign planner", () => {
  it("fills only empty days by default and protects daily overrides", () => {
    const plan = planBulkAssignShifts({
      employeeIds: ["e1"],
      dateKeys: ["2026-07-16", "2026-07-17", "2026-07-18", "2026-07-19"],
      weekdays: WEEKDAY_PRESETS.MON_SAT,
      mode: "FILL_EMPTY",
      replaceOverrides: false,
      existing: [
        {
          employeeId: "e1",
          dateKey: "2026-07-16",
          shiftIds: ["s1"],
          isDailyOverride: false,
        },
        {
          employeeId: "e1",
          dateKey: "2026-07-17",
          shiftIds: ["s2"],
          isDailyOverride: true,
        },
      ],
    });
    // 16 Thu existing, 17 Fri override, 18 Sat create, 19 Sun skipped by weekday
    assert.equal(plan.createCount, 1);
    assert.equal(plan.jobs[0]?.dateKey, "2026-07-18");
    assert.equal(plan.skippedExisting, 1);
    assert.equal(plan.skippedOverride, 1);
  });

  it("replace mode still skips overrides unless replaceOverrides", () => {
    const protectedPlan = planBulkAssignShifts({
      employeeIds: ["e1"],
      dateKeys: ["2026-07-16"],
      weekdays: WEEKDAY_PRESETS.EVERY_DAY,
      mode: "REPLACE_ALL",
      replaceOverrides: false,
      existing: [
        {
          employeeId: "e1",
          dateKey: "2026-07-16",
          shiftIds: ["s1"],
          isDailyOverride: true,
        },
      ],
    });
    assert.equal(protectedPlan.replaceCount, 0);
    assert.equal(protectedPlan.skippedOverride, 1);

    const forced = planBulkAssignShifts({
      employeeIds: ["e1"],
      dateKeys: ["2026-07-16"],
      weekdays: WEEKDAY_PRESETS.EVERY_DAY,
      mode: "REPLACE_ALL",
      replaceOverrides: true,
      existing: [
        {
          employeeId: "e1",
          dateKey: "2026-07-16",
          shiftIds: ["s1"],
          isDailyOverride: true,
        },
      ],
    });
    assert.equal(forced.replaceCount, 1);
  });

  it("assigns only selected cells when cells are provided", () => {
    const plan = planBulkAssignShifts({
      cells: [
        { employeeId: "e1", dateKey: "2026-07-19" }, // Sunday
        { employeeId: "e2", dateKey: "2026-07-16" },
      ],
      mode: "FILL_EMPTY",
      replaceOverrides: false,
      existing: [
        {
          employeeId: "e2",
          dateKey: "2026-07-16",
          shiftIds: ["s1"],
          isDailyOverride: false,
        },
      ],
    });
    assert.equal(plan.createCount, 1);
    assert.equal(plan.jobs[0]?.employeeId, "e1");
    assert.equal(plan.jobs[0]?.dateKey, "2026-07-19");
    assert.equal(plan.skippedExisting, 1);
  });
});

describe("shift template UI separation", () => {
  it("แม่แบบกะ board does not call membership assign APIs", () => {
    const source = readFileSync(
      join(process.cwd(), "components/hr/HrSchedulesBoard.tsx"),
      "utf8",
    );
    assert.equal(source.includes("/members"), false);
    assert.equal(source.includes("จัดลงกะ"), false);
    assert.equal(source.includes("เลือกพนักงาน"), false);
  });
});

describe("schedule manage actions UI", () => {
  it("row actions moved to central manage buttons", () => {
    const board = readFileSync(
      join(process.cwd(), "components/hr/HrScheduleRosterBoard.tsx"),
      "utf8",
    );
    const manage = readFileSync(
      join(process.cwd(), "components/hr/HrScheduleManageActions.tsx"),
      "utf8",
    );
    assert.equal(board.includes("กำหนดทั้งรอบ"), false);
    assert.equal(board.includes("ล้างกะแถว"), false);
    assert.equal(board.includes("คัดลอกแถว"), false);
    assert.equal(board.includes("HrScheduleManageActions"), true);
    assert.equal(manage.includes("กำหนดกะทั้งรอบ"), true);
    assert.equal(manage.includes("กำหนดกะที่เลือก"), true);
    assert.equal(manage.includes("คัดลอกแถว"), true);
    assert.equal(manage.includes("ล้างกะแถว"), true);
    assert.equal(manage.includes("/copy-row"), true);
    assert.equal(manage.includes("dryRun"), true);
    assert.equal(manage.includes("cells"), true);
    assert.equal(board.includes("โหมดเลือกหลายช่อง"), true);
  });
});

describe("attendance matching", () => {
  it("picks nearest scheduled shift and pending review when none", () => {
    const at = new Date("2026-07-01T02:10:00.000Z");
    const shifts = [
      {
        id: "1",
        employeeId: "e1",
        plannedStart: new Date("2026-07-01T01:00:00.000Z"),
        plannedEnd: new Date("2026-07-01T09:00:00.000Z"),
        status: "SCHEDULED",
      },
      {
        id: "2",
        employeeId: "e1",
        plannedStart: new Date("2026-07-01T09:00:00.000Z"),
        plannedEnd: new Date("2026-07-01T17:00:00.000Z"),
        status: "SCHEDULED",
      },
    ];
    const candidates = findCandidateScheduledShifts(shifts, "e1", at);
    assert.equal(candidates.length, 2);
    assert.equal(pickNearest(candidates, at)?.id, "1");
    assert.equal(attendanceStatusForMatch(null), "PENDING_REVIEW");
    assert.equal(attendanceStatusForMatch(candidates[0]!), "OPEN");
  });
});
