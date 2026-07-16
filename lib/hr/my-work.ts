import type { AttendanceEventType } from "@/generated/prisma/client";

import { calculateAttendanceMetrics } from "@/lib/hr/attendance";
import { getAttendanceSetting } from "@/lib/hr/attendance-settings";
import { haversineDistanceMeters, validateCoordinates } from "@/lib/hr/geo";
import { dateKeyUtc, parseDateKey } from "@/lib/hr/schedules";
import { ensureWorkScheduleFromMembership } from "@/lib/hr/shift-memberships";
import { prisma } from "@/lib/prisma";

/** "YYYY-MM-DD" for a given IANA timezone, defaulting to server clock as the source of truth. */
export function todayDateKeyInTimezone(timezone: string): string {
  const parts = new Intl.DateTimeFormat("en-CA", {
    timeZone: timezone,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).formatToParts(new Date());
  const get = (type: Intl.DateTimeFormatPartTypes) =>
    parts.find((part) => part.type === type)?.value ?? "";
  return `${get("year")}-${get("month")}-${get("day")}`;
}

export async function getTodayScheduleForEmployee(
  employeeId: string,
  timezone: string,
) {
  const todayKey = todayDateKeyInTimezone(timezone);
  const workDate = parseDateKey(todayKey);
  if (!workDate) return null;

  // Prefer permanent shift membership (every day until changed / validity ends).
  const fromMembership = await ensureWorkScheduleFromMembership(
    employeeId,
    workDate,
  );
  if (fromMembership) return fromMembership;

  return prisma.workSchedule.findFirst({
    where: { employeeId, workDate, status: "ASSIGNED" },
    include: {
      shiftTemplate: {
        select: {
          id: true,
          name: true,
          startMinutes: true,
          endMinutes: true,
          breakMinutes: true,
          lateGraceMinutes: true,
          earlyLeaveGraceMinutes: true,
        },
      },
    },
  });
}

export type ClockInput = {
  employeeId: string;
  type: AttendanceEventType;
  latitude: number;
  longitude: number;
  accuracyMeters?: number | null;
  userAgent?: string | null;
};

export class ClockError extends Error {
  constructor(
    public code: string,
    message: string,
  ) {
    super(message);
    this.name = "ClockError";
  }
}

/**
 * Record a CHECK_IN/CHECK_OUT event for the employee, validating GPS accuracy,
 * geofence radius and duplicate/ordering rules server-side. Server time is
 * the source of truth; only the reported coordinates come from the client.
 */
export async function clockAttendance(input: ClockInput) {
  const coordCheck = validateCoordinates(input.latitude, input.longitude);
  if (!coordCheck.ok) {
    throw new ClockError("INVALID_COORDINATES", coordCheck.message);
  }

  const employee = await prisma.employee.findUnique({
    where: { id: input.employeeId },
    select: { id: true, isActive: true, hrStatus: true },
  });
  if (
    !employee ||
    !employee.isActive ||
    !["ACTIVE", "PROBATION"].includes(employee.hrStatus)
  ) {
    throw new ClockError(
      "EMPLOYEE_INACTIVE",
      "บัญชีพนักงานนี้ไม่สามารถลงเวลาได้",
    );
  }

  const settings = await getAttendanceSetting();

  if (
    input.accuracyMeters != null &&
    input.accuracyMeters > settings.maxAccuracyMeters
  ) {
    throw new ClockError(
      "LOW_ACCURACY",
      `สัญญาณ GPS ไม่แม่นยำพอ (±${Math.round(input.accuracyMeters)} ม.) กรุณาลองใหม่ในที่โล่ง`,
    );
  }

  const distanceMeters = haversineDistanceMeters(
    input.latitude,
    input.longitude,
    Number(settings.latitude),
    Number(settings.longitude),
  );

  if (distanceMeters > settings.radiusMeters) {
    throw new ClockError(
      "OUT_OF_RANGE",
      `อยู่นอกรัศมีที่กำหนด (ห่างจากหมุด ${Math.round(distanceMeters)} ม. อนุญาตไม่เกิน ${settings.radiusMeters} ม.)`,
    );
  }

  const todayKey = todayDateKeyInTimezone(settings.timezone);
  const workDate = parseDateKey(todayKey);
  if (!workDate) {
    throw new ClockError("INTERNAL_ERROR", "ไม่สามารถระบุวันที่ปัจจุบันได้");
  }

  const schedule = await prisma.workSchedule.findFirst({
    where: { employeeId: input.employeeId, workDate, status: "ASSIGNED" },
    include: { shiftTemplate: true },
  });

  if (!schedule && !settings.allowClockWithoutSchedule) {
    throw new ClockError("NO_SCHEDULE", "ยังไม่มีตารางกะของวันนี้");
  }

  if (schedule?.isDayOff) {
    throw new ClockError("DAY_OFF", "วันนี้เป็นวันหยุดตามตารางงาน");
  }

  return prisma.$transaction(async (tx) => {
    let record = await tx.attendanceRecord.findFirst({
      where: {
        employeeId: input.employeeId,
        workDate,
        workScheduleId: schedule?.id ?? null,
      },
    });

    if (!record) {
      record = await tx.attendanceRecord.create({
        data: {
          employeeId: input.employeeId,
          workScheduleId: schedule?.id ?? null,
          workDate,
          scheduledStart: schedule?.startsAt ?? null,
          scheduledEnd: schedule?.endsAt ?? null,
          status: "OPEN",
        },
      });
    }

    if (record.status === "LOCKED") {
      throw new ClockError("PERIOD_LOCKED", "ช่วงเวลานี้ถูกล็อกแล้ว");
    }

    const now = new Date();
    const lateGraceMinutes = schedule?.shiftTemplate?.lateGraceMinutes ?? 0;

    if (input.type === "CHECK_IN") {
      if (record.clockIn) {
        throw new ClockError("ALREADY_CHECKED_IN", "ลงเวลาเข้างานไปแล้ววันนี้");
      }
      const metrics = calculateAttendanceMetrics(
        {
          clockIn: now,
          clockOut: record.clockOut,
          scheduledStart: record.scheduledStart,
          scheduledEnd: record.scheduledEnd,
        },
        { lateGraceMinutes },
      );
      record = await tx.attendanceRecord.update({
        where: { id: record.id },
        data: {
          clockIn: now,
          lateMinutes: metrics.lateMinutes,
          status: record.clockOut ? metrics.status : "OPEN",
        },
      });
    } else {
      if (!record.clockIn) {
        throw new ClockError("NOT_CHECKED_IN", "ยังไม่ได้ลงเวลาเข้างานวันนี้");
      }
      if (record.clockOut) {
        throw new ClockError(
          "ALREADY_CHECKED_OUT",
          "ลงเวลาออกงานไปแล้ววันนี้",
        );
      }
      const metrics = calculateAttendanceMetrics(
        {
          clockIn: record.clockIn,
          clockOut: now,
          scheduledStart: record.scheduledStart,
          scheduledEnd: record.scheduledEnd,
        },
        { lateGraceMinutes },
      );
      record = await tx.attendanceRecord.update({
        where: { id: record.id },
        data: {
          clockOut: now,
          workedMinutes: metrics.workedMinutes,
          lateMinutes: metrics.lateMinutes,
          earlyLeaveMinutes: metrics.earlyLeaveMinutes,
          otMinutes: metrics.otMinutes,
          status: metrics.status,
        },
      });
    }

    const event = await tx.attendanceEvent.create({
      data: {
        employeeId: input.employeeId,
        attendanceRecordId: record.id,
        type: input.type,
        occurredAt: now,
        latitude: input.latitude,
        longitude: input.longitude,
        distanceMeters,
        accuracyMeters: input.accuracyMeters ?? null,
        userAgent: input.userAgent ?? null,
      },
    });

    return { record, event, distanceMeters };
  });
}

export async function getMyWorkHistory(employeeId: string, days = 14) {
  const since = new Date();
  since.setUTCDate(since.getUTCDate() - days);
  since.setUTCHours(0, 0, 0, 0);

  return prisma.attendanceRecord.findMany({
    where: { employeeId, workDate: { gte: since } },
    include: {
      workSchedule: {
        select: { shiftTemplate: { select: { name: true } } },
      },
    },
    orderBy: { workDate: "desc" },
    take: days,
  });
}

export function serializeAttendanceRecordSummary(record: {
  id: string;
  workDate: Date;
  clockIn: Date | null;
  clockOut: Date | null;
  workedMinutes: number;
  lateMinutes: number;
  earlyLeaveMinutes: number;
  otMinutes: number;
  otApprovedMinutes: number;
  status: string;
  workSchedule?: { shiftTemplate: { name: string } | null } | null;
}) {
  return {
    id: record.id,
    workDate: dateKeyUtc(record.workDate),
    shiftName: record.workSchedule?.shiftTemplate?.name ?? null,
    clockIn: record.clockIn?.toISOString() ?? null,
    clockOut: record.clockOut?.toISOString() ?? null,
    workedMinutes: record.workedMinutes,
    lateMinutes: record.lateMinutes,
    earlyLeaveMinutes: record.earlyLeaveMinutes,
    otMinutes: record.otMinutes,
    otApprovedMinutes: record.otApprovedMinutes,
    status: record.status,
  };
}
