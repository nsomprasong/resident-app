import { apiErrorResponse } from "@/lib/api/validation";
import { excludeSystemAdminEmployeeWhere } from "@/lib/auth/support-account";
import { displayEmployeeName } from "@/lib/hr/employees";
import { availableLeaveDays, decimalDays } from "@/lib/hr/leave";
import {
  buildReportCsv,
  buildReportRows,
  HR_REPORT_TYPE_LABELS,
  HR_REPORT_TYPES,
  isHrReportType,
  type HrReportType,
} from "@/lib/hr/reports";
import { dateKeyUtc, parseDateKey } from "@/lib/hr/schedules";
import { prisma } from "@/lib/prisma";
import { NextRequest, NextResponse } from "next/server";

async function loadReportPayload(input: {
  type: HrReportType;
  from: Date;
  to: Date;
  departmentId: string | null;
  employmentType: string | null;
  hrStatus: string | null;
}) {
  const [
    employees,
    attendance,
    leaveBalances,
    payrollEntries,
    adjustments,
    compensations,
  ] = await Promise.all([
    prisma.employee.findMany({
      where: excludeSystemAdminEmployeeWhere(),
      include: {
        department: { select: { id: true, name: true } },
      },
      orderBy: { name: "asc" },
    }),
    prisma.attendanceRecord.findMany({
      where: { workDate: { gte: input.from, lte: input.to } },
      include: {
        employee: {
          select: {
            id: true,
            name: true,
            firstName: true,
            lastName: true,
            employeeCode: true,
            departmentId: true,
            department: { select: { name: true } },
          },
        },
      },
      orderBy: [{ workDate: "asc" }, { employee: { name: "asc" } }],
    }),
    prisma.leaveBalance.findMany({
      where: { year: input.from.getUTCFullYear() },
      include: {
        employee: {
          select: {
            id: true,
            name: true,
            firstName: true,
            lastName: true,
            employeeCode: true,
            departmentId: true,
          },
        },
        leaveType: { select: { name: true } },
      },
    }),
    prisma.payrollEntry.findMany({
      where: {
        period: {
          periodStart: { lte: input.to },
          periodEnd: { gte: input.from },
        },
      },
      include: {
        employee: {
          select: {
            id: true,
            name: true,
            firstName: true,
            lastName: true,
            employeeCode: true,
            departmentId: true,
            department: { select: { name: true } },
          },
        },
        period: { select: { name: true } },
      },
    }),
    prisma.payrollAdjustment.findMany({
      where: {
        period: {
          periodStart: { lte: input.to },
          periodEnd: { gte: input.from },
        },
      },
      include: {
        employee: {
          select: {
            id: true,
            name: true,
            firstName: true,
            lastName: true,
            employeeCode: true,
          },
        },
        period: { select: { name: true } },
      },
    }),
    prisma.employeeCompensation.findMany({
      include: {
        employee: {
          select: {
            id: true,
            name: true,
            firstName: true,
            lastName: true,
            employeeCode: true,
          },
        },
      },
      orderBy: [{ effectiveFrom: "desc" }],
    }),
  ]);

  const mappedEmployees = employees.map((item) => ({
    id: item.id,
    employeeCode: item.employeeCode,
    name: displayEmployeeName(item),
    employmentType: item.employmentType,
    hrStatus: item.hrStatus,
    departmentId: item.departmentId,
    departmentName: item.department?.name ?? null,
    hiredAt: item.hiredAt,
    endedAt: item.endedAt,
    isActive: item.isActive,
  }));

  const report = buildReportRows(input.type, {
    employees: mappedEmployees,
    attendance: attendance.map((item) => ({
      employeeId: item.employeeId,
      employeeCode: item.employee.employeeCode,
      employeeName: displayEmployeeName(item.employee),
      workDate: item.workDate,
      status: item.status,
      workedMinutes: item.workedMinutes,
      lateMinutes: item.lateMinutes,
      otMinutes: item.otMinutes,
      otApprovedMinutes: item.otApprovedMinutes,
      departmentId: item.employee.departmentId,
      departmentName: item.employee.department?.name ?? null,
    })),
    leaveBalances: leaveBalances.map((item) => {
      const entitled = decimalDays(item.entitled);
      const used = decimalDays(item.used);
      const pending = decimalDays(item.pending);
      return {
        employeeId: item.employeeId,
        employeeCode: item.employee.employeeCode,
        employeeName: displayEmployeeName(item.employee),
        leaveTypeName: item.leaveType.name,
        year: item.year,
        entitled,
        used,
        pending,
        available: availableLeaveDays({ entitled, used, pending }),
        departmentId: item.employee.departmentId,
      };
    }),
    payrollEntries: payrollEntries.map((item) => ({
      employeeId: item.employeeId,
      employeeCode: item.employee.employeeCode,
      employeeName: displayEmployeeName(item.employee),
      employmentType: item.employmentType,
      departmentId: item.employee.departmentId,
      departmentName: item.employee.department?.name ?? null,
      grossPay: Number(item.grossPay),
      netPay: Number(item.netPay),
      periodName: item.period.name,
    })),
    adjustments: adjustments.map((item) => ({
      employeeId: item.employeeId,
      employeeCode: item.employee.employeeCode,
      employeeName: displayEmployeeName(item.employee),
      type: item.type,
      amount: Number(item.amount),
      reason: item.reason,
      periodName: item.period.name,
    })),
    compensations: compensations.map((item) => ({
      employeeId: item.employeeId,
      employeeCode: item.employee.employeeCode,
      employeeName: displayEmployeeName(item.employee),
      employmentType: item.employmentType,
      dailyRate: Number(item.dailyRate),
      hourlyRate: Number(item.hourlyRate),
      monthlySalary: Number(item.monthlySalary),
      effectiveFrom: item.effectiveFrom,
      effectiveTo: item.effectiveTo,
      isActive: item.isActive,
    })),
    filter: {
      departmentId: input.departmentId,
      employmentType: input.employmentType,
      hrStatus: input.hrStatus,
    },
    from: input.from,
    to: input.to,
  });

  return report;
}

export async function GET(request: NextRequest) {
  try {
    const typeRaw = request.nextUrl.searchParams.get("type") ?? "employees";
    const fromRaw = request.nextUrl.searchParams.get("from");
    const toRaw = request.nextUrl.searchParams.get("to");
    const format = request.nextUrl.searchParams.get("format") ?? "json";
    const departmentId = request.nextUrl.searchParams.get("departmentId");
    const employmentType = request.nextUrl.searchParams.get("employmentType");
    const hrStatus = request.nextUrl.searchParams.get("hrStatus");

    if (!isHrReportType(typeRaw)) {
      return apiErrorResponse("ประเภทรายงานไม่ถูกต้อง", 400, "VALIDATION_ERROR");
    }
    const from = parseDateKey(fromRaw ?? "");
    const to = parseDateKey(toRaw ?? "");
    if (!from || !to || from > to) {
      return apiErrorResponse("ช่วงวันที่ไม่ถูกต้อง", 400, "VALIDATION_ERROR");
    }

    const report = await loadReportPayload({
      type: typeRaw,
      from,
      to,
      departmentId: departmentId || null,
      employmentType: employmentType || null,
      hrStatus: hrStatus || null,
    });

    const departments = await prisma.department.findMany({
      select: { id: true, name: true },
      orderBy: { name: "asc" },
    });

    if (format === "csv") {
      const csv = buildReportCsv(report.headers, report.rows);
      return new NextResponse(csv, {
        status: 200,
        headers: {
          "Content-Type": "text/csv; charset=utf-8",
          "Content-Disposition": `attachment; filename="hr-report-${typeRaw}.csv"`,
        },
      });
    }

    return NextResponse.json({
      type: typeRaw,
      label: HR_REPORT_TYPE_LABELS[typeRaw],
      from: dateKeyUtc(from),
      to: dateKeyUtc(to),
      types: HR_REPORT_TYPES.map((code) => ({
        code,
        label: HR_REPORT_TYPE_LABELS[code],
      })),
      departments,
      headers: report.headers,
      rows: report.rows,
      totalRows: report.rows.length,
    });
  } catch (error) {
    console.error("GET /api/hr/reports failed", error);
    return apiErrorResponse("ไม่สามารถโหลดรายงานได้", 500, "INTERNAL_ERROR");
  }
}
