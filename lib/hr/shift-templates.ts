import type { ShiftTemplate } from "@/generated/prisma/client";

import type { ValidationIssue } from "@/lib/api/validation";
import {
  formatMinutesAsTime,
  parseTimeToMinutes,
} from "@/lib/hr/schedules";

export type ShiftTemplateRecord = {
  id: string;
  code: string | null;
  name: string;
  startMinutes: number;
  endMinutes: number;
  startTime: string;
  endTime: string;
  breakMinutes: number;
  requiredHeadcount: number;
  color: string | null;
  isActive: boolean;
};

export function serializeShiftTemplate(
  template: ShiftTemplate,
): ShiftTemplateRecord {
  return {
    id: template.id,
    code: template.code,
    name: template.name,
    startMinutes: template.startMinutes,
    endMinutes: template.endMinutes,
    startTime: formatMinutesAsTime(template.startMinutes),
    endTime: formatMinutesAsTime(template.endMinutes),
    breakMinutes: template.breakMinutes,
    requiredHeadcount: template.requiredHeadcount,
    color: template.color,
    isActive: template.isActive,
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
  requiredHeadcount?: number;
  color?: string | null;
  isActive?: boolean;
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

  if (issues.length) return { ok: false, issues };
  return { ok: true, data };
}
