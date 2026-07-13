import type { RoomType } from "@/generated/prisma/client";

import type { ValidationIssue } from "@/lib/api/validation";

export type RoomTypeRecord = {
  id: string;
  name: string;
  description: string | null;
  basePrice: number;
  capacity: number;
  bedType: string | null;
  isActive: boolean;
};

export function serializeRoomType(roomType: RoomType): RoomTypeRecord {
  return {
    id: roomType.id,
    name: roomType.name,
    description: roomType.description,
    basePrice: Number(roomType.basePrice),
    capacity: roomType.capacity,
    bedType: roomType.bedType,
    isActive: roomType.isActive,
  };
}

type RoomTypeFieldSource = Record<string, unknown>;

function readTrimmedString(
  source: RoomTypeFieldSource,
  key: string,
): string | undefined {
  const value = source[key];
  if (value === undefined) return undefined;
  return typeof value === "string" ? value.trim() : "";
}

function readBoolean(
  source: RoomTypeFieldSource,
  key: string,
): boolean | undefined {
  const value = source[key];
  if (value === undefined) return undefined;
  return typeof value === "boolean" ? value : undefined;
}

function readPositiveNumber(
  source: RoomTypeFieldSource,
  key: string,
): number | undefined | null {
  const value = source[key];
  if (value === undefined) return undefined;
  const numeric = typeof value === "number" ? value : Number(value);
  if (!Number.isFinite(numeric)) return null;
  return numeric;
}

function readCapacity(
  source: RoomTypeFieldSource,
  key: string,
): number | undefined | null {
  const value = readPositiveNumber(source, key);
  if (value === undefined || value === null) return value;
  if (!Number.isInteger(value) || value < 1) return null;
  return value;
}

export type ParsedRoomTypeInput = {
  name?: string;
  description?: string | null;
  basePrice?: number;
  capacity?: number;
  bedType?: string | null;
  isActive?: boolean;
};

export function parseRoomTypeInput(
  body: RoomTypeFieldSource,
  mode: "create" | "update",
): { ok: true; data: ParsedRoomTypeInput } | { ok: false; issues: ValidationIssue[] } {
  const issues: ValidationIssue[] = [];
  const data: ParsedRoomTypeInput = {};

  const name = readTrimmedString(body, "name");
  if (mode === "create" || name !== undefined) {
    if (!name) {
      issues.push({ path: "name", message: "กรุณาระบุชื่อประเภทห้อง" });
    } else {
      data.name = name;
    }
  }

  if ("description" in body) {
    const description = readTrimmedString(body, "description");
    data.description = description === "" ? null : description ?? null;
  }

  const basePrice = readPositiveNumber(body, "basePrice");
  if (mode === "create" || basePrice !== undefined) {
    if (basePrice === undefined && mode === "create") {
      issues.push({ path: "basePrice", message: "กรุณาระบุราคา" });
    } else if (basePrice === null || (basePrice !== undefined && basePrice < 0)) {
      issues.push({ path: "basePrice", message: "ราคาต้องเป็นตัวเลขที่ไม่ติดลบ" });
    } else if (basePrice !== undefined) {
      data.basePrice = basePrice;
    }
  }

  const capacity = readCapacity(body, "capacity");
  if (mode === "create" || capacity !== undefined) {
    if (capacity === undefined && mode === "create") {
      issues.push({ path: "capacity", message: "กรุณาระบุจำนวนผู้เข้าพัก" });
    } else if (capacity === null) {
      issues.push({
        path: "capacity",
        message: "จำนวนผู้เข้าพักต้องเป็นจำนวนเต็มอย่างน้อย 1",
      });
    } else if (capacity !== undefined) {
      data.capacity = capacity;
    }
  }

  if ("bedType" in body) {
    const bedType = readTrimmedString(body, "bedType");
    data.bedType = bedType === "" ? null : bedType ?? null;
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

export function isUuid(value: string): boolean {
  return /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(
    value,
  );
}
