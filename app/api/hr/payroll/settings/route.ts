import {
  apiErrorResponse,
  readJsonObject,
  validationErrorResponse,
} from "@/lib/api/validation";
import { recordAuditLog } from "@/lib/audit/audit-log";
import { getCurrentUser } from "@/lib/auth/current-user";
import { parsePayrollSettings } from "@/lib/hr/payroll";
import { prisma } from "@/lib/prisma";
import { NextResponse } from "next/server";

const ALLOWED_KEYS = new Set([
  "ot_multiplier",
  "holiday_multiplier",
  "late_deduction_per_minute",
  "standard_work_minutes_per_day",
]);

export async function GET() {
  try {
    const rows = await prisma.payrollSetting.findMany({
      orderBy: { key: "asc" },
    });
    return NextResponse.json({
      items: rows.map((row) => ({
        id: row.id,
        key: row.key,
        value: row.value,
        labelTh: row.labelTh,
      })),
      parsed: parsePayrollSettings(rows),
    });
  } catch (error) {
    console.error("GET /api/hr/payroll/settings failed", error);
    return apiErrorResponse("ไม่สามารถโหลดตั้งค่าค่าจ้างได้", 500, "INTERNAL_ERROR");
  }
}

export async function POST(request: Request) {
  try {
    const currentUser = await getCurrentUser();
    const permissions = currentUser?.employee?.role?.permissions ?? [];
    if (!permissions.includes("hr.settings.manage")) {
      return apiErrorResponse("ไม่มีสิทธิ์ตั้งค่าค่าจ้าง", 403, "FORBIDDEN");
    }

    const parsed = await readJsonObject(request);
    if (!parsed.ok) return parsed.response;
    const key =
      typeof parsed.body.key === "string" ? parsed.body.key.trim() : "";
    const value =
      typeof parsed.body.value === "string"
        ? parsed.body.value.trim()
        : String(parsed.body.value ?? "");
    if (!ALLOWED_KEYS.has(key) || !value || Number.isNaN(Number(value))) {
      return validationErrorResponse("ค่าตั้งค่าไม่ถูกต้อง", [
        { path: "key", message: "key/value ไม่ถูกต้อง" },
      ]);
    }

    const saved = await prisma.payrollSetting.upsert({
      where: { key },
      create: {
        key,
        value,
        labelTh:
          typeof parsed.body.labelTh === "string"
            ? parsed.body.labelTh.trim() || null
            : null,
      },
      update: { value },
    });

    await recordAuditLog({
      actor: {
        employeeId: currentUser?.employee?.id,
        authUserId: currentUser?.user.id,
      },
      action: "HR_PAYROLL_SETTING_UPDATED",
      entityType: "PAYROLL_SETTING",
      entityId: saved.id,
      metadata: { key, value },
    });

    return NextResponse.json({
      id: saved.id,
      key: saved.key,
      value: saved.value,
      labelTh: saved.labelTh,
    });
  } catch (error) {
    console.error("POST /api/hr/payroll/settings failed", error);
    return apiErrorResponse("ไม่สามารถบันทึกตั้งค่าค่าจ้างได้", 500, "INTERNAL_ERROR");
  }
}
