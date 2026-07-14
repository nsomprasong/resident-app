import { apiErrorResponse } from "@/lib/api/validation";
import { getCurrentUser } from "@/lib/auth/current-user";
import { decimalDays, leaveDurationLabel } from "@/lib/hr/leave";
import { getAttendanceSetting } from "@/lib/hr/attendance-settings";
import { haversineDistanceMeters, validateCoordinates } from "@/lib/hr/geo";
import {
  getMyWorkHistory,
  getTodayScheduleForEmployee,
  serializeAttendanceRecordSummary,
  todayDateKeyInTimezone,
} from "@/lib/hr/my-work";
import { parseDateKey } from "@/lib/hr/schedules";
import { prisma } from "@/lib/prisma";
import { NextRequest, NextResponse } from "next/server";

export async function GET(request: NextRequest) {
  try {
    const currentUser = await getCurrentUser();
    const employeeId = currentUser?.employee?.id;
    if (!employeeId) {
      return apiErrorResponse("ไม่พบบัญชีพนักงานของผู้ใช้", 403, "FORBIDDEN");
    }

    const settings = await getAttendanceSetting();
    const todayKey = todayDateKeyInTimezone(settings.timezone);
    const workDate = parseDateKey(todayKey);
    if (!workDate) {
      return apiErrorResponse("ไม่สามารถระบุวันที่ปัจจุบันได้", 500, "INTERNAL_ERROR");
    }

    const schedule = await getTodayScheduleForEmployee(employeeId, settings.timezone);

    const attendanceRecord = await prisma.attendanceRecord.findFirst({
      where: {
        employeeId,
        workDate,
        workScheduleId: schedule?.id ?? null,
      },
    });

    const [history, leaveRequests] = await Promise.all([
      getMyWorkHistory(employeeId, 14),
      prisma.leaveRequest.findMany({
        where: { employeeId },
        include: { leaveType: { select: { name: true, code: true } } },
        orderBy: { createdAt: "desc" },
        take: 10,
      }),
    ]);

    let distancePreviewMeters: number | null = null;
    const latParam = request.nextUrl.searchParams.get("lat");
    const lonParam = request.nextUrl.searchParams.get("lon");
    if (latParam !== null && lonParam !== null) {
      const lat = Number(latParam);
      const lon = Number(lonParam);
      const check = validateCoordinates(lat, lon);
      if (check.ok) {
        distancePreviewMeters = Math.round(
          haversineDistanceMeters(
            lat,
            lon,
            Number(settings.latitude),
            Number(settings.longitude),
          ),
        );
      }
    }

    return NextResponse.json({
      today: {
        workDate: todayKey,
        schedule: schedule
          ? {
              id: schedule.id,
              shiftName: schedule.shiftTemplate?.name ?? "กำหนดเอง",
              startsAt: schedule.startsAt.toISOString(),
              endsAt: schedule.endsAt.toISOString(),
              isDayOff: schedule.isDayOff,
            }
          : null,
        attendance: attendanceRecord
          ? serializeAttendanceRecordSummary({ ...attendanceRecord, workSchedule: null })
          : null,
        allowClockWithoutSchedule: settings.allowClockWithoutSchedule,
      },
      settings: {
        radiusMeters: settings.radiusMeters,
        maxAccuracyMeters: settings.maxAccuracyMeters,
        timezone: settings.timezone,
      },
      distancePreviewMeters,
      history: history.map(serializeAttendanceRecordSummary),
      leaveRequests: leaveRequests.map((item) => ({
        id: item.id,
        leaveTypeName: item.leaveType.name,
        leaveTypeCode: item.leaveType.code,
        startDate: item.startDate.toISOString().slice(0, 10),
        endDate: item.endDate.toISOString().slice(0, 10),
        duration: item.duration,
        durationLabel: leaveDurationLabel(item.duration),
        daysRequested: decimalDays(item.daysRequested),
        reason: item.reason,
        status: item.status,
        reviewNote: item.reviewNote,
        createdAt: item.createdAt.toISOString(),
      })),
    });
  } catch (error) {
    console.error("GET /api/hr/my-work failed", error);
    return apiErrorResponse("ไม่สามารถโหลดข้อมูลงานของฉันได้", 500, "INTERNAL_ERROR");
  }
}
