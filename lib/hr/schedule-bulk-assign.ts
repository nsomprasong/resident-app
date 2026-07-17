export type BulkAssignMode =
  | "FILL_EMPTY"
  | "REPLACE_ALL"
  | "REPLACE_SELECTED";

export type BulkAssignDayDecision =
  | "CREATE"
  | "REPLACE"
  | "SKIP_EXISTING"
  | "SKIP_OVERRIDE"
  | "SKIP_WEEKDAY";

export type BulkAssignExistingDay = {
  dateKey: string;
  employeeId: string;
  shiftIds: string[];
  isDailyOverride: boolean;
};

export type BulkAssignPlan = {
  jobs: Array<{
    employeeId: string;
    dateKey: string;
    action: "CREATE" | "REPLACE";
    replaceShiftIds: string[];
  }>;
  createCount: number;
  replaceCount: number;
  skippedExisting: number;
  skippedOverride: number;
};

/** 0 = Sunday … 6 = Saturday (UTC calendar day). */
export function weekdayUtc(dateKey: string): number | null {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(dateKey)) return null;
  const [y, m, d] = dateKey.split("-").map(Number);
  return new Date(Date.UTC(y, m - 1, d)).getUTCDay();
}

export function filterDateKeysByWeekdays(
  dateKeys: string[],
  weekdays: readonly number[],
): string[] {
  const allowed = new Set(weekdays);
  return dateKeys.filter((key) => {
    const day = weekdayUtc(key);
    return day !== null && allowed.has(day);
  });
}

export function clampDateKeysToRange(
  periodDateKeys: string[],
  fromKey?: string | null,
  toKey?: string | null,
): string[] {
  return periodDateKeys.filter((key) => {
    if (fromKey && key < fromKey) return false;
    if (toKey && key > toKey) return false;
    return true;
  });
}

function planJobsForCells(input: {
  cells: Array<{ employeeId: string; dateKey: string }>;
  mode: BulkAssignMode;
  replaceOverrides: boolean;
  existingByKey: Map<string, BulkAssignExistingDay>;
}): BulkAssignPlan {
  const jobs: BulkAssignPlan["jobs"] = [];
  let skippedExisting = 0;
  let skippedOverride = 0;
  let createCount = 0;
  let replaceCount = 0;

  const seen = new Set<string>();
  for (const cell of input.cells) {
    const key = `${cell.employeeId}|${cell.dateKey}`;
    if (seen.has(key)) continue;
    seen.add(key);

    const existing = input.existingByKey.get(key);
    const hasShifts = Boolean(existing?.shiftIds.length);

    if (existing?.isDailyOverride && !input.replaceOverrides) {
      skippedOverride += 1;
      continue;
    }

    if (input.mode === "FILL_EMPTY") {
      if (hasShifts) {
        skippedExisting += 1;
        continue;
      }
      jobs.push({
        employeeId: cell.employeeId,
        dateKey: cell.dateKey,
        action: "CREATE",
        replaceShiftIds: [],
      });
      createCount += 1;
      continue;
    }

    // REPLACE_ALL / REPLACE_SELECTED — both operate only on the filtered cell set
    if (hasShifts) {
      jobs.push({
        employeeId: cell.employeeId,
        dateKey: cell.dateKey,
        action: "REPLACE",
        replaceShiftIds: existing?.shiftIds ?? [],
      });
      replaceCount += 1;
    } else {
      jobs.push({
        employeeId: cell.employeeId,
        dateKey: cell.dateKey,
        action: "CREATE",
        replaceShiftIds: [],
      });
      createCount += 1;
    }
  }

  return {
    jobs,
    createCount,
    replaceCount,
    skippedExisting,
    skippedOverride,
  };
}

/**
 * Pure planner for “กำหนดกะทั้งรอบ”.
 * Daily overrides are never replaced unless replaceOverrides is true.
 * Pass `cells` to assign only selected day-cells (ignores weekdays filter).
 */
export function planBulkAssignShifts(input: {
  employeeIds?: string[];
  dateKeys?: string[];
  weekdays?: readonly number[];
  cells?: Array<{ employeeId: string; dateKey: string }>;
  mode: BulkAssignMode;
  replaceOverrides: boolean;
  existing: BulkAssignExistingDay[];
}): BulkAssignPlan {
  const existingByKey = new Map<string, BulkAssignExistingDay>();
  for (const item of input.existing) {
    existingByKey.set(`${item.employeeId}|${item.dateKey}`, item);
  }

  if (input.cells?.length) {
    return planJobsForCells({
      cells: input.cells,
      mode: input.mode,
      replaceOverrides: input.replaceOverrides,
      existingByKey,
    });
  }

  const employeeIds = input.employeeIds ?? [];
  const dateKeys = input.dateKeys ?? [];
  const weekdays = input.weekdays ?? [];
  const workingDates = filterDateKeysByWeekdays(dateKeys, weekdays);
  const cells = employeeIds.flatMap((employeeId) =>
    workingDates.map((dateKey) => ({ employeeId, dateKey })),
  );

  return planJobsForCells({
    cells,
    mode: input.mode,
    replaceOverrides: input.replaceOverrides,
    existingByKey,
  });
}

export const WEEKDAY_PRESETS = {
  EVERY_DAY: [0, 1, 2, 3, 4, 5, 6],
  MON_FRI: [1, 2, 3, 4, 5],
  MON_SAT: [1, 2, 3, 4, 5, 6],
} as const;
