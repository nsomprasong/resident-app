import { apiErrorResponse } from "@/lib/api/validation";
import { buildDailyStatusRows } from "@/lib/hr/daily-status";
import { displayEmployeeName } from "@/lib/hr/employees";
import { buildPaySummaries, type EmployeePayInput } from "@/lib/hr/pay-summary";
import { eachDateKey, parseDateKey } from "@/lib/hr/schedules";
import { prisma } from "@/lib/prisma";
import { NextRequest, NextResponse } from "next/server";

export async function GET(request: NextRequest) {
  try {
    const fromKey = request.nextUrl.searchParams.get("from");
    const toKey = request.nextUrl.searchParams.get("to");
    if (!fromKey || !toKey) {
      return apiErrorResponse("ต้องระบุ from และ to (YYYY-MM-DD)", 400, "VALIDATION_ERROR");
    }
    const from = parseDateKey(fromKey);
    const to = parseDateKey(toKey);
    if (!from || !to || from > to) {
      return apiErrorResponse("ช่วงวันที่ไม่ถูกต้อง", 400, "VALIDATION_ERROR");
    }

    const employees = await prisma.employee.findMany({
      where: { hrStatus: { in: ["ACTIVE", "PROBATION"] } },
      select: {
        id: true,
        name: true,
        firstName: true,
        lastName: true,
        employeeCode: true,
        employmentType: true,
        otHourlyRate: true,
        compensations: {
          where: { isActive: true },
          select: { dailyRate: true, monthlySalary: true },
          take: 1,
        },
      },
      orderBy: [{ employeeCode: "asc" }, { name: "asc" }],
    });

    const employeeIds = employees.map((item) => item.id);

    const [schedules, attendanceRecords, approvedLeaves] = await Promise.all([
      prisma.workSchedule.findMany({
        where: {
          employeeId: { in: employeeIds },
          workDate: { gte: from, lte: to },
          status: "ASSIGNED",
        },
        include: { shiftTemplate: { select: { name: true } } },
      }),
      prisma.attendanceRecord.findMany({
        where: {
          employeeId: { in: employeeIds },
          workDate: { gte: from, lte: to },
        },
      }),
      prisma.leaveRequest.findMany({
        where: {
          employeeId: { in: employeeIds },
          status: "APPROVED",
          startDate: { lte: to },
          endDate: { gte: from },
        },
        select: { employeeId: true, startDate: true, endDate: true },
      }),
    ]);

    const dailyStatusRows = buildDailyStatusRows({
      employeeIds,
      fromKey,
      toKey,
      schedules: schedules.map((item) => ({
        employeeId: item.employeeId,
        workDate: item.workDate,
        isDayOff: item.isDayOff,
        status: item.status,
        shiftTemplateId: item.shiftTemplateId,
        shiftName: item.shiftTemplate?.name ?? null,
        startsAt: item.startsAt,
        endsAt: item.endsAt,
      })),
      attendanceRecords: attendanceRecords.map((item) => ({
        employeeId: item.employeeId,
        workDate: item.workDate,
        clockIn: item.clockIn,
        clockOut: item.clockOut,
        workedMinutes: item.workedMinutes,
        lateMinutes: item.lateMinutes,
        earlyLeaveMinutes: item.earlyLeaveMinutes,
        otApprovedMinutes: item.otApprovedMinutes,
      })),
      approvedLeaves,
    });

    const payInputs: EmployeePayInput[] = employees.map((employee) => ({
      employeeId: employee.id,
      employeeName: displayEmployeeName(employee),
      employeeCode: employee.employeeCode,
      employmentType: employee.employmentType,
      dailyRate: employee.compensations[0] ? Number(employee.compensations[0].dailyRate) : 0,
      monthlySalary: employee.compensations[0]
        ? Number(employee.compensations[0].monthlySalary)
        : 0,
      otHourlyRate: employee.otHourlyRate ? Number(employee.otHourlyRate) : 0,
    }));

    const periodCalendarDays = eachDateKey(fromKey, toKey).length;
    const paySummaries = buildPaySummaries({
      employees: payInputs,
      dailyStatusRows,
      periodCalendarDays,
    });

    return NextResponse.json({
      from: fromKey,
      to: toKey,
      periodCalendarDays,
      employees: paySummaries,
      dailyStatusRows,
    });
  } catch (error) {
    console.error("GET /api/hr/time-pay/summary failed", error);
    return apiErrorResponse("ไม่สามารถโหลดสรุปค่าแรงได้", 500, "INTERNAL_ERROR");
  }
}
