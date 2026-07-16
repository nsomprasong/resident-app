import { buildScheduleRange, dateKeyUtc, parseDateKey } from "@/lib/hr/schedules";
import {
  dateOnly,
  resolveTimePeriodFromList,
  todayKeyAsiaBangkok,
  type ShiftTimeSnapshot,
} from "@/lib/hr/shift-time-period-resolve";
import { prisma } from "@/lib/prisma";

export type { ShiftTimeSnapshot };
export {
  dateOnly,
  resolveTimePeriodFromList,
  todayKeyAsiaBangkok,
};

export async function resolveShiftTimesForDate(
  shiftTemplateId: string,
  workDate: Date,
): Promise<ShiftTimeSnapshot | null> {
  const day = dateOnly(workDate);
  const period = await prisma.shiftTemplateTimePeriod.findFirst({
    where: {
      shiftTemplateId,
      effectiveFrom: { lte: day },
    },
    orderBy: { effectiveFrom: "desc" },
  });
  if (period) {
    return {
      startMinutes: period.startMinutes,
      endMinutes: period.endMinutes,
      breakMinutes: period.breakMinutes,
      lateGraceMinutes: period.lateGraceMinutes,
      earlyLeaveGraceMinutes: period.earlyLeaveGraceMinutes,
      effectiveFrom: period.effectiveFrom,
    };
  }

  const template = await prisma.shiftTemplate.findUnique({
    where: { id: shiftTemplateId },
    select: {
      startMinutes: true,
      endMinutes: true,
      breakMinutes: true,
      lateGraceMinutes: true,
      earlyLeaveGraceMinutes: true,
      createdAt: true,
    },
  });
  if (!template) return null;
  return {
    startMinutes: template.startMinutes,
    endMinutes: template.endMinutes,
    breakMinutes: template.breakMinutes,
    lateGraceMinutes: template.lateGraceMinutes,
    earlyLeaveGraceMinutes: template.earlyLeaveGraceMinutes,
    effectiveFrom: dateOnly(template.createdAt),
  };
}

export async function upsertShiftTimePeriod(input: {
  shiftTemplateId: string;
  effectiveFrom: Date;
  startMinutes: number;
  endMinutes: number;
  breakMinutes: number;
  lateGraceMinutes: number;
  earlyLeaveGraceMinutes: number;
}) {
  const effectiveFrom = dateOnly(input.effectiveFrom);
  return prisma.shiftTemplateTimePeriod.upsert({
    where: {
      shiftTemplateId_effectiveFrom: {
        shiftTemplateId: input.shiftTemplateId,
        effectiveFrom,
      },
    },
    create: {
      shiftTemplateId: input.shiftTemplateId,
      effectiveFrom,
      startMinutes: input.startMinutes,
      endMinutes: input.endMinutes,
      breakMinutes: input.breakMinutes,
      lateGraceMinutes: input.lateGraceMinutes,
      earlyLeaveGraceMinutes: input.earlyLeaveGraceMinutes,
    },
    update: {
      startMinutes: input.startMinutes,
      endMinutes: input.endMinutes,
      breakMinutes: input.breakMinutes,
      lateGraceMinutes: input.lateGraceMinutes,
      earlyLeaveGraceMinutes: input.earlyLeaveGraceMinutes,
    },
  });
}

/** Keep denormalized template columns in sync with today's effective period. */
export async function syncTemplateTimesAsOfToday(shiftTemplateId: string) {
  const today = parseDateKey(todayKeyAsiaBangkok());
  if (!today) return;
  const snapshot = await resolveShiftTimesForDate(shiftTemplateId, today);
  if (!snapshot) return;
  await prisma.shiftTemplate.update({
    where: { id: shiftTemplateId },
    data: {
      startMinutes: snapshot.startMinutes,
      endMinutes: snapshot.endMinutes,
      breakMinutes: snapshot.breakMinutes,
      lateGraceMinutes: snapshot.lateGraceMinutes,
      earlyLeaveGraceMinutes: snapshot.earlyLeaveGraceMinutes,
    },
  });
}

/**
 * Rematerialize ASSIGNED schedules on/after effectiveFrom using the new times.
 * Never touches workDate < effectiveFrom (history stays frozen).
 */
export async function rematerializeSchedulesFromEffectiveDate(input: {
  shiftTemplateId: string;
  effectiveFrom: Date;
  startMinutes: number;
  endMinutes: number;
}) {
  const from = dateOnly(input.effectiveFrom);
  const schedules = await prisma.workSchedule.findMany({
    where: {
      shiftTemplateId: input.shiftTemplateId,
      status: "ASSIGNED",
      workDate: { gte: from },
    },
    select: { id: true, workDate: true },
  });

  for (const schedule of schedules) {
    const range = buildScheduleRange(
      schedule.workDate,
      input.startMinutes,
      input.endMinutes,
    );
    if (!range) continue;
    await prisma.workSchedule.update({
      where: { id: schedule.id },
      data: {
        startsAt: range.startsAt,
        endsAt: range.endsAt,
      },
    });
  }

  return schedules.length;
}

export { dateKeyUtc, parseDateKey };
