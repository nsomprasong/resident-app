import type { AttendanceStatus } from "@/generated/prisma/client";

import {
  applyApprovedOt,
  calculateAttendanceMetrics,
} from "@/lib/hr/attendance";

import type { DayScenarioKind } from "@/lib/hr/seed/attendance-payroll-july-2026-scenarios";

export type ClockPlan = {
  clockIn: Date | null;
  clockOut: Date | null;
  otApprovedMinutes: number;
  otSuggestedOnly: boolean;
  markAbsent: boolean;
  statusOverride?: AttendanceStatus;
};

function addMinutes(date: Date, minutes: number): Date {
  return new Date(date.getTime() + minutes * 60_000);
}

/** มาก่อนกะ 30 นาที / ออกหลังเลิกกะ 30 นาที (OT รออนุมัติ) — ตรงตัวอย่าง 8:00–17:00 */
function normalEarlyInMinutes(_day: number): number {
  return 30;
}

function normalLateOutMinutes(_day: number): number {
  return 30;
}

export function buildClockPlan(input: {
  kind: DayScenarioKind;
  plannedStart: Date;
  plannedEnd: Date;
  lateGraceMinutes: number;
  day: number;
}): ClockPlan {
  const { kind, plannedStart, plannedEnd, day } = input;

  if (kind === "ABSENT" || kind === "PAID_LEAVE" || kind === "UNPAID_LEAVE") {
    return {
      clockIn: null,
      clockOut: null,
      otApprovedMinutes: 0,
      otSuggestedOnly: false,
      markAbsent: kind === "ABSENT",
    };
  }

  if (kind === "DAY_OFF" || kind === "REPLACED_OWNER") {
    return {
      clockIn: null,
      clockOut: null,
      otApprovedMinutes: 0,
      otSuggestedOnly: false,
      markAbsent: false,
    };
  }

  if (kind === "NO_CLOCK_OUT") {
    return {
      clockIn: addMinutes(plannedStart, -normalEarlyInMinutes(day)),
      clockOut: null,
      otApprovedMinutes: 0,
      otSuggestedOnly: false,
      markAbsent: false,
      statusOverride: "INCOMPLETE",
    };
  }

  if (kind === "OFF_SCHEDULE") {
    return {
      clockIn: addMinutes(plannedStart, 30),
      clockOut: addMinutes(plannedEnd, 15),
      otApprovedMinutes: 0,
      otSuggestedOnly: false,
      markAbsent: false,
      statusOverride: "PENDING_REVIEW",
    };
  }

  let clockIn = addMinutes(plannedStart, -normalEarlyInMinutes(day));
  let clockOut = addMinutes(plannedEnd, normalLateOutMinutes(day));
  let otApprovedMinutes = 0;
  let otSuggestedOnly = false;

  switch (kind) {
    case "LATE_12":
      clockIn = addMinutes(plannedStart, 12);
      break;
    case "LATE_25":
      clockIn = addMinutes(plannedStart, 25);
      break;
    case "LATE_25_OT_60":
      clockIn = addMinutes(plannedStart, 25);
      clockOut = addMinutes(plannedEnd, 60);
      otApprovedMinutes = 60;
      break;
    case "LATE_8":
      clockIn = addMinutes(plannedStart, 8);
      break;
    case "LATE_20":
      clockIn = addMinutes(plannedStart, 20);
      break;
    case "EARLY_30":
      clockOut = addMinutes(plannedEnd, -30);
      break;
    case "EARLY_45":
      clockOut = addMinutes(plannedEnd, -45);
      break;
    case "OT_60":
      clockOut = addMinutes(plannedEnd, 60);
      otApprovedMinutes = 60;
      break;
    case "OT_120":
      clockOut = addMinutes(plannedEnd, 120);
      otApprovedMinutes = 120;
      break;
    case "OT_180":
      clockOut = addMinutes(plannedEnd, 180);
      otApprovedMinutes = 180;
      break;
    case "OT_SUGGESTED":
      clockOut = addMinutes(plannedEnd, 90);
      otApprovedMinutes = 0;
      otSuggestedOnly = true;
      break;
    default:
      break;
  }

  return {
    clockIn,
    clockOut,
    otApprovedMinutes,
    otSuggestedOnly,
    markAbsent: false,
  };
}

export function metricsFromClockPlan(input: {
  plan: ClockPlan;
  plannedStart: Date;
  plannedEnd: Date;
  lateGraceMinutes: number;
}) {
  const base = calculateAttendanceMetrics(
    {
      clockIn: input.plan.clockIn,
      clockOut: input.plan.clockOut,
      scheduledStart: input.plannedStart,
      scheduledEnd: input.plannedEnd,
      markAbsent: input.plan.markAbsent,
      otApprovedMinutes: input.plan.otApprovedMinutes,
    },
    { lateGraceMinutes: input.lateGraceMinutes },
  );
  const withOt = applyApprovedOt(base, input.plan.otApprovedMinutes);
  if (input.plan.statusOverride) {
    return { ...withOt, status: input.plan.statusOverride };
  }
  if (input.plan.otSuggestedOnly && withOt.otMinutes > 0) {
    return {
      ...withOt,
      otApprovedMinutes: 0,
      status: withOt.status,
    };
  }
  return withOt;
}

/** Offset ~10m north-east from resort pin (deterministic). */
export function seedGeoNearResort(
  latitude: number,
  longitude: number,
  slot: number,
): { latitude: number; longitude: number } {
  const meters = 5 + (slot % 16);
  const latDelta = (meters / 111_320) * (slot % 2 === 0 ? 1 : -1);
  const lngDelta =
    (meters / (111_320 * Math.cos((latitude * Math.PI) / 180))) *
    (slot % 3 === 0 ? 1 : -1);
  return {
    latitude: latitude + latDelta,
    longitude: longitude + lngDelta,
  };
}
