import type { LeaveDuration } from "@/generated/prisma/client";

import { dateKeyUtc, parseDateKey } from "@/lib/hr/schedules";

export type LeaveDurationCode = LeaveDuration;

export function decimalDays(value: { toString(): string } | number | string): number {
  return Number(value);
}

export function roundLeaveDays(value: number): number {
  return Math.round(value * 100) / 100;
}

export function eachDateKeyInclusive(startKey: string, endKey: string): string[] {
  const start = parseDateKey(startKey);
  const end = parseDateKey(endKey);
  if (!start || !end || start > end) return [];
  const keys: string[] = [];
  for (
    let cursor = start.getTime();
    cursor <= end.getTime();
    cursor += 24 * 60 * 60_000
  ) {
    keys.push(dateKeyUtc(new Date(cursor)));
  }
  return keys;
}

export function computeLeaveDaysRequested(input: {
  startDate: Date;
  endDate: Date;
  duration: LeaveDurationCode;
}): number {
  if (input.endDate < input.startDate) {
    throw new Error("INVALID_RANGE");
  }

  if (
    input.duration === "HALF_DAY_AM" ||
    input.duration === "HALF_DAY_PM"
  ) {
    if (dateKeyUtc(input.startDate) !== dateKeyUtc(input.endDate)) {
      throw new Error("HALF_DAY_SINGLE_DATE");
    }
    return 0.5;
  }

  const startKey = dateKeyUtc(input.startDate);
  const endKey = dateKeyUtc(input.endDate);
  return roundLeaveDays(eachDateKeyInclusive(startKey, endKey).length);
}

export function availableLeaveDays(input: {
  entitled: number;
  used: number;
  pending: number;
}): number {
  return roundLeaveDays(input.entitled - input.used - input.pending);
}

export function leaveDurationLabel(duration: LeaveDurationCode): string {
  switch (duration) {
    case "HALF_DAY_AM":
      return "ครึ่งวันเช้า";
    case "HALF_DAY_PM":
      return "ครึ่งวันบ่าย";
    default:
      return "เต็มวัน";
  }
}

export function rangesOverlapInclusive(
  aStart: Date,
  aEnd: Date,
  bStart: Date,
  bEnd: Date,
): boolean {
  return aStart <= bEnd && bStart <= aEnd;
}
