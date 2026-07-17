import { buildScheduleRange, rangesOverlap } from "@/lib/hr/schedules";

export type ScheduledShiftRange = {
  id?: string;
  employeeId: string;
  plannedStart: Date;
  plannedEnd: Date;
  status?: string;
};

export function detectOverlap(
  candidate: ScheduledShiftRange,
  shifts: readonly ScheduledShiftRange[],
) {
  return shifts.filter(
    (shift) =>
      shift.employeeId === candidate.employeeId &&
      shift.status !== "CANCELLED" &&
      shift.status !== "REPLACED" &&
      shift.id !== candidate.id &&
      rangesOverlap(
        { startsAt: candidate.plannedStart, endsAt: candidate.plannedEnd },
        { startsAt: shift.plannedStart, endsAt: shift.plannedEnd },
      ),
  );
}

export function buildSnapshotFromTemplate(
  startMinutes: number,
  endMinutes: number,
  workDate: Date,
  breakMinutes: number,
) {
  if (!Number.isInteger(breakMinutes) || breakMinutes < 0) return null;
  const range = buildScheduleRange(workDate, startMinutes, endMinutes);
  if (!range) return null;
  return { plannedStart: range.startsAt, plannedEnd: range.endsAt, breakMinutes };
}

export function canAssignMultiple(
  candidate: ScheduledShiftRange,
  existing: readonly ScheduledShiftRange[],
) {
  return detectOverlap(candidate, existing).length === 0;
}
