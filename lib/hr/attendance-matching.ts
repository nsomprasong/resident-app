export type CandidateScheduledShift = {
  id: string;
  employeeId: string;
  plannedStart: Date;
  plannedEnd: Date;
  status: string;
};

export function findCandidateScheduledShifts(
  shifts: readonly CandidateScheduledShift[],
  employeeId: string,
  at: Date,
) {
  const windowStart = new Date(at.getTime() - 16 * 60 * 60_000);
  const windowEnd = new Date(at.getTime() + 16 * 60 * 60_000);
  return shifts.filter(
    (shift) =>
      shift.employeeId === employeeId &&
      shift.status === "SCHEDULED" &&
      shift.plannedStart <= windowEnd &&
      shift.plannedEnd >= windowStart,
  );
}

export function pickNearest(
  shifts: readonly CandidateScheduledShift[],
  at: Date,
): CandidateScheduledShift | null {
  return shifts.reduce<CandidateScheduledShift | null>((nearest, shift) => {
    const distance = Math.min(
      Math.abs(shift.plannedStart.getTime() - at.getTime()),
      Math.abs(shift.plannedEnd.getTime() - at.getTime()),
    );
    if (!nearest) return shift;
    const nearestDistance = Math.min(
      Math.abs(nearest.plannedStart.getTime() - at.getTime()),
      Math.abs(nearest.plannedEnd.getTime() - at.getTime()),
    );
    return distance < nearestDistance ? shift : nearest;
  }, null);
}

export function attendanceStatusForMatch(match: CandidateScheduledShift | null) {
  return match ? "OPEN" : "PENDING_REVIEW";
}
