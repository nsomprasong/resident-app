import type { AttendanceStatus } from "@/generated/prisma/client";

/** Late grace before counting late minutes — HR settings can replace later. */
export const ATTENDANCE_LATE_GRACE_MINUTES = 0;

export type AttendanceClockInput = {
  clockIn?: Date | null;
  clockOut?: Date | null;
  breakStart?: Date | null;
  breakEnd?: Date | null;
  scheduledStart?: Date | null;
  scheduledEnd?: Date | null;
  isHolidayWork?: boolean;
  otApprovedMinutes?: number;
  markAbsent?: boolean;
};

export type AttendanceMetrics = {
  workedMinutes: number;
  breakMinutes: number;
  lateMinutes: number;
  earlyLeaveMinutes: number;
  otMinutes: number;
  status: AttendanceStatus;
};

function minutesBetween(start: Date, end: Date) {
  return Math.max(0, Math.round((end.getTime() - start.getTime()) / 60_000));
}

function breakMinutesInWindow(
  breakStart: Date | null,
  breakEnd: Date | null,
  windowStart: Date,
  windowEnd: Date,
): number {
  if (!breakStart || !breakEnd || breakEnd <= breakStart) return 0;
  const start =
    breakStart.getTime() > windowStart.getTime() ? breakStart : windowStart;
  const end =
    breakEnd.getTime() < windowEnd.getTime() ? breakEnd : windowEnd;
  if (end <= start) return 0;
  return minutesBetween(start, end);
}

export function calculateAttendanceMetrics(
  input: AttendanceClockInput,
  options?: { lateGraceMinutes?: number },
): AttendanceMetrics {
  const lateGrace =
    options?.lateGraceMinutes ?? ATTENDANCE_LATE_GRACE_MINUTES;

  if (input.markAbsent) {
    return {
      workedMinutes: 0,
      breakMinutes: 0,
      lateMinutes: 0,
      earlyLeaveMinutes: 0,
      otMinutes: 0,
      status: "ABSENT",
    };
  }

  const clockIn = input.clockIn ?? null;
  const clockOut = input.clockOut ?? null;
  const breakStart = input.breakStart ?? null;
  const breakEnd = input.breakEnd ?? null;
  const scheduledStart = input.scheduledStart ?? null;
  const scheduledEnd = input.scheduledEnd ?? null;

  if (!clockIn && !clockOut) {
    return {
      workedMinutes: 0,
      breakMinutes: 0,
      lateMinutes: 0,
      earlyLeaveMinutes: 0,
      otMinutes: 0,
      status: "OPEN",
    };
  }

  if (!clockIn || !clockOut || clockOut <= clockIn) {
    return {
      workedMinutes: 0,
      breakMinutes: 0,
      lateMinutes: 0,
      earlyLeaveMinutes: 0,
      otMinutes: 0,
      status: "INCOMPLETE",
    };
  }

  let workedMinutes = 0;
  let breakMinutes = 0;
  if (scheduledStart && scheduledEnd) {
    const effectiveStart =
      clockIn.getTime() < scheduledStart.getTime() ? scheduledStart : clockIn;
    const regularEnd =
      clockOut.getTime() > scheduledEnd.getTime() ? scheduledEnd : clockOut;
    if (regularEnd > effectiveStart) {
      breakMinutes = breakMinutesInWindow(
        breakStart,
        breakEnd,
        effectiveStart,
        regularEnd,
      );
      workedMinutes = Math.max(
        0,
        minutesBetween(effectiveStart, regularEnd) - breakMinutes,
      );
    }
  } else {
    if (breakStart && breakEnd && breakEnd > breakStart) {
      breakMinutes = minutesBetween(breakStart, breakEnd);
    }
    const grossMinutes = minutesBetween(clockIn, clockOut);
    workedMinutes = Math.max(0, grossMinutes - breakMinutes);
  }

  let lateMinutes = 0;
  if (scheduledStart) {
    const threshold = new Date(
      scheduledStart.getTime() + lateGrace * 60_000,
    );
    if (clockIn > threshold) {
      lateMinutes = minutesBetween(threshold, clockIn);
    }
  }

  let earlyLeaveMinutes = 0;
  if (scheduledEnd && clockOut < scheduledEnd) {
    earlyLeaveMinutes = minutesBetween(clockOut, scheduledEnd);
  }

  let otMinutes = 0;
  if (scheduledEnd && clockOut > scheduledEnd) {
    otMinutes = minutesBetween(scheduledEnd, clockOut);
  } else if (!scheduledEnd && input.isHolidayWork) {
    otMinutes = workedMinutes;
  }

  return {
    workedMinutes,
    breakMinutes,
    lateMinutes,
    earlyLeaveMinutes,
    otMinutes,
    status: "COMPLETE",
  };
}

export function applyApprovedOt(
  metrics: AttendanceMetrics,
  otApprovedMinutes: number,
): AttendanceMetrics {
  return {
    ...metrics,
    otMinutes: Math.max(metrics.otMinutes, otApprovedMinutes),
  };
}

export type PeriodLike = {
  periodStart: Date;
  periodEnd: Date;
  lockedAt: Date | null;
};

export function isDateInLockedPeriod(
  workDate: Date,
  periods: readonly PeriodLike[],
): boolean {
  const key = workDate.getTime();
  return periods.some((period) => {
    if (!period.lockedAt) return false;
    return (
      key >= period.periodStart.getTime() && key <= period.periodEnd.getTime()
    );
  });
}

export function resolveAttendanceShiftName(input: {
  scheduledShiftId?: string | null;
  status?: string;
  scheduledShift?: { shiftTemplate: { name: string } | null } | null;
  workSchedule?: { shiftTemplate: { name: string } | null } | null;
}): string | null {
  const fromTemplate =
    input.scheduledShift?.shiftTemplate?.name ??
    input.workSchedule?.shiftTemplate?.name ??
    null;
  if (fromTemplate) return fromTemplate;
  if (
    input.status === "PENDING_REVIEW" &&
    !input.scheduledShiftId &&
    !input.scheduledShift
  ) {
    return "นอกตาราง";
  }
  return null;
}
