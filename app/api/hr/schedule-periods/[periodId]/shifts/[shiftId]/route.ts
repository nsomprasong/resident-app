import {
  apiErrorResponse,
  readJsonObject,
} from "@/lib/api/validation";
import { getCurrentUser } from "@/lib/auth/current-user";
import {
  cancelScheduledShift,
  ScheduleRosterError,
  upsertScheduledShift,
} from "@/lib/hr/schedule-roster";
import type { ScheduledShiftAssignmentType } from "@/generated/prisma/client";
import { NextRequest, NextResponse } from "next/server";

type RouteContext = {
  params: Promise<{ periodId: string; shiftId: string }>;
};

export async function PATCH(request: NextRequest, { params }: RouteContext) {
  try {
    const { periodId, shiftId } = await params;
    const currentUser = await getCurrentUser();
    const actorEmployeeId = currentUser?.employee?.id;
    if (!actorEmployeeId) {
      return apiErrorResponse("ไม่พบบัญชีพนักงานของผู้ใช้", 403, "FORBIDDEN");
    }

    const parsed = await readJsonObject(request);
    if (!parsed.ok) return parsed.response;

    const updated = await upsertScheduledShift({
      periodId,
      shiftId,
      actorEmployeeId,
      employeeId:
        typeof parsed.body.employeeId === "string"
          ? parsed.body.employeeId
          : "",
      workDate:
        typeof parsed.body.workDate === "string" ? parsed.body.workDate : "",
      shiftTemplateId:
        typeof parsed.body.shiftTemplateId === "string"
          ? parsed.body.shiftTemplateId
          : null,
      plannedStart:
        typeof parsed.body.plannedStart === "string"
          ? parsed.body.plannedStart
          : undefined,
      plannedEnd:
        typeof parsed.body.plannedEnd === "string"
          ? parsed.body.plannedEnd
          : undefined,
      breakMinutes:
        typeof parsed.body.breakMinutes === "number"
          ? parsed.body.breakMinutes
          : undefined,
      assignmentType:
        typeof parsed.body.assignmentType === "string"
          ? (parsed.body.assignmentType as ScheduledShiftAssignmentType)
          : undefined,
      note: typeof parsed.body.note === "string" ? parsed.body.note : null,
      reason: typeof parsed.body.reason === "string" ? parsed.body.reason : null,
      allowOverlap: parsed.body.allowOverlap === true,
      isDailyOverride: parsed.body.isDailyOverride !== false,
    });

    return NextResponse.json(updated);
  } catch (error) {
    if (error instanceof ScheduleRosterError) {
      return apiErrorResponse(
        error.message,
        error.code === "NOT_FOUND" ? 404 : 400,
        error.code,
      );
    }
    console.error(error);
    return apiErrorResponse("แก้ไขกะไม่สำเร็จ", 500, "INTERNAL_ERROR");
  }
}

export async function DELETE(request: NextRequest, { params }: RouteContext) {
  try {
    const { periodId, shiftId } = await params;
    const currentUser = await getCurrentUser();
    const actorEmployeeId = currentUser?.employee?.id;
    if (!actorEmployeeId) {
      return apiErrorResponse("ไม่พบบัญชีพนักงานของผู้ใช้", 403, "FORBIDDEN");
    }

    const body = (await request.json().catch(() => ({}))) as {
      reason?: string;
    };

    const cancelled = await cancelScheduledShift({
      periodId,
      shiftId,
      actorEmployeeId,
      reason: body.reason ?? null,
    });
    return NextResponse.json(cancelled);
  } catch (error) {
    if (error instanceof ScheduleRosterError) {
      return apiErrorResponse(
        error.message,
        error.code === "NOT_FOUND" ? 404 : 400,
        error.code,
      );
    }
    console.error(error);
    return apiErrorResponse("ยกเลิกกะไม่สำเร็จ", 500, "INTERNAL_ERROR");
  }
}
