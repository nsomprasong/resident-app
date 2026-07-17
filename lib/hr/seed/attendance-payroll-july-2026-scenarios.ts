/** Day-of-month (1–16) scenario for July 2026 seed. */
export type DayScenarioKind =
  | "WORK_NORMAL"
  | "LATE_12"
  | "LATE_25"
  | "LATE_8"
  | "LATE_20"
  | "EARLY_30"
  | "EARLY_45"
  | "LATE_25_OT_60"
  | "OT_60"
  | "OT_120"
  | "OT_180"
  | "DAY_OFF"
  | "ABSENT"
  | "PAID_LEAVE"
  | "UNPAID_LEAVE"
  | "NO_CLOCK_OUT"
  | "OFF_SCHEDULE"
  | "OT_SUGGESTED"
  | "REPLACEMENT_WORKER"
  | "REPLACED_OWNER"
  | "DOUBLE_SHIFT_A"
  | "DOUBLE_SHIFT_B";

export const EMP1_JULY_PLAN: Record<number, DayScenarioKind> = {
  1: "WORK_NORMAL",
  2: "LATE_12",
  3: "WORK_NORMAL",
  4: "OT_120",
  5: "REPLACED_OWNER",
  6: "EARLY_30",
  7: "WORK_NORMAL",
  8: "PAID_LEAVE",
  9: "WORK_NORMAL",
  10: "LATE_25_OT_60",
  11: "ABSENT",
  12: "DAY_OFF",
  13: "WORK_NORMAL",
  14: "NO_CLOCK_OUT",
  15: "WORK_NORMAL",
  16: "OT_180",
};

export const EMP2_JULY_PLAN: Record<number, DayScenarioKind> = {
  1: "WORK_NORMAL",
  2: "WORK_NORMAL",
  3: "UNPAID_LEAVE",
  4: "LATE_8",
  5: "REPLACEMENT_WORKER",
  6: "DAY_OFF",
  7: "WORK_NORMAL",
  8: "DOUBLE_SHIFT_A",
  9: "WORK_NORMAL",
  10: "EARLY_45",
  11: "REPLACEMENT_WORKER",
  12: "OT_120",
  13: "DAY_OFF",
  14: "OFF_SCHEDULE",
  15: "LATE_20",
  16: "WORK_NORMAL",
};

/** พนักงานคนที่ 3+: ส่วนใหญ่ปกติ + ขาด/OT/OT รอตรวจ */
export const EMP3_JULY_PLAN: Record<number, DayScenarioKind> = {
  1: "WORK_NORMAL",
  2: "WORK_NORMAL",
  3: "WORK_NORMAL",
  4: "WORK_NORMAL",
  5: "OT_SUGGESTED",
  6: "WORK_NORMAL",
  7: "WORK_NORMAL",
  8: "WORK_NORMAL",
  9: "WORK_NORMAL",
  10: "ABSENT",
  11: "WORK_NORMAL",
  12: "WORK_NORMAL",
  13: "OT_60",
  14: "WORK_NORMAL",
  15: "DAY_OFF",
  16: "WORK_NORMAL",
};

export const EMP4_JULY_PLAN: Record<number, DayScenarioKind> = {
  1: "WORK_NORMAL",
  2: "PAID_LEAVE",
  3: "WORK_NORMAL",
  4: "WORK_NORMAL",
  5: "WORK_NORMAL",
  6: "WORK_NORMAL",
  7: "DAY_OFF",
  8: "WORK_NORMAL",
  9: "WORK_NORMAL",
  10: "WORK_NORMAL",
  11: "WORK_NORMAL",
  12: "WORK_NORMAL",
  13: "WORK_NORMAL",
  14: "WORK_NORMAL",
  15: "WORK_NORMAL",
  16: "WORK_NORMAL",
};

export const EMP5_JULY_PLAN: Record<number, DayScenarioKind> = {
  1: "LATE_12",
  2: "WORK_NORMAL",
  3: "LATE_20",
  4: "WORK_NORMAL",
  5: "WORK_NORMAL",
  6: "LATE_8",
  7: "WORK_NORMAL",
  8: "WORK_NORMAL",
  9: "LATE_25",
  10: "WORK_NORMAL",
  11: "WORK_NORMAL",
  12: "DAY_OFF",
  13: "WORK_NORMAL",
  14: "WORK_NORMAL",
  15: "WORK_NORMAL",
  16: "WORK_NORMAL",
};

export const EXTRA_EMPLOYEE_PLANS: Record<number, Record<number, DayScenarioKind>> =
  {
    2: EMP3_JULY_PLAN,
    3: EMP4_JULY_PLAN,
    4: EMP5_JULY_PLAN,
  };

/** Emp1 day 5: replaced by emp2 — owner keeps scheduled shift marked replaced. */
export const EMP1_REPLACED_DAY = 5;

/** Emp2 day 11: replacement while emp1 is absent. */
export const EMP2_REPLACEMENT_DAY_11 = 11;

export function dateKeyForJulyDay(day: number): string {
  const dd = String(day).padStart(2, "0");
  return `2026-07-${dd}`;
}

export function scenarioSkipsShift(kind: DayScenarioKind): boolean {
  return (
    kind === "DAY_OFF" ||
    kind === "ABSENT" ||
    kind === "PAID_LEAVE" ||
    kind === "UNPAID_LEAVE" ||
    kind === "OFF_SCHEDULE" ||
    kind === "REPLACED_OWNER"
  );
}

export function scenarioNeedsLeave(kind: DayScenarioKind): boolean {
  return kind === "PAID_LEAVE" || kind === "UNPAID_LEAVE";
}
