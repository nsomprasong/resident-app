import {
  apiErrorResponse,
  readJsonObject,
  validationErrorResponse,
  type ValidationIssue,
} from "@/lib/api/validation";
import { recordAuditLog } from "@/lib/audit/audit-log";
import { getCurrentUser } from "@/lib/auth/current-user";
import { isDateInLockedPeriod } from "@/lib/hr/attendance";
import { prisma } from "@/lib/prisma";
import { NextRequest, NextResponse } from "next/server";

function isUuid(value: string) {
  return /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(
    value,
  );
}

async function assertNotLocked(workDate: Date) {
  const periods = await prisma.attendancePeriod.findMany({
    where: {
      lockedAt: { not: null },
      periodStart: { lte: workDate },
      periodEnd: { gte: workDate },
    },
  });
  if (isDateInLockedPeriod(workDate, periods)) {
    throw new Error("PERIOD_LOCKED");
  }
}

export async function POST(request: NextRequest) {
  try {
    const currentUser = await getCurrentUser();
    const employeeId = currentUser?.employee?.id;
    if (!employeeId) {
      return apiErrorResponse("ไม่พบบัญชีพนักงานของผู้ใช้", 403, "FORBIDDEN");
    }

    const parsed = await readJsonObject(request);
    if (!parsed.ok) return parsed.response;

    const issues: ValidationIssue[] = [];
    const attendanceId =
      typeof parsed.body.attendanceId === "string"
        ? parsed.body.attendanceId.trim()
        : "";
    const reason =
      typeof parsed.body.reason === "string" ? parsed.body.reason.trim() : "";
    const rawMinutes = parsed.body.proposedOtMinutes;
    const proposedOtMinutes =
      rawMinutes === undefined || rawMinutes === null || rawMinutes === ""
        ? NaN
        : Number(rawMinutes);

    if (!isUuid(attendanceId)) {
      issues.push({ path: "attendanceId", message: "รหัสรายการไม่ถูกต้อง" });
    }
    if (!reason || reason.length < 3) {
      issues.push({ path: "reason", message: "ต้องระบุเหตุผลอย่างน้อย 3 ตัวอักษร" });
    }
    if (!Number.isFinite(proposedOtMinutes) || proposedOtMinutes <= 0) {
      issues.push({
        path: "proposedOtMinutes",
        message: "ต้องระบุนาที OT มากกว่า 0",
      });
    }
    if (issues.length) {
      return validationErrorResponse("กรุณาตรวจสอบคำขอ OT", issues);
    }

    const record = await prisma.attendanceRecord.findUnique({
      where: { id: attendanceId },
    });
    if (!record || record.employeeId !== employeeId) {
      return apiErrorResponse("ไม่พบรายการลงเวลา", 404, "NOT_FOUND");
    }
    if (record.status === "LOCKED") {
      return apiErrorResponse("รายการนี้ถูกล็อกแล้ว", 409, "LOCKED");
    }
    if (!record.clockOut) {
      return apiErrorResponse(
        "ลงเวลาออกงานก่อนจึงจะขอ OT ได้",
        409,
        "NOT_CHECKED_OUT",
      );
    }
    await assertNotLocked(record.workDate);

    const pending = await prisma.attendanceAdjustment.findFirst({
      where: {
        attendanceRecordId: record.id,
        type: "OT_REQUEST",
        status: "PENDING",
      },
      select: { id: true },
    });
    if (pending) {
      return apiErrorResponse(
        "มีคำขอ OT รออนุมัติอยู่แล้ว",
        409,
        "PENDING_EXISTS",
      );
    }

    const created = await prisma.attendanceAdjustment.create({
      data: {
        attendanceRecordId: record.id,
        type: "OT_REQUEST",
        status: "PENDING",
        reason,
        proposedOtMinutes: Math.round(proposedOtMinutes),
        requestedById: employeeId,
      },
    });

    await recordAuditLog({
      actor: {
        employeeId,
        authUserId: currentUser.user.id,
      },
      action: "HR_ATTENDANCE_OT_REQUESTED_SELF",
      entityType: "ATTENDANCE_ADJUSTMENT",
      entityId: created.id,
      metadata: { attendanceId: record.id, proposedOtMinutes },
    });

    return NextResponse.json(
      {
        id: created.id,
        status: created.status,
        proposedOtMinutes: created.proposedOtMinutes,
      },
      { status: 201 },
    );
  } catch (error) {
    if (error instanceof Error && error.message === "PERIOD_LOCKED") {
      return apiErrorResponse(
        "วันที่นี้อยู่ในรอบที่ล็อกแล้ว",
        409,
        "PERIOD_LOCKED",
      );
    }
    console.error("POST /api/hr/my-work/ot-request failed", error);
    return apiErrorResponse("ส่งคำขอ OT ไม่สำเร็จ", 500, "INTERNAL_ERROR");
  }
}
