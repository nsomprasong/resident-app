import type { HrAttendanceSetting } from "@/generated/prisma/client";

import type { ValidationIssue } from "@/lib/api/validation";
import { validateCoordinates } from "@/lib/hr/geo";
import { prisma } from "@/lib/prisma";

const SETTINGS_ID = "default";

export type HrAttendanceSettingRecord = {
  latitude: number;
  longitude: number;
  radiusMeters: number;
  maxAccuracyMeters: number;
  timezone: string;
  allowClockWithoutSchedule: boolean;
  updatedAt: string;
};

export function serializeAttendanceSetting(
  setting: HrAttendanceSetting,
): HrAttendanceSettingRecord {
  return {
    latitude: Number(setting.latitude),
    longitude: Number(setting.longitude),
    radiusMeters: setting.radiusMeters,
    maxAccuracyMeters: setting.maxAccuracyMeters,
    timezone: setting.timezone,
    allowClockWithoutSchedule: setting.allowClockWithoutSchedule,
    updatedAt: setting.updatedAt.toISOString(),
  };
}

/** Read the singleton geofence/attendance settings row, creating defaults if missing. */
export async function getAttendanceSetting(): Promise<HrAttendanceSetting> {
  return prisma.hrAttendanceSetting.upsert({
    where: { id: SETTINGS_ID },
    update: {},
    create: {
      id: SETTINGS_ID,
      latitude: 0,
      longitude: 0,
      radiusMeters: 50,
      maxAccuracyMeters: 80,
      timezone: "Asia/Bangkok",
      allowClockWithoutSchedule: false,
    },
  });
}

type FieldSource = Record<string, unknown>;

export type ParsedAttendanceSettingInput = {
  latitude?: number;
  longitude?: number;
  radiusMeters?: number;
  maxAccuracyMeters?: number;
  timezone?: string;
  allowClockWithoutSchedule?: boolean;
};

export function parseAttendanceSettingInput(
  body: FieldSource,
):
  | { ok: true; data: ParsedAttendanceSettingInput }
  | { ok: false; issues: ValidationIssue[] } {
  const issues: ValidationIssue[] = [];
  const data: ParsedAttendanceSettingInput = {};

  if ("latitude" in body || "longitude" in body) {
    const latitude = Number(body.latitude);
    const longitude = Number(body.longitude);
    const check = validateCoordinates(latitude, longitude);
    if (!check.ok) {
      issues.push({ path: "latitude", message: check.message });
    } else {
      data.latitude = latitude;
      data.longitude = longitude;
    }
  }

  if ("radiusMeters" in body) {
    const value = Number(body.radiusMeters);
    if (!Number.isFinite(value) || value < 1 || value > 5000) {
      issues.push({ path: "radiusMeters", message: "รัศมีต้องอยู่ระหว่าง 1–5000 เมตร" });
    } else {
      data.radiusMeters = Math.round(value);
    }
  }

  if ("maxAccuracyMeters" in body) {
    const value = Number(body.maxAccuracyMeters);
    if (!Number.isFinite(value) || value < 1 || value > 5000) {
      issues.push({
        path: "maxAccuracyMeters",
        message: "ความแม่นยำ GPS สูงสุดต้องอยู่ระหว่าง 1–5000 เมตร",
      });
    } else {
      data.maxAccuracyMeters = Math.round(value);
    }
  }

  if ("timezone" in body) {
    const value = typeof body.timezone === "string" ? body.timezone.trim() : "";
    if (!value) {
      issues.push({ path: "timezone", message: "กรุณาระบุเขตเวลา" });
    } else {
      data.timezone = value;
    }
  }

  if ("allowClockWithoutSchedule" in body) {
    if (typeof body.allowClockWithoutSchedule !== "boolean") {
      issues.push({
        path: "allowClockWithoutSchedule",
        message: "ต้องเป็น boolean",
      });
    } else {
      data.allowClockWithoutSchedule = body.allowClockWithoutSchedule;
    }
  }

  if (issues.length) return { ok: false, issues };
  return { ok: true, data };
}

export async function upsertAttendanceSetting(
  input: ParsedAttendanceSettingInput,
): Promise<HrAttendanceSetting> {
  return prisma.hrAttendanceSetting.upsert({
    where: { id: SETTINGS_ID },
    update: input,
    create: {
      id: SETTINGS_ID,
      latitude: input.latitude ?? 0,
      longitude: input.longitude ?? 0,
      radiusMeters: input.radiusMeters ?? 50,
      maxAccuracyMeters: input.maxAccuracyMeters ?? 80,
      timezone: input.timezone ?? "Asia/Bangkok",
      allowClockWithoutSchedule: input.allowClockWithoutSchedule ?? false,
    },
  });
}
