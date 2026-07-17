import {
  apiErrorResponse,
  readJsonObject,
  validationErrorResponse,
} from "@/lib/api/validation";
import { getCurrentUser } from "@/lib/auth/current-user";
import {
  copyEmployeeRowShifts,
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

    const sourceEmployeeId =
      typeof parsed.body.sourceEmployeeId === "string"
        ? parsed.body.sourceEmployeeId.trim()
        : "";
    const targetEmployeeIds = Array.isArray(parsed.body.targetEmployeeIds)
      ? parsed.body.targetEmployeeIds.filter(
          (item): item is string => typeof item === "string" && item.length > 0,
        )
      : [];
    const mode =
      parsed.body.mode === "REPLACE_ALL" ? "REPLACE_ALL" : "FILL_EMPTY";

    if (!sourceEmployeeId || !targetEmployeeIds.length) {
      return validationErrorResponse("กรุณาเลือกต้นฉบับและปลายทาง", [
        { path: "sourceEmployeeId", message: "เลือกต้นฉบับ 1 คน" },
        { path: "targetEmployeeIds", message: "เลือกปลายทางอย่างน้อย 1 คน" },
      ]);
    }

    const result = await copyEmployeeRowShifts({
      periodId,
      actorEmployeeId,
      sourceEmployeeId,
      targetEmployeeIds,
      dateFrom:
        typeof parsed.body.dateFrom === "string" ? parsed.body.dateFrom : null,
      dateTo: typeof parsed.body.dateTo === "string" ? parsed.body.dateTo : null,
      mode,
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
    return apiErrorResponse("คัดลอกแถวไม่สำเร็จ", 500, "INTERNAL_ERROR");
  }
}
