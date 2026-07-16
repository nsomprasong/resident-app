import type { ShiftTemplate } from "@/generated/prisma/client";

import type { ValidationIssue } from "@/lib/api/validation";
import {
  formatMinutesAsTime,
  parseDateKey,
  parseTimeToMinutes,
} from "@/lib/hr/schedules";
import {
  resolveTimePeriodFromList,
  todayKeyAsiaBangkok,
} from "@/lib/hr/shift-time-period-resolve";

export type ShiftTimePeriodRecord = {
  effectiveFrom: string;
  startTime: string;
  endTime: string;
  breakMinutes: number;
};

export type ShiftTemplateRecord = {
  id: string;
  code: string | null;
  name: string;
  startMinutes: number;
  endMinutes: number;
  startTime: string;
  endTime: string;
  breakMinutes: number;
  lateGraceMinutes: number;
  earlyLeaveGraceMinutes: number;
  requiredHeadcount: number;
  color: string | null;
  isActive: boolean;
  memberCount: number;
  /** Next change after today, if any. */
  pendingChange: ShiftTimePeriodRecord | null;
  timePeriods?: ShiftTimePeriodRecord[];
  members?: Array<{
    id: string;
    employeeId: string;
    employeeName: string;
    employeeCode: string | null;
  }>;
};

type PeriodRow = {
  effectiveFrom: Date;
  startMinutes: number;
  endMinutes: number;
  breakMinutes: number;
  lateGraceMinutes: number;
  earlyLeaveGraceMinutes: number;
};

function dateOnlyIso(value: Date): string {
  return value.toISOString().slice(0, 10);
}

export function serializeShiftTemplate(
  template: ShiftTemplate & {
    _count?: { memberships?: number };
    timePeriods?: PeriodRow[];
    memberships?: Array<{
      id: string;
      employeeId: string;
      employee: {
        id: string;
        name: string;
        firstName: string | null;
        lastName: string | null;
        nickname: string | null;
        email: string | null;
        employeeCode: string | null;
      };
    }>;
  },
): ShiftTemplateRecord {
  const members = template.memberships?.map((membership) => {
    const employee = membership.employee;
    const fromParts = [employee.firstName, employee.lastName]
      .filter(Boolean)
      .join(" ")
      .trim();
    return {
      id: membership.id,
      employeeId: membership.employeeId,
      employeeName: fromParts || employee.name,
      employeeCode: employee.employeeCode,
    };
  });

  const today = parseDateKey(todayKeyAsiaBangkok())!;
  const periods = template.timePeriods ?? [];
  const current =
    resolveTimePeriodFromList(periods, today) ??
    ({
      startMinutes: template.startMinutes,
      endMinutes: template.endMinutes,
      breakMinutes: template.breakMinutes,
      lateGraceMinutes: template.lateGraceMinutes,
      earlyLeaveGraceMinutes: template.earlyLeaveGraceMinutes,
      effectiveFrom: today,
    } as const);

  const todayKey = dateOnlyIso(today);
  const pending = periods
    .filter((period) => dateOnlyIso(period.effectiveFrom) > todayKey)
    .sort(
      (a, b) =>
        dateOnlyIso(a.effectiveFrom).localeCompare(dateOnlyIso(b.effectiveFrom)),
    )[0];

  return {
    id: template.id,
    code: template.code,
    name: template.name,
    startMinutes: current.startMinutes,
    endMinutes: current.endMinutes,
    startTime: formatMinutesAsTime(current.startMinutes),
    endTime: formatMinutesAsTime(current.endMinutes),
    breakMinutes: current.breakMinutes,
    lateGraceMinutes: current.lateGraceMinutes,
    earlyLeaveGraceMinutes: current.earlyLeaveGraceMinutes,
    requiredHeadcount: template.requiredHeadcount,
    color: template.color,
    isActive: template.isActive,
    memberCount: template._count?.memberships ?? members?.length ?? 0,
    pendingChange: pending
      ? {
          effectiveFrom: dateOnlyIso(pending.effectiveFrom),
          startTime: formatMinutesAsTime(pending.startMinutes),
          endTime: formatMinutesAsTime(pending.endMinutes),
          breakMinutes: pending.breakMinutes,
        }
      : null,
    timePeriods: periods
      .slice()
      .sort((a, b) =>
        dateOnlyIso(a.effectiveFrom).localeCompare(dateOnlyIso(b.effectiveFrom)),
      )
      .map((period) => ({
        effectiveFrom: dateOnlyIso(period.effectiveFrom),
        startTime: formatMinutesAsTime(period.startMinutes),
        endTime: formatMinutesAsTime(period.endMinutes),
        breakMinutes: period.breakMinutes,
      })),
    members,
  };
}

type FieldSource = Record<string, unknown>;

function readTrimmed(source: FieldSource, key: string): string | undefined {
  const value = source[key];
  if (value === undefined) return undefined;
  return typeof value === "string" ? value.trim() : "";
}

export type ParsedShiftTemplateInput = {
  code?: string | null;
  name?: string;
  startMinutes?: number;
  endMinutes?: number;
  breakMinutes?: number;
  lateGraceMinutes?: number;
  earlyLeaveGraceMinutes?: number;
  requiredHeadcount?: number;
  color?: string | null;
  isActive?: boolean;
  /** Required when updating time-related fields. */
  effectiveFrom?: Date;
  timeFieldsChanged?: boolean;
};

export function parseShiftTemplateInput(
  body: FieldSource,
  mode: "create" | "update",
):
  | { ok: true; data: ParsedShiftTemplateInput }
  | { ok: false; issues: ValidationIssue[] } {
  const issues: ValidationIssue[] = [];
  const data: ParsedShiftTemplateInput = {};

  const name = readTrimmed(body, "name");
  if (mode === "create" || name !== undefined) {
    if (!name) issues.push({ path: "name", message: "กรุณาระบุชื่อกะ" });
    else if (name.length > 80)
      issues.push({ path: "name", message: "ชื่อกะยาวเกินไป" });
    else data.name = name;
  }

  if ("code" in body) {
    const code = readTrimmed(body, "code");
    data.code = code ? code.toUpperCase() : null;
  }

  const startTime = readTrimmed(body, "startTime");
  const endTime = readTrimmed(body, "endTime");
  if (mode === "create" || startTime !== undefined || endTime !== undefined) {
    const startMinutes =
      startTime !== undefined ? parseTimeToMinutes(startTime ?? "") : undefined;
    const endMinutes =
      endTime !== undefined ? parseTimeToMinutes(endTime ?? "") : undefined;
    if (mode === "create") {
      if (startMinutes === null || startMinutes === undefined) {
        issues.push({ path: "startTime", message: "เวลาเริ่มไม่ถูกต้อง (HH:mm)" });
      } else data.startMinutes = startMinutes;
      if (endMinutes === null || endMinutes === undefined) {
        issues.push({ path: "endTime", message: "เวลาสิ้นสุดไม่ถูกต้อง (HH:mm)" });
      } else data.endMinutes = endMinutes;
      if (
        data.startMinutes !== undefined &&
        data.endMinutes !== undefined &&
        data.startMinutes === data.endMinutes
      ) {
        issues.push({
          path: "endTime",
          message: "เวลาสิ้นสุดต้องไม่เท่ากับเวลาเริ่ม",
        });
      }
    } else {
      if (startTime !== undefined) {
        if (startMinutes === null)
          issues.push({ path: "startTime", message: "เวลาเริ่มไม่ถูกต้อง (HH:mm)" });
        else data.startMinutes = startMinutes ?? undefined;
      }
      if (endTime !== undefined) {
        if (endMinutes === null)
          issues.push({ path: "endTime", message: "เวลาสิ้นสุดไม่ถูกต้อง (HH:mm)" });
        else data.endMinutes = endMinutes ?? undefined;
      }
    }
  }

  if ("breakMinutes" in body) {
    const value = Number(body.breakMinutes);
    if (!Number.isInteger(value) || value < 0 || value > 12 * 60) {
      issues.push({ path: "breakMinutes", message: "นาทีพักไม่ถูกต้อง" });
    } else data.breakMinutes = value;
  } else if (mode === "create") {
    data.breakMinutes = 0;
  }

  if ("lateGraceMinutes" in body) {
    const value = Number(body.lateGraceMinutes);
    if (!Number.isInteger(value) || value < 0 || value > 240) {
      issues.push({ path: "lateGraceMinutes", message: "นาทีอนุโลมสายไม่ถูกต้อง" });
    } else data.lateGraceMinutes = value;
  } else if (mode === "create") {
    data.lateGraceMinutes = 0;
  }

  if ("earlyLeaveGraceMinutes" in body) {
    const value = Number(body.earlyLeaveGraceMinutes);
    if (!Number.isInteger(value) || value < 0 || value > 240) {
      issues.push({
        path: "earlyLeaveGraceMinutes",
        message: "นาทีอนุโลมออกก่อนไม่ถูกต้อง",
      });
    } else data.earlyLeaveGraceMinutes = value;
  } else if (mode === "create") {
    data.earlyLeaveGraceMinutes = 0;
  }

  if ("requiredHeadcount" in body || mode === "create") {
    const value =
      "requiredHeadcount" in body
        ? Number(body.requiredHeadcount)
        : 1;
    if (!Number.isInteger(value) || value < 1 || value > 100) {
      issues.push({
        path: "requiredHeadcount",
        message: "จำนวนคนที่ต้องการต้องเป็นจำนวนเต็ม 1–100",
      });
    } else data.requiredHeadcount = value;
  }

  if ("color" in body) {
    const color = readTrimmed(body, "color");
    data.color = color || null;
  }

  if ("isActive" in body) {
    if (typeof body.isActive !== "boolean") {
      issues.push({ path: "isActive", message: "isActive ต้องเป็น boolean" });
    } else data.isActive = body.isActive;
  } else if (mode === "create") {
    data.isActive = true;
  }

  const timeFieldsChanged =
    data.startMinutes !== undefined ||
    data.endMinutes !== undefined ||
    data.breakMinutes !== undefined ||
    data.lateGraceMinutes !== undefined ||
    data.earlyLeaveGraceMinutes !== undefined;
  data.timeFieldsChanged = timeFieldsChanged;

  if (mode === "update" && timeFieldsChanged) {
    const effectiveFromRaw = readTrimmed(body, "effectiveFrom");
    const effectiveFrom = effectiveFromRaw
      ? parseDateKey(effectiveFromRaw)
      : null;
    if (!effectiveFrom) {
      issues.push({
        path: "effectiveFrom",
        message: "กรุณาระบุวันที่มีผลเมื่อแก้ไขเวลา",
      });
    } else {
      data.effectiveFrom = effectiveFrom;
    }
  }

  if (issues.length) return { ok: false, issues };
  return { ok: true, data };
}
