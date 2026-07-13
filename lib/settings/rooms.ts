import { RoomStatus } from "@/generated/prisma/client";
import type { Room } from "@/generated/prisma/client";

import type { ValidationIssue } from "@/lib/api/validation";
import type { RoomMasterRecord } from "@/lib/settings/room-master-shared";

export type { RoomMasterRecord } from "@/lib/settings/room-master-shared";
export { roomStatusOptions } from "@/lib/settings/room-master-shared";

const roomStatusSet = new Set<string>(Object.values(RoomStatus));

type RoomWithRelations = Room & {
  zone: { id: string; name: string; isActive: boolean };
  roomType: { id: string; name: string; isActive: boolean };
};

export function serializeRoomMaster(room: RoomWithRelations): RoomMasterRecord {
  return {
    id: room.id,
    number: room.number,
    floor: room.floor,
    status: room.status,
    zone: {
      id: room.zone.id,
      name: room.zone.name,
      isActive: room.zone.isActive,
    },
    roomType: {
      id: room.roomType.id,
      name: room.roomType.name,
      isActive: room.roomType.isActive,
    },
  };
}

type RoomFieldSource = Record<string, unknown>;

function readTrimmedString(
  source: RoomFieldSource,
  key: string,
): string | undefined {
  const value = source[key];
  if (value === undefined) return undefined;
  return typeof value === "string" ? value.trim() : "";
}

function readUuid(
  source: RoomFieldSource,
  key: string,
): string | undefined | null {
  const value = source[key];
  if (value === undefined) return undefined;
  if (typeof value !== "string") return null;
  const trimmed = value.trim();
  return isRoomUuid(trimmed) ? trimmed : null;
}

function readFloor(
  source: RoomFieldSource,
  key: string,
): number | null | undefined {
  const value = source[key];
  if (value === undefined) return undefined;
  if (value === null || value === "") return null;
  const numeric = typeof value === "number" ? value : Number.parseInt(String(value), 10);
  if (!Number.isInteger(numeric)) return null;
  return numeric;
}

function readStatus(
  source: RoomFieldSource,
  key: string,
): RoomStatus | undefined | null {
  const value = source[key];
  if (value === undefined) return undefined;
  if (typeof value !== "string" || !roomStatusSet.has(value)) return null;
  return value as RoomStatus;
}

export type ParsedRoomInput = {
  number?: string;
  floor?: number | null;
  status?: RoomStatus;
  zoneId?: string;
  roomTypeId?: string;
};

export function parseRoomInput(
  body: RoomFieldSource,
  mode: "create" | "update",
): { ok: true; data: ParsedRoomInput } | { ok: false; issues: ValidationIssue[] } {
  const issues: ValidationIssue[] = [];
  const data: ParsedRoomInput = {};

  const number = readTrimmedString(body, "number");
  if (mode === "create" || number !== undefined) {
    if (!number) {
      issues.push({ path: "number", message: "กรุณาระบุเลขห้อง" });
    } else {
      data.number = number;
    }
  }

  if ("floor" in body) {
    const floor = readFloor(body, "floor");
    if (floor === null && body.floor !== null && body.floor !== "") {
      issues.push({ path: "floor", message: "ชั้นต้องเป็นจำนวนเต็ม" });
    } else {
      data.floor = floor;
    }
  }

  const status = readStatus(body, "status");
  if (status === null) {
    issues.push({ path: "status", message: "สถานะห้องไม่ถูกต้อง" });
  } else if (status !== undefined) {
    data.status = status;
  }

  const zoneId = readUuid(body, "zoneId");
  if (mode === "create" || zoneId !== undefined) {
    if (zoneId === undefined && mode === "create") {
      issues.push({ path: "zoneId", message: "กรุณาเลือกโซน" });
    } else if (zoneId === null) {
      issues.push({ path: "zoneId", message: "โซนไม่ถูกต้อง" });
    } else if (zoneId !== undefined) {
      data.zoneId = zoneId;
    }
  }

  const roomTypeId = readUuid(body, "roomTypeId");
  if (mode === "create" || roomTypeId !== undefined) {
    if (roomTypeId === undefined && mode === "create") {
      issues.push({ path: "roomTypeId", message: "กรุณาเลือกประเภทห้อง" });
    } else if (roomTypeId === null) {
      issues.push({ path: "roomTypeId", message: "ประเภทห้องไม่ถูกต้อง" });
    } else if (roomTypeId !== undefined) {
      data.roomTypeId = roomTypeId;
    }
  }

  if (mode === "update" && Object.keys(data).length === 0) {
    issues.push({ path: "body", message: "ไม่มีข้อมูลที่จะอัปเดต" });
  }

  if (issues.length) {
    return { ok: false, issues };
  }

  return { ok: true, data };
}

export function isRoomUuid(value: string): boolean {
  return /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(
    value,
  );
}

export async function validateRoomRelationIds(
  zoneId: string,
  roomTypeId: string,
  load: {
    zone: { findUnique(args: { where: { id: string } }): Promise<{ id: string; isActive: boolean } | null> };
    roomType: { findUnique(args: { where: { id: string } }): Promise<{ id: string; isActive: boolean } | null> };
  },
): Promise<ValidationIssue[]> {
  const issues: ValidationIssue[] = [];
  const [zone, roomType] = await Promise.all([
    load.zone.findUnique({ where: { id: zoneId } }),
    load.roomType.findUnique({ where: { id: roomTypeId } }),
  ]);

  if (!zone) {
    issues.push({ path: "zoneId", message: "ไม่พบโซนที่เลือก" });
  } else if (!zone.isActive) {
    issues.push({ path: "zoneId", message: "โซนนี้ปิดใช้งานอยู่" });
  }

  if (!roomType) {
    issues.push({ path: "roomTypeId", message: "ไม่พบประเภทห้องที่เลือก" });
  } else if (!roomType.isActive) {
    issues.push({ path: "roomTypeId", message: "ประเภทห้องนี้ปิดใช้งานอยู่" });
  }

  return issues;
}
