import {
  apiErrorResponse,
  readJsonObject,
  validationErrorResponse,
} from "@/lib/api/validation";
import { getCurrentUser } from "@/lib/auth/current-user";
import {
  replaceScheduledShift,
  ScheduleRosterError,
} from "@/lib/hr/schedule-roster";
import { NextRequest, NextResponse } from "next/server";

type RouteContext = {
  params: Promise<{ periodId: string; shiftId: string }>;
};

export async function POST(request: NextRequest, { params }: RouteContext) {
  try {
    const { periodId, shiftId } = await params;
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
    const reason =
      typeof parsed.body.reason === "string" ? parsed.body.reason : "";
    if (!employeeId || !reason.trim()) {
      return validationErrorResponse("กรุณาเลือกผู้ทำแทนและเหตุผล", [
        { path: "employeeId", message: "ต้องระบุผู้ทำแทน" },
        { path: "reason", message: "ต้องระบุเหตุผล" },
      ]);
    }

    const result = await replaceScheduledShift({
      periodId,
      shiftId,
      replacementEmployeeId: employeeId,
      actorEmployeeId,
      reason,
    });
    return NextResponse.json(result, { status: 201 });
  } catch (error) {
    if (error instanceof ScheduleRosterError) {
      return apiErrorResponse(
        error.message,
        error.code === "NOT_FOUND" ? 404 : 400,
        error.code,
      );
    }
    console.error(error);
    return apiErrorResponse("จัดผู้ทำแทนไม่สำเร็จ", 500, "INTERNAL_ERROR");
  }
}
