import {
  apiErrorResponse,
  readJsonObject,
  validationErrorResponse,
} from "@/lib/api/validation";
import { getCurrentUser } from "@/lib/auth/current-user";
import { computeSemiMonthlyRanges } from "@/lib/hr/schedule-periods";
import {
  createSchedulePeriod,
  listSchedulePeriods,
  ScheduleRosterError,
} from "@/lib/hr/schedule-roster";
import { NextRequest, NextResponse } from "next/server";

function rosterError(error: unknown) {
  if (error instanceof ScheduleRosterError) {
    const status =
      error.code === "NOT_FOUND"
        ? 404
        : error.code === "PERIOD_OVERLAP" || error.code === "OVERLAP"
          ? 409
          : 400;
    return apiErrorResponse(error.message, status, error.code);
  }
  console.error(error);
  return apiErrorResponse("เกิดข้อผิดพลาดกับรอบตาราง", 500, "INTERNAL_ERROR");
}

export async function GET(request: NextRequest) {
  try {
    const year = Number(request.nextUrl.searchParams.get("year") ?? "");
    const month = Number(request.nextUrl.searchParams.get("month") ?? "");
    const periods = await listSchedulePeriods();
    const suggestions =
      Number.isInteger(year) && Number.isInteger(month)
        ? computeSemiMonthlyRanges(year, month).map((item) => ({
            name: item.name,
            startDate: item.startDate.toISOString().slice(0, 10),
            endDate: item.endDate.toISOString().slice(0, 10),
          }))
        : [];
    return NextResponse.json({ periods, suggestions });
  } catch (error) {
    return rosterError(error);
  }
}

export async function POST(request: NextRequest) {
  try {
    const currentUser = await getCurrentUser();
    const parsed = await readJsonObject(request);
    if (!parsed.ok) return parsed.response;

    const startDate =
      typeof parsed.body.startDate === "string" ? parsed.body.startDate.trim() : "";
    const endDate =
      typeof parsed.body.endDate === "string" ? parsed.body.endDate.trim() : "";
    const name =
      typeof parsed.body.name === "string" ? parsed.body.name.trim() : undefined;

    if (!startDate || !endDate) {
      return validationErrorResponse("กรุณาระบุช่วงวันที่รอบ", [
        { path: "startDate", message: "ต้องระบุวันเริ่ม" },
        { path: "endDate", message: "ต้องระบุวันสิ้นสุด" },
      ]);
    }

    const created = await createSchedulePeriod({
      name,
      startDate,
      endDate,
      actorEmployeeId: currentUser?.employee?.id ?? null,
    });
    return NextResponse.json(created, { status: 201 });
  } catch (error) {
    return rosterError(error);
  }
}
