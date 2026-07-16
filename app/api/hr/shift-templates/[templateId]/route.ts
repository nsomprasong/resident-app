import {
  apiErrorResponse,
  readJsonObject,
  validationErrorResponse,
} from "@/lib/api/validation";
import { recordAuditLog } from "@/lib/audit/audit-log";
import { getCurrentUser } from "@/lib/auth/current-user";
import {
  parseShiftTemplateInput,
  serializeShiftTemplate,
} from "@/lib/hr/shift-templates";
import {
  rematerializeSchedulesFromEffectiveDate,
  resolveShiftTimesForDate,
  syncTemplateTimesAsOfToday,
  upsertShiftTimePeriod,
} from "@/lib/hr/shift-time-periods";
import { prisma } from "@/lib/prisma";
import { NextRequest, NextResponse } from "next/server";

const templateInclude = {
  _count: { select: { memberships: true } },
  timePeriods: {
    orderBy: { effectiveFrom: "asc" as const },
  },
  memberships: {
    orderBy: { createdAt: "asc" as const },
    include: {
      employee: {
        select: {
          id: true,
          name: true,
          firstName: true,
          lastName: true,
          nickname: true,
          email: true,
          employeeCode: true,
        },
      },
    },
  },
} as const;

export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ templateId: string }> },
) {
  try {
    const { templateId } = await params;
    const currentUser = await getCurrentUser();
    const parsed = await readJsonObject(request);
    if (!parsed.ok) return parsed.response;

    const existing = await prisma.shiftTemplate.findUnique({
      where: { id: templateId },
    });
    if (!existing) {
      return apiErrorResponse("ไม่พบกะ", 404, "NOT_FOUND");
    }

    const validated = parseShiftTemplateInput(parsed.body, "update");
    if (!validated.ok) {
      return validationErrorResponse("กรุณาตรวจสอบข้อมูลกะ", validated.issues);
    }

    const {
      timeFieldsChanged,
      effectiveFrom,
      startMinutes,
      endMinutes,
      breakMinutes,
      lateGraceMinutes,
      earlyLeaveGraceMinutes,
      ...templatePatch
    } = validated.data;

    let rematerialized = 0;

    if (timeFieldsChanged && effectiveFrom) {
      const baseline =
        (await resolveShiftTimesForDate(templateId, effectiveFrom)) ?? {
          startMinutes: existing.startMinutes,
          endMinutes: existing.endMinutes,
          breakMinutes: existing.breakMinutes,
          lateGraceMinutes: existing.lateGraceMinutes,
          earlyLeaveGraceMinutes: existing.earlyLeaveGraceMinutes,
          effectiveFrom,
        };

      const nextStart = startMinutes ?? baseline.startMinutes;
      const nextEnd = endMinutes ?? baseline.endMinutes;
      const nextBreak = breakMinutes ?? baseline.breakMinutes;
      const nextLate = lateGraceMinutes ?? baseline.lateGraceMinutes;
      const nextEarly =
        earlyLeaveGraceMinutes ?? baseline.earlyLeaveGraceMinutes;

      if (nextStart === nextEnd) {
        return validationErrorResponse("กรุณาตรวจสอบข้อมูลกะ", [
          {
            path: "endTime",
            message: "เวลาสิ้นสุดต้องไม่เท่ากับเวลาเริ่ม",
          },
        ]);
      }

      await upsertShiftTimePeriod({
        shiftTemplateId: templateId,
        effectiveFrom,
        startMinutes: nextStart,
        endMinutes: nextEnd,
        breakMinutes: nextBreak,
        lateGraceMinutes: nextLate,
        earlyLeaveGraceMinutes: nextEarly,
      });

      rematerialized = await rematerializeSchedulesFromEffectiveDate({
        shiftTemplateId: templateId,
        effectiveFrom,
        startMinutes: nextStart,
        endMinutes: nextEnd,
      });

      await syncTemplateTimesAsOfToday(templateId);
    }

    const metaPatch = Object.fromEntries(
      Object.entries(templatePatch).filter(([, value]) => value !== undefined),
    );

    if (Object.keys(metaPatch).length > 0) {
      await prisma.shiftTemplate.update({
        where: { id: templateId },
        data: metaPatch,
      });
    }

    const updated = await prisma.shiftTemplate.findUniqueOrThrow({
      where: { id: templateId },
      include: templateInclude,
    });

    await recordAuditLog({
      actor: {
        employeeId: currentUser?.employee?.id,
        authUserId: currentUser?.user.id,
      },
      action: "HR_SHIFT_TEMPLATE_UPDATED",
      entityType: "SHIFT_TEMPLATE",
      entityId: updated.id,
      metadata: {
        fields: Object.keys(validated.data),
        effectiveFrom: effectiveFrom?.toISOString().slice(0, 10) ?? null,
        rematerializedSchedules: rematerialized,
      },
    });

    return NextResponse.json(serializeShiftTemplate(updated));
  } catch (error) {
    console.error("PATCH /api/hr/shift-templates/[id] failed", error);
    return apiErrorResponse("ไม่สามารถบันทึกกะได้", 500, "INTERNAL_ERROR");
  }
}

export async function DELETE(
  _: NextRequest,
  { params }: { params: Promise<{ templateId: string }> },
) {
  try {
    const { templateId } = await params;
    const currentUser = await getCurrentUser();

    const existing = await prisma.shiftTemplate.findUnique({
      where: { id: templateId },
      select: {
        id: true,
        name: true,
        _count: {
          select: {
            memberships: true,
            schedules: true,
            defaultForEmployees: true,
          },
        },
      },
    });
    if (!existing) {
      return apiErrorResponse("ไม่พบกะ", 404, "NOT_FOUND");
    }

    if (existing._count.memberships > 0) {
      return apiErrorResponse(
        `ไม่สามารถลบกะได้ เพราะยังมีสมาชิก ${existing._count.memberships} คน — ให้ถอดสมาชิกออกก่อน`,
        409,
        "HAS_MEMBERS",
      );
    }

    await prisma.shiftTemplate.delete({ where: { id: templateId } });

    await recordAuditLog({
      actor: {
        employeeId: currentUser?.employee?.id,
        authUserId: currentUser?.user.id,
      },
      action: "HR_SHIFT_TEMPLATE_DELETED",
      entityType: "SHIFT_TEMPLATE",
      entityId: existing.id,
      metadata: {
        name: existing.name,
        schedulesCleared: existing._count.schedules,
        employeesClearedDefault: existing._count.defaultForEmployees,
      },
    });

    return NextResponse.json({ ok: true });
  } catch (error) {
    console.error("DELETE /api/hr/shift-templates/[id] failed", error);
    return apiErrorResponse("ไม่สามารถลบกะได้", 500, "INTERNAL_ERROR");
  }
}
