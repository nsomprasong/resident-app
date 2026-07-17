import type { AttendanceRecord, Prisma } from "@/generated/prisma/client";

import {
  apiErrorResponse,
  readJsonObject,
  validationErrorResponse,
  type ValidationIssue,
} from "@/lib/api/validation";
import { recordAuditLog } from "@/lib/audit/audit-log";
import { getCurrentUser } from "@/lib/auth/current-user";
import {
  applyApprovedOt,
  calculateAttendanceMetrics,
  isDateInLockedPeriod,
  resolveAttendanceShiftName,
} from "@/lib/hr/attendance";
import { displayEmployeeName } from "@/lib/hr/employees";
import { dateKeyUtc, parseDateKey } from "@/lib/hr/schedules";
import { prisma } from "@/lib/prisma";
import { NextRequest, NextResponse } from "next/server";

const recordInclude = {
  employee: {
    select: {
      id: true,
      name: true,
      firstName: true,
      lastName: true,
      employeeCode: true,
    },
  },
  workSchedule: {
    select: {
      id: true,
      shiftTemplate: { select: { id: true, name: true } },
    },
  },
  scheduledShift: {
    select: {
      id: true,
      shiftTemplate: { select: { id: true, name: true } },
    },
  },
  adjustments: {
    where: { status: "PENDING" },
    orderBy: { createdAt: "desc" as const },
    take: 5,
  },
} satisfies Prisma.AttendanceRecordInclude;

function isUuid(value: string) {
  return /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(
    value,
  );
}

function serializeRecord(
  record: AttendanceRecord & {
    employee: {
      id: string;
      name: string;
      firstName: string | null;
      lastName: string | null;
      employeeCode: string | null;
    };
    workSchedule: {
      id: string;
      shiftTemplate: { id: string; name: string } | null;
    } | null;
    scheduledShift: {
      id: string;
      shiftTemplate: { id: string; name: string } | null;
    } | null;
    adjustments: Array<{
      id: string;
      type: string;
      status: string;
      reason: string;
      proposedOtMinutes: number | null;
    }>;
  },
) {
  return {
    id: record.id,
    employeeId: record.employeeId,
    employeeName: displayEmployeeName(record.employee),
    employeeCode: record.employee.employeeCode,
    workScheduleId: record.workScheduleId,
    scheduledShiftId: record.scheduledShiftId,
    shiftName: resolveAttendanceShiftName(record),
    workDate: dateKeyUtc(record.workDate),
    clockIn: record.clockIn?.toISOString() ?? null,
    clockOut: record.clockOut?.toISOString() ?? null,
    breakStart: record.breakStart?.toISOString() ?? null,
    breakEnd: record.breakEnd?.toISOString() ?? null,
    scheduledStart: record.scheduledStart?.toISOString() ?? null,
    scheduledEnd: record.scheduledEnd?.toISOString() ?? null,
    workedMinutes: record.workedMinutes,
    breakMinutes: record.breakMinutes,
    lateMinutes: record.lateMinutes,
    earlyLeaveMinutes: record.earlyLeaveMinutes,
    otMinutes: record.otMinutes,
    otApprovedMinutes: record.otApprovedMinutes,
    isHolidayWork: record.isHolidayWork,
    status: record.status,
    notes: record.notes,
    pendingAdjustments: record.adjustments,
  };
}

async function assertNotLocked(workDate: Date) {
  const periods = await prisma.attendancePeriod.findMany({
    where: {
      lockedAt: { not: null },
      periodStart: { lte: workDate },
      periodEnd: { gte: workDate },
    },
  });
  if (isDateInLockedPeriod(workDate, periods)) {
    throw new Error("PERIOD_LOCKED");
  }
}

function recompute(
  record: Pick<
    AttendanceRecord,
    | "clockIn"
    | "clockOut"
    | "breakStart"
    | "breakEnd"
    | "scheduledStart"
    | "scheduledEnd"
    | "isHolidayWork"
    | "otApprovedMinutes"
    | "status"
  >,
) {
  if (record.status === "ABSENT") {
    return calculateAttendanceMetrics({ markAbsent: true });
  }
  const metrics = calculateAttendanceMetrics({
    clockIn: record.clockIn,
    clockOut: record.clockOut,
    breakStart: record.breakStart,
    breakEnd: record.breakEnd,
    scheduledStart: record.scheduledStart,
    scheduledEnd: record.scheduledEnd,
    isHolidayWork: record.isHolidayWork,
  });
  return applyApprovedOt(metrics, record.otApprovedMinutes);
}

export async function GET(request: NextRequest) {
  try {
    const fromKey = request.nextUrl.searchParams.get("from");
    const toKey = request.nextUrl.searchParams.get("to");
    const employeeIdParam = request.nextUrl.searchParams.get("employeeId");

    const hasFrom = Boolean(fromKey?.trim());
    const hasTo = Boolean(toKey?.trim());
    if (hasFrom !== hasTo) {
      return apiErrorResponse(
        "ต้องระบุ from และ to คู่กัน หรือไม่ระบุทั้งคู่",
        400,
        "VALIDATION_ERROR",
      );
    }

    let from: Date | null = null;
    let to: Date | null = null;
    if (hasFrom && hasTo) {
      from = parseDateKey(fromKey!.trim());
      to = parseDateKey(toKey!.trim());
      if (!from || !to || from > to) {
        return apiErrorResponse("ช่วงวันที่ไม่ถูกต้อง", 400, "VALIDATION_ERROR");
      }
    }

    const employeeId =
      employeeIdParam && isUuid(employeeIdParam.trim())
        ? employeeIdParam.trim()
        : null;

    const recordWhere: Prisma.AttendanceRecordWhereInput = {
      ...(from && to ? { workDate: { gte: from, lte: to } } : {}),
      ...(employeeId ? { employeeId } : {}),
    };

    const [records, periods, pending] = await Promise.all([
      prisma.attendanceRecord.findMany({
        where: recordWhere,
        include: recordInclude,
        orderBy: [{ workDate: "desc" }, { clockIn: "desc" }],
        ...(from && to ? {} : { take: 5000 }),
      }),
      prisma.attendancePeriod.findMany({
        where:
          from && to
            ? {
                periodStart: { lte: to },
                periodEnd: { gte: from },
              }
            : {},
        orderBy: { periodStart: "desc" },
        take: from && to ? undefined : 100,
      }),
      prisma.attendanceAdjustment.findMany({
        where: {
          status: "PENDING",
          ...(employeeId
            ? { attendanceRecord: { employeeId } }
            : {}),
        },
        include: {
          attendanceRecord: {
            select: {
              id: true,
              workDate: true,
              employeeId: true,
              employee: {
                select: { id: true, name: true, firstName: true, lastName: true },
              },
            },
          },
        },
        orderBy: { createdAt: "asc" },
        take: 50,
      }),
    ]);

    return NextResponse.json({
      from: fromKey,
      to: toKey,
      records: records.map(serializeRecord),
      periods: periods.map((period) => ({
        id: period.id,
        periodStart: dateKeyUtc(period.periodStart),
        periodEnd: dateKeyUtc(period.periodEnd),
        lockedAt: period.lockedAt?.toISOString() ?? null,
        lockedById: period.lockedById,
      })),
      pendingApprovals: pending.map((item) => ({
        id: item.id,
        type: item.type,
        reason: item.reason,
        proposedOtMinutes: item.proposedOtMinutes,
        attendanceRecordId: item.attendanceRecordId,
        employeeId: item.attendanceRecord.employeeId,
        workDate: dateKeyUtc(item.attendanceRecord.workDate),
        employeeName: displayEmployeeName(item.attendanceRecord.employee),
      })),
    });
  } catch (error) {
    console.error("GET /api/hr/attendance failed", error);
    return apiErrorResponse("ไม่สามารถโหลดเวลาเข้างานได้", 500, "INTERNAL_ERROR");
  }
}

export async function POST(request: NextRequest) {
  try {
    const currentUser = await getCurrentUser();
    const actorEmployeeId = currentUser?.employee?.id;
    if (!actorEmployeeId) {
      return apiErrorResponse("ไม่พบบัญชีพนักงานของผู้ใช้", 403, "FORBIDDEN");
    }
    const permissions = currentUser.employee?.role?.permissions ?? [];
    const parsed = await readJsonObject(request);
    if (!parsed.ok) return parsed.response;
    const mode =
      typeof parsed.body.mode === "string" ? parsed.body.mode : "clock";

    if (mode === "open-from-schedule") {
      const workDateRaw =
        typeof parsed.body.workDate === "string"
          ? parsed.body.workDate.trim()
          : "";
      const workDate = parseDateKey(workDateRaw);
      if (!workDate) {
        return validationErrorResponse("วันที่ไม่ถูกต้อง", [
          { path: "workDate", message: "ต้องเป็น YYYY-MM-DD" },
        ]);
      }
      await assertNotLocked(workDate);

      const schedules = await prisma.workSchedule.findMany({
        where: { workDate, status: "ASSIGNED" },
      });
      let created = 0;
      for (const schedule of schedules) {
        const existing = await prisma.attendanceRecord.findFirst({
          where: {
            employeeId: schedule.employeeId,
            workDate,
            workScheduleId: schedule.id,
          },
        });
        if (existing) continue;
        const holiday = await prisma.holidayCalendar.findFirst({
          where: { holidayDate: workDate, isDayOff: true },
        });
        await prisma.attendanceRecord.create({
          data: {
            employeeId: schedule.employeeId,
            workScheduleId: schedule.id,
            workDate,
            scheduledStart: schedule.startsAt,
            scheduledEnd: schedule.endsAt,
            isHolidayWork: Boolean(holiday),
            status: "OPEN",
          },
        });
        created += 1;
      }

      await recordAuditLog({
        actor: {
          employeeId: actorEmployeeId,
          authUserId: currentUser.user.id,
        },
        action: "HR_ATTENDANCE_OPENED_FROM_SCHEDULE",
        entityType: "ATTENDANCE",
        metadata: { workDate: workDateRaw, created },
      });

      return NextResponse.json({ created });
    }

    if (mode === "clock") {
      const issues: ValidationIssue[] = [];
      const attendanceId =
        typeof parsed.body.attendanceId === "string"
          ? parsed.body.attendanceId.trim()
          : "";
      const action =
        typeof parsed.body.action === "string"
          ? parsed.body.action.trim()
          : "";
      const atRaw =
        typeof parsed.body.at === "string" ? parsed.body.at.trim() : "";
      if (!isUuid(attendanceId)) {
        issues.push({ path: "attendanceId", message: "รหัสรายการไม่ถูกต้อง" });
      }
      if (
        !["clock-in", "clock-out", "break-start", "break-end"].includes(action)
      ) {
        issues.push({ path: "action", message: "action ไม่ถูกต้อง" });
      }
      const at = atRaw ? new Date(atRaw) : new Date();
      if (Number.isNaN(at.getTime())) {
        issues.push({ path: "at", message: "เวลาไม่ถูกต้อง" });
      }
      if (issues.length) {
        return validationErrorResponse("กรุณาตรวจสอบการลงเวลา", issues);
      }

      const existing = await prisma.attendanceRecord.findUnique({
        where: { id: attendanceId },
      });
      if (!existing) {
        return apiErrorResponse("ไม่พบรายการลงเวลา", 404, "NOT_FOUND");
      }
      if (existing.status === "LOCKED" || existing.status === "ABSENT") {
        return apiErrorResponse("รายการนี้แก้ไขไม่ได้", 409, "LOCKED");
      }
      await assertNotLocked(existing.workDate);

      const patch: Prisma.AttendanceRecordUpdateInput = {};
      if (action === "clock-in") patch.clockIn = at;
      if (action === "clock-out") patch.clockOut = at;
      if (action === "break-start") patch.breakStart = at;
      if (action === "break-end") patch.breakEnd = at;

      const merged = { ...existing, ...{
        clockIn: action === "clock-in" ? at : existing.clockIn,
        clockOut: action === "clock-out" ? at : existing.clockOut,
        breakStart: action === "break-start" ? at : existing.breakStart,
        breakEnd: action === "break-end" ? at : existing.breakEnd,
      }};
      const metrics = recompute(merged);

      const updated = await prisma.attendanceRecord.update({
        where: { id: attendanceId },
        data: {
          ...patch,
          workedMinutes: metrics.workedMinutes,
          breakMinutes: metrics.breakMinutes,
          lateMinutes: metrics.lateMinutes,
          earlyLeaveMinutes: metrics.earlyLeaveMinutes,
          otMinutes: metrics.otMinutes,
          status: metrics.status,
        },
        include: recordInclude,
      });

      if (
        action === "clock-out" &&
        metrics.otMinutes > 0 &&
        actorEmployeeId
      ) {
        const pendingOt = await prisma.attendanceAdjustment.findFirst({
          where: {
            attendanceRecordId: updated.id,
            type: "OT_REQUEST",
            status: "PENDING",
          },
          select: { id: true },
        });
        if (!pendingOt) {
          await prisma.attendanceAdjustment.create({
            data: {
              attendanceRecordId: updated.id,
              type: "OT_REQUEST",
              status: "PENDING",
              reason: "ระบบเสนอ OT จากเวลาออกงานเกินตาราง",
              proposedOtMinutes: metrics.otMinutes,
              requestedById: actorEmployeeId,
            },
          });
        }
      }

      await recordAuditLog({
        actor: {
          employeeId: actorEmployeeId,
          authUserId: currentUser.user.id,
        },
        action: "HR_ATTENDANCE_CLOCKED",
        entityType: "ATTENDANCE",
        entityId: updated.id,
        metadata: { action, at: at.toISOString() },
      });

      return NextResponse.json(serializeRecord(updated));
    }

    if (mode === "mark-absent") {
      const attendanceId =
        typeof parsed.body.attendanceId === "string"
          ? parsed.body.attendanceId.trim()
          : "";
      if (!isUuid(attendanceId)) {
        return validationErrorResponse("รหัสรายการไม่ถูกต้อง", [
          { path: "attendanceId", message: "UUID ไม่ถูกต้อง" },
        ]);
      }
      const existing = await prisma.attendanceRecord.findUnique({
        where: { id: attendanceId },
      });
      if (!existing) {
        return apiErrorResponse("ไม่พบรายการลงเวลา", 404, "NOT_FOUND");
      }
      await assertNotLocked(existing.workDate);
      const metrics = calculateAttendanceMetrics({ markAbsent: true });
      const updated = await prisma.attendanceRecord.update({
        where: { id: attendanceId },
        data: {
          clockIn: null,
          clockOut: null,
          breakStart: null,
          breakEnd: null,
          ...metrics,
          otApprovedMinutes: 0,
        },
        include: recordInclude,
      });
      return NextResponse.json(serializeRecord(updated));
    }

    if (mode === "adjust") {
      const issues: ValidationIssue[] = [];
      const attendanceId =
        typeof parsed.body.attendanceId === "string"
          ? parsed.body.attendanceId.trim()
          : "";
      const type =
        typeof parsed.body.type === "string" ? parsed.body.type.trim() : "";
      const reason =
        typeof parsed.body.reason === "string" ? parsed.body.reason.trim() : "";
      if (!isUuid(attendanceId)) {
        issues.push({ path: "attendanceId", message: "รหัสรายการไม่ถูกต้อง" });
      }
      if (
        !["CLOCK_CORRECTION", "OT_REQUEST", "MANUAL_ENTRY"].includes(type)
      ) {
        issues.push({ path: "type", message: "ประเภทคำขอไม่ถูกต้อง" });
      }
      if (!reason || reason.length < 3) {
        issues.push({ path: "reason", message: "ต้องระบุเหตุผล" });
      }
      if (issues.length) {
        return validationErrorResponse("กรุณาตรวจสอบคำขอแก้ไข", issues);
      }

      const existing = await prisma.attendanceRecord.findUnique({
        where: { id: attendanceId },
      });
      if (!existing) {
        return apiErrorResponse("ไม่พบรายการลงเวลา", 404, "NOT_FOUND");
      }
      if (existing.status === "LOCKED") {
        return apiErrorResponse("รอบถูกล็อกแล้ว", 409, "PERIOD_LOCKED");
      }
      await assertNotLocked(existing.workDate);

      const created = await prisma.attendanceAdjustment.create({
        data: {
          attendanceRecordId: attendanceId,
          type: type as "CLOCK_CORRECTION" | "OT_REQUEST" | "MANUAL_ENTRY",
          reason,
          proposedClockIn:
            typeof parsed.body.proposedClockIn === "string"
              ? new Date(parsed.body.proposedClockIn)
              : null,
          proposedClockOut:
            typeof parsed.body.proposedClockOut === "string"
              ? new Date(parsed.body.proposedClockOut)
              : null,
          proposedBreakStart:
            typeof parsed.body.proposedBreakStart === "string"
              ? new Date(parsed.body.proposedBreakStart)
              : null,
          proposedBreakEnd:
            typeof parsed.body.proposedBreakEnd === "string"
              ? new Date(parsed.body.proposedBreakEnd)
              : null,
          proposedOtMinutes:
            parsed.body.proposedOtMinutes === undefined ||
            parsed.body.proposedOtMinutes === null ||
            parsed.body.proposedOtMinutes === ""
              ? null
              : Number(parsed.body.proposedOtMinutes),
          requestedById: actorEmployeeId,
        },
      });

      await recordAuditLog({
        actor: {
          employeeId: actorEmployeeId,
          authUserId: currentUser.user.id,
        },
        action: "HR_ATTENDANCE_ADJUSTMENT_REQUESTED",
        entityType: "ATTENDANCE_ADJUSTMENT",
        entityId: created.id,
        metadata: { type, attendanceId },
      });

      return NextResponse.json(
        { id: created.id, status: created.status, type: created.type },
        { status: 201 },
      );
    }

    if (mode === "review") {
      if (!permissions.includes("hr.attendance.approve")) {
        return apiErrorResponse("ไม่มีสิทธิ์อนุมัติ", 403, "FORBIDDEN");
      }
      const adjustmentId =
        typeof parsed.body.adjustmentId === "string"
          ? parsed.body.adjustmentId.trim()
          : "";
      const decision =
        typeof parsed.body.decision === "string"
          ? parsed.body.decision.trim()
          : "";
      if (!isUuid(adjustmentId) || !["APPROVED", "REJECTED"].includes(decision)) {
        return validationErrorResponse("คำขออนุมัติไม่ถูกต้อง", [
          { path: "decision", message: "ต้องเป็น APPROVED หรือ REJECTED" },
        ]);
      }

      const adjustment = await prisma.attendanceAdjustment.findUnique({
        where: { id: adjustmentId },
        include: { attendanceRecord: true },
      });
      if (!adjustment || adjustment.status !== "PENDING") {
        return apiErrorResponse("ไม่พบคำขอที่รออนุมัติ", 404, "NOT_FOUND");
      }
      await assertNotLocked(adjustment.attendanceRecord.workDate);

      const result = await prisma.$transaction(async (tx) => {
        const reviewed = await tx.attendanceAdjustment.update({
          where: { id: adjustmentId },
          data: {
            status: decision as "APPROVED" | "REJECTED",
            reviewedById: actorEmployeeId,
            reviewedAt: new Date(),
            reviewNote:
              typeof parsed.body.reviewNote === "string"
                ? parsed.body.reviewNote.trim() || null
                : null,
          },
        });

        if (decision === "APPROVED") {
          const record = adjustment.attendanceRecord;
          const next = {
            clockIn: adjustment.proposedClockIn ?? record.clockIn,
            clockOut: adjustment.proposedClockOut ?? record.clockOut,
            breakStart: adjustment.proposedBreakStart ?? record.breakStart,
            breakEnd: adjustment.proposedBreakEnd ?? record.breakEnd,
            scheduledStart: record.scheduledStart,
            scheduledEnd: record.scheduledEnd,
            isHolidayWork: record.isHolidayWork,
            otApprovedMinutes:
              adjustment.type === "OT_REQUEST" &&
              adjustment.proposedOtMinutes !== null
                ? adjustment.proposedOtMinutes
                : record.otApprovedMinutes,
            status: record.status,
          };
          const metrics = recompute(next);
          await tx.attendanceRecord.update({
            where: { id: record.id },
            data: {
              clockIn: next.clockIn,
              clockOut: next.clockOut,
              breakStart: next.breakStart,
              breakEnd: next.breakEnd,
              otApprovedMinutes: next.otApprovedMinutes,
              workedMinutes: metrics.workedMinutes,
              breakMinutes: metrics.breakMinutes,
              lateMinutes: metrics.lateMinutes,
              earlyLeaveMinutes: metrics.earlyLeaveMinutes,
              otMinutes: metrics.otMinutes,
              status: metrics.status,
            },
          });
        }

        return reviewed;
      });

      await recordAuditLog({
        actor: {
          employeeId: actorEmployeeId,
          authUserId: currentUser.user.id,
        },
        action: "HR_ATTENDANCE_ADJUSTMENT_REVIEWED",
        entityType: "ATTENDANCE_ADJUSTMENT",
        entityId: result.id,
        metadata: { decision },
      });

      return NextResponse.json({
        id: result.id,
        status: result.status,
      });
    }

    if (mode === "correct-time") {
      if (
        !permissions.includes("hr.attendance.approve") &&
        !permissions.includes("hr.attendance.manage")
      ) {
        return apiErrorResponse("ไม่มีสิทธิ์แก้ไขเวลา", 403, "FORBIDDEN");
      }

      const issues: ValidationIssue[] = [];
      const attendanceId =
        typeof parsed.body.attendanceId === "string"
          ? parsed.body.attendanceId.trim()
          : "";
      const reason =
        typeof parsed.body.reason === "string" ? parsed.body.reason.trim() : "";
      if (!isUuid(attendanceId)) {
        issues.push({ path: "attendanceId", message: "รหัสรายการไม่ถูกต้อง" });
      }
      if (!reason || reason.length < 3) {
        issues.push({ path: "reason", message: "ต้องระบุเหตุผลอย่างน้อย 3 ตัวอักษร" });
      }

      const hasClockIn = "clockIn" in parsed.body;
      const hasClockOut = "clockOut" in parsed.body;
      if (!hasClockIn && !hasClockOut) {
        issues.push({
          path: "clockIn",
          message: "ต้องระบุเวลาเข้าหรือเวลาออกอย่างน้อยหนึ่งค่า",
        });
      }

      let nextClockIn: Date | null | undefined;
      let nextClockOut: Date | null | undefined;

      if (hasClockIn) {
        const raw = parsed.body.clockIn;
        if (raw === null || raw === "") {
          nextClockIn = null;
        } else if (typeof raw === "string") {
          const parsedIn = new Date(raw);
          if (Number.isNaN(parsedIn.getTime())) {
            issues.push({ path: "clockIn", message: "เวลาเข้าไม่ถูกต้อง" });
          } else {
            nextClockIn = parsedIn;
          }
        } else {
          issues.push({ path: "clockIn", message: "รูปแบบเวลาเข้าไม่ถูกต้อง" });
        }
      }

      if (hasClockOut) {
        const raw = parsed.body.clockOut;
        if (raw === null || raw === "") {
          nextClockOut = null;
        } else if (typeof raw === "string") {
          const parsedOut = new Date(raw);
          if (Number.isNaN(parsedOut.getTime())) {
            issues.push({ path: "clockOut", message: "เวลาออกไม่ถูกต้อง" });
          } else {
            nextClockOut = parsedOut;
          }
        } else {
          issues.push({ path: "clockOut", message: "รูปแบบเวลาออกไม่ถูกต้อง" });
        }
      }

      if (issues.length) {
        return validationErrorResponse("กรุณาตรวจสอบการแก้ไขเวลา", issues);
      }

      const existing = await prisma.attendanceRecord.findUnique({
        where: { id: attendanceId },
      });
      if (!existing) {
        return apiErrorResponse("ไม่พบรายการลงเวลา", 404, "NOT_FOUND");
      }
      if (existing.status === "LOCKED") {
        return apiErrorResponse("รายการถูกล็อกแล้ว", 409, "LOCKED");
      }
      await assertNotLocked(existing.workDate);

      const clockIn =
        nextClockIn !== undefined ? nextClockIn : existing.clockIn;
      const clockOut =
        nextClockOut !== undefined ? nextClockOut : existing.clockOut;

      if (clockIn && clockOut && clockOut.getTime() < clockIn.getTime()) {
        return validationErrorResponse("กรุณาตรวจสอบการแก้ไขเวลา", [
          { path: "clockOut", message: "เวลาออกต้องไม่ก่อนเวลาเข้า" },
        ]);
      }

      const next = {
        clockIn,
        clockOut,
        breakStart: existing.breakStart,
        breakEnd: existing.breakEnd,
        scheduledStart: existing.scheduledStart,
        scheduledEnd: existing.scheduledEnd,
        isHolidayWork: existing.isHolidayWork,
        otApprovedMinutes: existing.otApprovedMinutes,
        status: existing.status,
      };
      const metrics = recompute(next);

      const updated = await prisma.attendanceRecord.update({
        where: { id: attendanceId },
        data: {
          clockIn: next.clockIn,
          clockOut: next.clockOut,
          workedMinutes: metrics.workedMinutes,
          breakMinutes: metrics.breakMinutes,
          lateMinutes: metrics.lateMinutes,
          earlyLeaveMinutes: metrics.earlyLeaveMinutes,
          otMinutes: metrics.otMinutes,
          status: metrics.status,
          notes: existing.notes
            ? `${existing.notes}\n[แก้ไข] ${reason}`
            : `[แก้ไข] ${reason}`,
        },
        include: recordInclude,
      });

      await recordAuditLog({
        actor: {
          employeeId: actorEmployeeId,
          authUserId: currentUser.user.id,
        },
        action: "HR_ATTENDANCE_TIME_CORRECTED",
        entityType: "ATTENDANCE",
        entityId: updated.id,
        metadata: {
          reason,
          clockIn: clockIn?.toISOString() ?? null,
          clockOut: clockOut?.toISOString() ?? null,
        },
      });

      return NextResponse.json(serializeRecord(updated));
    }

    if (mode === "set-ot-approved") {
      if (
        !permissions.includes("hr.attendance.approve") &&
        !permissions.includes("hr.attendance.manage")
      ) {
        return apiErrorResponse("ไม่มีสิทธิ์อนุมัติ OT", 403, "FORBIDDEN");
      }
      const attendanceId =
        typeof parsed.body.attendanceId === "string"
          ? parsed.body.attendanceId.trim()
          : "";
      const reason =
        typeof parsed.body.reason === "string" ? parsed.body.reason.trim() : "";
      const rawMinutes = parsed.body.otApprovedMinutes;
      const otApprovedMinutes =
        rawMinutes === undefined || rawMinutes === null || rawMinutes === ""
          ? NaN
          : Number(rawMinutes);
      if (!isUuid(attendanceId)) {
        return validationErrorResponse("รหัสรายการไม่ถูกต้อง", [
          { path: "attendanceId", message: "UUID ไม่ถูกต้อง" },
        ]);
      }
      if (!Number.isFinite(otApprovedMinutes) || otApprovedMinutes < 0) {
        return validationErrorResponse("นาที OT ไม่ถูกต้อง", [
          { path: "otApprovedMinutes", message: "ต้องเป็นจำนวนเต็ม ≥ 0" },
        ]);
      }
      if (!reason || reason.length < 3) {
        return validationErrorResponse("ต้องระบุเหตุผล", [
          { path: "reason", message: "อย่างน้อย 3 ตัวอักษร" },
        ]);
      }

      const existing = await prisma.attendanceRecord.findUnique({
        where: { id: attendanceId },
      });
      if (!existing) {
        return apiErrorResponse("ไม่พบรายการลงเวลา", 404, "NOT_FOUND");
      }
      if (existing.status === "LOCKED") {
        return apiErrorResponse("รายการถูกล็อกแล้ว", 409, "LOCKED");
      }
      await assertNotLocked(existing.workDate);

      const updated = await prisma.$transaction(async (tx) => {
        await tx.attendanceAdjustment.updateMany({
          where: {
            attendanceRecordId: attendanceId,
            type: "OT_REQUEST",
            status: "PENDING",
          },
          data: {
            status: "REJECTED",
            reviewedById: actorEmployeeId,
            reviewedAt: new Date(),
            reviewNote:
              otApprovedMinutes > 0
                ? "ปิดคำขอ — ผู้ดูแลอนุมัติ OT โดยตรง"
                : "ปิดคำขอ — ยกเลิกการอนุมัติ OT",
          },
        });

        const next = {
          clockIn: existing.clockIn,
          clockOut: existing.clockOut,
          breakStart: existing.breakStart,
          breakEnd: existing.breakEnd,
          scheduledStart: existing.scheduledStart,
          scheduledEnd: existing.scheduledEnd,
          isHolidayWork: existing.isHolidayWork,
          otApprovedMinutes: Math.round(otApprovedMinutes),
          status: existing.status,
        };
        const metrics = recompute(next);
        return tx.attendanceRecord.update({
          where: { id: attendanceId },
          data: {
            otApprovedMinutes: next.otApprovedMinutes,
            workedMinutes: metrics.workedMinutes,
            breakMinutes: metrics.breakMinutes,
            lateMinutes: metrics.lateMinutes,
            earlyLeaveMinutes: metrics.earlyLeaveMinutes,
            otMinutes: metrics.otMinutes,
            status: metrics.status,
          },
          include: recordInclude,
        });
      });

      await recordAuditLog({
        actor: {
          employeeId: actorEmployeeId,
          authUserId: currentUser.user.id,
        },
        action: "HR_ATTENDANCE_OT_APPROVAL_SET",
        entityType: "ATTENDANCE",
        entityId: updated.id,
        metadata: {
          reason,
          otApprovedMinutes: updated.otApprovedMinutes,
        },
      });

      return NextResponse.json(serializeRecord(updated));
    }

    if (mode === "lock-period") {
      if (!permissions.includes("hr.attendance.approve")) {
        return apiErrorResponse("ไม่มีสิทธิ์ปิดรอบเวลา", 403, "FORBIDDEN");
      }
      const periodStartRaw =
        typeof parsed.body.periodStart === "string"
          ? parsed.body.periodStart.trim()
          : "";
      const periodEndRaw =
        typeof parsed.body.periodEnd === "string"
          ? parsed.body.periodEnd.trim()
          : "";
      const periodStart = parseDateKey(periodStartRaw);
      const periodEnd = parseDateKey(periodEndRaw);
      if (!periodStart || !periodEnd || periodStart > periodEnd) {
        return validationErrorResponse("ช่วงรอบไม่ถูกต้อง", [
          { path: "periodStart", message: "ระบุ periodStart/periodEnd" },
        ]);
      }

      const period = await prisma.$transaction(async (tx) => {
        const saved = await tx.attendancePeriod.upsert({
          where: {
            periodStart_periodEnd: { periodStart, periodEnd },
          },
          create: {
            periodStart,
            periodEnd,
            lockedAt: new Date(),
            lockedById: actorEmployeeId,
          },
          update: {
            lockedAt: new Date(),
            lockedById: actorEmployeeId,
          },
        });
        await tx.attendanceRecord.updateMany({
          where: {
            workDate: { gte: periodStart, lte: periodEnd },
            status: { not: "ABSENT" },
          },
          data: { status: "LOCKED" },
        });
        return saved;
      });

      await recordAuditLog({
        actor: {
          employeeId: actorEmployeeId,
          authUserId: currentUser.user.id,
        },
        action: "HR_ATTENDANCE_PERIOD_LOCKED",
        entityType: "ATTENDANCE_PERIOD",
        entityId: period.id,
        metadata: { periodStart: periodStartRaw, periodEnd: periodEndRaw },
      });

      return NextResponse.json({
        id: period.id,
        periodStart: periodStartRaw,
        periodEnd: periodEndRaw,
        lockedAt: period.lockedAt?.toISOString() ?? null,
      });
    }

    return apiErrorResponse("mode ไม่รองรับ", 400, "INVALID_MODE");
  } catch (error) {
    const message = error instanceof Error ? error.message : "";
    if (message === "PERIOD_LOCKED") {
      return apiErrorResponse(
        "วันที่นี้อยู่ในรอบที่ล็อกแล้ว",
        409,
        "PERIOD_LOCKED",
      );
    }
    console.error("POST /api/hr/attendance failed", error);
    return apiErrorResponse("ไม่สามารถบันทึกเวลาเข้างานได้", 500, "INTERNAL_ERROR");
  }
}
