import {
  apiErrorResponse,
} from "@/lib/api/validation";
import {
  buildHrDashboardMetrics,
  buildHrMonthSummary,
} from "@/lib/hr/dashboard";
import { findUnderstaffedShifts } from "@/lib/hr/schedules";
import { dateKeyUtc, monthRangeContaining, parseDateKey } from "@/lib/hr/schedules";
import { prisma } from "@/lib/prisma";
import { NextRequest, NextResponse } from "next/server";

export async function GET(request: NextRequest) {
  try {
    const dateRaw = request.nextUrl.searchParams.get("date");
    const mode = request.nextUrl.searchParams.get("mode") ?? "day";
    const date = parseDateKey(dateRaw ?? dateKeyUtc(new Date()));
    if (!date) {
      return apiErrorResponse("วันที่ไม่ถูกต้อง", 400, "VALIDATION_ERROR");
    }

    const monthRange = monthRangeContaining(dateKeyUtc(date));
    if (!monthRange) {
      return apiErrorResponse("ช่วงเดือนไม่ถูกต้อง", 400, "VALIDATION_ERROR");
    }
    const monthFrom = parseDateKey(monthRange.from)!;
    const monthTo = parseDateKey(monthRange.to)!;

    const [
      employees,
      schedules,
      attendanceDay,
      attendanceMonth,
      leavesDay,
      leavesMonth,
      pendingOt,
      pendingLeaves,
      templates,
      compensations,
      departments,
    ] = await Promise.all([
      prisma.employee.findMany({
        select: {
          id: true,
          employmentType: true,
          hrStatus: true,
          isActive: true,
          departmentId: true,
        },
      }),
      prisma.workSchedule.findMany({
        where: {
          workDate: date,
          status: "ASSIGNED",
        },
        select: {
          employeeId: true,
          workDate: true,
          status: true,
          shiftTemplateId: true,
        },
      }),
      prisma.attendanceRecord.findMany({
        where: { workDate: date },
        select: {
          employeeId: true,
          workDate: true,
          status: true,
          clockIn: true,
          clockOut: true,
          lateMinutes: true,
          otMinutes: true,
          otApprovedMinutes: true,
          workedMinutes: true,
        },
      }),
      prisma.attendanceRecord.findMany({
        where: { workDate: { gte: monthFrom, lte: monthTo } },
        select: {
          employeeId: true,
          workDate: true,
          status: true,
          clockIn: true,
          clockOut: true,
          lateMinutes: true,
          otMinutes: true,
          otApprovedMinutes: true,
          workedMinutes: true,
        },
      }),
      prisma.leaveRequest.findMany({
        where: {
          status: "APPROVED",
          startDate: { lte: date },
          endDate: { gte: date },
        },
        select: {
          employeeId: true,
          startDate: true,
          endDate: true,
          status: true,
          duration: true,
        },
      }),
      prisma.leaveRequest.findMany({
        where: {
          status: "APPROVED",
          startDate: { lte: monthTo },
          endDate: { gte: monthFrom },
        },
        select: {
          employeeId: true,
          startDate: true,
          endDate: true,
          status: true,
          duration: true,
        },
      }),
      prisma.attendanceAdjustment.findMany({
        where: { status: "PENDING", type: "OT_REQUEST" },
        select: { id: true, status: true },
      }),
      prisma.leaveRequest.findMany({
        where: { status: "PENDING" },
        select: {
          employeeId: true,
          startDate: true,
          endDate: true,
          status: true,
          duration: true,
        },
      }),
      prisma.shiftTemplate.findMany({
        where: { isActive: true },
        select: {
          id: true,
          name: true,
          requiredHeadcount: true,
          isActive: true,
        },
      }),
      prisma.employeeCompensation.findMany({
        where: { isActive: true },
        select: {
          employeeId: true,
          employmentType: true,
          dailyRate: true,
          monthlySalary: true,
        },
      }),
      prisma.department.findMany({
        select: { id: true, name: true },
        orderBy: { name: "asc" },
      }),
    ]);

    const understaffed = findUnderstaffedShifts({
      templates,
      schedules: schedules.map((item) => ({
        employeeId: item.employeeId,
        workDate: item.workDate,
        status: item.status,
        shiftTemplateId: item.shiftTemplateId,
        startsAt: date,
        endsAt: date,
      })),
      workDates: [dateKeyUtc(date)],
    });

    const dayMetrics = buildHrDashboardMetrics({
      date,
      employees,
      schedules,
      attendance: attendanceDay,
      leaves: leavesDay,
      pendingOt,
      pendingLeaves,
      understaffedCount: understaffed.length,
      compensations: compensations.map((item) => ({
        employeeId: item.employeeId,
        employmentType: item.employmentType,
        dailyRate: Number(item.dailyRate),
        monthlySalary: Number(item.monthlySalary),
      })),
    });

    const monthSummary = buildHrMonthSummary({
      employees,
      attendance: attendanceMonth,
      leaves: leavesMonth,
      compensations: compensations.map((item) => ({
        employeeId: item.employeeId,
        employmentType: item.employmentType,
        dailyRate: Number(item.dailyRate),
        monthlySalary: Number(item.monthlySalary),
      })),
    });

    return NextResponse.json({
      date: dateKeyUtc(date),
      mode,
      month: monthRange,
      day: dayMetrics,
      monthSummary,
      understaffed: understaffed.slice(0, 10),
      departments: departments.map((item) => ({
        id: item.id,
        name: item.name,
      })),
      quickActions: [
        { label: "เพิ่มพนักงาน", href: "/hr/employees" },
        { label: "จัดตารางงาน", href: "/hr/schedules" },
        { label: "ลงเวลา", href: "/hr/attendance" },
        { label: "อนุมัติวันลา", href: "/hr/leave" },
        { label: "ประมวลผลค่าจ้าง", href: "/hr/payroll" },
      ],
    });
  } catch (error) {
    console.error("GET /api/hr/dashboard failed", error);
    return apiErrorResponse("ไม่สามารถโหลดภาพรวมบุคลากรได้", 500, "INTERNAL_ERROR");
  }
}
