import { toCsvRow } from "@/lib/hr/payroll";
import { dateKeyUtc } from "@/lib/hr/schedules";

export const HR_REPORT_TYPES = [
  "employees",
  "attendance",
  "hours_ot",
  "leave",
  "payroll_cost",
  "department_cost",
  "adjustments",
  "compensation_history",
  "headcount_moves",
] as const;

export type HrReportType = (typeof HR_REPORT_TYPES)[number];

export function isHrReportType(value: string): value is HrReportType {
  return (HR_REPORT_TYPES as readonly string[]).includes(value);
}

export const HR_REPORT_TYPE_LABELS: Record<HrReportType, string> = {
  employees: "รายชื่อพนักงาน",
  attendance: "เข้า–ออกงาน มาสาย ขาดงาน",
  hours_ot: "ชั่วโมงทำงานและ OT",
  leave: "วันลาและสิทธิคงเหลือ",
  payroll_cost: "ต้นทุนค่าจ้าง",
  department_cost: "ต้นทุนตามแผนก",
  adjustments: "เงินเบิกและรายการหัก",
  compensation_history: "ประวัติการปรับค่าจ้าง",
  headcount_moves: "พนักงานเข้าใหม่และลาออก",
};

export type ReportEmployee = {
  id: string;
  employeeCode: string | null;
  name: string;
  employmentType: string;
  hrStatus: string;
  departmentId: string | null;
  departmentName: string | null;
  hiredAt: Date | null;
  endedAt: Date | null;
  isActive: boolean;
};

export type ReportAttendance = {
  employeeId: string;
  employeeCode: string | null;
  employeeName: string;
  workDate: Date;
  status: string;
  workedMinutes: number;
  lateMinutes: number;
  otMinutes: number;
  otApprovedMinutes: number;
  departmentId: string | null;
  departmentName: string | null;
};

export type ReportLeaveBalance = {
  employeeId: string;
  employeeCode: string | null;
  employeeName: string;
  leaveTypeName: string;
  year: number;
  entitled: number;
  used: number;
  pending: number;
  available: number;
  departmentId: string | null;
};

export type ReportPayrollEntry = {
  employeeId: string;
  employeeCode: string | null;
  employeeName: string;
  employmentType: string;
  departmentId: string | null;
  departmentName: string | null;
  grossPay: number;
  netPay: number;
  periodName: string;
};

export type ReportAdjustment = {
  employeeId: string;
  employeeCode: string | null;
  employeeName: string;
  type: string;
  amount: number;
  reason: string;
  periodName: string;
};

export type ReportCompensation = {
  employeeId: string;
  employeeCode: string | null;
  employeeName: string;
  employmentType: string;
  dailyRate: number;
  hourlyRate: number;
  monthlySalary: number;
  effectiveFrom: Date;
  effectiveTo: Date | null;
  isActive: boolean;
};

export type ReportFilter = {
  departmentId?: string | null;
  employmentType?: string | null;
  hrStatus?: string | null;
};

export function matchesEmployeeFilter(
  employee: {
    departmentId: string | null;
    employmentType: string;
    hrStatus: string;
  },
  filter: ReportFilter,
): boolean {
  if (filter.departmentId && employee.departmentId !== filter.departmentId) {
    return false;
  }
  if (
    filter.employmentType &&
    employee.employmentType !== filter.employmentType
  ) {
    return false;
  }
  if (filter.hrStatus && employee.hrStatus !== filter.hrStatus) {
    return false;
  }
  return true;
}

export function buildReportRows(
  type: HrReportType,
  input: {
    employees: readonly ReportEmployee[];
    attendance: readonly ReportAttendance[];
    leaveBalances: readonly ReportLeaveBalance[];
    payrollEntries: readonly ReportPayrollEntry[];
    adjustments: readonly ReportAdjustment[];
    compensations: readonly ReportCompensation[];
    filter: ReportFilter;
    from: Date;
    to: Date;
  },
): { headers: string[]; rows: Array<Array<string | number>> } {
  const employees = input.employees.filter((item) =>
    matchesEmployeeFilter(item, input.filter),
  );
  const employeeIds = new Set(employees.map((item) => item.id));

  switch (type) {
    case "employees":
      return {
        headers: [
          "employee_code",
          "name",
          "employment_type",
          "hr_status",
          "department",
          "hired_at",
          "ended_at",
        ],
        rows: employees.map((item) => [
          item.employeeCode ?? "",
          item.name,
          item.employmentType,
          item.hrStatus,
          item.departmentName ?? "",
          item.hiredAt ? dateKeyUtc(item.hiredAt) : "",
          item.endedAt ? dateKeyUtc(item.endedAt) : "",
        ]),
      };
    case "attendance":
      return {
        headers: [
          "date",
          "employee_code",
          "name",
          "status",
          "late_minutes",
          "department",
        ],
        rows: input.attendance
          .filter((item) => employeeIds.has(item.employeeId))
          .filter(
            (item) => item.workDate >= input.from && item.workDate <= input.to,
          )
          .map((item) => [
            dateKeyUtc(item.workDate),
            item.employeeCode ?? "",
            item.employeeName,
            item.status,
            item.lateMinutes,
            item.departmentName ?? "",
          ]),
      };
    case "hours_ot":
      return {
        headers: [
          "date",
          "employee_code",
          "name",
          "worked_minutes",
          "ot_minutes",
          "ot_approved_minutes",
        ],
        rows: input.attendance
          .filter((item) => employeeIds.has(item.employeeId))
          .filter(
            (item) => item.workDate >= input.from && item.workDate <= input.to,
          )
          .map((item) => [
            dateKeyUtc(item.workDate),
            item.employeeCode ?? "",
            item.employeeName,
            item.workedMinutes,
            item.otMinutes,
            item.otApprovedMinutes,
          ]),
      };
    case "leave":
      return {
        headers: [
          "employee_code",
          "name",
          "leave_type",
          "year",
          "entitled",
          "used",
          "pending",
          "available",
        ],
        rows: input.leaveBalances
          .filter((item) => employeeIds.has(item.employeeId))
          .map((item) => [
            item.employeeCode ?? "",
            item.employeeName,
            item.leaveTypeName,
            item.year,
            item.entitled,
            item.used,
            item.pending,
            item.available,
          ]),
      };
    case "payroll_cost":
      return {
        headers: [
          "period",
          "employee_code",
          "name",
          "employment_type",
          "gross_pay",
          "net_pay",
          "department",
        ],
        rows: input.payrollEntries
          .filter((item) => employeeIds.has(item.employeeId))
          .map((item) => [
            item.periodName,
            item.employeeCode ?? "",
            item.employeeName,
            item.employmentType,
            item.grossPay,
            item.netPay,
            item.departmentName ?? "",
          ]),
      };
    case "department_cost": {
      const totals = new Map<
        string,
        { department: string; gross: number; net: number; count: number }
      >();
      for (const item of input.payrollEntries) {
        if (!employeeIds.has(item.employeeId)) continue;
        const key = item.departmentId ?? "none";
        const current = totals.get(key) ?? {
          department: item.departmentName ?? "(ไม่มีแผนก)",
          gross: 0,
          net: 0,
          count: 0,
        };
        current.gross += item.grossPay;
        current.net += item.netPay;
        current.count += 1;
        totals.set(key, current);
      }
      return {
        headers: ["department", "entries", "gross_pay", "net_pay"],
        rows: [...totals.values()].map((item) => [
          item.department,
          item.count,
          Math.round(item.gross * 100) / 100,
          Math.round(item.net * 100) / 100,
        ]),
      };
    }
    case "adjustments":
      return {
        headers: [
          "period",
          "employee_code",
          "name",
          "type",
          "amount",
          "reason",
        ],
        rows: input.adjustments
          .filter((item) => employeeIds.has(item.employeeId))
          .map((item) => [
            item.periodName,
            item.employeeCode ?? "",
            item.employeeName,
            item.type,
            item.amount,
            item.reason,
          ]),
      };
    case "compensation_history":
      return {
        headers: [
          "employee_code",
          "name",
          "employment_type",
          "daily_rate",
          "hourly_rate",
          "monthly_salary",
          "effective_from",
          "effective_to",
          "is_active",
        ],
        rows: input.compensations
          .filter((item) => employeeIds.has(item.employeeId))
          .map((item) => [
            item.employeeCode ?? "",
            item.employeeName,
            item.employmentType,
            item.dailyRate,
            item.hourlyRate,
            item.monthlySalary,
            dateKeyUtc(item.effectiveFrom),
            item.effectiveTo ? dateKeyUtc(item.effectiveTo) : "",
            item.isActive ? "true" : "false",
          ]),
      };
    case "headcount_moves":
      return {
        headers: [
          "employee_code",
          "name",
          "event",
          "date",
          "hr_status",
          "department",
        ],
        rows: employees.flatMap((item) => {
          const rows: Array<Array<string | number>> = [];
          if (
            item.hiredAt &&
            item.hiredAt >= input.from &&
            item.hiredAt <= input.to
          ) {
            rows.push([
              item.employeeCode ?? "",
              item.name,
              "HIRED",
              dateKeyUtc(item.hiredAt),
              item.hrStatus,
              item.departmentName ?? "",
            ]);
          }
          if (
            item.endedAt &&
            item.endedAt >= input.from &&
            item.endedAt <= input.to
          ) {
            rows.push([
              item.employeeCode ?? "",
              item.name,
              "ENDED",
              dateKeyUtc(item.endedAt),
              item.hrStatus,
              item.departmentName ?? "",
            ]);
          }
          return rows;
        }),
      };
    default:
      return { headers: [], rows: [] };
  }
}

export function buildReportCsv(
  headers: readonly string[],
  rows: readonly (readonly (string | number)[])[],
): string {
  return [toCsvRow(headers), ...rows.map((row) => toCsvRow(row))].join("\n");
}
