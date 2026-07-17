import type { AttendanceEventType } from "@/generated/prisma/client";

import { calculateAttendanceMetrics } from "@/lib/hr/attendance";
import {
  attendanceStatusForMatch,
  findCandidateScheduledShifts,
  pickNearest,
} from "@/lib/hr/attendance-matching";
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

export async function listPublishedScheduledShiftsForEmployee(
  employeeId: string,
  at: Date,
) {
  const windowStart = new Date(at.getTime() - 18 * 60 * 60_000);
  const windowEnd = new Date(at.getTime() + 18 * 60 * 60_000);
  return prisma.scheduledShift.findMany({
    where: {
      employeeId,
      status: "SCHEDULED",
      plannedStart: { lte: windowEnd },
      plannedEnd: { gte: windowStart },
      schedulePeriod: { status: "PUBLISHED" },
    },
    include: {
      shiftTemplate: {
        select: {
          id: true,
          name: true,
          lateGraceMinutes: true,
          earlyLeaveGraceMinutes: true,
        },
      },
    },
    orderBy: { plannedStart: "asc" },
  });
}

export async function getTodayScheduleForEmployee(
  employeeId: string,
  timezone: string,
) {
  const todayKey = todayDateKeyInTimezone(timezone);
  const workDate = parseDateKey(todayKey);
  if (!workDate) return null;

  const published = await listPublishedScheduledShiftsForEmployee(
    employeeId,
    new Date(),
  );
  const todayShifts = published.filter(
    (shift) => dateKeyUtc(shift.workDate) === todayKey,
  );
  if (todayShifts[0]) {
    const shift = todayShifts[0];
    return {
      id: shift.id,
      employeeId: shift.employeeId,
      workDate: shift.workDate,
      startsAt: shift.plannedStart,
      endsAt: shift.plannedEnd,
      isDayOff: false,
      status: "ASSIGNED" as const,
      shiftTemplateId: shift.shiftTemplateId,
      shiftTemplate: shift.shiftTemplate
        ? {
            id: shift.shiftTemplate.id,
            name: shift.shiftTemplate.name,
            startMinutes: 0,
            endMinutes: 0,
            breakMinutes: shift.breakMinutes,
            lateGraceMinutes: shift.lateGraceMinutes,
            earlyLeaveGraceMinutes:
              shift.shiftTemplate.earlyLeaveGraceMinutes ?? 0,
          }
        : {
            id: shift.id,
            name: "กะตามตาราง",
            startMinutes: 0,
            endMinutes: 0,
            breakMinutes: shift.breakMinutes,
            lateGraceMinutes: shift.lateGraceMinutes,
            earlyLeaveGraceMinutes: 0,
          },
      source: "scheduled_shift" as const,
      scheduledShiftId: shift.id,
    };
  }

  const fromMembership = await ensureWorkScheduleFromMembership(
    employeeId,
    workDate,
  );
  if (fromMembership) {
    return { ...fromMembership, source: "work_schedule" as const };
  }

  const legacy = await prisma.workSchedule.findFirst({
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
  return legacy ? { ...legacy, source: "work_schedule" as const } : null;
}

export type ClockInput = {
  employeeId: string;
  type: AttendanceEventType;
  latitude: number;
  longitude: number;
  accuracyMeters?: number | null;
  userAgent?: string | null;
  scheduledShiftId?: string | null;
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
 * geofence radius and duplicate/ordering rules server-side. Prefers published
 * ScheduledShift, then falls back to WorkSchedule / membership.
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

  const now = new Date();
  const publishedShifts = await listPublishedScheduledShiftsForEmployee(
    input.employeeId,
    now,
  );
  const candidates = findCandidateScheduledShifts(
    publishedShifts,
    input.employeeId,
    now,
  );

  let matchedShift =
    input.scheduledShiftId != null
      ? (candidates.find((item) => item.id === input.scheduledShiftId) ?? null)
      : null;

  if (!matchedShift && candidates.length === 1) {
    matchedShift = candidates[0] ?? null;
  } else if (!matchedShift && candidates.length > 1) {
    if (input.type === "CHECK_IN" && !input.scheduledShiftId) {
      throw new ClockError(
        "SHIFT_SELECTION_REQUIRED",
        "มีหลายกะในช่วงนี้ — กรุณาเลือกกะก่อนลงเวลา",
      );
    }
    matchedShift = pickNearest(candidates, now);
  }

  const fullMatched = matchedShift
    ? (publishedShifts.find((item) => item.id === matchedShift.id) ?? null)
    : null;

  const legacySchedule = fullMatched
    ? null
    : await prisma.workSchedule.findFirst({
        where: { employeeId: input.employeeId, workDate, status: "ASSIGNED" },
        include: { shiftTemplate: true },
      });

  if (!fullMatched && !legacySchedule && !settings.allowClockWithoutSchedule) {
    throw new ClockError("NO_SCHEDULE", "ยังไม่มีตารางกะของวันนี้");
  }

  if (legacySchedule?.isDayOff) {
    throw new ClockError("DAY_OFF", "วันนี้เป็นวันหยุดตามตารางงาน");
  }

  const initialStatus = attendanceStatusForMatch(
    fullMatched
      ? {
          id: fullMatched.id,
          employeeId: fullMatched.employeeId,
          plannedStart: fullMatched.plannedStart,
          plannedEnd: fullMatched.plannedEnd,
          status: fullMatched.status,
        }
      : legacySchedule
        ? {
            id: legacySchedule.id,
            employeeId: legacySchedule.employeeId,
            plannedStart: legacySchedule.startsAt,
            plannedEnd: legacySchedule.endsAt,
            status: "SCHEDULED",
          }
        : null,
  );

  return prisma.$transaction(async (tx) => {
    let record = await tx.attendanceRecord.findFirst({
      where: {
        employeeId: input.employeeId,
        workDate,
        ...(fullMatched
          ? { scheduledShiftId: fullMatched.id }
          : { workScheduleId: legacySchedule?.id ?? null }),
      },
    });

    if (!record) {
      record = await tx.attendanceRecord.create({
        data: {
          employeeId: input.employeeId,
          workScheduleId: legacySchedule?.id ?? null,
          scheduledShiftId: fullMatched?.id ?? null,
          source: "MOBILE",
          workDate,
          scheduledStart:
            fullMatched?.plannedStart ?? legacySchedule?.startsAt ?? null,
          scheduledEnd:
            fullMatched?.plannedEnd ?? legacySchedule?.endsAt ?? null,
          status: initialStatus === "PENDING_REVIEW" ? "PENDING_REVIEW" : "OPEN",
        },
      });
    }

    if (record.status === "LOCKED") {
      throw new ClockError("PERIOD_LOCKED", "ช่วงเวลานี้ถูกล็อกแล้ว");
    }

    const lateGraceMinutes =
      fullMatched?.lateGraceMinutes ??
      legacySchedule?.shiftTemplate?.lateGraceMinutes ??
      0;

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
          status:
            record.status === "PENDING_REVIEW"
              ? "PENDING_REVIEW"
              : record.clockOut
                ? metrics.status
                : "OPEN",
          source: "MOBILE",
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
          status:
            record.status === "PENDING_REVIEW"
              ? "PENDING_REVIEW"
              : metrics.status,
          source: "MOBILE",
        },
      });

      // Auto-suggest OT when clock-out exceeds scheduled end (payroll still uses approved only).
      if (metrics.otMinutes > 0) {
        const pendingOt = await tx.attendanceAdjustment.findFirst({
          where: {
            attendanceRecordId: record.id,
            type: "OT_REQUEST",
            status: "PENDING",
          },
          select: { id: true },
        });
        if (!pendingOt) {
          await tx.attendanceAdjustment.create({
            data: {
              attendanceRecordId: record.id,
              type: "OT_REQUEST",
              status: "PENDING",
              reason: "ระบบเสนอ OT จากเวลาออกงานเกินตาราง",
              proposedOtMinutes: metrics.otMinutes,
              requestedById: input.employeeId,
            },
          });
        }
      }
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

    return {
      record,
      event,
      distanceMeters,
      matchedShiftId: fullMatched?.id ?? null,
    };
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
      scheduledShift: {
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
  scheduledShift?: { shiftTemplate: { name: string } | null } | null;
}) {
  return {
    id: record.id,
    workDate: dateKeyUtc(record.workDate),
    shiftName:
      record.scheduledShift?.shiftTemplate?.name ??
      record.workSchedule?.shiftTemplate?.name ??
      null,
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
