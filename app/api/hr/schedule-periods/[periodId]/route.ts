import {
  apiErrorResponse,
  readJsonObject,
  validationErrorResponse,
} from "@/lib/api/validation";
import { getCurrentUser } from "@/lib/auth/current-user";
import {
  closeSchedulePeriod,
  getSchedulePeriod,
  listRosterGrid,
  publishSchedulePeriod,
  ScheduleRosterError,
} from "@/lib/hr/schedule-roster";
import { NextRequest, NextResponse } from "next/server";

type RouteContext = { params: Promise<{ periodId: string }> };

function rosterError(error: unknown) {
  if (error instanceof ScheduleRosterError) {
    const status =
      error.code === "NOT_FOUND"
        ? 404
        : error.code === "PERIOD_CLOSED" || error.code === "INVALID_STATUS"
          ? 409
          : 400;
    return apiErrorResponse(error.message, status, error.code);
  }
  console.error(error);
  return apiErrorResponse("เกิดข้อผิดพลาดกับรอบตาราง", 500, "INTERNAL_ERROR");
}

export async function GET(request: NextRequest, { params }: RouteContext) {
  try {
    const { periodId } = await params;
    const withGrid = request.nextUrl.searchParams.get("grid") === "1";
    if (withGrid) {
      return NextResponse.json(await listRosterGrid(periodId));
    }
    return NextResponse.json(await getSchedulePeriod(periodId));
  } catch (error) {
    return rosterError(error);
  }
}

export async function PATCH(request: NextRequest, { params }: RouteContext) {
  try {
    const { periodId } = await params;
    const currentUser = await getCurrentUser();
    const actorEmployeeId = currentUser?.employee?.id;
    if (!actorEmployeeId) {
      return apiErrorResponse("ไม่พบบัญชีพนักงานของผู้ใช้", 403, "FORBIDDEN");
    }

    const parsed = await readJsonObject(request);
    if (!parsed.ok) return parsed.response;

    const action =
      typeof parsed.body.action === "string" ? parsed.body.action.trim() : "";
    if (action === "publish") {
      return NextResponse.json(
        await publishSchedulePeriod({ periodId, actorEmployeeId }),
      );
    }
    if (action === "close") {
      const reason =
        typeof parsed.body.reason === "string" ? parsed.body.reason : "";
      if (!reason.trim()) {
        return validationErrorResponse("ต้องระบุเหตุผลเมื่อปิดรอบ", [
          { path: "reason", message: "กรุณาระบุเหตุผล" },
        ]);
      }
      return NextResponse.json(
        await closeSchedulePeriod({ periodId, actorEmployeeId, reason }),
      );
    }

    return validationErrorResponse("ไม่รองรับคำสั่งนี้", [
      { path: "action", message: "ใช้ publish หรือ close" },
    ]);
  } catch (error) {
    return rosterError(error);
  }
}
