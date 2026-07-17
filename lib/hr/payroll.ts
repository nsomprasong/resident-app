import type { EmploymentType } from "@/generated/prisma/client";

export type PayrollSettingsMap = {
  otMultiplier: number;
  holidayMultiplier: number;
  lateDeductionPerMinute: number;
  standardWorkMinutesPerDay: number;
  /** ตัวหาร prorate เงินเดือนรายเดือน (เช่น 30 = ครึ่งเดือน 15 วัน ≈ 50%) */
  standardDaysPerMonth: number;
  /** Business payday (1–31). Employee forms no longer override this. */
  payDayOfMonth: number;
};

export const DEFAULT_PAYROLL_SETTINGS: PayrollSettingsMap = {
  otMultiplier: 1.5,
  holidayMultiplier: 2,
  lateDeductionPerMinute: 0,
  standardWorkMinutesPerDay: 480,
  standardDaysPerMonth: 30,
  payDayOfMonth: 25,
};

export const PAYROLL_SETTING_DEFS = [
  {
    key: "ot_multiplier",
    labelTh: "ตัวคูณ OT",
    defaultValue: String(DEFAULT_PAYROLL_SETTINGS.otMultiplier),
  },
  {
    key: "holiday_multiplier",
    labelTh: "ตัวคูณวันหยุด",
    defaultValue: String(DEFAULT_PAYROLL_SETTINGS.holidayMultiplier),
  },
  {
    key: "late_deduction_per_minute",
    labelTh: "หักมาสายต่อนาที",
    defaultValue: String(DEFAULT_PAYROLL_SETTINGS.lateDeductionPerMinute),
  },
  {
    key: "standard_work_minutes_per_day",
    labelTh: "นาทีทำงานมาตรฐานต่อวัน",
    defaultValue: String(DEFAULT_PAYROLL_SETTINGS.standardWorkMinutesPerDay),
  },
  {
    key: "standard_days_per_month",
    labelTh: "จำนวนวันต่อเดือนสำหรับ prorate เงินเดือน",
    defaultValue: String(DEFAULT_PAYROLL_SETTINGS.standardDaysPerMonth),
  },
  {
    key: "pay_day_of_month",
    labelTh: "วันจ่ายเงินเดือนของกิจการ",
    defaultValue: String(DEFAULT_PAYROLL_SETTINGS.payDayOfMonth),
  },
] as const;

export function parsePayrollSettings(
  rows: readonly { key: string; value: string }[],
): PayrollSettingsMap {
  const map = { ...DEFAULT_PAYROLL_SETTINGS };
  for (const row of rows) {
    const value = Number(row.value);
    if (!Number.isFinite(value)) continue;
    if (row.key === "ot_multiplier") map.otMultiplier = value;
    if (row.key === "holiday_multiplier") map.holidayMultiplier = value;
    if (row.key === "late_deduction_per_minute") {
      map.lateDeductionPerMinute = value;
    }
    if (row.key === "standard_work_minutes_per_day") {
      map.standardWorkMinutesPerDay = value;
    }
    if (row.key === "standard_days_per_month") {
      const days = Math.trunc(value);
      if (days >= 1 && days <= 31) map.standardDaysPerMonth = days;
    }
    if (row.key === "pay_day_of_month") {
      const day = Math.trunc(value);
      if (day >= 1 && day <= 31) map.payDayOfMonth = day;
    }
  }
  return map;
}

export function mergePayrollSettingItems(
  rows: readonly { id?: string; key: string; value: string; labelTh: string | null }[],
) {
  const byKey = new Map(rows.map((row) => [row.key, row]));
  return PAYROLL_SETTING_DEFS.map((def) => {
    const existing = byKey.get(def.key);
    return {
      id: existing?.id ?? null,
      key: def.key,
      value: existing?.value ?? def.defaultValue,
      labelTh: existing?.labelTh ?? def.labelTh,
    };
  });
}

export function money(value: number): number {
  return Math.round((value + Number.EPSILON) * 100) / 100;
}

export type CompensationLike = {
  employmentType: EmploymentType;
  dailyRate: number;
  hourlyRate: number;
  monthlySalary: number;
  positionAllowance: number;
  mealAllowance: number;
  housingAllowance: number;
  travelAllowance: number;
  /** Employee.otHourlyRate when set — preferred OT rate for pay + snapshot. */
  otHourlyRate?: number | null;
};

export type AttendanceAgg = {
  workedMinutes: number;
  otMinutes: number;
  lateMinutes: number;
  holidayWorkedMinutes: number;
  absentDays: number;
};

export type LeaveAgg = {
  unpaidLeaveDays: number;
};

export type AdjustmentAgg = {
  bonuses: number;
  deductions: number;
  advances: number;
  otherEarnings: number;
};

export type PayrollCalcInput = {
  compensation: CompensationLike;
  attendance: AttendanceAgg;
  leave: LeaveAgg;
  adjustments: AdjustmentAgg;
  settings: PayrollSettingsMap;
  /** Inclusive calendar days in the period (for monthly prorate). */
  periodCalendarDays: number;
  /** Days in the month of period start (for monthly salary prorate). */
  monthDays: number;
};

export type PayrollCalcResult = {
  basePay: number;
  otPay: number;
  holidayPay: number;
  allowances: number;
  bonuses: number;
  deductions: number;
  advances: number;
  unpaidLeaveDeduction: number;
  absenceDeduction: number;
  lateDeduction: number;
  grossPay: number;
  netPay: number;
  workedMinutes: number;
  otMinutes: number;
  absentDays: number;
  unpaidLeaveDays: number;
  lateMinutes: number;
  hourlyRateSnapshot: number;
  otHourlyRateSnapshot: number;
  otMultiplierSnapshot: number;
  dailyRateSnapshot: number;
  monthlySalarySnapshot: number;
};

function effectiveHourlyRate(comp: CompensationLike): number {
  if (comp.hourlyRate > 0) return comp.hourlyRate;
  if (comp.dailyRate > 0) {
    return money(comp.dailyRate / (DEFAULT_PAYROLL_SETTINGS.standardWorkMinutesPerDay / 60));
  }
  if (comp.monthlySalary > 0) {
    // Approximate hourly from monthly / 30 / 8
    return money(comp.monthlySalary / 30 / 8);
  }
  return 0;
}

function salaryMonthDayDivisor(
  settings: PayrollSettingsMap,
  monthDays: number,
): number {
  const std = settings.standardDaysPerMonth;
  if (std > 0) return std;
  return monthDays > 0 ? monthDays : 30;
}

export function calculatePayrollEntry(input: PayrollCalcInput): PayrollCalcResult {
  const { compensation: comp, attendance, leave, adjustments, settings } = input;
  const hourly = effectiveHourlyRate(comp);
  const otMultiplier = settings.otMultiplier;
  const otHourly =
    comp.otHourlyRate != null && comp.otHourlyRate > 0
      ? comp.otHourlyRate
      : money(hourly * otMultiplier);
  const dayMinutes = settings.standardWorkMinutesPerDay || 480;
  const monthDivisor = salaryMonthDayDivisor(settings, input.monthDays);

  let basePay = 0;
  if (comp.employmentType === "DAILY") {
    if (comp.dailyRate > 0) {
      // Phase 21: ค่าจ้างพื้นฐาน = วันที่ได้รับรองในรอบ × ค่าแรงรายวัน
      // (ไม่ prorate จาก workedMinutes — OT แยกตาม otApprovedMinutes)
      const billableDays = Math.max(
        0,
        input.periodCalendarDays -
          leave.unpaidLeaveDays -
          attendance.absentDays,
      );
      basePay = money(billableDays * comp.dailyRate);
    } else {
      basePay = money((attendance.workedMinutes / 60) * hourly);
    }
  } else {
    const ratio =
      monthDivisor > 0
        ? Math.min(1, input.periodCalendarDays / monthDivisor)
        : 1;
    basePay = money(comp.monthlySalary * ratio);
  }

  const otPay = money((attendance.otMinutes / 60) * otHourly);
  const holidayPay = money(
    (attendance.holidayWorkedMinutes / 60) * hourly * Math.max(0, settings.holidayMultiplier - 1),
  );

  const allowances = money(
    (comp.positionAllowance +
      comp.mealAllowance +
      comp.housingAllowance +
      comp.travelAllowance) *
      (comp.employmentType === "MONTHLY"
        ? Math.min(1, input.periodCalendarDays / Math.max(1, monthDivisor))
        : attendance.workedMinutes > 0
          ? 1
          : 0),
  );

  const unpaidLeaveDeduction =
    comp.employmentType === "DAILY" && comp.dailyRate > 0
      ? 0
      : money(
          leave.unpaidLeaveDays *
            (comp.employmentType === "DAILY"
              ? comp.dailyRate || hourly * (dayMinutes / 60)
              : comp.monthlySalary / Math.max(1, monthDivisor)),
        );

  const absenceDeduction =
    comp.employmentType === "DAILY" && comp.dailyRate > 0
      ? 0
      : money(
          attendance.absentDays *
            (comp.employmentType === "DAILY"
              ? comp.dailyRate || hourly * (dayMinutes / 60)
              : comp.monthlySalary / Math.max(1, monthDivisor)),
        );

  const lateDeduction = money(
    attendance.lateMinutes * settings.lateDeductionPerMinute,
  );

  const bonuses = money(adjustments.bonuses + adjustments.otherEarnings);
  const deductions = money(adjustments.deductions);
  const advances = money(adjustments.advances);

  const grossPay = money(
    basePay + otPay + holidayPay + allowances + bonuses,
  );
  const netPay = money(
    grossPay -
      deductions -
      advances -
      unpaidLeaveDeduction -
      absenceDeduction -
      lateDeduction,
  );

  return {
    basePay,
    otPay,
    holidayPay,
    allowances,
    bonuses,
    deductions,
    advances,
    unpaidLeaveDeduction,
    absenceDeduction,
    lateDeduction,
    grossPay,
    netPay,
    workedMinutes: attendance.workedMinutes,
    otMinutes: attendance.otMinutes,
    absentDays: attendance.absentDays,
    unpaidLeaveDays: leave.unpaidLeaveDays,
    lateMinutes: attendance.lateMinutes,
    hourlyRateSnapshot: hourly,
    otHourlyRateSnapshot: otHourly,
    otMultiplierSnapshot: otMultiplier,
    dailyRateSnapshot: comp.dailyRate,
    monthlySalarySnapshot: comp.monthlySalary,
  };
}

export function buildPayslipPayload(input: {
  periodName: string;
  periodStart: string;
  periodEnd: string;
  employeeName: string;
  employeeCode: string | null;
  employmentType: EmploymentType;
  calc: PayrollCalcResult;
}) {
  return {
    periodName: input.periodName,
    periodStart: input.periodStart,
    periodEnd: input.periodEnd,
    employeeName: input.employeeName,
    employeeCode: input.employeeCode,
    employmentType: input.employmentType,
    lines: [
      { code: "BASE", label: "ค่าจ้างพื้นฐาน", amount: input.calc.basePay },
      { code: "OT", label: "ค่าล่วงเวลา", amount: input.calc.otPay },
      { code: "HOLIDAY", label: "ทำงานวันหยุด", amount: input.calc.holidayPay },
      { code: "ALLOWANCE", label: "เบี้ยเลี้ยง", amount: input.calc.allowances },
      { code: "BONUS", label: "โบนัส/รายได้เพิ่ม", amount: input.calc.bonuses },
      {
        code: "UNPAID_LEAVE",
        label: "หักลาไม่รับค่าจ้าง",
        amount: -input.calc.unpaidLeaveDeduction,
      },
      {
        code: "ABSENCE",
        label: "หักขาดงาน",
        amount: -input.calc.absenceDeduction,
      },
      { code: "LATE", label: "หักมาสาย", amount: -input.calc.lateDeduction },
      { code: "DEDUCTION", label: "รายการหัก", amount: -input.calc.deductions },
      { code: "ADVANCE", label: "เงินเบิก", amount: -input.calc.advances },
    ],
    grossPay: input.calc.grossPay,
    netPay: input.calc.netPay,
    metrics: {
      workedMinutes: input.calc.workedMinutes,
      otMinutes: input.calc.otMinutes,
      lateMinutes: input.calc.lateMinutes,
      absentDays: input.calc.absentDays,
      unpaidLeaveDays: input.calc.unpaidLeaveDays,
    },
  };
}

export function toCsvRow(values: readonly (string | number)[]): string {
  return values
    .map((value) => {
      const text = String(value);
      if (/[",\n]/.test(text)) return `"${text.replaceAll('"', '""')}"`;
      return text;
    })
    .join(",");
}

export function buildPayrollExportCsv(
  rows: readonly {
    employeeCode: string | null;
    employeeName: string;
    employmentType: string;
    basePay: number;
    otPay: number;
    holidayPay: number;
    allowances: number;
    bonuses: number;
    deductions: number;
    advances: number;
    unpaidLeaveDeduction: number;
    absenceDeduction: number;
    lateDeduction: number;
    grossPay: number;
    netPay: number;
  }[],
): string {
  const header = toCsvRow([
    "employee_code",
    "employee_name",
    "employment_type",
    "base_pay",
    "ot_pay",
    "holiday_pay",
    "allowances",
    "bonuses",
    "deductions",
    "advances",
    "unpaid_leave_deduction",
    "absence_deduction",
    "late_deduction",
    "gross_pay",
    "net_pay",
  ]);
  const body = rows.map((row) =>
    toCsvRow([
      row.employeeCode ?? "",
      row.employeeName,
      row.employmentType,
      row.basePay,
      row.otPay,
      row.holidayPay,
      row.allowances,
      row.bonuses,
      row.deductions,
      row.advances,
      row.unpaidLeaveDeduction,
      row.absenceDeduction,
      row.lateDeduction,
      row.grossPay,
      row.netPay,
    ]),
  );
  return [header, ...body].join("\n");
}
