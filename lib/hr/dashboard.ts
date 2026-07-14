import { money } from "@/lib/hr/payroll";
import { dateKeyUtc } from "@/lib/hr/schedules";

export type DashboardEmployee = {
  id: string;
  employmentType: "DAILY" | "MONTHLY";
  hrStatus: string;
  isActive: boolean;
  departmentId: string | null;
};

export type DashboardSchedule = {
  employeeId: string;
  workDate: Date;
  status: string;
  shiftTemplateId: string | null;
};

export type DashboardAttendance = {
  employeeId: string;
  workDate: Date;
  status: string;
  clockIn: Date | null;
  clockOut: Date | null;
  lateMinutes: number;
  otMinutes: number;
  otApprovedMinutes: number;
  workedMinutes: number;
};

export type DashboardLeave = {
  employeeId: string;
  startDate: Date;
  endDate: Date;
  status: string;
  duration: string;
};

export type DashboardOtPending = {
  id: string;
  status: string;
};

export type DashboardCompensation = {
  employeeId: string;
  employmentType: "DAILY" | "MONTHLY";
  dailyRate: number;
  monthlySalary: number;
};

export type HrDashboardMetrics = {
  totalEmployees: number;
  dailyEmployees: number;
  monthlyEmployees: number;
  scheduledToday: number;
  clockedIn: number;
  notClockedIn: number;
  late: number;
  absent: number;
  onLeave: number;
  working: number;
  finished: number;
  pendingOtApprovals: number;
  pendingLeaveRequests: number;
  understaffedCount: number;
  estimatedPayroll: number;
};

function activeEmployees(employees: readonly DashboardEmployee[]) {
  return employees.filter(
    (item) =>
      item.isActive &&
      (item.hrStatus === "ACTIVE" || item.hrStatus === "PROBATION"),
  );
}

export function buildHrDashboardMetrics(input: {
  date: Date;
  employees: readonly DashboardEmployee[];
  schedules: readonly DashboardSchedule[];
  attendance: readonly DashboardAttendance[];
  leaves: readonly DashboardLeave[];
  pendingOt: readonly DashboardOtPending[];
  pendingLeaves: readonly DashboardLeave[];
  understaffedCount: number;
  compensations: readonly DashboardCompensation[];
}): HrDashboardMetrics {
  const dayKey = dateKeyUtc(input.date);
  const employees = activeEmployees(input.employees);
  const scheduled = input.schedules.filter(
    (item) =>
      item.status === "ASSIGNED" && dateKeyUtc(item.workDate) === dayKey,
  );
  const scheduledIds = new Set(scheduled.map((item) => item.employeeId));
  const dayAttendance = input.attendance.filter(
    (item) => dateKeyUtc(item.workDate) === dayKey,
  );

  const clockedInIds = new Set(
    dayAttendance
      .filter((item) => item.clockIn !== null)
      .map((item) => item.employeeId),
  );
  const late = dayAttendance.filter((item) => item.lateMinutes > 0).length;
  const absent = dayAttendance.filter((item) => item.status === "ABSENT").length;
  const working = dayAttendance.filter(
    (item) => item.clockIn && !item.clockOut && item.status !== "ABSENT",
  ).length;
  const finished = dayAttendance.filter(
    (item) => item.clockIn && item.clockOut,
  ).length;

  const onLeaveIds = new Set<string>();
  for (const leave of input.leaves) {
    if (leave.status !== "APPROVED") continue;
    if (leave.startDate <= input.date && leave.endDate >= input.date) {
      onLeaveIds.add(leave.employeeId);
    }
  }

  let notClockedIn = 0;
  for (const employeeId of scheduledIds) {
    if (!clockedInIds.has(employeeId) && !onLeaveIds.has(employeeId)) {
      notClockedIn += 1;
    }
  }

  let estimatedPayroll = 0;
  const byEmployee = new Map(
    input.compensations.map((item) => [item.employeeId, item]),
  );
  for (const employee of employees) {
    const compensation = byEmployee.get(employee.id);
    if (!compensation) continue;
    if (compensation.employmentType === "DAILY") {
      if (scheduledIds.has(employee.id) || clockedInIds.has(employee.id)) {
        estimatedPayroll += compensation.dailyRate;
      }
    } else {
      estimatedPayroll += money(compensation.monthlySalary / 30);
    }
  }

  return {
    totalEmployees: employees.length,
    dailyEmployees: employees.filter((item) => item.employmentType === "DAILY")
      .length,
    monthlyEmployees: employees.filter(
      (item) => item.employmentType === "MONTHLY",
    ).length,
    scheduledToday: scheduledIds.size,
    clockedIn: clockedInIds.size,
    notClockedIn,
    late,
    absent,
    onLeave: onLeaveIds.size,
    working,
    finished,
    pendingOtApprovals: input.pendingOt.filter(
      (item) => item.status === "PENDING",
    ).length,
    pendingLeaveRequests: input.pendingLeaves.filter(
      (item) => item.status === "PENDING",
    ).length,
    understaffedCount: input.understaffedCount,
    estimatedPayroll: money(estimatedPayroll),
  };
}

export function buildHrMonthSummary(input: {
  employees: readonly DashboardEmployee[];
  attendance: readonly DashboardAttendance[];
  leaves: readonly DashboardLeave[];
  compensations: readonly DashboardCompensation[];
}): {
  totalEmployees: number;
  workedMinutes: number;
  otMinutes: number;
  lateMinutes: number;
  absentDays: number;
  approvedLeaveDays: number;
  estimatedMonthlyPayroll: number;
} {
  const employees = activeEmployees(input.employees);
  let workedMinutes = 0;
  let otMinutes = 0;
  let lateMinutes = 0;
  let absentDays = 0;
  for (const row of input.attendance) {
    workedMinutes += row.workedMinutes;
    otMinutes += row.otApprovedMinutes || row.otMinutes;
    lateMinutes += row.lateMinutes;
    if (row.status === "ABSENT") absentDays += 1;
  }

  let approvedLeaveDays = 0;
  for (const leave of input.leaves) {
    if (leave.status !== "APPROVED") continue;
    const start = leave.startDate.getTime();
    const end = leave.endDate.getTime();
    const days = Math.round((end - start) / 86_400_000) + 1;
    approvedLeaveDays += leave.duration === "FULL_DAY" ? days : 0.5;
  }

  let estimatedMonthlyPayroll = 0;
  const byEmployee = new Map(
    input.compensations.map((item) => [item.employeeId, item]),
  );
  for (const employee of employees) {
    const compensation = byEmployee.get(employee.id);
    if (!compensation) continue;
    if (compensation.employmentType === "MONTHLY") {
      estimatedMonthlyPayroll += compensation.monthlySalary;
    } else {
      estimatedMonthlyPayroll += compensation.dailyRate * 22;
    }
  }

  return {
    totalEmployees: employees.length,
    workedMinutes,
    otMinutes,
    lateMinutes,
    absentDays,
    approvedLeaveDays,
    estimatedMonthlyPayroll: money(estimatedMonthlyPayroll),
  };
}
