import type { Zone } from "@/generated/prisma/client";

import type { ValidationIssue } from "@/lib/api/validation";

export type ZoneRecord = {
  id: string;
  name: string;
  isActive: boolean;
  roomCount: number;
};

type ZoneWithCount = Zone & {
  _count: { rooms: number };
};

export function serializeZone(zone: ZoneWithCount): ZoneRecord {
  return {
    id: zone.id,
    name: zone.name,
    isActive: zone.isActive,
    roomCount: zone._count.rooms,
  };
}

type ZoneFieldSource = Record<string, unknown>;

function readTrimmedString(
  source: ZoneFieldSource,
  key: string,
): string | undefined {
  const value = source[key];
  if (value === undefined) return undefined;
  return typeof value === "string" ? value.trim() : "";
}

function readBoolean(
  source: ZoneFieldSource,
  key: string,
): boolean | undefined {
  const value = source[key];
  if (value === undefined) return undefined;
  return typeof value === "boolean" ? value : undefined;
}

export type ParsedZoneInput = {
  name?: string;
  isActive?: boolean;
};

export function parseZoneInput(
  body: ZoneFieldSource,
  mode: "create" | "update",
): { ok: true; data: ParsedZoneInput } | { ok: false; issues: ValidationIssue[] } {
  const issues: ValidationIssue[] = [];
  const data: ParsedZoneInput = {};

  const name = readTrimmedString(body, "name");
  if (mode === "create" || name !== undefined) {
    if (!name) {
      issues.push({ path: "name", message: "กรุณาระบุชื่อโซนหรืออาคาร" });
    } else {
      data.name = name;
    }
  }

  const isActive = readBoolean(body, "isActive");
  if (isActive !== undefined) {
    data.isActive = isActive;
  }

  if (mode === "update" && Object.keys(data).length === 0) {
    issues.push({ path: "body", message: "ไม่มีข้อมูลที่จะอัปเดต" });
  }

  if (issues.length) {
    return { ok: false, issues };
  }

  return { ok: true, data };
}

export function isZoneUuid(value: string): boolean {
  return /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(
    value,
  );
}
