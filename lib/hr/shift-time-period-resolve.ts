export type ShiftTimeSnapshot = {
  startMinutes: number;
  endMinutes: number;
  breakMinutes: number;
  lateGraceMinutes: number;
  earlyLeaveGraceMinutes: number;
  effectiveFrom: Date;
};

export function dateOnly(value: Date): Date {
  return new Date(
    Date.UTC(value.getUTCFullYear(), value.getUTCMonth(), value.getUTCDate()),
  );
}

/** "YYYY-MM-DD" for Asia/Bangkok (ops timezone). */
export function todayKeyAsiaBangkok(now = new Date()): string {
  const parts = new Intl.DateTimeFormat("en-CA", {
    timeZone: "Asia/Bangkok",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).formatToParts(now);
  const get = (type: Intl.DateTimeFormatPartTypes) =>
    parts.find((part) => part.type === type)?.value ?? "";
  return `${get("year")}-${get("month")}-${get("day")}`;
}

export function resolveTimePeriodFromList(
  periods: readonly {
    effectiveFrom: Date;
    startMinutes: number;
    endMinutes: number;
    breakMinutes: number;
    lateGraceMinutes: number;
    earlyLeaveGraceMinutes: number;
  }[],
  workDate: Date,
): ShiftTimeSnapshot | null {
  const day = dateOnly(workDate).getTime();
  let best: ShiftTimeSnapshot | null = null;
  for (const period of periods) {
    const from = dateOnly(period.effectiveFrom).getTime();
    if (from > day) continue;
    if (!best || from > dateOnly(best.effectiveFrom).getTime()) {
      best = {
        startMinutes: period.startMinutes,
        endMinutes: period.endMinutes,
        breakMinutes: period.breakMinutes,
        lateGraceMinutes: period.lateGraceMinutes,
        earlyLeaveGraceMinutes: period.earlyLeaveGraceMinutes,
        effectiveFrom: period.effectiveFrom,
      };
    }
  }
  return best;
}
