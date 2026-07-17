import { apiErrorResponse } from "@/lib/api/validation";
import { getCurrentUser } from "@/lib/auth/current-user";
import {
  copyFromPreviousPeriod,
  ScheduleRosterError,
} from "@/lib/hr/schedule-roster";
import { NextRequest, NextResponse } from "next/server";

type RouteContext = {
  params: Promise<{ periodId: string; sourcePeriodId: string }>;
};

export async function POST(request: NextRequest, { params }: RouteContext) {
  try {
    const { periodId, sourcePeriodId } = await params;
    const currentUser = await getCurrentUser();
    const actorEmployeeId = currentUser?.employee?.id;
    if (!actorEmployeeId) {
      return apiErrorResponse("ไม่พบบัญชีพนักงานของผู้ใช้", 403, "FORBIDDEN");
    }

    const body = (await request.json().catch(() => ({}))) as {
      employeeIds?: string[];
      dateFrom?: string;
      dateTo?: string;
    };

    const result = await copyFromPreviousPeriod({
      periodId,
      sourcePeriodId,
      actorEmployeeId,
      employeeIds: Array.isArray(body.employeeIds) ? body.employeeIds : undefined,
      dateFrom: typeof body.dateFrom === "string" ? body.dateFrom : null,
      dateTo: typeof body.dateTo === "string" ? body.dateTo : null,
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
    return apiErrorResponse("คัดลอกรอบไม่สำเร็จ", 500, "INTERNAL_ERROR");
  }
}
