import assert from "node:assert/strict";
import { describe, it } from "node:test";

import { buildDailyStatusRows, computeDailyStatus } from "@/lib/hr/daily-status";

describe("hr daily status — computeDailyStatus", () => {
  it("returns DAY_OFF when the schedule marks the day off", () => {
    const result = computeDailyStatus({
      isDayOff: true,
      hasSchedule: true,
      isApprovedLeave: false,
      clockIn: null,
      clockOut: null,
      workedMinutes: 0,
      lateMinutes: 0,
      earlyLeaveMinutes: 0,
      otApprovedMinutes: 0,
    });
    assert.equal(result.status, "DAY_OFF");
  });

  it("returns ON_LEAVE when covered by an approved leave", () => {
    const result = computeDailyStatus({
      isDayOff: false,
      hasSchedule: true,
      isApprovedLeave: true,
      clockIn: null,
      clockOut: null,
      workedMinutes: 0,
      lateMinutes: 0,
      earlyLeaveMinutes: 0,
      otApprovedMinutes: 0,
    });
    assert.equal(result.status, "ON_LEAVE");
  });

  it("returns ABSENT when there is no clock-in", () => {
    const result = computeDailyStatus({
      isDayOff: false,
      hasSchedule: true,
      isApprovedLeave: false,
      clockIn: null,
      clockOut: null,
      workedMinutes: 0,
      lateMinutes: 0,
      earlyLeaveMinutes: 0,
      otApprovedMinutes: 0,
    });
    assert.equal(result.status, "ABSENT");
  });

  it("returns LATE when late minutes are present, taking priority over early leave", () => {
    const result = computeDailyStatus({
      isDayOff: false,
      hasSchedule: true,
      isApprovedLeave: false,
      clockIn: new Date("2026-07-14T01:15:00.000Z"),
      clockOut: new Date("2026-07-14T09:00:00.000Z"),
      workedMinutes: 450,
      lateMinutes: 15,
      earlyLeaveMinutes: 10,
      otApprovedMinutes: 0,
    });
    assert.equal(result.status, "LATE");
    assert.equal(result.isLate, true);
    assert.equal(result.isEarlyLeave, true);
  });

  it("returns EARLY_LEAVE when not late but leaving before schedule", () => {
    const result = computeDailyStatus({
      isDayOff: false,
      hasSchedule: true,
      isApprovedLeave: false,
      clockIn: new Date("2026-07-14T01:00:00.000Z"),
      clockOut: new Date("2026-07-14T08:00:00.000Z"),
      workedMinutes: 420,
      lateMinutes: 0,
      earlyLeaveMinutes: 30,
      otApprovedMinutes: 0,
    });
    assert.equal(result.status, "EARLY_LEAVE");
  });

  it("returns PRESENT with approved OT carried through", () => {
    const result = computeDailyStatus({
      isDayOff: false,
      hasSchedule: true,
      isApprovedLeave: false,
      clockIn: new Date("2026-07-14T01:00:00.000Z"),
      clockOut: new Date("2026-07-14T11:00:00.000Z"),
      workedMinutes: 600,
      lateMinutes: 0,
      earlyLeaveMinutes: 0,
      otApprovedMinutes: 60,
    });
    assert.equal(result.status, "PRESENT");
    assert.equal(result.workedMinutes, 600);
    assert.equal(result.otApprovedMinutes, 60);
  });
});

describe("hr daily status — buildDailyStatusRows", () => {
  it("builds one row per employee per date, applying schedule/attendance/leave", () => {
    const rows = buildDailyStatusRows({
      employeeIds: ["emp-1"],
      fromKey: "2026-07-13",
      toKey: "2026-07-14",
      schedules: [
        {
          employeeId: "emp-1",
          workDate: new Date("2026-07-13T00:00:00.000Z"),
          isDayOff: false,
          status: "ASSIGNED",
          shiftTemplateId: "shift-1",
          shiftName: "เช้า",
          startsAt: new Date("2026-07-13T01:00:00.000Z"),
          endsAt: new Date("2026-07-13T09:00:00.000Z"),
        },
        {
          employeeId: "emp-1",
          workDate: new Date("2026-07-14T00:00:00.000Z"),
          isDayOff: true,
          status: "ASSIGNED",
          shiftTemplateId: null,
          shiftName: null,
          startsAt: new Date("2026-07-14T00:00:00.000Z"),
          endsAt: new Date("2026-07-14T23:59:59.000Z"),
        },
      ],
      attendanceRecords: [
        {
          employeeId: "emp-1",
          workDate: new Date("2026-07-13T00:00:00.000Z"),
          clockIn: new Date("2026-07-13T01:00:00.000Z"),
          clockOut: new Date("2026-07-13T09:00:00.000Z"),
          workedMinutes: 480,
          lateMinutes: 0,
          earlyLeaveMinutes: 0,
          otApprovedMinutes: 0,
        },
      ],
      approvedLeaves: [],
    });

    assert.equal(rows.length, 2);
    const day1 = rows.find((row) => row.workDate === "2026-07-13");
    const day2 = rows.find((row) => row.workDate === "2026-07-14");
    assert.equal(day1?.status, "PRESENT");
    assert.equal(day1?.shiftName, "เช้า");
    assert.equal(day2?.status, "DAY_OFF");
  });

  it("marks ABSENT for a scheduled day with no attendance record", () => {
    const rows = buildDailyStatusRows({
      employeeIds: ["emp-2"],
      fromKey: "2026-07-13",
      toKey: "2026-07-13",
      schedules: [
        {
          employeeId: "emp-2",
          workDate: new Date("2026-07-13T00:00:00.000Z"),
          isDayOff: false,
          status: "ASSIGNED",
          shiftTemplateId: "shift-1",
          shiftName: "เช้า",
          startsAt: new Date("2026-07-13T01:00:00.000Z"),
          endsAt: new Date("2026-07-13T09:00:00.000Z"),
        },
      ],
      attendanceRecords: [],
      approvedLeaves: [],
    });

    assert.equal(rows.length, 1);
    assert.equal(rows[0].status, "ABSENT");
  });
});
