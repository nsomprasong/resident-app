import { buildScheduleRange, dateKeyUtc } from "@/lib/hr/schedules";
import {
  dateOnly,
  resolveShiftTimesForDate,
} from "@/lib/hr/shift-time-periods";
import { prisma } from "@/lib/prisma";

export type ShiftMembershipRecord = {
  id: string;
  shiftTemplateId: string;
  employeeId: string;
  employeeName: string;
  employeeCode: string | null;
  createdAt: string;
};

/** Active permanent membership for an employee (no expiry date). */
export async function findActiveMembershipForDate(employeeId: string) {
  return prisma.shiftMembership.findFirst({
    where: {
      employeeId,
      shiftTemplate: {
        isActive: true,
      },
    },
    include: {
      shiftTemplate: true,
    },
  });
}

/**
 * Keep ShiftMembership aligned with Employee.defaultShiftTemplateId.
 * Membership APIs remain for compatibility; กะประจำ is the source of truth in UI.
 */
export async function syncMembershipFromDefaultShift(
  employeeId: string,
  defaultShiftTemplateId: string | null,
) {
  await prisma.shiftMembership.deleteMany({ where: { employeeId } });
  if (!defaultShiftTemplateId) return;
  await prisma.shiftMembership.create({
    data: {
      employeeId,
      shiftTemplateId: defaultShiftTemplateId,
    },
  });
}

/**
 * Resolve today's operational WorkSchedule from permanent shift membership.
 * Creates a concrete WorkSchedule once; does not rewrite existing days when
 * template times change (history stays on the row; new dates use effective periods).
 */
export async function ensureWorkScheduleFromMembership(
  employeeId: string,
  workDate: Date,
) {
  const membership = await findActiveMembershipForDate(employeeId);
  let templateId = membership?.shiftTemplateId ?? null;

  if (!templateId) {
    const employee = await prisma.employee.findUnique({
      where: { id: employeeId },
      select: {
        defaultShiftTemplateId: true,
        defaultShiftTemplate: { select: { id: true, isActive: true } },
      },
    });
    if (
      employee?.defaultShiftTemplateId &&
      employee.defaultShiftTemplate?.isActive
    ) {
      templateId = employee.defaultShiftTemplateId;
    }
  }

  if (!templateId) return null;

  const times = await resolveShiftTimesForDate(templateId, workDate);
  if (!times) return null;

  const range = buildScheduleRange(
    workDate,
    times.startMinutes,
    times.endMinutes,
  );
  if (!range) return null;

  const include = {
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
  } as const;

  const existing = await prisma.workSchedule.findFirst({
    where: {
      employeeId,
      workDate: dateOnly(workDate),
      status: "ASSIGNED",
      shiftTemplateId: templateId,
    },
    include,
  });

  // Never overwrite past / already-materialized times here.
  // Future rematerialization happens explicitly when an effective-dated edit is saved.
  if (existing) return existing;

  return prisma.workSchedule.create({
    data: {
      employeeId,
      shiftTemplateId: templateId,
      workDate: dateOnly(workDate),
      startsAt: range.startsAt,
      endsAt: range.endsAt,
      isDayOff: false,
      status: "ASSIGNED",
    },
    include,
  });
}

export async function listEmployeesAlreadyInAnyShift(): Promise<string[]> {
  const rows = await prisma.shiftMembership.findMany({
    select: { employeeId: true },
  });
  return rows.map((row) => row.employeeId);
}

export function understaffedFromMemberships(input: {
  templates: readonly {
    id: string;
    name: string;
    requiredHeadcount: number;
    isActive: boolean;
    memberCount: number;
  }[];
}) {
  const result: Array<{
    shiftTemplateId: string;
    shiftName: string;
    requiredHeadcount: number;
    assignedCount: number;
    shortage: number;
  }> = [];

  for (const template of input.templates) {
    if (!template.isActive) continue;
    const shortage = template.requiredHeadcount - template.memberCount;
    if (shortage > 0) {
      result.push({
        shiftTemplateId: template.id,
        shiftName: template.name,
        requiredHeadcount: template.requiredHeadcount,
        assignedCount: template.memberCount,
        shortage,
      });
    }
  }
  return result;
}

export { dateKeyUtc };
