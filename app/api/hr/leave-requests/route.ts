import type { LeaveDuration, Prisma } from "@/generated/prisma/client";

import {
  apiErrorResponse,
  readJsonObject,
  validationErrorResponse,
  type ValidationIssue,
} from "@/lib/api/validation";
import { recordAuditLog } from "@/lib/audit/audit-log";
import { getCurrentUser } from "@/lib/auth/current-user";
import { displayEmployeeName } from "@/lib/hr/employees";
import {
  availableLeaveDays,
  computeLeaveDaysRequested,
  decimalDays,
  eachDateKeyInclusive,
  leaveDurationLabel,
  rangesOverlapInclusive,
  roundLeaveDays,
} from "@/lib/hr/leave";
import { dateKeyUtc, parseDateKey } from "@/lib/hr/schedules";
import { prisma } from "@/lib/prisma";
import { NextRequest, NextResponse } from "next/server";

function isUuid(value: string) {
  return /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(
    value,
  );
}

const requestInclude = {
  employee: {
    select: {
      id: true,
      name: true,
      firstName: true,
      lastName: true,
      employeeCode: true,
    },
  },
  leaveType: {
    select: {
      id: true,
      code: true,
      name: true,
      isPaid: true,
      requiresAttachment: true,
    },
  },
} satisfies Prisma.LeaveRequestInclude;

function serializeRequest(
  item: Prisma.LeaveRequestGetPayload<{ include: typeof requestInclude }>,
) {
  return {
    id: item.id,
    employeeId: item.employeeId,
    employeeName: displayEmployeeName(item.employee),
    employeeCode: item.employee.employeeCode,
    leaveTypeId: item.leaveTypeId,
    leaveTypeCode: item.leaveType.code,
    leaveTypeName: item.leaveType.name,
    isPaid: item.leaveType.isPaid,
    startDate: dateKeyUtc(item.startDate),
    endDate: dateKeyUtc(item.endDate),
    duration: item.duration,
    durationLabel: leaveDurationLabel(item.duration),
    daysRequested: decimalDays(item.daysRequested),
    reason: item.reason,
    attachmentUrl: item.attachmentUrl,
    attachmentName: item.attachmentName,
    status: item.status,
    reviewedAt: item.reviewedAt?.toISOString() ?? null,
    reviewNote: item.reviewNote,
    createdAt: item.createdAt.toISOString(),
  };
}

async function ensureBalance(
  tx: Prisma.TransactionClient,
  input: {
    employeeId: string;
    leaveTypeId: string;
    year: number;
    defaultAllowanceDays: number;
  },
) {
  return tx.leaveBalance.upsert({
    where: {
      employeeId_leaveTypeId_year: {
        employeeId: input.employeeId,
        leaveTypeId: input.leaveTypeId,
        year: input.year,
      },
    },
    create: {
      employeeId: input.employeeId,
      leaveTypeId: input.leaveTypeId,
      year: input.year,
      entitled: input.defaultAllowanceDays,
    },
    update: {},
  });
}

async function applyApprovedLeaveEffects(
  tx: Prisma.TransactionClient,
  input: {
    employeeId: string;
    startDate: Date;
    endDate: Date;
    duration: LeaveDuration;
    leaveTypeName: string;
  },
) {
  const dateKeys = eachDateKeyInclusive(
    dateKeyUtc(input.startDate),
    dateKeyUtc(input.endDate),
  );

  if (input.duration === "FULL_DAY") {
    await tx.workSchedule.updateMany({
      where: {
        employeeId: input.employeeId,
        workDate: { gte: input.startDate, lte: input.endDate },
        status: "ASSIGNED",
      },
      data: { status: "CANCELLED", notes: `ยกเลิกเนื่องจากลา: ${input.leaveTypeName}` },
    });
  }

  for (const dateKey of dateKeys) {
    const workDate = parseDateKey(dateKey);
    if (!workDate) continue;
    const existing = await tx.attendanceRecord.findFirst({
      where: {
        employeeId: input.employeeId,
        workDate,
        workScheduleId: null,
      },
    });
    if (existing) {
      if (existing.status !== "LOCKED") {
        await tx.attendanceRecord.update({
          where: { id: existing.id },
          data: {
            status: "ABSENT",
            clockIn: null,
            clockOut: null,
            breakStart: null,
            breakEnd: null,
            workedMinutes: 0,
            breakMinutes: 0,
            lateMinutes: 0,
            earlyLeaveMinutes: 0,
            otMinutes: 0,
            notes: `ลา: ${input.leaveTypeName} (${leaveDurationLabel(input.duration)})`,
          },
        });
      }
      continue;
    }
    await tx.attendanceRecord.create({
      data: {
        employeeId: input.employeeId,
        workDate,
        status: "ABSENT",
        notes: `ลา: ${input.leaveTypeName} (${leaveDurationLabel(input.duration)})`,
      },
    });
  }
}

export async function GET(request: NextRequest) {
  try {
    const fromKey = request.nextUrl.searchParams.get("from");
    const toKey = request.nextUrl.searchParams.get("to");
    const status = request.nextUrl.searchParams.get("status");
    const employeeId = request.nextUrl.searchParams.get("employeeId");

    const where: Prisma.LeaveRequestWhereInput = {};
    if (fromKey && toKey) {
      const from = parseDateKey(fromKey);
      const to = parseDateKey(toKey);
      if (!from || !to || from > to) {
        return apiErrorResponse("ช่วงวันที่ไม่ถูกต้อง", 400, "VALIDATION_ERROR");
      }
      where.AND = [
        { startDate: { lte: to } },
        { endDate: { gte: from } },
      ];
    }
    if (
      status &&
      ["PENDING", "APPROVED", "REJECTED", "CANCELLED"].includes(status)
    ) {
      where.status = status as
        | "PENDING"
        | "APPROVED"
        | "REJECTED"
        | "CANCELLED";
    }
    if (employeeId) {
      if (!isUuid(employeeId)) {
        return apiErrorResponse("รหัสพนักงานไม่ถูกต้อง", 400, "VALIDATION_ERROR");
      }
      where.employeeId = employeeId;
    }

    const requests = await prisma.leaveRequest.findMany({
      where,
      include: requestInclude,
      orderBy: [{ createdAt: "desc" }],
      take: 200,
    });

    return NextResponse.json({
      requests: requests.map(serializeRequest),
    });
  } catch (error) {
    console.error("GET /api/hr/leave-requests failed", error);
    return apiErrorResponse("ไม่สามารถโหลดคำขอลาได้", 500, "INTERNAL_ERROR");
  }
}

export async function POST(request: NextRequest) {
  try {
    const currentUser = await getCurrentUser();
    const actorEmployeeId = currentUser?.employee?.id;
    if (!actorEmployeeId) {
      return apiErrorResponse("ไม่พบบัญชีพนักงานของผู้ใช้", 403, "FORBIDDEN");
    }
    const permissions = currentUser.employee?.role?.permissions ?? [];
    const parsed = await readJsonObject(request);
    if (!parsed.ok) return parsed.response;
    const mode =
      typeof parsed.body.mode === "string" ? parsed.body.mode.trim() : "create";

    if (mode === "create") {
      const issues: ValidationIssue[] = [];
      const employeeId =
        typeof parsed.body.employeeId === "string"
          ? parsed.body.employeeId.trim()
          : actorEmployeeId;
      const leaveTypeId =
        typeof parsed.body.leaveTypeId === "string"
          ? parsed.body.leaveTypeId.trim()
          : "";
      const startRaw =
        typeof parsed.body.startDate === "string"
          ? parsed.body.startDate.trim()
          : "";
      const endRaw =
        typeof parsed.body.endDate === "string"
          ? parsed.body.endDate.trim()
          : startRaw;
      const durationRaw =
        typeof parsed.body.duration === "string"
          ? parsed.body.duration.trim()
          : "FULL_DAY";
      const reason =
        typeof parsed.body.reason === "string"
          ? parsed.body.reason.trim()
          : "";
      const attachmentUrl =
        typeof parsed.body.attachmentUrl === "string"
          ? parsed.body.attachmentUrl.trim() || null
          : null;
      const attachmentName =
        typeof parsed.body.attachmentName === "string"
          ? parsed.body.attachmentName.trim() || null
          : null;

      if (!isUuid(employeeId)) {
        issues.push({ path: "employeeId", message: "รหัสพนักงานไม่ถูกต้อง" });
      }
      if (!isUuid(leaveTypeId)) {
        issues.push({ path: "leaveTypeId", message: "ประเภทลาไม่ถูกต้อง" });
      }
      const startDate = parseDateKey(startRaw);
      const endDate = parseDateKey(endRaw);
      if (!startDate) {
        issues.push({ path: "startDate", message: "วันที่เริ่มไม่ถูกต้อง" });
      }
      if (!endDate) {
        issues.push({ path: "endDate", message: "วันที่สิ้นสุดไม่ถูกต้อง" });
      }
      if (
        !["FULL_DAY", "HALF_DAY_AM", "HALF_DAY_PM"].includes(durationRaw)
      ) {
        issues.push({ path: "duration", message: "รูปแบบลาไม่ถูกต้อง" });
      }
      if (issues.length || !startDate || !endDate) {
        return validationErrorResponse("กรุณาตรวจสอบคำขอลา", issues);
      }

      const duration = durationRaw as LeaveDuration;
      let daysRequested: number;
      try {
        daysRequested = computeLeaveDaysRequested({
          startDate,
          endDate,
          duration,
        });
      } catch (computeError) {
        const message =
          computeError instanceof Error ? computeError.message : "";
        if (message === "HALF_DAY_SINGLE_DATE") {
          return validationErrorResponse("ลาครึ่งวันต้องเป็นวันเดียว", [
            { path: "endDate", message: "ต้องเท่ากับวันเริ่ม" },
          ]);
        }
        return validationErrorResponse("ช่วงวันที่ไม่ถูกต้อง", [
          { path: "startDate", message: "ช่วงวันที่ไม่ถูกต้อง" },
        ]);
      }

      const leaveType = await prisma.leaveType.findUnique({
        where: { id: leaveTypeId },
      });
      if (!leaveType || !leaveType.isActive) {
        return apiErrorResponse("ไม่พบประเภทลา", 404, "NOT_FOUND");
      }
      if (leaveType.requiresAttachment && !attachmentUrl) {
        return validationErrorResponse("ประเภทลานี้ต้องแนบเอกสาร", [
          { path: "attachmentUrl", message: "ระบุลิงก์เอกสาร" },
        ]);
      }

      const year = startDate.getUTCFullYear();
      if (endDate.getUTCFullYear() !== year) {
        return validationErrorResponse("คำขอลาต้องอยู่ในปีปฏิทินเดียวกัน", [
          { path: "endDate", message: "ห้ามข้ามปี" },
        ]);
      }

      const created = await prisma.$transaction(async (tx) => {
        const overlapping = await tx.leaveRequest.findMany({
          where: {
            employeeId,
            status: { in: ["PENDING", "APPROVED"] },
            startDate: { lte: endDate },
            endDate: { gte: startDate },
          },
        });
        const conflict = overlapping.find((item) =>
          rangesOverlapInclusive(
            item.startDate,
            item.endDate,
            startDate,
            endDate,
          ),
        );
        if (conflict) {
          throw new Error("LEAVE_OVERLAP");
        }

        const balance = await ensureBalance(tx, {
          employeeId,
          leaveTypeId,
          year,
          defaultAllowanceDays: decimalDays(leaveType.defaultAllowanceDays),
        });
        const entitled = decimalDays(balance.entitled);
        const used = decimalDays(balance.used);
        const pending = decimalDays(balance.pending);
        const available = availableLeaveDays({ entitled, used, pending });
        if (daysRequested > available + 1e-9) {
          throw new Error("INSUFFICIENT_BALANCE");
        }

        const requestRow = await tx.leaveRequest.create({
          data: {
            employeeId,
            leaveTypeId,
            startDate,
            endDate,
            duration,
            daysRequested,
            reason: reason || null,
            attachmentUrl,
            attachmentName,
            requestedById: actorEmployeeId,
          },
          include: requestInclude,
        });

        await tx.leaveBalance.update({
          where: { id: balance.id },
          data: {
            pending: roundLeaveDays(pending + daysRequested),
          },
        });

        return requestRow;
      });

      await recordAuditLog({
        actor: {
          employeeId: actorEmployeeId,
          authUserId: currentUser.user.id,
        },
        action: "HR_LEAVE_REQUESTED",
        entityType: "LEAVE_REQUEST",
        entityId: created.id,
        metadata: {
          employeeId,
          leaveTypeId,
          daysRequested,
          startDate: startRaw,
          endDate: endRaw,
        },
      });

      return NextResponse.json(serializeRequest(created), { status: 201 });
    }

    if (mode === "review") {
      if (!permissions.includes("hr.leave.approve")) {
        return apiErrorResponse("ไม่มีสิทธิ์อนุมัติวันลา", 403, "FORBIDDEN");
      }
      const requestId =
        typeof parsed.body.requestId === "string"
          ? parsed.body.requestId.trim()
          : "";
      const decision =
        typeof parsed.body.decision === "string"
          ? parsed.body.decision.trim()
          : "";
      if (!isUuid(requestId) || !["APPROVED", "REJECTED"].includes(decision)) {
        return validationErrorResponse("คำขออนุมัติไม่ถูกต้อง", [
          { path: "decision", message: "ต้องเป็น APPROVED หรือ REJECTED" },
        ]);
      }

      const result = await prisma.$transaction(async (tx) => {
        const existing = await tx.leaveRequest.findUnique({
          where: { id: requestId },
          include: { leaveType: true },
        });
        if (!existing || existing.status !== "PENDING") {
          throw new Error("NOT_FOUND");
        }

        const year = existing.startDate.getUTCFullYear();
        const balance = await ensureBalance(tx, {
          employeeId: existing.employeeId,
          leaveTypeId: existing.leaveTypeId,
          year,
          defaultAllowanceDays: decimalDays(existing.leaveType.defaultAllowanceDays),
        });
        const days = decimalDays(existing.daysRequested);
        const pending = decimalDays(balance.pending);
        const used = decimalDays(balance.used);

        if (decision === "APPROVED") {
          const entitled = decimalDays(balance.entitled);
          const available = availableLeaveDays({
            entitled,
            used,
            pending: roundLeaveDays(pending - days),
          });
          if (days > available + 1e-9) {
            throw new Error("INSUFFICIENT_BALANCE");
          }
          await tx.leaveBalance.update({
            where: { id: balance.id },
            data: {
              pending: roundLeaveDays(Math.max(0, pending - days)),
              used: roundLeaveDays(used + days),
            },
          });
          await applyApprovedLeaveEffects(tx, {
            employeeId: existing.employeeId,
            startDate: existing.startDate,
            endDate: existing.endDate,
            duration: existing.duration,
            leaveTypeName: existing.leaveType.name,
          });
        } else {
          await tx.leaveBalance.update({
            where: { id: balance.id },
            data: {
              pending: roundLeaveDays(Math.max(0, pending - days)),
            },
          });
        }

        return tx.leaveRequest.update({
          where: { id: requestId },
          data: {
            status: decision as "APPROVED" | "REJECTED",
            reviewedById: actorEmployeeId,
            reviewedAt: new Date(),
            reviewNote:
              typeof parsed.body.reviewNote === "string"
                ? parsed.body.reviewNote.trim() || null
                : null,
          },
          include: requestInclude,
        });
      });

      await recordAuditLog({
        actor: {
          employeeId: actorEmployeeId,
          authUserId: currentUser.user.id,
        },
        action: "HR_LEAVE_REVIEWED",
        entityType: "LEAVE_REQUEST",
        entityId: result.id,
        metadata: { decision },
      });

      return NextResponse.json(serializeRequest(result));
    }

    if (mode === "cancel") {
      const requestId =
        typeof parsed.body.requestId === "string"
          ? parsed.body.requestId.trim()
          : "";
      if (!isUuid(requestId)) {
        return validationErrorResponse("รหัสคำขอไม่ถูกต้อง", [
          { path: "requestId", message: "UUID ไม่ถูกต้อง" },
        ]);
      }

      const result = await prisma.$transaction(async (tx) => {
        const existing = await tx.leaveRequest.findUnique({
          where: { id: requestId },
          include: { leaveType: true },
        });
        if (!existing || existing.status !== "PENDING") {
          throw new Error("NOT_FOUND");
        }
        const canCancel =
          existing.requestedById === actorEmployeeId ||
          existing.employeeId === actorEmployeeId ||
          permissions.includes("hr.leave.approve");
        if (!canCancel) {
          throw new Error("FORBIDDEN");
        }

        const year = existing.startDate.getUTCFullYear();
        const balance = await ensureBalance(tx, {
          employeeId: existing.employeeId,
          leaveTypeId: existing.leaveTypeId,
          year,
          defaultAllowanceDays: decimalDays(existing.leaveType.defaultAllowanceDays),
        });
        const days = decimalDays(existing.daysRequested);
        const pending = decimalDays(balance.pending);
        await tx.leaveBalance.update({
          where: { id: balance.id },
          data: {
            pending: roundLeaveDays(Math.max(0, pending - days)),
          },
        });

        return tx.leaveRequest.update({
          where: { id: requestId },
          data: { status: "CANCELLED" },
          include: requestInclude,
        });
      });

      await recordAuditLog({
        actor: {
          employeeId: actorEmployeeId,
          authUserId: currentUser.user.id,
        },
        action: "HR_LEAVE_CANCELLED",
        entityType: "LEAVE_REQUEST",
        entityId: result.id,
      });

      return NextResponse.json(serializeRequest(result));
    }

    return apiErrorResponse("mode ไม่รองรับ", 400, "INVALID_MODE");
  } catch (error) {
    const message = error instanceof Error ? error.message : "";
    if (message === "LEAVE_OVERLAP") {
      return apiErrorResponse("ช่วงลาซ้อนกับคำขอที่มีอยู่", 409, "CONFLICT");
    }
    if (message === "INSUFFICIENT_BALANCE") {
      return apiErrorResponse("สิทธิวันลาไม่พอ", 409, "INSUFFICIENT_BALANCE");
    }
    if (message === "NOT_FOUND") {
      return apiErrorResponse("ไม่พบคำขอที่รออนุมัติ", 404, "NOT_FOUND");
    }
    if (message === "FORBIDDEN") {
      return apiErrorResponse("ไม่มีสิทธิ์ยกเลิกคำขอนี้", 403, "FORBIDDEN");
    }
    console.error("POST /api/hr/leave-requests failed", error);
    return apiErrorResponse("ไม่สามารถบันทึกคำขอลาได้", 500, "INTERNAL_ERROR");
  }
}
