type MoneyValue = number | string | { toString(): string };

export type ShiftLike = {
  startsAt: Date;
  endsAt: Date;
};

export type WageShiftLike = ShiftLike & {
  hourlyRate?: MoneyValue | null;
};

export function calculateShiftHours(shift: ShiftLike) {
  const durationMs = shift.endsAt.getTime() - shift.startsAt.getTime();
  if (durationMs <= 0) return 0;
  return Math.round((durationMs / 3_600_000) * 100) / 100;
}

export function calculateTotalShiftHours(shifts: readonly ShiftLike[]) {
  return Math.round(
    shifts.reduce((sum, shift) => sum + calculateShiftHours(shift), 0) * 100,
  ) / 100;
}

export function calculateEstimatedWage(shifts: readonly WageShiftLike[]) {
  return Math.round(
    shifts.reduce((sum, shift) => {
      if (shift.hourlyRate === null || shift.hourlyRate === undefined) return sum;
      return sum + calculateShiftHours(shift) * Number(shift.hourlyRate);
    }, 0) * 100,
  ) / 100;
}
