import assert from "node:assert/strict";
import { describe, it } from "node:test";

import {
  buildPayrollExportCsv,
  calculatePayrollEntry,
  parsePayrollSettings,
} from "@/lib/hr/payroll";

describe("hr payroll", () => {
  it("parses configurable multipliers", () => {
    const settings = parsePayrollSettings([
      { key: "ot_multiplier", value: "1.5" },
      { key: "holiday_multiplier", value: "2" },
      { key: "late_deduction_per_minute", value: "1" },
      { key: "standard_work_minutes_per_day", value: "480" },
    ]);
    assert.equal(settings.otMultiplier, 1.5);
    assert.equal(settings.lateDeductionPerMinute, 1);
    assert.equal(settings.payDayOfMonth, 25);
  });

  it("parses business payday", () => {
    const settings = parsePayrollSettings([
      { key: "pay_day_of_month", value: "5" },
    ]);
    assert.equal(settings.payDayOfMonth, 5);
  });

  it("calculates DAILY base from calendar days in period (not worked minutes)", () => {
    const result = calculatePayrollEntry({
      compensation: {
        employmentType: "DAILY",
        dailyRate: 500,
        hourlyRate: 0,
        monthlySalary: 0,
        positionAllowance: 0,
        mealAllowance: 0,
        housingAllowance: 0,
        travelAllowance: 0,
      },
      attendance: {
        workedMinutes: 480 * 2,
        otMinutes: 60,
        lateMinutes: 0,
        holidayWorkedMinutes: 0,
        absentDays: 0,
      },
      leave: { unpaidLeaveDays: 0 },
      adjustments: {
        bonuses: 100,
        deductions: 50,
        advances: 0,
        otherEarnings: 0,
      },
      settings: {
        otMultiplier: 1.5,
        holidayMultiplier: 2,
        lateDeductionPerMinute: 0,
        standardWorkMinutesPerDay: 480,
        standardDaysPerMonth: 30,
        payDayOfMonth: 25,
      },
      periodCalendarDays: 2,
      monthDays: 30,
    });
    assert.equal(result.basePay, 1000);
    assert.equal(result.otPay, 93.75);
    assert.equal(result.bonuses, 100);
    assert.equal(result.deductions, 50);
    assert.equal(result.grossPay, 1193.75);
    assert.equal(result.netPay, 1143.75);
    assert.equal(result.hourlyRateSnapshot, 62.5);
    assert.equal(result.otHourlyRateSnapshot, 93.75);
    assert.equal(result.otMultiplierSnapshot, 1.5);
    assert.equal(result.dailyRateSnapshot, 500);
  });

  it("DAILY 400×15-day period uses 15 billable days not minute proration", () => {
    const result = calculatePayrollEntry({
      compensation: {
        employmentType: "DAILY",
        dailyRate: 400,
        hourlyRate: 0,
        monthlySalary: 0,
        positionAllowance: 0,
        mealAllowance: 0,
        housingAllowance: 0,
        travelAllowance: 0,
      },
      attendance: {
        workedMinutes: 7020,
        otMinutes: 0,
        lateMinutes: 0,
        holidayWorkedMinutes: 0,
        absentDays: 0,
      },
      leave: { unpaidLeaveDays: 0 },
      adjustments: {
        bonuses: 0,
        deductions: 0,
        advances: 0,
        otherEarnings: 0,
      },
      settings: {
        otMultiplier: 1.5,
        holidayMultiplier: 2,
        lateDeductionPerMinute: 0,
        standardWorkMinutesPerDay: 480,
        standardDaysPerMonth: 30,
        payDayOfMonth: 25,
      },
      periodCalendarDays: 15,
      monthDays: 31,
    });
    assert.equal(result.basePay, 6000);
    assert.equal(result.absenceDeduction, 0);
    assert.equal(result.unpaidLeaveDeduction, 0);
  });

  it("uses employee otHourlyRate for OT pay and snapshot", () => {
    const result = calculatePayrollEntry({
      compensation: {
        employmentType: "DAILY",
        dailyRate: 500,
        hourlyRate: 0,
        monthlySalary: 0,
        positionAllowance: 0,
        mealAllowance: 0,
        housingAllowance: 0,
        travelAllowance: 0,
        otHourlyRate: 100,
      },
      attendance: {
        workedMinutes: 480,
        otMinutes: 60,
        lateMinutes: 0,
        holidayWorkedMinutes: 0,
        absentDays: 0,
      },
      leave: { unpaidLeaveDays: 0 },
      adjustments: {
        bonuses: 0,
        deductions: 0,
        advances: 0,
        otherEarnings: 0,
      },
      settings: {
        otMultiplier: 1.5,
        holidayMultiplier: 2,
        lateDeductionPerMinute: 0,
        standardWorkMinutesPerDay: 480,
        standardDaysPerMonth: 30,
        payDayOfMonth: 25,
      },
      periodCalendarDays: 1,
      monthDays: 30,
    });
    assert.equal(result.otPay, 100);
    assert.equal(result.otHourlyRateSnapshot, 100);
    assert.equal(result.otMultiplierSnapshot, 1.5);
  });

  it("calculates MONTHLY prorated salary", () => {
    const result = calculatePayrollEntry({
      compensation: {
        employmentType: "MONTHLY",
        dailyRate: 0,
        hourlyRate: 0,
        monthlySalary: 30000,
        positionAllowance: 0,
        mealAllowance: 0,
        housingAllowance: 0,
        travelAllowance: 0,
      },
      attendance: {
        workedMinutes: 0,
        otMinutes: 0,
        lateMinutes: 0,
        holidayWorkedMinutes: 0,
        absentDays: 0,
      },
      leave: { unpaidLeaveDays: 0 },
      adjustments: {
        bonuses: 0,
        deductions: 0,
        advances: 0,
        otherEarnings: 0,
      },
      settings: {
        otMultiplier: 1.5,
        holidayMultiplier: 2,
        lateDeductionPerMinute: 0,
        standardWorkMinutesPerDay: 480,
        standardDaysPerMonth: 30,
        payDayOfMonth: 25,
      },
      periodCalendarDays: 15,
      monthDays: 30,
    });
    assert.equal(result.basePay, 15000);
    assert.equal(result.netPay, 15000);
  });

  it("MONTHLY Jul 1–15 uses 30-day divisor not calendar 31", () => {
    const result = calculatePayrollEntry({
      compensation: {
        employmentType: "MONTHLY",
        dailyRate: 0,
        hourlyRate: 0,
        monthlySalary: 20000,
        positionAllowance: 0,
        mealAllowance: 0,
        housingAllowance: 0,
        travelAllowance: 0,
      },
      attendance: {
        workedMinutes: 0,
        otMinutes: 0,
        lateMinutes: 0,
        holidayWorkedMinutes: 0,
        absentDays: 0,
      },
      leave: { unpaidLeaveDays: 0 },
      adjustments: {
        bonuses: 0,
        deductions: 0,
        advances: 0,
        otherEarnings: 0,
      },
      settings: {
        otMultiplier: 1.5,
        holidayMultiplier: 2,
        lateDeductionPerMinute: 0,
        standardWorkMinutesPerDay: 480,
        standardDaysPerMonth: 30,
        payDayOfMonth: 25,
      },
      periodCalendarDays: 15,
      monthDays: 31,
    });
    assert.equal(result.basePay, 10000);
  });

  it("builds csv export", () => {
    const csv = buildPayrollExportCsv([
      {
        employeeCode: "E1",
        employeeName: "Test",
        employmentType: "DAILY",
        basePay: 100,
        otPay: 0,
        holidayPay: 0,
        allowances: 0,
        bonuses: 0,
        deductions: 0,
        advances: 0,
        unpaidLeaveDeduction: 0,
        absenceDeduction: 0,
        lateDeduction: 0,
        grossPay: 100,
        netPay: 100,
      },
    ]);
    assert.match(csv, /employee_code/);
    assert.match(csv, /E1,Test,DAILY,100/);
  });
});

describe("resolvePayrollCompensation", () => {
  it("prefers employee hourly and ot rates", async () => {
    const { resolvePayrollCompensation } = await import(
      "@/lib/hr/employee-compensation"
    );
    const comp = resolvePayrollCompensation(
      {
        employmentType: "MONTHLY",
        hourlyRate: { toString: () => "120" } as never,
        otHourlyRate: { toString: () => "180" } as never,
      },
      {
        employmentType: "MONTHLY",
        dailyRate: { toString: () => "0" } as never,
        hourlyRate: { toString: () => "50" } as never,
        monthlySalary: { toString: () => "15000" } as never,
        positionAllowance: { toString: () => "0" } as never,
        mealAllowance: { toString: () => "0" } as never,
        housingAllowance: { toString: () => "0" } as never,
        travelAllowance: { toString: () => "0" } as never,
      },
    );
    assert.ok(comp);
    assert.equal(comp.hourlyRate, 120);
    assert.equal(comp.otHourlyRate, 180);
    assert.equal(comp.monthlySalary, 15000);
  });

  it("returns null when no payable base", async () => {
    const { resolvePayrollCompensation } = await import(
      "@/lib/hr/employee-compensation"
    );
    const comp = resolvePayrollCompensation(
      {
        employmentType: "MONTHLY",
        hourlyRate: null,
        otHourlyRate: null,
      },
      null,
    );
    assert.equal(comp, null);
  });
});
