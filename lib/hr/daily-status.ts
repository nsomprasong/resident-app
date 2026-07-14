import { dateKeyUtc, eachDateKey } from "@/lib/hr/schedules";

export const dailyStatusCodes = [
  "PRESENT",
  "LATE",
  "EARLY_LEAVE",
  "ABSENT",
  "ON_LEAVE",
  "DAY_OFF",
] as const;

export type DailyStatusCode = (typeof dailyStatusCodes)[number];

export const dailyStatusLabels: Record<DailyStatusCode, string> = {
  PRESENT: "มาทำงาน",
  LATE: "มาสาย",
  EARLY_LEAVE: "ออกก่อนเวลา",
  ABSENT: "ขาดงาน",
  ON_LEAVE: "ลางาน",
  DAY_OFF: "วันหยุด",
};

export type DailyStatusInput = {
  /** Schedule marks this date as an official day off. */
  isDayOff: boolean;
  /** Employee has an assigned (non-cancelled) schedule for this date. */
  hasSchedule: boolean;
  /** An approved leave request covers this date. */
  isApprovedLeave: boolean;
  clockIn: Date | null;
  clockOut: Date | null;
  workedMinutes: number;
  lateMinutes: number;
  earlyLeaveMinutes: number;
  otApprovedMinutes: number;
};

export type DailyStatusResult = {
  status: DailyStatusCode;
  statusLabel: string;
  isLate: boolean;
  isEarlyLeave: boolean;
  workedMinutes: number;
  otApprovedMinutes: number;
};

/**
 * Compute the daily attendance status for one employee/day, following the
 * priority: day off > approved leave > absent (no clock-in on a workday) >
 * late/early-leave (both may apply, status prioritizes late) > present.
 */
export function computeDailyStatus(input: DailyStatusInput): DailyStatusResult {
  const isLate = input.lateMinutes > 0;
  const isEarlyLeave = input.earlyLeaveMinutes > 0;

  if (input.isDayOff) {
    return {
      status: "DAY_OFF",
      statusLabel: dailyStatusLabels.DAY_OFF,
      isLate: false,
      isEarlyLeave: false,
      workedMinutes: 0,
      otApprovedMinutes: 0,
    };
  }

  if (input.isApprovedLeave) {
    return {
      status: "ON_LEAVE",
      statusLabel: dailyStatusLabels.ON_LEAVE,
      isLate: false,
      isEarlyLeave: false,
      workedMinutes: 0,
      otApprovedMinutes: 0,
    };
  }

  if (!input.clockIn) {
    if (!input.hasSchedule) {
      return {
        status: "ABSENT",
        statusLabel: dailyStatusLabels.ABSENT,
        isLate: false,
        isEarlyLeave: false,
        workedMinutes: 0,
        otApprovedMinutes: 0,
      };
    }
    return {
      status: "ABSENT",
      statusLabel: dailyStatusLabels.ABSENT,
      isLate: false,
      isEarlyLeave: false,
      workedMinutes: 0,
      otApprovedMinutes: 0,
    };
  }

  if (isLate) {
    return {
      status: "LATE",
      statusLabel: dailyStatusLabels.LATE,
      isLate: true,
      isEarlyLeave,
      workedMinutes: input.workedMinutes,
      otApprovedMinutes: input.otApprovedMinutes,
    };
  }

  if (isEarlyLeave) {
    return {
      status: "EARLY_LEAVE",
      statusLabel: dailyStatusLabels.EARLY_LEAVE,
      isLate: false,
      isEarlyLeave: true,
      workedMinutes: input.workedMinutes,
      otApprovedMinutes: input.otApprovedMinutes,
    };
  }

  return {
    status: "PRESENT",
    statusLabel: dailyStatusLabels.PRESENT,
    isLate: false,
    isEarlyLeave: false,
    workedMinutes: input.workedMinutes,
    otApprovedMinutes: input.otApprovedMinutes,
  };
}

export type ScheduleForStatus = {
  employeeId: string;
  workDate: Date;
  isDayOff: boolean;
  status: string;
  shiftTemplateId: string | null;
  shiftName: string | null;
  startsAt: Date;
  endsAt: Date;
};

export type AttendanceRecordForStatus = {
  employeeId: string;
  workDate: Date;
  clockIn: Date | null;
  clockOut: Date | null;
  workedMinutes: number;
  lateMinutes: number;
  earlyLeaveMinutes: number;
  otApprovedMinutes: number;
};

export type ApprovedLeaveForStatus = {
  employeeId: string;
  startDate: Date;
  endDate: Date;
};

export type DailyStatusRow = DailyStatusResult & {
  employeeId: string;
  workDate: string;
  shiftName: string | null;
  scheduledStart: string | null;
  scheduledEnd: string | null;
  clockIn: string | null;
  clockOut: string | null;
  lateMinutes: number;
  earlyLeaveMinutes: number;
};

/**
 * Build one daily-status row per employee/date in range from already-fetched
 * schedules, attendance records and approved leaves (server queries live in
 * the API route; this function stays pure/testable).
 */
export function buildDailyStatusRows(input: {
  employeeIds: readonly string[];
  fromKey: string;
  toKey: string;
  schedules: readonly ScheduleForStatus[];
  attendanceRecords: readonly AttendanceRecordForStatus[];
  approvedLeaves: readonly ApprovedLeaveForStatus[];
}): DailyStatusRow[] {
  const dateKeys = eachDateKey(input.fromKey, input.toKey);
  const rows: DailyStatusRow[] = [];

  for (const employeeId of input.employeeIds) {
    for (const workDate of dateKeys) {
      const schedule = input.schedules.find(
        (item) =>
          item.employeeId === employeeId &&
          item.status !== "CANCELLED" &&
          dateKeyUtc(item.workDate) === workDate,
      );
      const attendance = input.attendanceRecords.find(
        (item) =>
          item.employeeId === employeeId && dateKeyUtc(item.workDate) === workDate,
      );
      const onLeave = input.approvedLeaves.some(
        (leave) =>
          leave.employeeId === employeeId &&
          dateKeyUtc(leave.startDate) <= workDate &&
          dateKeyUtc(leave.endDate) >= workDate,
      );

      const result = computeDailyStatus({
        isDayOff: schedule?.isDayOff ?? false,
        hasSchedule: Boolean(schedule),
        isApprovedLeave: onLeave,
        clockIn: attendance?.clockIn ?? null,
        clockOut: attendance?.clockOut ?? null,
        workedMinutes: attendance?.workedMinutes ?? 0,
        lateMinutes: attendance?.lateMinutes ?? 0,
        earlyLeaveMinutes: attendance?.earlyLeaveMinutes ?? 0,
        otApprovedMinutes: attendance?.otApprovedMinutes ?? 0,
      });

      rows.push({
        ...result,
        employeeId,
        workDate,
        shiftName: schedule?.shiftName ?? null,
        scheduledStart: schedule ? schedule.startsAt.toISOString() : null,
        scheduledEnd: schedule ? schedule.endsAt.toISOString() : null,
        clockIn: attendance?.clockIn?.toISOString() ?? null,
        clockOut: attendance?.clockOut?.toISOString() ?? null,
        lateMinutes: attendance?.lateMinutes ?? 0,
        earlyLeaveMinutes: attendance?.earlyLeaveMinutes ?? 0,
      });
    }
  }

  return rows;
}
