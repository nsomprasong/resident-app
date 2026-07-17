import { apiErrorResponse } from "@/lib/api/validation";
import {
  listPeriodChangeLogs,
  ScheduleRosterError,
} from "@/lib/hr/schedule-roster";
import { NextRequest, NextResponse } from "next/server";

type RouteContext = { params: Promise<{ periodId: string }> };

export async function GET(request: NextRequest, { params }: RouteContext) {
  try {
    const { periodId } = await params;
    const takeRaw = request.nextUrl.searchParams.get("take");
    const take = takeRaw ? Number(takeRaw) : 40;
    const items = await listPeriodChangeLogs(
      periodId,
      Number.isFinite(take) ? Math.min(Math.max(take, 1), 100) : 40,
    );
    return NextResponse.json({ items });
  } catch (error) {
    if (error instanceof ScheduleRosterError) {
      return apiErrorResponse(
        error.message,
        error.code === "NOT_FOUND" ? 404 : 400,
        error.code,
      );
    }
    console.error(error);
    return apiErrorResponse("โหลดประวัติตารางไม่สำเร็จ", 500, "INTERNAL_ERROR");
  }
}
