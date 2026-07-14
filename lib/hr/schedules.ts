export type ScheduleRange = {
  startsAt: Date;
  endsAt: Date;
};

export type ScheduleLike = ScheduleRange & {
  id?: string;
  employeeId: string;
  shiftTemplateId?: string | null;
  workDate?: Date;
  status?: string;
};

export type ShiftTemplateLike = {
  id: string;
  name: string;
  requiredHeadcount: number;
  isActive?: boolean;
};

/** "HH:mm" → minutes from midnight */
export function parseTimeToMinutes(value: string): number | null {
  const match = /^([01]?\d|2[0-3]):([0-5]\d)$/.exec(value.trim());
  if (!match) return null;
  return Number(match[1]) * 60 + Number(match[2]);
}

export function formatMinutesAsTime(minutes: number): string {
  const normalized = ((minutes % (24 * 60)) + 24 * 60) % (24 * 60);
  const hours = Math.floor(normalized / 60);
  const mins = normalized % 60;
  return `${String(hours).padStart(2, "0")}:${String(mins).padStart(2, "0")}`;
}

export function dateKeyUtc(value: Date): string {
  return value.toISOString().slice(0, 10);
}

export function parseDateKey(value: string): Date | null {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) return null;
  return new Date(`${value}T00:00:00.000Z`);
}

/** Build absolute start/end from calendar date + minute-of-day (supports overnight). */
export function buildScheduleRange(
  workDate: Date,
  startMinutes: number,
  endMinutes: number,
): ScheduleRange | null {
  if (
    !Number.isInteger(startMinutes) ||
    !Number.isInteger(endMinutes) ||
    startMinutes < 0 ||
    startMinutes >= 24 * 60 ||
    endMinutes < 0 ||
    endMinutes >= 24 * 60 ||
    startMinutes === endMinutes
  ) {
    return null;
  }

  const day = Date.UTC(
    workDate.getUTCFullYear(),
    workDate.getUTCMonth(),
    workDate.getUTCDate(),
  );
  const startsAt = new Date(day + startMinutes * 60_000);
  let endsAt = new Date(day + endMinutes * 60_000);
  if (endMinutes < startMinutes) {
    endsAt = new Date(endsAt.getTime() + 24 * 60 * 60_000);
  }
  return { startsAt, endsAt };
}

export function rangesOverlap(a: ScheduleRange, b: ScheduleRange): boolean {
  return a.startsAt < b.endsAt && b.startsAt < a.endsAt;
}

export function findEmployeeScheduleOverlaps(
  candidate: ScheduleLike,
  existing: readonly ScheduleLike[],
): ScheduleLike[] {
  return existing.filter((item) => {
    if (item.employeeId !== candidate.employeeId) return false;
    if (item.status === "CANCELLED") return false;
    if (candidate.id && item.id === candidate.id) return false;
    return rangesOverlap(candidate, item);
  });
}

export type UnderstaffedSlot = {
  workDate: string;
  shiftTemplateId: string;
  shiftName: string;
  requiredHeadcount: number;
  assignedCount: number;
  shortage: number;
};

export function findUnderstaffedShifts(input: {
  templates: readonly ShiftTemplateLike[];
  schedules: readonly ScheduleLike[];
  workDates: readonly string[];
}): UnderstaffedSlot[] {
  const activeTemplates = input.templates.filter(
    (template) => template.isActive !== false,
  );
  const result: UnderstaffedSlot[] = [];

  for (const workDate of input.workDates) {
    for (const template of activeTemplates) {
      const assignedCount = input.schedules.filter(
        (schedule) =>
          schedule.status !== "CANCELLED" &&
          schedule.shiftTemplateId === template.id &&
          schedule.workDate !== undefined &&
          dateKeyUtc(schedule.workDate) === workDate,
      ).length;
      const shortage = template.requiredHeadcount - assignedCount;
      if (shortage > 0) {
        result.push({
          workDate,
          shiftTemplateId: template.id,
          shiftName: template.name,
          requiredHeadcount: template.requiredHeadcount,
          assignedCount,
          shortage,
        });
      }
    }
  }

  return result;
}

export function addDaysToDateKey(dateKey: string, days: number): string | null {
  const date = parseDateKey(dateKey);
  if (!date) return null;
  date.setUTCDate(date.getUTCDate() + days);
  return dateKeyUtc(date);
}

export function eachDateKey(fromKey: string, toKey: string): string[] {
  const from = parseDateKey(fromKey);
  const to = parseDateKey(toKey);
  if (!from || !to || from > to) return [];
  const keys: string[] = [];
  const cursor = new Date(from);
  while (cursor <= to) {
    keys.push(dateKeyUtc(cursor));
    cursor.setUTCDate(cursor.getUTCDate() + 1);
  }
  return keys;
}

export function weekRangeContaining(dateKey: string): {
  from: string;
  to: string;
} | null {
  const date = parseDateKey(dateKey);
  if (!date) return null;
  const day = date.getUTCDay(); // 0 Sun
  const mondayOffset = day === 0 ? -6 : 1 - day;
  const fromDate = new Date(date);
  fromDate.setUTCDate(fromDate.getUTCDate() + mondayOffset);
  const toDate = new Date(fromDate);
  toDate.setUTCDate(toDate.getUTCDate() + 6);
  return { from: dateKeyUtc(fromDate), to: dateKeyUtc(toDate) };
}

export function monthRangeContaining(dateKey: string): {
  from: string;
  to: string;
} | null {
  const date = parseDateKey(dateKey);
  if (!date) return null;
  const from = new Date(
    Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), 1),
  );
  const to = new Date(
    Date.UTC(date.getUTCFullYear(), date.getUTCMonth() + 1, 0),
  );
  return { from: dateKeyUtc(from), to: dateKeyUtc(to) };
}
