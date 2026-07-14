import type { EmploymentType } from "@/generated/prisma/client";

import type { DailyStatusRow } from "@/lib/hr/daily-status";

/** Attendance statuses counted as a worked day for daily-rate pay. */
const PRESENT_LIKE_STATUSES = new Set(["PRESENT", "LATE", "EARLY_LEAVE"]);

export type EmployeePayInput = {
  employeeId: string;
  employeeName: string;
  employeeCode: string | null;
  employmentType: EmploymentType;
  dailyRate: number;
  monthlySalary: number;
  otHourlyRate: number;
};

export type EmployeePaySummary = {
  employeeId: string;
  employeeName: string;
  employeeCode: string | null;
  employmentType: EmploymentType;
  daysPresent: number;
  daysAbsent: number;
  daysOnLeave: number;
  totalWorkedMinutes: number;
  otApprovedMinutes: number;
  otHours: number;
  basePay: number;
  otPay: number;
  totalPay: number;
};

/**
 * Simple "pay summary" for a date range — not a full payroll engine.
 * Daily rate: dailyRate × days present in range.
 * Monthly salary: prorated by (days present ÷ calendar days in range) —
 * a straightforward approximation, not a statutory payroll calculation.
 * OT: only otApprovedMinutes (already approved) × otHourlyRate.
 */
export function summarizeEmployeePay(
  employee: EmployeePayInput,
  input: {
    daysPresent: number;
    daysAbsent: number;
    daysOnLeave: number;
    totalWorkedMinutes: number;
    otApprovedMinutes: number;
    periodCalendarDays: number;
  },
): EmployeePaySummary {
  const otHours = Math.round((input.otApprovedMinutes / 60) * 100) / 100;
  const otPay = Math.round(otHours * employee.otHourlyRate * 100) / 100;

  let basePay = 0;
  if (employee.employmentType === "DAILY") {
    basePay = Math.round(input.daysPresent * employee.dailyRate * 100) / 100;
  } else {
    const denominator = Math.max(1, input.periodCalendarDays);
    basePay =
      Math.round(
        (employee.monthlySalary * (input.daysPresent / denominator)) * 100,
      ) / 100;
  }

  return {
    employeeId: employee.employeeId,
    employeeName: employee.employeeName,
    employeeCode: employee.employeeCode,
    employmentType: employee.employmentType,
    daysPresent: input.daysPresent,
    daysAbsent: input.daysAbsent,
    daysOnLeave: input.daysOnLeave,
    totalWorkedMinutes: input.totalWorkedMinutes,
    otApprovedMinutes: input.otApprovedMinutes,
    otHours,
    basePay,
    otPay,
    totalPay: Math.round((basePay + otPay) * 100) / 100,
  };
}

/** Aggregate daily-status rows into per-employee pay summaries for a range. */
export function buildPaySummaries(input: {
  employees: readonly EmployeePayInput[];
  dailyStatusRows: readonly DailyStatusRow[];
  periodCalendarDays: number;
}): EmployeePaySummary[] {
  return input.employees.map((employee) => {
    const rows = input.dailyStatusRows.filter(
      (row) => row.employeeId === employee.employeeId,
    );
    const daysPresent = rows.filter((row) =>
      PRESENT_LIKE_STATUSES.has(row.status),
    ).length;
    const daysAbsent = rows.filter((row) => row.status === "ABSENT").length;
    const daysOnLeave = rows.filter((row) => row.status === "ON_LEAVE").length;
    const totalWorkedMinutes = rows.reduce(
      (sum, row) => sum + row.workedMinutes,
      0,
    );
    const otApprovedMinutes = rows.reduce(
      (sum, row) => sum + row.otApprovedMinutes,
      0,
    );

    return summarizeEmployeePay(employee, {
      daysPresent,
      daysAbsent,
      daysOnLeave,
      totalWorkedMinutes,
      otApprovedMinutes,
      periodCalendarDays: input.periodCalendarDays,
    });
  });
}
