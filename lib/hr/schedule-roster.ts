import type {
  ScheduleChangeType,
  ScheduledShiftAssignmentType,
  ScheduledShiftStatus,
  SchedulePeriodStatus,
} from "@/generated/prisma/client";

import { workforceEmployeeWhere } from "@/lib/auth/support-account";
import { displayEmployeeName } from "@/lib/hr/employees";
import {
  dateKeyUtc,
  parseDateKey,
} from "@/lib/hr/schedules";
import {
  dateOnly,
  periodsOverlap,
  serializeSchedulePeriod,
} from "@/lib/hr/schedule-periods";
import {
  buildSnapshotFromTemplate,
  detectOverlap,
} from "@/lib/hr/scheduled-shifts";
import {
  clampDateKeysToRange,
  planBulkAssignShifts,
  type BulkAssignMode,
} from "@/lib/hr/schedule-bulk-assign";
import {
  planGenerateFromDefaultShifts,
} from "@/lib/hr/schedule-generate-plan";
import { resolveTimePeriodFromList } from "@/lib/hr/shift-time-period-resolve";
import { resolveShiftTimesForDate } from "@/lib/hr/shift-time-periods";
import { prisma } from "@/lib/prisma";

export {
  planGenerateFromDefaultShifts,
  type GenerateFromDefaultsPlan,
} from "@/lib/hr/schedule-generate-plan";
export {
  planBulkAssignShifts,
  WEEKDAY_PRESETS,
  type BulkAssignMode,
} from "@/lib/hr/schedule-bulk-assign";

export class ScheduleRosterError extends Error {
  constructor(
    public code: string,
    message: string,
  ) {
    super(message);
    this.name = "ScheduleRosterError";
  }
}

const activeShiftStatuses: ScheduledShiftStatus[] = [
  "SCHEDULED",
  "COMPLETED",
  "ABSENT",
  "LEAVE",
];

function serializeShift(shift: {
  id: string;
  schedulePeriodId: string;
  employeeId: string;
  shiftTemplateId: string | null;
  workDate: Date;
  plannedStart: Date;
  plannedEnd: Date;
  breakMinutes: number;
  lateGraceMinutes: number;
  assignmentType: ScheduledShiftAssignmentType;
  status: ScheduledShiftStatus;
  isDailyOverride?: boolean;
  replacedEmployeeId: string | null;
  sourceScheduledShiftId: string | null;
  note: string | null;
  employee?: {
    id: string;
    name: string;
    firstName: string | null;
    lastName: string | null;
    nickname: string | null;
    email: string | null;
    employeeCode: string | null;
  };
  shiftTemplate?: { id: string; name: string; color: string | null } | null;
  replacedEmployee?: {
    id: string;
    name: string;
    firstName: string | null;
    lastName: string | null;
    nickname: string | null;
    email: string | null;
  } | null;
}) {
  const isDayOff = shift.note === "DAY_OFF";
  return {
    id: shift.id,
    schedulePeriodId: shift.schedulePeriodId,
    employeeId: shift.employeeId,
    employeeName: shift.employee ? displayEmployeeName(shift.employee) : null,
    employeeCode: shift.employee?.employeeCode ?? null,
    shiftTemplateId: shift.shiftTemplateId,
    shiftName: isDayOff
      ? "หยุด"
      : shift.status === "LEAVE"
        ? "ลา"
        : (shift.shiftTemplate?.name ?? "กะพิเศษ"),
    shiftColor: shift.shiftTemplate?.color ?? null,
    workDate: dateKeyUtc(shift.workDate),
    plannedStart: shift.plannedStart.toISOString(),
    plannedEnd: shift.plannedEnd.toISOString(),
    breakMinutes: shift.breakMinutes,
    lateGraceMinutes: shift.lateGraceMinutes,
    assignmentType: shift.assignmentType,
    status: shift.status,
    isDailyOverride: shift.isDailyOverride ?? false,
    replacedEmployeeId: shift.replacedEmployeeId,
    replacedEmployeeName: shift.replacedEmployee
      ? displayEmployeeName(shift.replacedEmployee)
      : null,
    sourceScheduledShiftId: shift.sourceScheduledShiftId,
    note: shift.note,
  };
}

const shiftInclude = {
  employee: {
    select: {
      id: true,
      name: true,
      firstName: true,
      lastName: true,
      nickname: true,
      email: true,
      employeeCode: true,
    },
  },
  shiftTemplate: { select: { id: true, name: true, color: true } },
  replacedEmployee: {
    select: {
      id: true,
      name: true,
      firstName: true,
      lastName: true,
      nickname: true,
      email: true,
    },
  },
} as const;

async function assertPeriodEditable(periodId: string, allowPublished = false) {
  const period = await prisma.schedulePeriod.findUnique({
    where: { id: periodId },
  });
  if (!period) throw new ScheduleRosterError("NOT_FOUND", "ไม่พบรอบตาราง");
  if (period.status === "CLOSED") {
    throw new ScheduleRosterError("PERIOD_CLOSED", "รอบนี้ปิดแล้ว ห้ามแก้ไขโดยตรง");
  }
  if (period.status === "PUBLISHED" && !allowPublished) {
    throw new ScheduleRosterError(
      "PERIOD_PUBLISHED",
      "รอบประกาศแล้ว — ต้องระบุเหตุผลเมื่อแก้ไข",
    );
  }
  return period;
}

async function writeChangeLog(input: {
  schedulePeriodId?: string | null;
  scheduledShiftId?: string | null;
  changeType: ScheduleChangeType;
  beforeData?: unknown;
  afterData?: unknown;
  reason?: string | null;
  changedById: string;
}) {
  await prisma.scheduleChangeLog.create({
    data: {
      schedulePeriodId: input.schedulePeriodId ?? null,
      scheduledShiftId: input.scheduledShiftId ?? null,
      changeType: input.changeType,
      beforeData:
        input.beforeData === undefined
          ? undefined
          : (input.beforeData as object),
      afterData:
        input.afterData === undefined ? undefined : (input.afterData as object),
      reason: input.reason ?? null,
      changedById: input.changedById,
    },
  });
}

export async function listSchedulePeriods() {
  const periods = await prisma.schedulePeriod.findMany({
    orderBy: [{ startDate: "desc" }, { createdAt: "desc" }],
  });
  return periods.map(serializeSchedulePeriod);
}

export async function createSchedulePeriod(input: {
  name?: string;
  startDate: string;
  endDate: string;
  actorEmployeeId?: string | null;
}) {
  const startDate = parseDateKey(input.startDate);
  const endDate = parseDateKey(input.endDate);
  if (!startDate || !endDate || startDate > endDate) {
    throw new ScheduleRosterError("VALIDATION_ERROR", "ช่วงวันที่รอบไม่ถูกต้อง");
  }

  const existing = await prisma.schedulePeriod.findMany({
    select: { id: true, startDate: true, endDate: true },
  });
  if (periodsOverlap({ startDate, endDate }, existing)) {
    throw new ScheduleRosterError(
      "PERIOD_OVERLAP",
      "ช่วงรอบนี้ซ้อนกับรอบที่มีอยู่แล้ว",
    );
  }

  const name =
    input.name?.trim() ||
    `รอบ ${input.startDate} ถึง ${input.endDate}`;

  const created = await prisma.schedulePeriod.create({
    data: {
      name,
      startDate,
      endDate,
      status: "DRAFT",
      createdById: input.actorEmployeeId ?? null,
      updatedById: input.actorEmployeeId ?? null,
    },
  });

  if (input.actorEmployeeId) {
    await writeChangeLog({
      schedulePeriodId: created.id,
      changeType: "CREATE",
      afterData: serializeSchedulePeriod(created),
      changedById: input.actorEmployeeId,
    });
  }

  return serializeSchedulePeriod(created);
}

export async function getSchedulePeriod(periodId: string) {
  const period = await prisma.schedulePeriod.findUnique({
    where: { id: periodId },
  });
  if (!period) throw new ScheduleRosterError("NOT_FOUND", "ไม่พบรอบตาราง");
  return serializeSchedulePeriod(period);
}

export async function publishSchedulePeriod(input: {
  periodId: string;
  actorEmployeeId: string;
}) {
  const period = await assertPeriodEditable(input.periodId, true);
  if (period.status === "PUBLISHED") {
    return serializeSchedulePeriod(period);
  }
  if (period.status !== "DRAFT") {
    throw new ScheduleRosterError("INVALID_STATUS", "ประกาศได้เฉพาะรอบฉบับร่าง");
  }

  const updated = await prisma.schedulePeriod.update({
    where: { id: period.id },
    data: {
      status: "PUBLISHED",
      publishedAt: new Date(),
      updatedById: input.actorEmployeeId,
    },
  });

  await writeChangeLog({
    schedulePeriodId: period.id,
    changeType: "PUBLISH",
    beforeData: serializeSchedulePeriod(period),
    afterData: serializeSchedulePeriod(updated),
    changedById: input.actorEmployeeId,
  });

  return serializeSchedulePeriod(updated);
}

export async function closeSchedulePeriod(input: {
  periodId: string;
  actorEmployeeId: string;
  reason: string;
}) {
  const reason = input.reason.trim();
  if (!reason) {
    throw new ScheduleRosterError("VALIDATION_ERROR", "ต้องระบุเหตุผลเมื่อปิดรอบ");
  }
  const period = await prisma.schedulePeriod.findUnique({
    where: { id: input.periodId },
  });
  if (!period) throw new ScheduleRosterError("NOT_FOUND", "ไม่พบรอบตาราง");
  if (period.status === "CLOSED") {
    return serializeSchedulePeriod(period);
  }
  if (period.status !== "PUBLISHED") {
    throw new ScheduleRosterError(
      "INVALID_STATUS",
      "ปิดรอบได้เฉพาะรอบที่ประกาศแล้ว",
    );
  }

  const updated = await prisma.schedulePeriod.update({
    where: { id: period.id },
    data: {
      status: "CLOSED",
      closedAt: new Date(),
      updatedById: input.actorEmployeeId,
    },
  });

  await writeChangeLog({
    schedulePeriodId: period.id,
    changeType: "CLOSE",
    beforeData: serializeSchedulePeriod(period),
    afterData: serializeSchedulePeriod(updated),
    reason,
    changedById: input.actorEmployeeId,
  });

  return serializeSchedulePeriod(updated);
}

export async function listPeriodShifts(periodId: string) {
  await getSchedulePeriod(periodId);
  const shifts = await prisma.scheduledShift.findMany({
    where: { schedulePeriodId: periodId },
    include: shiftInclude,
    orderBy: [{ workDate: "asc" }, { plannedStart: "asc" }],
  });
  return shifts.map(serializeShift);
}

function eachDateKeyInclusive(start: Date, end: Date): string[] {
  const keys: string[] = [];
  let cursor = dateOnly(start);
  const last = dateOnly(end);
  while (cursor <= last) {
    keys.push(dateKeyUtc(cursor));
    cursor = new Date(cursor.getTime() + 24 * 60 * 60_000);
  }
  return keys;
}

export async function generateFromDefaultShifts(input: {
  periodId: string;
  actorEmployeeId: string;
  employeeIds?: string[];
}) {
  const period = await assertPeriodEditable(input.periodId);

  const employees = await prisma.employee.findMany({
    where: input.employeeIds?.length
      ? {
          AND: [
            { id: { in: input.employeeIds } },
            workforceEmployeeWhere(),
          ],
        }
      : workforceEmployeeWhere(),
    select: {
      id: true,
      isActive: true,
      hrStatus: true,
      defaultShiftTemplateId: true,
    },
  });

  const activeTemplates = await prisma.shiftTemplate.findMany({
    where: { isActive: true },
    select: { id: true },
  });
  const activeTemplateIds = new Set(activeTemplates.map((item) => item.id));

  const existing = await prisma.scheduledShift.findMany({
    where: {
      schedulePeriodId: period.id,
      status: { in: activeShiftStatuses },
    },
  });

  const existingEmployeeDateKeys = new Set(
    existing.map(
      (item) => `${item.employeeId}|${dateKeyUtc(item.workDate)}`,
    ),
  );

  const plan = planGenerateFromDefaultShifts({
    dateKeys: eachDateKeyInclusive(period.startDate, period.endDate),
    employees,
    activeTemplateIds,
    existingEmployeeDateKeys,
  });

  let createdCount = 0;

  for (const job of plan.jobs) {
    const workDate = parseDateKey(job.dateKey);
    if (!workDate) continue;

    const times = await resolveShiftTimesForDate(job.shiftTemplateId, workDate);
    if (!times) continue;
    const snapshot = buildSnapshotFromTemplate(
      times.startMinutes,
      times.endMinutes,
      workDate,
      times.breakMinutes,
    );
    if (!snapshot) continue;

    const overlaps = detectOverlap(
      {
        employeeId: job.employeeId,
        plannedStart: snapshot.plannedStart,
        plannedEnd: snapshot.plannedEnd,
      },
      existing.map((item) => ({
        id: item.id,
        employeeId: item.employeeId,
        plannedStart: item.plannedStart,
        plannedEnd: item.plannedEnd,
        status: item.status,
      })),
    );
    if (overlaps.length) continue;

    // Re-check same day in case of race / prior loop insert
    const alreadySameDay = existing.some(
      (item) =>
        item.employeeId === job.employeeId &&
        dateKeyUtc(item.workDate) === job.dateKey &&
        activeShiftStatuses.includes(item.status),
    );
    if (alreadySameDay) continue;

    const created = await prisma.scheduledShift.create({
      data: {
        schedulePeriodId: period.id,
        employeeId: job.employeeId,
        shiftTemplateId: job.shiftTemplateId,
        workDate,
        plannedStart: snapshot.plannedStart,
        plannedEnd: snapshot.plannedEnd,
        breakMinutes: snapshot.breakMinutes,
        lateGraceMinutes: times.lateGraceMinutes,
        assignmentType: "NORMAL",
        status: "SCHEDULED",
        createdById: input.actorEmployeeId,
        updatedById: input.actorEmployeeId,
      },
    });
    existing.push(created);
    existingEmployeeDateKeys.add(`${job.employeeId}|${job.dateKey}`);
    createdCount += 1;
  }

  const summary = {
    created: createdCount,
    skippedNoDefault: plan.skippedNoDefault,
    skippedInactive: plan.skippedInactive,
    skippedExisting: plan.skippedExisting,
    skippedInactiveTemplate: plan.skippedInactiveTemplate,
  };

  await writeChangeLog({
    schedulePeriodId: period.id,
    changeType: "CREATE",
    afterData: summary,
    reason: "สร้างจากกะประจำ",
    changedById: input.actorEmployeeId,
  });

  return summary;
}

/** @deprecated Use generateFromDefaultShifts — kept for call-site compatibility. */
export async function generateFromMemberships(input: {
  periodId: string;
  actorEmployeeId: string;
  employeeIds?: string[];
}) {
  return generateFromDefaultShifts(input);
}

export async function copyFromPreviousPeriod(input: {
  periodId: string;
  sourcePeriodId: string;
  actorEmployeeId: string;
  employeeIds?: string[];
  /** Filter by source workDate (inclusive YYYY-MM-DD). */
  dateFrom?: string | null;
  dateTo?: string | null;
}) {
  const period = await assertPeriodEditable(input.periodId);
  const source = await prisma.schedulePeriod.findUnique({
    where: { id: input.sourcePeriodId },
  });
  if (!source) {
    throw new ScheduleRosterError("NOT_FOUND", "ไม่พบรอบต้นทาง");
  }

  const sourceFrom = input.dateFrom ? parseDateKey(input.dateFrom) : null;
  const sourceTo = input.dateTo ? parseDateKey(input.dateTo) : null;

  const sourceShifts = await prisma.scheduledShift.findMany({
    where: {
      schedulePeriodId: source.id,
      status: { in: ["SCHEDULED", "COMPLETED"] },
      assignmentType: { in: ["NORMAL", "DOUBLE_SHIFT", "EXTRA_SHIFT"] },
      ...(input.employeeIds?.length
        ? { employeeId: { in: input.employeeIds } }
        : {}),
      ...(sourceFrom || sourceTo
        ? {
            workDate: {
              ...(sourceFrom ? { gte: sourceFrom } : {}),
              ...(sourceTo ? { lte: sourceTo } : {}),
            },
          }
        : {}),
    },
  });

  const dayOffsetMs =
    dateOnly(period.startDate).getTime() - dateOnly(source.startDate).getTime();

  const existing = await prisma.scheduledShift.findMany({
    where: {
      schedulePeriodId: period.id,
      status: { in: activeShiftStatuses },
    },
    select: {
      id: true,
      employeeId: true,
      plannedStart: true,
      plannedEnd: true,
      status: true,
    },
  });

  const overlapPool = existing.map((item) => ({
    id: item.id,
    employeeId: item.employeeId,
    plannedStart: item.plannedStart,
    plannedEnd: item.plannedEnd,
    status: item.status,
  }));

  const createData: Array<{
    schedulePeriodId: string;
    employeeId: string;
    shiftTemplateId: string | null;
    workDate: Date;
    plannedStart: Date;
    plannedEnd: Date;
    breakMinutes: number;
    lateGraceMinutes: number;
    assignmentType: ScheduledShiftAssignmentType;
    status: "SCHEDULED";
    note: string | null;
    isDailyOverride: boolean;
    createdById: string;
    updatedById: string;
  }> = [];

  for (const shift of sourceShifts) {
    const workDate = new Date(shift.workDate.getTime() + dayOffsetMs);
    if (workDate < dateOnly(period.startDate) || workDate > dateOnly(period.endDate)) {
      continue;
    }
    const plannedStart = new Date(shift.plannedStart.getTime() + dayOffsetMs);
    const plannedEnd = new Date(shift.plannedEnd.getTime() + dayOffsetMs);
    if (
      detectOverlap(
        { employeeId: shift.employeeId, plannedStart, plannedEnd },
        overlapPool,
      ).length
    ) {
      continue;
    }

    const assignmentType: ScheduledShiftAssignmentType =
      shift.assignmentType === "REPLACEMENT" ? "NORMAL" : shift.assignmentType;
    createData.push({
      schedulePeriodId: period.id,
      employeeId: shift.employeeId,
      shiftTemplateId: shift.shiftTemplateId,
      workDate,
      plannedStart,
      plannedEnd,
      breakMinutes: shift.breakMinutes,
      lateGraceMinutes: shift.lateGraceMinutes,
      assignmentType,
      status: "SCHEDULED",
      note: shift.note,
      isDailyOverride: false,
      createdById: input.actorEmployeeId,
      updatedById: input.actorEmployeeId,
    });
    overlapPool.push({
      id: `pending-${createData.length}`,
      employeeId: shift.employeeId,
      plannedStart,
      plannedEnd,
      status: "SCHEDULED",
    });
  }

  if (createData.length > 0) {
    await prisma.scheduledShift.createMany({ data: createData });
  }

  await writeChangeLog({
    schedulePeriodId: period.id,
    changeType: "COPY",
    afterData: {
      copied: createData.length,
      sourcePeriodId: source.id,
      employeeIds: input.employeeIds ?? null,
      dateFrom: input.dateFrom ?? null,
      dateTo: input.dateTo ?? null,
    },
    reason: "คัดลอกจากรอบก่อน",
    changedById: input.actorEmployeeId,
  });

  return { created: createData.length };
}

export async function listPeriodChangeLogs(periodId: string, take = 40) {
  await getSchedulePeriod(periodId);
  const rows = await prisma.scheduleChangeLog.findMany({
    where: { schedulePeriodId: periodId },
    include: {
      changedBy: {
        select: {
          id: true,
          name: true,
          firstName: true,
          lastName: true,
          nickname: true,
          email: true,
          employeeCode: true,
        },
      },
    },
    orderBy: { changedAt: "desc" },
    take,
  });

  return rows.map((row) => ({
    id: row.id,
    changeType: row.changeType,
    reason: row.reason,
    changedAt: row.changedAt.toISOString(),
    changedByName: displayEmployeeName(row.changedBy),
    scheduledShiftId: row.scheduledShiftId,
    afterData: row.afterData,
  }));
}

export async function upsertScheduledShift(input: {
  periodId: string;
  actorEmployeeId: string;
  employeeId: string;
  workDate: string;
  shiftTemplateId?: string | null;
  plannedStart?: string;
  plannedEnd?: string;
  breakMinutes?: number;
  assignmentType?: ScheduledShiftAssignmentType;
  status?: ScheduledShiftStatus;
  note?: string | null;
  reason?: string | null;
  allowOverlap?: boolean;
  shiftId?: string;
  /** Defaults to true for interactive day edits; bulk assign sets false. */
  isDailyOverride?: boolean;
}) {
  const period = await prisma.schedulePeriod.findUnique({
    where: { id: input.periodId },
  });
  if (!period) throw new ScheduleRosterError("NOT_FOUND", "ไม่พบรอบตาราง");
  if (period.status === "CLOSED") {
    throw new ScheduleRosterError("PERIOD_CLOSED", "รอบนี้ปิดแล้ว ห้ามแก้ไขโดยตรง");
  }
  if (period.status === "PUBLISHED" && !input.reason?.trim()) {
    throw new ScheduleRosterError(
      "REASON_REQUIRED",
      "รอบประกาศแล้ว — ต้องระบุเหตุผลเมื่อแก้ไข",
    );
  }

  const workDate = parseDateKey(input.workDate);
  if (!workDate) {
    throw new ScheduleRosterError("VALIDATION_ERROR", "วันที่ทำงานไม่ถูกต้อง");
  }
  if (workDate < dateOnly(period.startDate) || workDate > dateOnly(period.endDate)) {
    throw new ScheduleRosterError(
      "VALIDATION_ERROR",
      "วันที่อยู่นอกรอบตาราง",
    );
  }

  let plannedStart: Date;
  let plannedEnd: Date;
  let breakMinutes = input.breakMinutes ?? 0;
  let lateGraceMinutes = 0;
  const shiftTemplateId = input.shiftTemplateId ?? null;

  if (shiftTemplateId) {
    const times = await resolveShiftTimesForDate(shiftTemplateId, workDate);
    if (!times) {
      throw new ScheduleRosterError("TEMPLATE_NOT_FOUND", "ไม่พบแม่แบบกะ");
    }
    const snapshot = buildSnapshotFromTemplate(
      times.startMinutes,
      times.endMinutes,
      workDate,
      input.breakMinutes ?? times.breakMinutes,
    );
    if (!snapshot) {
      throw new ScheduleRosterError("INVALID_RANGE", "เวลากะไม่ถูกต้อง");
    }
    plannedStart = snapshot.plannedStart;
    plannedEnd = snapshot.plannedEnd;
    breakMinutes = snapshot.breakMinutes;
    lateGraceMinutes = times.lateGraceMinutes;
  } else if (input.plannedStart && input.plannedEnd) {
    plannedStart = new Date(input.plannedStart);
    plannedEnd = new Date(input.plannedEnd);
    if (
      Number.isNaN(plannedStart.getTime()) ||
      Number.isNaN(plannedEnd.getTime()) ||
      plannedEnd <= plannedStart
    ) {
      throw new ScheduleRosterError("INVALID_RANGE", "เวลาเริ่ม/สิ้นสุดไม่ถูกต้อง");
    }
  } else {
    throw new ScheduleRosterError(
      "VALIDATION_ERROR",
      "ต้องเลือกแม่แบบกะ หรือระบุเวลาเริ่ม–สิ้นสุด",
    );
  }

  const existing = await prisma.scheduledShift.findMany({
    where: {
      schedulePeriodId: period.id,
      employeeId: input.employeeId,
      status: { in: activeShiftStatuses },
    },
  });

  const overlaps = detectOverlap(
    {
      id: input.shiftId,
      employeeId: input.employeeId,
      plannedStart,
      plannedEnd,
    },
    existing.map((item) => ({
      id: item.id,
      employeeId: item.employeeId,
      plannedStart: item.plannedStart,
      plannedEnd: item.plannedEnd,
      status: item.status,
    })),
  );
  if (overlaps.length && !input.allowOverlap) {
    throw new ScheduleRosterError(
      "OVERLAP",
      "เวลากะซ้อนกับกะอื่นของพนักงานคนนี้",
    );
  }

  const assignmentType =
    input.assignmentType ??
    (overlaps.length ? "DOUBLE_SHIFT" : shiftTemplateId ? "NORMAL" : "EXTRA_SHIFT");
  const isDailyOverride = input.isDailyOverride ?? true;
  const nextStatus = input.status ?? "SCHEDULED";

  if (input.shiftId) {
    const before = await prisma.scheduledShift.findFirst({
      where: { id: input.shiftId, schedulePeriodId: period.id },
      include: shiftInclude,
    });
    if (!before) throw new ScheduleRosterError("NOT_FOUND", "ไม่พบกะในรอบนี้");

    const updated = await prisma.scheduledShift.update({
      where: { id: before.id },
      data: {
        shiftTemplateId,
        workDate,
        plannedStart,
        plannedEnd,
        breakMinutes,
        lateGraceMinutes,
        assignmentType,
        status: nextStatus,
        isDailyOverride,
        note: input.note ?? null,
        updatedById: input.actorEmployeeId,
      },
      include: shiftInclude,
    });

    await writeChangeLog({
      schedulePeriodId: period.id,
      scheduledShiftId: updated.id,
      changeType: "UPDATE",
      beforeData: serializeShift(before),
      afterData: serializeShift(updated),
      reason: input.reason,
      changedById: input.actorEmployeeId,
    });

    return serializeShift(updated);
  }

  const created = await prisma.scheduledShift.create({
    data: {
      schedulePeriodId: period.id,
      employeeId: input.employeeId,
      shiftTemplateId,
      workDate,
      plannedStart,
      plannedEnd,
      breakMinutes,
      lateGraceMinutes,
      assignmentType,
      status: nextStatus,
      isDailyOverride,
      note: input.note ?? null,
      createdById: input.actorEmployeeId,
      updatedById: input.actorEmployeeId,
    },
    include: shiftInclude,
  });

  await writeChangeLog({
    schedulePeriodId: period.id,
    scheduledShiftId: created.id,
    changeType: "CREATE",
    afterData: serializeShift(created),
    reason: input.reason,
    changedById: input.actorEmployeeId,
  });

  return serializeShift(created);
}

export async function cancelScheduledShift(input: {
  periodId: string;
  shiftId: string;
  actorEmployeeId: string;
  reason?: string | null;
}) {
  const period = await prisma.schedulePeriod.findUnique({
    where: { id: input.periodId },
  });
  if (!period) throw new ScheduleRosterError("NOT_FOUND", "ไม่พบรอบตาราง");
  if (period.status === "CLOSED") {
    throw new ScheduleRosterError("PERIOD_CLOSED", "รอบนี้ปิดแล้ว ห้ามแก้ไขโดยตรง");
  }
  if (period.status === "PUBLISHED" && !input.reason?.trim()) {
    throw new ScheduleRosterError(
      "REASON_REQUIRED",
      "รอบประกาศแล้ว — ต้องระบุเหตุผลเมื่อยกเลิก",
    );
  }

  const before = await prisma.scheduledShift.findFirst({
    where: { id: input.shiftId, schedulePeriodId: period.id },
    include: shiftInclude,
  });
  if (!before) throw new ScheduleRosterError("NOT_FOUND", "ไม่พบกะในรอบนี้");

  const updated = await prisma.scheduledShift.update({
    where: { id: before.id },
    data: {
      status: "CANCELLED",
      updatedById: input.actorEmployeeId,
    },
    include: shiftInclude,
  });

  await writeChangeLog({
    schedulePeriodId: period.id,
    scheduledShiftId: updated.id,
    changeType: "CANCEL",
    beforeData: serializeShift(before),
    afterData: serializeShift(updated),
    reason: input.reason,
    changedById: input.actorEmployeeId,
  });

  return serializeShift(updated);
}

export async function replaceScheduledShift(input: {
  periodId: string;
  shiftId: string;
  replacementEmployeeId: string;
  actorEmployeeId: string;
  reason: string;
}) {
  const reason = input.reason.trim();
  if (!reason) {
    throw new ScheduleRosterError("VALIDATION_ERROR", "ต้องระบุเหตุผลการทำแทน");
  }

  const period = await prisma.schedulePeriod.findUnique({
    where: { id: input.periodId },
  });
  if (!period) throw new ScheduleRosterError("NOT_FOUND", "ไม่พบรอบตาราง");
  if (period.status === "CLOSED") {
    throw new ScheduleRosterError("PERIOD_CLOSED", "รอบนี้ปิดแล้ว ห้ามแก้ไขโดยตรง");
  }

  const source = await prisma.scheduledShift.findFirst({
    where: { id: input.shiftId, schedulePeriodId: period.id },
    include: shiftInclude,
  });
  if (!source || source.status !== "SCHEDULED") {
    throw new ScheduleRosterError("NOT_FOUND", "ไม่พบกะต้นทางที่ยังใช้งานได้");
  }
  if (source.employeeId === input.replacementEmployeeId) {
    throw new ScheduleRosterError(
      "VALIDATION_ERROR",
      "ผู้ทำแทนต้องเป็นคนละคนกับเจ้าของกะเดิม",
    );
  }

  const result = await prisma.$transaction(async (tx) => {
    const cancelled = await tx.scheduledShift.update({
      where: { id: source.id },
      data: {
        status: "REPLACED",
        updatedById: input.actorEmployeeId,
      },
      include: shiftInclude,
    });

    const replacement = await tx.scheduledShift.create({
      data: {
        schedulePeriodId: period.id,
        employeeId: input.replacementEmployeeId,
        shiftTemplateId: source.shiftTemplateId,
        workDate: source.workDate,
        plannedStart: source.plannedStart,
        plannedEnd: source.plannedEnd,
        breakMinutes: source.breakMinutes,
        lateGraceMinutes: source.lateGraceMinutes,
        assignmentType: "REPLACEMENT",
        status: "SCHEDULED",
        replacedEmployeeId: source.employeeId,
        sourceScheduledShiftId: source.id,
        note: source.note,
        createdById: input.actorEmployeeId,
        updatedById: input.actorEmployeeId,
      },
      include: shiftInclude,
    });

    await tx.scheduleChangeLog.create({
      data: {
        schedulePeriodId: period.id,
        scheduledShiftId: replacement.id,
        changeType: "REPLACE",
        beforeData: serializeShift(cancelled),
        afterData: serializeShift(replacement),
        reason,
        changedById: input.actorEmployeeId,
      },
    });

    return { cancelled, replacement };
  });

  return {
    cancelled: serializeShift(result.cancelled),
    replacement: serializeShift(result.replacement),
  };
}

export async function listRosterGrid(periodId: string) {
  const period = await getSchedulePeriod(periodId);
  const [shifts, employees] = await Promise.all([
    listPeriodShifts(periodId),
    prisma.employee.findMany({
      where: workforceEmployeeWhere(),
      select: {
        id: true,
        name: true,
        firstName: true,
        lastName: true,
        nickname: true,
        email: true,
        employeeCode: true,
      },
      orderBy: [{ employeeCode: "asc" }, { name: "asc" }],
    }),
  ]);

  return {
    period,
    employees: employees.map((employee) => ({
      id: employee.id,
      name: displayEmployeeName(employee),
      employeeCode: employee.employeeCode,
    })),
    shifts,
  };
}

export async function bulkAssignPeriodShifts(input: {
  periodId: string;
  actorEmployeeId: string;
  employeeIds?: string[];
  cells?: Array<{ employeeId: string; dateKey: string }>;
  shiftTemplateId: string;
  mode: BulkAssignMode;
  weekdays?: number[];
  dateFrom?: string | null;
  dateTo?: string | null;
  replaceOverrides?: boolean;
  reason?: string | null;
  dryRun?: boolean;
}) {
  const cellMode = Boolean(input.cells?.length);
  const employeeIds = cellMode
    ? [...new Set((input.cells ?? []).map((cell) => cell.employeeId))]
    : (input.employeeIds ?? []);
  if (!employeeIds.length) {
    throw new ScheduleRosterError("VALIDATION_ERROR", "เลือกพนักงานอย่างน้อย 1 คน");
  }
  if (!input.shiftTemplateId) {
    throw new ScheduleRosterError("VALIDATION_ERROR", "เลือกกะก่อน");
  }
  if (!cellMode && !(input.weekdays?.length)) {
    throw new ScheduleRosterError("VALIDATION_ERROR", "เลือกวันทำงานอย่างน้อย 1 วัน");
  }

  const period = await prisma.schedulePeriod.findUnique({
    where: { id: input.periodId },
  });
  if (!period) throw new ScheduleRosterError("NOT_FOUND", "ไม่พบรอบตาราง");
  if (period.status === "CLOSED") {
    throw new ScheduleRosterError("PERIOD_CLOSED", "รอบนี้ปิดแล้ว ห้ามแก้ไขโดยตรง");
  }
  if (period.status === "PUBLISHED" && !input.reason?.trim()) {
    throw new ScheduleRosterError(
      "REASON_REQUIRED",
      "รอบประกาศแล้ว — ต้องระบุเหตุผลเมื่อแก้ไข",
    );
  }

  const template = await prisma.shiftTemplate.findFirst({
    where: { id: input.shiftTemplateId, isActive: true },
    select: { id: true, name: true },
  });
  if (!template) {
    throw new ScheduleRosterError("TEMPLATE_NOT_FOUND", "ไม่พบแม่แบบกะที่ใช้งานได้");
  }

  const periodKeys = eachDateKeyInclusive(period.startDate, period.endDate);
  const dateKeys = clampDateKeysToRange(
    periodKeys,
    input.dateFrom,
    input.dateTo,
  );
  const periodKeySet = new Set(periodKeys);
  const cells = cellMode
    ? (input.cells ?? []).filter((cell) => periodKeySet.has(cell.dateKey))
    : undefined;

  const existingRows = await prisma.scheduledShift.findMany({
    where: {
      schedulePeriodId: period.id,
      employeeId: { in: employeeIds },
      status: { in: activeShiftStatuses },
    },
    select: {
      id: true,
      employeeId: true,
      workDate: true,
      isDailyOverride: true,
    },
  });

  const existingByDay = new Map<
    string,
    { shiftIds: string[]; isDailyOverride: boolean }
  >();
  for (const row of existingRows) {
    const key = `${row.employeeId}|${dateKeyUtc(row.workDate)}`;
    const current = existingByDay.get(key) ?? {
      shiftIds: [],
      isDailyOverride: false,
    };
    current.shiftIds.push(row.id);
    current.isDailyOverride = current.isDailyOverride || row.isDailyOverride;
    existingByDay.set(key, current);
  }

  const plan = planBulkAssignShifts({
    employeeIds: cellMode ? undefined : employeeIds,
    dateKeys: cellMode ? undefined : dateKeys,
    weekdays: cellMode ? undefined : (input.weekdays ?? []),
    cells,
    mode: input.mode,
    replaceOverrides: input.replaceOverrides === true,
    existing: [...existingByDay.entries()].map(([key, value]) => {
      const [employeeId, dateKey] = key.split("|");
      return {
        employeeId: employeeId!,
        dateKey: dateKey!,
        shiftIds: value.shiftIds,
        isDailyOverride: value.isDailyOverride,
      };
    }),
  });

  const summary = {
    created: plan.createCount,
    replaced: plan.replaceCount,
    skippedExisting: plan.skippedExisting,
    skippedOverride: plan.skippedOverride,
    shiftName: template.name,
  };

  if (input.dryRun) {
    return { ...summary, dryRun: true as const };
  }

  if (plan.jobs.length === 0) {
    return { ...summary, dryRun: false as const };
  }

  // Batch path: avoid N× upsert/cancel round-trips (was ~15–20s for a half-month row).
  const [timePeriods, templateTimes] = await Promise.all([
    prisma.shiftTemplateTimePeriod.findMany({
      where: { shiftTemplateId: input.shiftTemplateId },
      orderBy: { effectiveFrom: "asc" },
      select: {
        effectiveFrom: true,
        startMinutes: true,
        endMinutes: true,
        breakMinutes: true,
        lateGraceMinutes: true,
        earlyLeaveGraceMinutes: true,
      },
    }),
    prisma.shiftTemplate.findUnique({
      where: { id: input.shiftTemplateId },
      select: {
        startMinutes: true,
        endMinutes: true,
        breakMinutes: true,
        lateGraceMinutes: true,
        earlyLeaveGraceMinutes: true,
        createdAt: true,
      },
    }),
  ]);
  if (!templateTimes) {
    throw new ScheduleRosterError("TEMPLATE_NOT_FOUND", "ไม่พบแม่แบบกะที่ใช้งานได้");
  }

  const timesByDate = new Map<
    string,
    {
      startMinutes: number;
      endMinutes: number;
      breakMinutes: number;
      lateGraceMinutes: number;
    }
  >();
  for (const dateKey of [...new Set(plan.jobs.map((job) => job.dateKey))]) {
    const workDate = parseDateKey(dateKey);
    if (!workDate) continue;
    const resolved =
      resolveTimePeriodFromList(timePeriods, workDate) ?? {
        startMinutes: templateTimes.startMinutes,
        endMinutes: templateTimes.endMinutes,
        breakMinutes: templateTimes.breakMinutes,
        lateGraceMinutes: templateTimes.lateGraceMinutes,
        earlyLeaveGraceMinutes: templateTimes.earlyLeaveGraceMinutes,
        effectiveFrom: dateOnly(templateTimes.createdAt),
      };
    timesByDate.set(dateKey, {
      startMinutes: resolved.startMinutes,
      endMinutes: resolved.endMinutes,
      breakMinutes: resolved.breakMinutes,
      lateGraceMinutes: resolved.lateGraceMinutes,
    });
  }

  const replaceIds = [
    ...new Set(plan.jobs.flatMap((job) => job.replaceShiftIds)),
  ];
  const createData: Array<{
    schedulePeriodId: string;
    employeeId: string;
    shiftTemplateId: string;
    workDate: Date;
    plannedStart: Date;
    plannedEnd: Date;
    breakMinutes: number;
    lateGraceMinutes: number;
    assignmentType: "NORMAL";
    status: "SCHEDULED";
    isDailyOverride: boolean;
    createdById: string;
    updatedById: string;
  }> = [];

  for (const job of plan.jobs) {
    const workDate = parseDateKey(job.dateKey);
    const times = timesByDate.get(job.dateKey);
    if (!workDate || !times) continue;
    const snapshot = buildSnapshotFromTemplate(
      times.startMinutes,
      times.endMinutes,
      workDate,
      times.breakMinutes,
    );
    if (!snapshot) continue;
    createData.push({
      schedulePeriodId: period.id,
      employeeId: job.employeeId,
      shiftTemplateId: input.shiftTemplateId,
      workDate,
      plannedStart: snapshot.plannedStart,
      plannedEnd: snapshot.plannedEnd,
      breakMinutes: snapshot.breakMinutes,
      lateGraceMinutes: times.lateGraceMinutes,
      assignmentType: "NORMAL",
      status: "SCHEDULED",
      isDailyOverride: false,
      createdById: input.actorEmployeeId,
      updatedById: input.actorEmployeeId,
    });
  }

  // Prefer sequential batch queries over interactive $transaction (pooler latency).
  if (replaceIds.length > 0) {
    await prisma.scheduledShift.updateMany({
      where: {
        id: { in: replaceIds },
        schedulePeriodId: period.id,
        status: { in: activeShiftStatuses },
      },
      data: {
        status: "CANCELLED",
        updatedById: input.actorEmployeeId,
      },
    });
  }

  if (createData.length > 0) {
    await prisma.scheduledShift.createMany({ data: createData });
  }

  await prisma.scheduleChangeLog.create({
    data: {
      schedulePeriodId: period.id,
      changeType: "CREATE",
      afterData: {
        ...summary,
        created: createData.length,
        cancelledIds: replaceIds.length,
      },
      reason: input.reason ?? "กำหนดกะทั้งรอบ",
      changedById: input.actorEmployeeId,
    },
  });

  return {
    ...summary,
    created: createData.length,
    dryRun: false as const,
  };
}

export async function clearEmployeeNonOverrideShifts(input: {
  periodId: string;
  actorEmployeeId: string;
  /** @deprecated Prefer employeeIds */
  employeeId?: string;
  employeeIds?: string[];
  dateFrom?: string | null;
  dateTo?: string | null;
  /** When false (default), skip daily overrides. When true, cancel all active shifts in range. */
  includeOverrides?: boolean;
  reason?: string | null;
  dryRun?: boolean;
}) {
  const period = await prisma.schedulePeriod.findUnique({
    where: { id: input.periodId },
  });
  if (!period) throw new ScheduleRosterError("NOT_FOUND", "ไม่พบรอบตาราง");
  if (period.status === "CLOSED") {
    throw new ScheduleRosterError("PERIOD_CLOSED", "รอบนี้ปิดแล้ว ห้ามแก้ไขโดยตรง");
  }
  if (period.status === "PUBLISHED" && !input.reason?.trim()) {
    throw new ScheduleRosterError(
      "REASON_REQUIRED",
      "รอบประกาศแล้ว — ต้องระบุเหตุผลเมื่อแก้ไข",
    );
  }

  const employeeIds = [
    ...new Set(
      [
        ...(input.employeeIds ?? []),
        ...(input.employeeId ? [input.employeeId] : []),
      ].filter(Boolean),
    ),
  ];
  if (!employeeIds.length) {
    throw new ScheduleRosterError("VALIDATION_ERROR", "เลือกพนักงานอย่างน้อย 1 คน");
  }

  const from = input.dateFrom ? parseDateKey(input.dateFrom) : null;
  const to = input.dateTo ? parseDateKey(input.dateTo) : null;

  const where = {
    schedulePeriodId: period.id,
    employeeId: { in: employeeIds },
    status: { in: activeShiftStatuses },
    ...(input.includeOverrides ? {} : { isDailyOverride: false }),
    ...(from || to
      ? {
          workDate: {
            ...(from ? { gte: from } : {}),
            ...(to ? { lte: to } : {}),
          },
        }
      : {}),
  };

  const matchCount = await prisma.scheduledShift.count({ where });
  if (input.dryRun) {
    return {
      cancelled: matchCount,
      cancelledCount: matchCount,
      dryRun: true as const,
    };
  }

  const updated = await prisma.scheduledShift.updateMany({
    where,
    data: {
      status: "CANCELLED",
      updatedById: input.actorEmployeeId,
    },
  });

  if (updated.count > 0) {
    await prisma.scheduleChangeLog.create({
      data: {
        schedulePeriodId: period.id,
        changeType: "CANCEL",
        afterData: {
          cancelled: updated.count,
          employeeIds,
          dateFrom: input.dateFrom ?? null,
          dateTo: input.dateTo ?? null,
          includeOverrides: input.includeOverrides === true,
        },
        reason: input.reason ?? "ล้างกะของพนักงานที่เลือก",
        changedById: input.actorEmployeeId,
      },
    });
  }

  return {
    cancelled: updated.count,
    cancelledCount: updated.count,
    dryRun: false as const,
  };
}

/** Copy one employee's schedule days onto other employees in the same period. */
export async function copyEmployeeRowShifts(input: {
  periodId: string;
  actorEmployeeId: string;
  sourceEmployeeId: string;
  targetEmployeeIds: string[];
  dateFrom?: string | null;
  dateTo?: string | null;
  mode: "FILL_EMPTY" | "REPLACE_ALL";
  onlyDaysWithSource?: boolean;
  reason?: string | null;
  dryRun?: boolean;
}) {
  if (!input.sourceEmployeeId) {
    throw new ScheduleRosterError("VALIDATION_ERROR", "เลือกพนักงานต้นฉบับ");
  }
  const targets = [
    ...new Set(
      input.targetEmployeeIds.filter((id) => id && id !== input.sourceEmployeeId),
    ),
  ];
  if (!targets.length) {
    throw new ScheduleRosterError(
      "VALIDATION_ERROR",
      "เลือกพนักงานปลายทางอย่างน้อย 1 คน",
    );
  }

  const period = await prisma.schedulePeriod.findUnique({
    where: { id: input.periodId },
  });
  if (!period) throw new ScheduleRosterError("NOT_FOUND", "ไม่พบรอบตาราง");
  if (period.status === "CLOSED") {
    throw new ScheduleRosterError("PERIOD_CLOSED", "รอบนี้ปิดแล้ว ห้ามแก้ไขโดยตรง");
  }
  if (period.status === "PUBLISHED" && !input.reason?.trim()) {
    throw new ScheduleRosterError(
      "REASON_REQUIRED",
      "รอบประกาศแล้ว — ต้องระบุเหตุผลเมื่อแก้ไข",
    );
  }

  const from = input.dateFrom
    ? parseDateKey(input.dateFrom)
    : dateOnly(period.startDate);
  const to = input.dateTo ? parseDateKey(input.dateTo) : dateOnly(period.endDate);
  if (!from || !to || from > to) {
    throw new ScheduleRosterError("VALIDATION_ERROR", "ช่วงวันที่ไม่ถูกต้อง");
  }

  const sourceShifts = await prisma.scheduledShift.findMany({
    where: {
      schedulePeriodId: period.id,
      employeeId: input.sourceEmployeeId,
      workDate: { gte: from, lte: to },
      status: { in: ["SCHEDULED", "COMPLETED"] },
    },
  });

  let skippedReplacement = 0;
  const copyable = sourceShifts.filter((shift) => {
    if (shift.assignmentType === "REPLACEMENT") {
      skippedReplacement += 1;
      return false;
    }
    if (shift.note === "DAY_OFF" || shift.status === "LEAVE") return true;
    return Boolean(shift.shiftTemplateId) || shift.assignmentType === "EXTRA_SHIFT";
  });

  const existing = await prisma.scheduledShift.findMany({
    where: {
      schedulePeriodId: period.id,
      employeeId: { in: targets },
      workDate: { gte: from, lte: to },
      status: { in: activeShiftStatuses },
    },
    select: {
      id: true,
      employeeId: true,
      workDate: true,
      isDailyOverride: true,
    },
  });

  const existingByKey = new Map<string, { ids: string[]; isDailyOverride: boolean }>();
  for (const row of existing) {
    const key = `${row.employeeId}|${dateKeyUtc(row.workDate)}`;
    const current = existingByKey.get(key) ?? { ids: [], isDailyOverride: false };
    current.ids.push(row.id);
    current.isDailyOverride = current.isDailyOverride || row.isDailyOverride;
    existingByKey.set(key, current);
  }

  const replaceIds: string[] = [];
  const createData: Array<{
    schedulePeriodId: string;
    employeeId: string;
    shiftTemplateId: string | null;
    workDate: Date;
    plannedStart: Date;
    plannedEnd: Date;
    breakMinutes: number;
    lateGraceMinutes: number;
    assignmentType: ScheduledShiftAssignmentType;
    status: "SCHEDULED";
    note: string | null;
    isDailyOverride: boolean;
    createdById: string;
    updatedById: string;
  }> = [];
  let skippedExisting = 0;
  let skippedOverride = 0;

  for (const targetId of targets) {
    for (const source of copyable) {
      const dateKey = dateKeyUtc(source.workDate);
      const existingDay = existingByKey.get(`${targetId}|${dateKey}`);
      if (existingDay?.isDailyOverride) {
        skippedOverride += 1;
        continue;
      }
      if (existingDay?.ids.length) {
        if (input.mode === "FILL_EMPTY") {
          skippedExisting += 1;
          continue;
        }
        replaceIds.push(...existingDay.ids);
      }

      createData.push({
        schedulePeriodId: period.id,
        employeeId: targetId,
        shiftTemplateId: source.shiftTemplateId,
        workDate: source.workDate,
        plannedStart: source.plannedStart,
        plannedEnd: source.plannedEnd,
        breakMinutes: source.breakMinutes,
        lateGraceMinutes: source.lateGraceMinutes,
        assignmentType: "NORMAL",
        status: "SCHEDULED",
        note: source.note,
        isDailyOverride: false,
        createdById: input.actorEmployeeId,
        updatedById: input.actorEmployeeId,
      });
    }
  }

  const summary = {
    created: createData.length,
    createdCount: createData.length,
    cancelledCount: replaceIds.length,
    skippedExisting,
    skippedOverride,
    skippedReplacement,
    skippedCount: skippedExisting + skippedOverride + skippedReplacement,
  };

  if (input.dryRun) {
    return { ...summary, dryRun: true as const };
  }

  if (replaceIds.length > 0) {
    await prisma.scheduledShift.updateMany({
      where: {
        id: { in: [...new Set(replaceIds)] },
        schedulePeriodId: period.id,
      },
      data: {
        status: "CANCELLED",
        updatedById: input.actorEmployeeId,
      },
    });
  }
  if (createData.length > 0) {
    await prisma.scheduledShift.createMany({ data: createData });
  }

  await prisma.scheduleChangeLog.create({
    data: {
      schedulePeriodId: period.id,
      changeType: "COPY",
      afterData: {
        ...summary,
        sourceEmployeeId: input.sourceEmployeeId,
        targetEmployeeIds: targets,
      },
      reason: input.reason ?? "คัดลอกตารางของพนักงาน",
      changedById: input.actorEmployeeId,
    },
  });

  return { ...summary, dryRun: false as const };
}

export async function markEmployeeDayOffOrLeave(input: {
  periodId: string;
  actorEmployeeId: string;
  employeeId: string;
  workDate: string;
  kind: "DAY_OFF" | "LEAVE";
  reason?: string | null;
}) {
  const workDate = parseDateKey(input.workDate);
  if (!workDate) {
    throw new ScheduleRosterError("VALIDATION_ERROR", "วันที่ทำงานไม่ถูกต้อง");
  }

  const existing = await prisma.scheduledShift.findMany({
    where: {
      schedulePeriodId: input.periodId,
      employeeId: input.employeeId,
      workDate,
      status: { in: activeShiftStatuses },
    },
    select: { id: true },
  });

  for (const row of existing) {
    await cancelScheduledShift({
      periodId: input.periodId,
      shiftId: row.id,
      actorEmployeeId: input.actorEmployeeId,
      reason: input.reason ?? (input.kind === "DAY_OFF" ? "กำหนดวันหยุด" : "กำหนดลา"),
    });
  }

  const start = new Date(workDate);
  const end = new Date(workDate.getTime() + 60_000);

  return upsertScheduledShift({
    periodId: input.periodId,
    actorEmployeeId: input.actorEmployeeId,
    employeeId: input.employeeId,
    workDate: input.workDate,
    plannedStart: start.toISOString(),
    plannedEnd: end.toISOString(),
    breakMinutes: 0,
    assignmentType: "NORMAL",
    status: input.kind === "LEAVE" ? "LEAVE" : "SCHEDULED",
    note: input.kind === "DAY_OFF" ? "DAY_OFF" : "LEAVE",
    reason: input.reason,
    allowOverlap: true,
    isDailyOverride: true,
  });
}

export type { SchedulePeriodStatus };
