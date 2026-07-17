import { apiErrorResponse } from "@/lib/api/validation";
import { getCurrentUser } from "@/lib/auth/current-user";
import {
  generateFromDefaultShifts,
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

    const body = (await request.json().catch(() => ({}))) as {
      employeeIds?: string[];
    };

    const result = await generateFromDefaultShifts({
      periodId,
      actorEmployeeId,
      employeeIds: Array.isArray(body.employeeIds) ? body.employeeIds : undefined,
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
    return apiErrorResponse("สร้างจากกะประจำไม่สำเร็จ", 500, "INTERNAL_ERROR");
  }
}
