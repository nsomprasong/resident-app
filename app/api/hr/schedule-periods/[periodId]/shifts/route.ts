import {
  apiErrorResponse,
  readJsonObject,
  validationErrorResponse,
} from "@/lib/api/validation";
import { getCurrentUser } from "@/lib/auth/current-user";
import {
  listPeriodShifts,
  markEmployeeDayOffOrLeave,
  ScheduleRosterError,
  upsertScheduledShift,
} from "@/lib/hr/schedule-roster";
import type { ScheduledShiftAssignmentType } from "@/generated/prisma/client";
import { NextRequest, NextResponse } from "next/server";

type RouteContext = { params: Promise<{ periodId: string }> };

export async function GET(_: NextRequest, { params }: RouteContext) {
  try {
    const { periodId } = await params;
    return NextResponse.json({ items: await listPeriodShifts(periodId) });
  } catch (error) {
    if (error instanceof ScheduleRosterError) {
      return apiErrorResponse(
        error.message,
        error.code === "NOT_FOUND" ? 404 : 400,
        error.code,
      );
    }
    console.error(error);
    return apiErrorResponse("โหลดกะไม่สำเร็จ", 500, "INTERNAL_ERROR");
  }
}

export async function POST(request: NextRequest, { params }: RouteContext) {
  try {
    const { periodId } = await params;
    const currentUser = await getCurrentUser();
    const actorEmployeeId = currentUser?.employee?.id;
    if (!actorEmployeeId) {
      return apiErrorResponse("ไม่พบบัญชีพนักงานของผู้ใช้", 403, "FORBIDDEN");
    }

    const parsed = await readJsonObject(request);
    if (!parsed.ok) return parsed.response;

    const employeeId =
      typeof parsed.body.employeeId === "string"
        ? parsed.body.employeeId.trim()
        : "";
    const workDate =
      typeof parsed.body.workDate === "string" ? parsed.body.workDate.trim() : "";
    if (!employeeId || !workDate) {
      return validationErrorResponse("กรุณาเลือกพนักงานและวันที่", [
        { path: "employeeId", message: "ต้องระบุพนักงาน" },
        { path: "workDate", message: "ต้องระบุวันที่" },
      ]);
    }

    const markKind =
      parsed.body.markKind === "DAY_OFF" || parsed.body.markKind === "LEAVE"
        ? parsed.body.markKind
        : null;
    if (markKind) {
      const marked = await markEmployeeDayOffOrLeave({
        periodId,
        actorEmployeeId,
        employeeId,
        workDate,
        kind: markKind,
        reason:
          typeof parsed.body.reason === "string" ? parsed.body.reason : null,
      });
      return NextResponse.json(marked, { status: 201 });
    }

    const created = await upsertScheduledShift({
      periodId,
      actorEmployeeId,
      employeeId,
      workDate,
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

    return NextResponse.json(created, { status: 201 });
  } catch (error) {
    if (error instanceof ScheduleRosterError) {
      const status =
        error.code === "NOT_FOUND"
          ? 404
          : error.code === "OVERLAP"
            ? 409
            : 400;
      return apiErrorResponse(error.message, status, error.code);
    }
    console.error(error);
    return apiErrorResponse("บันทึกกะไม่สำเร็จ", 500, "INTERNAL_ERROR");
  }
}
