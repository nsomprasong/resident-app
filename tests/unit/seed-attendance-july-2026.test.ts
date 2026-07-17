import assert from "node:assert/strict";
import { describe, it } from "node:test";

import {
  SEED_BATCH_KEY,
  assertSeedEnvironment,
  isSeedMarkedText,
  seedNote,
} from "@/lib/hr/seed/attendance-payroll-july-2026-constants";
import {
  scenarioNeedsLeave,
  scenarioSkipsShift,
} from "@/lib/hr/seed/attendance-payroll-july-2026-scenarios";
import {
  buildClockPlan,
  metricsFromClockPlan,
  seedGeoNearResort,
} from "@/lib/hr/seed/attendance-payroll-july-2026-times";

function plannedWindow(day: number) {
  const workDate = new Date(Date.UTC(2026, 6, day, 0, 0, 0));
  const plannedStart = new Date(workDate);
  plannedStart.setUTCHours(9, 0, 0, 0);
  const plannedEnd = new Date(workDate);
  plannedEnd.setUTCHours(18, 0, 0, 0);
  return { plannedStart, plannedEnd };
}

describe("attendance-payroll july 2026 seed helpers", () => {
  it("seedNote includes batch key", () => {
    const note = seedNote("E1-D1");
    assert.ok(note.includes(SEED_BATCH_KEY));
    assert.ok(isSeedMarkedText(note));
  });

  it("blocks production without override", () => {
    const env = process.env as Record<string, string | undefined>;
    const prev = env.NODE_ENV;
    const allow = env.SEED_ALLOW_PRODUCTION;
    env.NODE_ENV = "production";
    delete env.SEED_ALLOW_PRODUCTION;
    assert.throws(() => assertSeedEnvironment());
    env.SEED_ALLOW_PRODUCTION = "true";
    assert.doesNotThrow(() => assertSeedEnvironment());
    if (prev === undefined) delete env.NODE_ENV;
    else env.NODE_ENV = prev;
    if (allow === undefined) delete env.SEED_ALLOW_PRODUCTION;
    else env.SEED_ALLOW_PRODUCTION = allow;
  });

  it("WORK_NORMAL aligns with shift window for metrics", () => {
    const plannedStart = new Date("2026-07-01T08:00:00.000Z");
    const plannedEnd = new Date("2026-07-01T17:00:00.000Z");
    const plan = buildClockPlan({
      kind: "WORK_NORMAL",
      plannedStart,
      plannedEnd,
      lateGraceMinutes: 10,
      day: 1,
    });
    const metrics = metricsFromClockPlan({
      plan,
      plannedStart,
      plannedEnd,
      lateGraceMinutes: 10,
    });
    assert.equal(plan.clockIn?.toISOString(), "2026-07-01T07:30:00.000Z");
    assert.equal(plan.clockOut?.toISOString(), "2026-07-01T17:30:00.000Z");
    assert.equal(metrics.workedMinutes, 540);
    assert.equal(metrics.otMinutes, 30);
    assert.equal(metrics.lateMinutes, 0);
  });

  it("buildClockPlan normal is deterministic", () => {
    const { plannedStart, plannedEnd } = plannedWindow(1);
    const a = buildClockPlan({
      kind: "WORK_NORMAL",
      plannedStart,
      plannedEnd,
      lateGraceMinutes: 5,
      day: 1,
    });
    const b = buildClockPlan({
      kind: "WORK_NORMAL",
      plannedStart,
      plannedEnd,
      lateGraceMinutes: 5,
      day: 1,
    });
    assert.equal(a.clockIn?.getTime(), b.clockIn?.getTime());
    assert.equal(a.clockOut?.getTime(), b.clockOut?.getTime());
  });

  it("late beyond grace records late minutes", () => {
    const { plannedStart, plannedEnd } = plannedWindow(2);
    const plan = buildClockPlan({
      kind: "LATE_25",
      plannedStart,
      plannedEnd,
      lateGraceMinutes: 5,
      day: 2,
    });
    const metrics = metricsFromClockPlan({
      plan,
      plannedStart,
      plannedEnd,
      lateGraceMinutes: 5,
    });
    assert.ok(metrics.lateMinutes >= 20);
  });

  it("early leave reduces worked time", () => {
    const { plannedStart, plannedEnd } = plannedWindow(6);
    const plan = buildClockPlan({
      kind: "EARLY_30",
      plannedStart,
      plannedEnd,
      lateGraceMinutes: 0,
      day: 6,
    });
    const metrics = metricsFromClockPlan({
      plan,
      plannedStart,
      plannedEnd,
      lateGraceMinutes: 0,
    });
    assert.ok(metrics.earlyLeaveMinutes >= 30);
  });

  it("absent and leave skip clock times", () => {
    const { plannedStart, plannedEnd } = plannedWindow(11);
    const absent = buildClockPlan({
      kind: "ABSENT",
      plannedStart,
      plannedEnd,
      lateGraceMinutes: 0,
      day: 11,
    });
    assert.equal(absent.clockIn, null);
    assert.ok(scenarioSkipsShift("ABSENT"));
    assert.ok(scenarioNeedsLeave("PAID_LEAVE"));
  });

  it("OT approved vs suggested payroll minutes", () => {
    const { plannedStart, plannedEnd } = plannedWindow(4);
    const approved = buildClockPlan({
      kind: "OT_120",
      plannedStart,
      plannedEnd,
      lateGraceMinutes: 0,
      day: 4,
    });
    const approvedMetrics = metricsFromClockPlan({
      plan: approved,
      plannedStart,
      plannedEnd,
      lateGraceMinutes: 0,
    });
    assert.equal(approved.otApprovedMinutes, 120);

    const suggested = buildClockPlan({
      kind: "OT_SUGGESTED",
      plannedStart,
      plannedEnd,
      lateGraceMinutes: 0,
      day: 5,
    });
    const suggestedMetrics = metricsFromClockPlan({
      plan: suggested,
      plannedStart,
      plannedEnd,
      lateGraceMinutes: 0,
    });
    assert.ok(suggestedMetrics.otMinutes > 0);
    assert.equal(suggested.otApprovedMinutes, 0);
  });

  it("seedGeoNearResort stays near pin", () => {
    const lat = 13.7;
    const lng = 100.5;
    const point = seedGeoNearResort(lat, lng, 3);
    const dLat = Math.abs(point.latitude - lat);
    const dLng = Math.abs(point.longitude - lng);
    assert.ok(dLat < 0.001);
    assert.ok(dLng < 0.001);
  });
});

describe("attendance-payroll july 2026 idempotency markers", () => {
  it("distinct scenario keys produce distinct notes", () => {
    const a = seedNote("E1-D1");
    const b = seedNote("E1-D2");
    assert.notEqual(a, b);
  });
});
