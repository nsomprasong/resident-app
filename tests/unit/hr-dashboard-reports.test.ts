import assert from "node:assert/strict";
import { describe, it } from "node:test";

import {
  buildHrDashboardMetrics,
  buildHrMonthSummary,
} from "@/lib/hr/dashboard";
import {
  buildReportCsv,
  buildReportRows,
  matchesEmployeeFilter,
} from "@/lib/hr/reports";

describe("hr dashboard and reports", () => {
  it("builds day metrics from source records", () => {
    const day = new Date("2026-07-13T00:00:00.000Z");
    const metrics = buildHrDashboardMetrics({
      date: day,
      employees: [
        {
          id: "e1",
          employmentType: "DAILY",
          hrStatus: "ACTIVE",
          isActive: true,
          departmentId: null,
        },
        {
          id: "e2",
          employmentType: "MONTHLY",
          hrStatus: "ACTIVE",
          isActive: true,
          departmentId: null,
        },
      ],
      schedules: [
        {
          employeeId: "e1",
          workDate: day,
          status: "ASSIGNED",
          shiftTemplateId: "t1",
        },
      ],
      attendance: [
        {
          employeeId: "e1",
          workDate: day,
          status: "COMPLETE",
          clockIn: new Date("2026-07-13T01:10:00.000Z"),
          clockOut: new Date("2026-07-13T10:00:00.000Z"),
          lateMinutes: 10,
          otMinutes: 0,
          otApprovedMinutes: 0,
          workedMinutes: 480,
        },
      ],
      leaves: [],
      pendingOt: [{ id: "ot1", status: "PENDING" }],
      pendingLeaves: [
        {
          employeeId: "e2",
          startDate: day,
          endDate: day,
          status: "PENDING",
          duration: "FULL_DAY",
        },
      ],
      understaffedCount: 1,
      compensations: [
        {
          employeeId: "e1",
          employmentType: "DAILY",
          dailyRate: 500,
          monthlySalary: 0,
        },
        {
          employeeId: "e2",
          employmentType: "MONTHLY",
          dailyRate: 0,
          monthlySalary: 30000,
        },
      ],
    });
    assert.equal(metrics.totalEmployees, 2);
    assert.equal(metrics.scheduledToday, 1);
    assert.equal(metrics.clockedIn, 1);
    assert.equal(metrics.late, 1);
    assert.equal(metrics.pendingOtApprovals, 1);
    assert.equal(metrics.pendingLeaveRequests, 1);
    assert.equal(metrics.estimatedPayroll, 500 + 1000);
  });

  it("filters report employees and builds csv", () => {
    assert.equal(
      matchesEmployeeFilter(
        {
          departmentId: "d1",
          employmentType: "DAILY",
          hrStatus: "ACTIVE",
        },
        { departmentId: "d2" },
      ),
      false,
    );
    const report = buildReportRows("employees", {
      employees: [
        {
          id: "e1",
          employeeCode: "E1",
          name: "A",
          employmentType: "DAILY",
          hrStatus: "ACTIVE",
          departmentId: "d1",
          departmentName: "Ops",
          hiredAt: new Date("2026-01-01T00:00:00.000Z"),
          endedAt: null,
          isActive: true,
        },
      ],
      attendance: [],
      leaveBalances: [],
      payrollEntries: [],
      adjustments: [],
      compensations: [],
      filter: {},
      from: new Date("2026-07-01T00:00:00.000Z"),
      to: new Date("2026-07-31T00:00:00.000Z"),
    });
    assert.equal(report.rows.length, 1);
    const csv = buildReportCsv(report.headers, report.rows);
    assert.match(csv, /E1,A,DAILY/);

    const month = buildHrMonthSummary({
      employees: [
        {
          id: "e1",
          employmentType: "MONTHLY",
          hrStatus: "ACTIVE",
          isActive: true,
          departmentId: null,
        },
      ],
      attendance: [
        {
          employeeId: "e1",
          workDate: new Date("2026-07-13T00:00:00.000Z"),
          status: "COMPLETE",
          clockIn: null,
          clockOut: null,
          lateMinutes: 5,
          otMinutes: 30,
          otApprovedMinutes: 30,
          workedMinutes: 480,
        },
      ],
      leaves: [],
      compensations: [
        {
          employeeId: "e1",
          employmentType: "MONTHLY",
          dailyRate: 0,
          monthlySalary: 30000,
        },
      ],
    });
    assert.equal(month.workedMinutes, 480);
    assert.equal(month.otMinutes, 30);
    assert.equal(month.estimatedMonthlyPayroll, 30000);
  });
});
