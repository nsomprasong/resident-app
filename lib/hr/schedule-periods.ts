import { dateKeyUtc } from "@/lib/hr/schedules";

export type SchedulePeriodLike = {
  id?: string;
  name: string;
  startDate: Date;
  endDate: Date;
  status: string;
  publishedAt?: Date | null;
  closedAt?: Date | null;
};

export function dateOnly(value: Date | string): Date {
  const date = typeof value === "string" ? new Date(`${value}T00:00:00.000Z`) : value;
  return new Date(Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), date.getUTCDate()));
}

export function computeSemiMonthlyRanges(year: number, month: number) {
  if (!Number.isInteger(year) || !Number.isInteger(month) || month < 1 || month > 12) {
    return [];
  }
  const firstStart = new Date(Date.UTC(year, month - 1, 1));
  const firstEnd = new Date(Date.UTC(year, month - 1, 15));
  const secondStart = new Date(Date.UTC(year, month - 1, 16));
  const secondEnd = new Date(Date.UTC(year, month, 0));
  return [
    { name: `รอบ 1–15 ${String(month).padStart(2, "0")}/${year}`, startDate: firstStart, endDate: firstEnd },
    { name: `รอบ 16–${secondEnd.getUTCDate()} ${String(month).padStart(2, "0")}/${year}`, startDate: secondStart, endDate: secondEnd },
  ];
}

export function periodsOverlap(
  candidate: Pick<SchedulePeriodLike, "startDate" | "endDate" | "id">,
  periods: readonly Pick<SchedulePeriodLike, "startDate" | "endDate" | "id">[],
) {
  const start = dateOnly(candidate.startDate);
  const end = dateOnly(candidate.endDate);
  return periods.some((period) => {
    if (candidate.id && period.id === candidate.id) return false;
    return start <= dateOnly(period.endDate) && dateOnly(period.startDate) <= end;
  });
}

export function serializeSchedulePeriod(period: SchedulePeriodLike) {
  return {
    id: period.id,
    name: period.name,
    startDate: dateKeyUtc(period.startDate),
    endDate: dateKeyUtc(period.endDate),
    status: period.status,
    publishedAt: period.publishedAt?.toISOString() ?? null,
    closedAt: period.closedAt?.toISOString() ?? null,
  };
}
