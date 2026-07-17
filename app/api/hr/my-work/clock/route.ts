import {
  apiErrorResponse,
  readJsonObject,
  validationErrorResponse,
} from "@/lib/api/validation";
import { recordAuditLog } from "@/lib/audit/audit-log";
import { getCurrentUser } from "@/lib/auth/current-user";
import { ClockError, clockAttendance } from "@/lib/hr/my-work";
import { NextRequest, NextResponse } from "next/server";

const CLOCK_ERROR_STATUS: Record<string, number> = {
  INVALID_COORDINATES: 400,
  EMPLOYEE_INACTIVE: 403,
  LOW_ACCURACY: 422,
  OUT_OF_RANGE: 422,
  NO_SCHEDULE: 422,
  DAY_OFF: 422,
  PERIOD_LOCKED: 409,
  ALREADY_CHECKED_IN: 409,
  ALREADY_CHECKED_OUT: 409,
  NOT_CHECKED_IN: 409,
  SHIFT_SELECTION_REQUIRED: 409,
  INTERNAL_ERROR: 500,
};

export async function POST(request: NextRequest) {
  try {
    const currentUser = await getCurrentUser();
    const employeeId = currentUser?.employee?.id;
    if (!employeeId) {
      return apiErrorResponse("ไม่พบบัญชีพนักงานของผู้ใช้", 403, "FORBIDDEN");
    }

    const parsed = await readJsonObject(request);
    if (!parsed.ok) return parsed.response;

    const type = typeof parsed.body.type === "string" ? parsed.body.type : "";
    if (type !== "CHECK_IN" && type !== "CHECK_OUT") {
      return validationErrorResponse("กรุณาตรวจสอบประเภทการลงเวลา", [
        { path: "type", message: "ต้องเป็น CHECK_IN หรือ CHECK_OUT" },
      ]);
    }

    const latitude = Number(parsed.body.latitude);
    const longitude = Number(parsed.body.longitude);
    const accuracyMeters =
      parsed.body.accuracyMeters === undefined || parsed.body.accuracyMeters === null
        ? null
        : Number(parsed.body.accuracyMeters);

    if (!Number.isFinite(latitude) || !Number.isFinite(longitude)) {
      return validationErrorResponse("กรุณาเปิดตำแหน่ง GPS แล้วลองใหม่", [
        { path: "latitude", message: "ไม่พบพิกัดตำแหน่งปัจจุบัน" },
      ]);
    }

    const userAgent = request.headers.get("user-agent");

    const result = await clockAttendance({
      employeeId,
      // employeeId is resolved from the session only — the client never
      // supplies which employee to clock, preventing spoofed employeeId.
      type,
      latitude,
      longitude,
      accuracyMeters,
      userAgent,
      scheduledShiftId:
        typeof parsed.body.scheduledShiftId === "string"
          ? parsed.body.scheduledShiftId
          : null,
    });

    await recordAuditLog({
      actor: { employeeId, authUserId: currentUser?.user.id },
      action: type === "CHECK_IN" ? "HR_ATTENDANCE_CHECK_IN" : "HR_ATTENDANCE_CHECK_OUT",
      entityType: "ATTENDANCE_RECORD",
      entityId: result.record.id,
      metadata: {
        distanceMeters: Math.round(result.distanceMeters),
        accuracyMeters,
      },
    });

    return NextResponse.json({
      record: {
        id: result.record.id,
        clockIn: result.record.clockIn?.toISOString() ?? null,
        clockOut: result.record.clockOut?.toISOString() ?? null,
        workedMinutes: result.record.workedMinutes,
        lateMinutes: result.record.lateMinutes,
        earlyLeaveMinutes: result.record.earlyLeaveMinutes,
        status: result.record.status,
      },
      distanceMeters: Math.round(result.distanceMeters),
    });
  } catch (error) {
    if (error instanceof ClockError) {
      const status = CLOCK_ERROR_STATUS[error.code] ?? 400;
      return apiErrorResponse(error.message, status, error.code);
    }
    console.error("POST /api/hr/my-work/clock failed", error);
    return apiErrorResponse("ไม่สามารถลงเวลาได้", 500, "INTERNAL_ERROR");
  }
}
