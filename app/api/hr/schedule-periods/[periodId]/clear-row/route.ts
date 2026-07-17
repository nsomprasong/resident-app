import {
  apiErrorResponse,
  readJsonObject,
  validationErrorResponse,
} from "@/lib/api/validation";
import { getCurrentUser } from "@/lib/auth/current-user";
import {
  clearEmployeeNonOverrideShifts,
  ScheduleRosterError,
} from "@/lib/hr/schedule-roster";
import { NextRequest, NextResponse } from "next/server";

type RouteContext = { params: Promise<{ periodId: string }> };

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

    const employeeIds = Array.isArray(parsed.body.employeeIds)
      ? parsed.body.employeeIds.filter(
          (item): item is string => typeof item === "string" && item.length > 0,
        )
      : [];
    const employeeId =
      typeof parsed.body.employeeId === "string"
        ? parsed.body.employeeId.trim()
        : "";
    if (!employeeIds.length && !employeeId) {
      return validationErrorResponse("กรุณาเลือกพนักงาน", [
        { path: "employeeIds", message: "ต้องระบุพนักงานอย่างน้อย 1 คน" },
      ]);
    }

    const result = await clearEmployeeNonOverrideShifts({
      periodId,
      actorEmployeeId,
      employeeId: employeeId || undefined,
      employeeIds,
      dateFrom:
        typeof parsed.body.dateFrom === "string" ? parsed.body.dateFrom : null,
      dateTo: typeof parsed.body.dateTo === "string" ? parsed.body.dateTo : null,
      includeOverrides: parsed.body.includeOverrides === true,
      reason:
        typeof parsed.body.reason === "string" ? parsed.body.reason : null,
      dryRun: parsed.body.dryRun === true,
    });
    return NextResponse.json(result);
  } catch (error) {
    if (error instanceof ScheduleRosterError) {
      return apiErrorResponse(
        error.message,
        error.code === "NOT_FOUND" ? 404 : 400,
        error.code,
      );
    }
    console.error(error);
    return apiErrorResponse("ล้างกะแถวไม่สำเร็จ", 500, "INTERNAL_ERROR");
  }
}
