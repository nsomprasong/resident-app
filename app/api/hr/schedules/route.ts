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
  addDaysToDateKey,
  buildScheduleRange,
  dateKeyUtc,
  eachDateKey,
  findEmployeeScheduleOverlaps,
  parseDateKey,
} from "@/lib/hr/schedules";
import { understaffedFromMemberships } from "@/lib/hr/shift-memberships";
import { resolveShiftTimesForDate } from "@/lib/hr/shift-time-periods";
import { prisma } from "@/lib/prisma";
import { NextRequest, NextResponse } from "next/server";

const scheduleInclude = {
  employee: {
    select: {
      id: true,
      name: true,
      firstName: true,
      lastName: true,
      employeeCode: true,
    },
  },
  shiftTemplate: {
    select: {
      id: true,
      name: true,
      requiredHeadcount: true,
      color: true,
      startMinutes: true,
      endMinutes: true,
    },
  },
} as const;

function serializeSchedule(schedule: {
  id: string;
  employeeId: string;
  shiftTemplateId: string | null;
  workDate: Date;
  startsAt: Date;
  endsAt: Date;
  isDayOff: boolean;
  notes: string | null;
  status: string;
  employee: {
    id: string;
    name: string;
    firstName: string | null;
    lastName: string | null;
    employeeCode: string | null;
  };
  shiftTemplate: {
    id: string;
    name: string;
    requiredHeadcount: number;
    color: string | null;
    startMinutes: number;
    endMinutes: number;
  } | null;
}) {
  return {
    id: schedule.id,
    employeeId: schedule.employeeId,
    employeeName: displayEmployeeName(schedule.employee),
    employeeCode: schedule.employee.employeeCode,
    shiftTemplateId: schedule.shiftTemplateId,
    shiftName: schedule.shiftTemplate?.name ?? "กำหนดเอง",
    shiftColor: schedule.shiftTemplate?.color ?? null,
    workDate: dateKeyUtc(schedule.workDate),
    startsAt: schedule.startsAt.toISOString(),
    endsAt: schedule.endsAt.toISOString(),
    isDayOff: schedule.isDayOff,
    notes: schedule.notes,
    status: schedule.status,
  };
}

function isUuid(value: string) {
  return /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(
    value,
  );
}

export async function GET(request: NextRequest) {
  try {
    const fromKey = request.nextUrl.searchParams.get("from");
    const toKey = request.nextUrl.searchParams.get("to");
    if (!fromKey || !toKey) {
      return apiErrorResponse("ต้องระบุ from และ to (YYYY-MM-DD)", 400, "VALIDATION_ERROR");
    }
    const from = parseDateKey(fromKey);
    const to = parseDateKey(toKey);
    if (!from || !to || from > to) {
      return apiErrorResponse("ช่วงวันที่ไม่ถูกต้อง", 400, "VALIDATION_ERROR");
    }

    const [schedules, templates, holidays, approvedLeaves] = await Promise.all([
      prisma.workSchedule.findMany({
        where: {
          workDate: { gte: from, lte: to },
          status: "ASSIGNED",
        },
        include: scheduleInclude,
        orderBy: [{ workDate: "asc" }, { startsAt: "asc" }],
      }),
      prisma.shiftTemplate.findMany({
        where: { isActive: true },
        orderBy: [{ startMinutes: "asc" }, { name: "asc" }],
        include: { _count: { select: { memberships: true } } },
      }),
      prisma.holidayCalendar.findMany({
        where: { holidayDate: { gte: from, lte: to } },
        orderBy: { holidayDate: "asc" },
      }),
      prisma.leaveRequest.findMany({
        where: {
          status: "APPROVED",
          startDate: { lte: to },
          endDate: { gte: from },
        },
        include: {
          leaveType: { select: { name: true } },
        },
      }),
    ]);

    const understaffed = understaffedFromMemberships({
      templates: templates.map((template) => ({
        id: template.id,
        name: template.name,
        requiredHeadcount: template.requiredHeadcount,
        isActive: template.isActive,
        memberCount: template._count.memberships,
      })),
    });

    const leaveMarkers: Array<{
      employeeId: string;
      date: string;
      label: string;
      requestId: string;
      duration: string;
    }> = [];
    for (const leave of approvedLeaves) {
      const keys = eachDateKey(dateKeyUtc(leave.startDate), dateKeyUtc(leave.endDate));
      for (const date of keys) {
        if (date < fromKey || date > toKey) continue;
        leaveMarkers.push({
          employeeId: leave.employeeId,
          date,
          label: leave.leaveType.name,
          requestId: leave.id,
          duration: leave.duration,
        });
      }
    }

    return NextResponse.json({
      from: fromKey,
      to: toKey,
      schedules: schedules.map(serializeSchedule),
      holidays: holidays.map((item) => ({
        id: item.id,
        name: item.name,
        holidayDate: dateKeyUtc(item.holidayDate),
        isDayOff: item.isDayOff,
        notes: item.notes,
      })),
      understaffed,
      leaveMarkers,
    });
  } catch (error) {
    console.error("GET /api/hr/schedules failed", error);
    return apiErrorResponse("ไม่สามารถโหลดตารางงานได้", 500, "INTERNAL_ERROR");
  }
}

type AssignBody = {
  employeeId: string;
  shiftTemplateId?: string;
  workDate: string;
  isDayOff?: boolean;
  notes?: string | null;
};

async function createAssignment(input: AssignBody) {
  const workDate = parseDateKey(input.workDate);
  if (!workDate) throw new Error("INVALID_DATE");
  if (!isUuid(input.employeeId)) throw new Error("INVALID_ID");

  const employee = await prisma.employee.findFirst({
    where: {
      id: input.employeeId,
      hrStatus: { in: ["ACTIVE", "PROBATION"] },
    },
    select: { id: true },
  });
  if (!employee) throw new Error("EMPLOYEE_NOT_FOUND");

  if (input.isDayOff) {
    const dayStart = Date.UTC(
      workDate.getUTCFullYear(),
      workDate.getUTCMonth(),
      workDate.getUTCDate(),
    );
    const startsAt = new Date(dayStart);
    const endsAt = new Date(dayStart + 24 * 60 * 60_000);

    const existing = await prisma.workSchedule.findMany({
      where: {
        employeeId: input.employeeId,
        status: "ASSIGNED",
        startsAt: { lt: endsAt },
        endsAt: { gt: startsAt },
      },
    });
    const overlaps = findEmployeeScheduleOverlaps(
      { employeeId: input.employeeId, startsAt, endsAt },
      existing,
    );
    if (overlaps.length) throw new Error("OVERLAP");

    return prisma.workSchedule.create({
      data: {
        employeeId: input.employeeId,
        shiftTemplateId: null,
        workDate,
        startsAt,
        endsAt,
        isDayOff: true,
        notes: input.notes ?? null,
        status: "ASSIGNED",
      },
      include: scheduleInclude,
    });
  }

  if (!input.shiftTemplateId || !isUuid(input.shiftTemplateId)) {
    throw new Error("INVALID_ID");
  }

  const template = await prisma.shiftTemplate.findFirst({
    where: { id: input.shiftTemplateId, isActive: true },
  });
  if (!template) throw new Error("TEMPLATE_NOT_FOUND");

  const times = await resolveShiftTimesForDate(template.id, workDate);
  if (!times) throw new Error("INVALID_RANGE");

  const range = buildScheduleRange(
    workDate,
    times.startMinutes,
    times.endMinutes,
  );
  if (!range) throw new Error("INVALID_RANGE");

  const existing = await prisma.workSchedule.findMany({
    where: {
      employeeId: input.employeeId,
      status: "ASSIGNED",
      startsAt: { lt: range.endsAt },
      endsAt: { gt: range.startsAt },
    },
  });
  const overlaps = findEmployeeScheduleOverlaps(
    {
      employeeId: input.employeeId,
      startsAt: range.startsAt,
      endsAt: range.endsAt,
    },
    existing,
  );
  if (overlaps.length) throw new Error("OVERLAP");

  return prisma.workSchedule.create({
    data: {
      employeeId: input.employeeId,
      shiftTemplateId: template.id,
      workDate,
      startsAt: range.startsAt,
      endsAt: range.endsAt,
      notes: input.notes ?? null,
      status: "ASSIGNED",
    },
    include: scheduleInclude,
  });
}

export async function POST(request: NextRequest) {
  try {
    const currentUser = await getCurrentUser();
    const parsed = await readJsonObject(request);
    if (!parsed.ok) return parsed.response;

    const mode =
      typeof parsed.body.mode === "string" ? parsed.body.mode : "assign";

    if (mode === "assign") {
      const issues: ValidationIssue[] = [];
      const employeeId =
        typeof parsed.body.employeeId === "string"
          ? parsed.body.employeeId.trim()
          : "";
      const shiftTemplateId =
        typeof parsed.body.shiftTemplateId === "string"
          ? parsed.body.shiftTemplateId.trim()
          : "";
      const workDate =
        typeof parsed.body.workDate === "string"
          ? parsed.body.workDate.trim()
          : "";
      const isDayOff = parsed.body.isDayOff === true;
      if (!employeeId) issues.push({ path: "employeeId", message: "ต้องระบุพนักงาน" });
      if (!isDayOff && !shiftTemplateId)
        issues.push({ path: "shiftTemplateId", message: "ต้องระบุกะ" });
      if (!workDate) issues.push({ path: "workDate", message: "ต้องระบุวันที่" });
      if (issues.length) {
        return validationErrorResponse("กรุณาตรวจสอบการจัดตาราง", issues);
      }

      const created = await createAssignment({
        employeeId,
        shiftTemplateId: isDayOff ? undefined : shiftTemplateId,
        workDate,
        isDayOff,
        notes:
          typeof parsed.body.notes === "string" ? parsed.body.notes.trim() : null,
      });

      await recordAuditLog({
        actor: {
          employeeId: currentUser?.employee?.id,
          authUserId: currentUser?.user.id,
        },
        action: "HR_SCHEDULE_ASSIGNED",
        entityType: "WORK_SCHEDULE",
        entityId: created.id,
        metadata: { employeeId, shiftTemplateId: isDayOff ? null : shiftTemplateId, workDate, isDayOff },
      });

      return NextResponse.json(serializeSchedule(created), { status: 201 });
    }

    if (mode === "bulk") {
      const assignments = parsed.body.assignments;
      if (!Array.isArray(assignments) || assignments.length === 0) {
        return validationErrorResponse("กรุณาตรวจสอบการจัดตาราง", [
          { path: "assignments", message: "ต้องมีรายการอย่างน้อย 1 รายการ" },
        ]);
      }
      if (assignments.length > 100) {
        return apiErrorResponse("จัด bulk ได้ครั้งละไม่เกิน 100 รายการ", 400, "TOO_MANY");
      }

      const created = [];
      for (const item of assignments) {
        if (
          typeof item !== "object" ||
          item === null ||
          typeof item.employeeId !== "string" ||
          typeof item.shiftTemplateId !== "string" ||
          typeof item.workDate !== "string"
        ) {
          return validationErrorResponse("กรุณาตรวจสอบการจัดตาราง", [
            { path: "assignments", message: "รูปแบบรายการไม่ถูกต้อง" },
          ]);
        }
        created.push(
          await createAssignment({
            employeeId: item.employeeId.trim(),
            shiftTemplateId: item.shiftTemplateId.trim(),
            workDate: item.workDate.trim(),
            notes:
              typeof item.notes === "string" ? item.notes.trim() : null,
          }),
        );
      }

      await recordAuditLog({
        actor: {
          employeeId: currentUser?.employee?.id,
          authUserId: currentUser?.user.id,
        },
        action: "HR_SCHEDULE_BULK_ASSIGNED",
        entityType: "WORK_SCHEDULE",
        metadata: { count: created.length },
      });

      return NextResponse.json(
        { items: created.map(serializeSchedule), count: created.length },
        { status: 201 },
      );
    }

    if (mode === "copy") {
      const sourceFrom =
        typeof parsed.body.sourceFrom === "string"
          ? parsed.body.sourceFrom.trim()
          : "";
      const sourceTo =
        typeof parsed.body.sourceTo === "string"
          ? parsed.body.sourceTo.trim()
          : "";
      const targetFrom =
        typeof parsed.body.targetFrom === "string"
          ? parsed.body.targetFrom.trim()
          : "";
      if (!sourceFrom || !sourceTo || !targetFrom) {
        return validationErrorResponse("กรุณาตรวจสอบการคัดลอกตาราง", [
          {
            path: "sourceFrom",
            message: "ต้องระบุ sourceFrom, sourceTo, targetFrom",
          },
        ]);
      }
      const sourceStart = parseDateKey(sourceFrom);
      const sourceEnd = parseDateKey(sourceTo);
      const targetStart = parseDateKey(targetFrom);
      if (!sourceStart || !sourceEnd || !targetStart || sourceStart > sourceEnd) {
        return apiErrorResponse("ช่วงวันที่คัดลอกไม่ถูกต้อง", 400, "VALIDATION_ERROR");
      }
      const dayOffset =
        (targetStart.getTime() - sourceStart.getTime()) / (24 * 60 * 60_000);
      if (!Number.isInteger(dayOffset)) {
        return apiErrorResponse("วันเป้าหมายต้องเป็นช่วงเต็มวัน", 400, "VALIDATION_ERROR");
      }

      const source = await prisma.workSchedule.findMany({
        where: {
          workDate: { gte: sourceStart, lte: sourceEnd },
          status: "ASSIGNED",
          shiftTemplateId: { not: null },
        },
      });

      const created = [];
      for (const item of source) {
        const targetDateKey = addDaysToDateKey(
          dateKeyUtc(item.workDate),
          dayOffset,
        );
        if (!targetDateKey || !item.shiftTemplateId) continue;
        try {
          created.push(
            await createAssignment({
              employeeId: item.employeeId,
              shiftTemplateId: item.shiftTemplateId,
              workDate: targetDateKey,
              notes: item.notes,
            }),
          );
        } catch (error) {
          if (error instanceof Error && error.message === "OVERLAP") continue;
          throw error;
        }
      }

      await recordAuditLog({
        actor: {
          employeeId: currentUser?.employee?.id,
          authUserId: currentUser?.user.id,
        },
        action: "HR_SCHEDULE_COPIED",
        entityType: "WORK_SCHEDULE",
        metadata: {
          sourceFrom,
          sourceTo,
          targetFrom,
          created: created.length,
          skipped: source.length - created.length,
        },
      });

      return NextResponse.json({
        items: created.map(serializeSchedule),
        count: created.length,
        skipped: source.length - created.length,
      });
    }

    if (mode === "cancel") {
      const scheduleId =
        typeof parsed.body.scheduleId === "string"
          ? parsed.body.scheduleId.trim()
          : "";
      if (!isUuid(scheduleId)) {
        return validationErrorResponse("กรุณาตรวจสอบการยกเลิก", [
          { path: "scheduleId", message: "รหัสตารางไม่ถูกต้อง" },
        ]);
      }
      const updated = await prisma.workSchedule.update({
        where: { id: scheduleId },
        data: { status: "CANCELLED" },
        include: scheduleInclude,
      });
      await recordAuditLog({
        actor: {
          employeeId: currentUser?.employee?.id,
          authUserId: currentUser?.user.id,
        },
        action: "HR_SCHEDULE_CANCELLED",
        entityType: "WORK_SCHEDULE",
        entityId: updated.id,
      });
      return NextResponse.json(serializeSchedule(updated));
    }

    return apiErrorResponse("mode ไม่รองรับ", 400, "INVALID_MODE");
  } catch (error) {
    const message = error instanceof Error ? error.message : "";
    const map: Record<string, [string, number, string]> = {
      INVALID_DATE: ["วันที่ไม่ถูกต้อง", 400, "VALIDATION_ERROR"],
      INVALID_ID: ["รหัสอ้างอิงไม่ถูกต้อง", 400, "VALIDATION_ERROR"],
      EMPLOYEE_NOT_FOUND: ["ไม่พบพนักงานที่ใช้งานได้", 404, "NOT_FOUND"],
      TEMPLATE_NOT_FOUND: ["ไม่พบกะที่เปิดใช้", 404, "NOT_FOUND"],
      INVALID_RANGE: ["ช่วงเวลากะไม่ถูกต้อง", 400, "VALIDATION_ERROR"],
      OVERLAP: ["พนักงานมีกะซ้อนในช่วงเวลานี้", 409, "OVERLAP"],
    };
    if (map[message]) {
      return apiErrorResponse(map[message][0], map[message][1], map[message][2]);
    }
    console.error("POST /api/hr/schedules failed", error);
    return apiErrorResponse("ไม่สามารถบันทึกตารางงานได้", 500, "INTERNAL_ERROR");
  }
}
