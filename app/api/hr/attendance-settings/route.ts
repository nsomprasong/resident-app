import {
  apiErrorResponse,
  readJsonObject,
  validationErrorResponse,
} from "@/lib/api/validation";
import { recordAuditLog } from "@/lib/audit/audit-log";
import { getCurrentUser } from "@/lib/auth/current-user";
import {
  getAttendanceSetting,
  parseAttendanceSettingInput,
  serializeAttendanceSetting,
  upsertAttendanceSetting,
} from "@/lib/hr/attendance-settings";
import { NextRequest, NextResponse } from "next/server";

export async function GET() {
  try {
    const setting = await getAttendanceSetting();
    return NextResponse.json(serializeAttendanceSetting(setting));
  } catch (error) {
    console.error("GET /api/hr/attendance-settings failed", error);
    return apiErrorResponse("ไม่สามารถโหลดการตั้งค่าหมุดได้", 500, "INTERNAL_ERROR");
  }
}

export async function PATCH(request: NextRequest) {
  try {
    const currentUser = await getCurrentUser();
    const parsed = await readJsonObject(request);
    if (!parsed.ok) return parsed.response;

    const validated = parseAttendanceSettingInput(parsed.body);
    if (!validated.ok) {
      return validationErrorResponse("กรุณาตรวจสอบการตั้งค่าหมุด", validated.issues);
    }

    const updated = await upsertAttendanceSetting(validated.data);

    await recordAuditLog({
      actor: {
        employeeId: currentUser?.employee?.id,
        authUserId: currentUser?.user.id,
      },
      action: "HR_ATTENDANCE_SETTINGS_UPDATED",
      entityType: "HR_ATTENDANCE_SETTING",
      entityId: updated.id,
      metadata: { fields: Object.keys(validated.data) },
    });

    return NextResponse.json(serializeAttendanceSetting(updated));
  } catch (error) {
    console.error("PATCH /api/hr/attendance-settings failed", error);
    return apiErrorResponse("ไม่สามารถบันทึกการตั้งค่าหมุดได้", 500, "INTERNAL_ERROR");
  }
}
