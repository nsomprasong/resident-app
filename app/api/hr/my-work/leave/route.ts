import type { LeaveDuration } from "@/generated/prisma/client";

import {
  apiErrorResponse,
  readJsonObject,
  validationErrorResponse,
  type ValidationIssue,
} from "@/lib/api/validation";
import { recordAuditLog } from "@/lib/audit/audit-log";
import { getCurrentUser } from "@/lib/auth/current-user";
import {
  computeLeaveDaysRequested,
  decimalDays,
  leaveDurationLabel,
  rangesOverlapInclusive,
} from "@/lib/hr/leave";
import { parseDateKey } from "@/lib/hr/schedules";
import { prisma } from "@/lib/prisma";
import { NextRequest, NextResponse } from "next/server";

function isUuid(value: string) {
  return /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(
    value,
  );
}

/**
 * Minimal self-service leave request for "งานของฉัน" — always targets the
 * caller's own Employee (never trusts a client-supplied employeeId), and
 * skips the quota/balance workflow which is out of scope for this phase.
 */
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
    const leaveTypeId =
      typeof parsed.body.leaveTypeId === "string" ? parsed.body.leaveTypeId.trim() : "";
    const startRaw =
      typeof parsed.body.startDate === "string" ? parsed.body.startDate.trim() : "";
    const endRaw =
      typeof parsed.body.endDate === "string" ? parsed.body.endDate.trim() : startRaw;
    const durationRaw =
      typeof parsed.body.duration === "string" ? parsed.body.duration.trim() : "FULL_DAY";
    const reason = typeof parsed.body.reason === "string" ? parsed.body.reason.trim() : "";

    if (!isUuid(leaveTypeId)) {
      issues.push({ path: "leaveTypeId", message: "กรุณาเลือกประเภทการลา" });
    }
    const startDate = parseDateKey(startRaw);
    const endDate = parseDateKey(endRaw);
    if (!startDate) issues.push({ path: "startDate", message: "วันที่เริ่มไม่ถูกต้อง" });
    if (!endDate) issues.push({ path: "endDate", message: "วันที่สิ้นสุดไม่ถูกต้อง" });
    if (!["FULL_DAY", "HALF_DAY_AM", "HALF_DAY_PM"].includes(durationRaw)) {
      issues.push({ path: "duration", message: "รูปแบบลาไม่ถูกต้อง" });
    }
    if (issues.length || !startDate || !endDate) {
      return validationErrorResponse("กรุณาตรวจสอบคำขอลา", issues);
    }

    const duration = durationRaw as LeaveDuration;
    let daysRequested: number;
    try {
      daysRequested = computeLeaveDaysRequested({ startDate, endDate, duration });
    } catch (computeError) {
      const message = computeError instanceof Error ? computeError.message : "";
      if (message === "HALF_DAY_SINGLE_DATE") {
        return validationErrorResponse("ลาครึ่งวันต้องเป็นวันเดียว", [
          { path: "endDate", message: "ต้องเท่ากับวันเริ่ม" },
        ]);
      }
      return validationErrorResponse("ช่วงวันที่ไม่ถูกต้อง", [
        { path: "startDate", message: "ช่วงวันที่ไม่ถูกต้อง" },
      ]);
    }

    const leaveType = await prisma.leaveType.findUnique({ where: { id: leaveTypeId } });
    if (!leaveType || !leaveType.isActive) {
      return apiErrorResponse("ไม่พบประเภทลา", 404, "NOT_FOUND");
    }

    const overlapping = await prisma.leaveRequest.findMany({
      where: {
        employeeId,
        status: { in: ["PENDING", "APPROVED"] },
        startDate: { lte: endDate },
        endDate: { gte: startDate },
      },
    });
    const conflict = overlapping.find((item) =>
      rangesOverlapInclusive(item.startDate, item.endDate, startDate, endDate),
    );
    if (conflict) {
      return apiErrorResponse("ช่วงลาซ้อนกับคำขอที่มีอยู่", 409, "CONFLICT");
    }

    const created = await prisma.leaveRequest.create({
      data: {
        employeeId,
        leaveTypeId,
        startDate,
        endDate,
        duration,
        daysRequested,
        reason: reason || null,
        requestedById: employeeId,
      },
      include: { leaveType: { select: { name: true, code: true } } },
    });

    await recordAuditLog({
      actor: { employeeId, authUserId: currentUser?.user.id },
      action: "HR_LEAVE_REQUESTED_SELF",
      entityType: "LEAVE_REQUEST",
      entityId: created.id,
      metadata: { leaveTypeId, daysRequested, startDate: startRaw, endDate: endRaw },
    });

    return NextResponse.json(
      {
        id: created.id,
        leaveTypeName: created.leaveType.name,
        leaveTypeCode: created.leaveType.code,
        startDate: startRaw,
        endDate: endRaw,
        duration: created.duration,
        durationLabel: leaveDurationLabel(created.duration),
        daysRequested: decimalDays(created.daysRequested),
        reason: created.reason,
        status: created.status,
      },
      { status: 201 },
    );
  } catch (error) {
    console.error("POST /api/hr/my-work/leave failed", error);
    return apiErrorResponse("ไม่สามารถส่งคำขอลาได้", 500, "INTERNAL_ERROR");
  }
}
