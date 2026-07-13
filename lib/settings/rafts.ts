import { RaftStatus } from "@/generated/prisma/client";
import type { Raft } from "@/generated/prisma/client";

import type { ValidationIssue } from "@/lib/api/validation";
import type { RaftMasterRecord } from "@/lib/settings/raft-master-shared";

export type { RaftMasterRecord } from "@/lib/settings/raft-master-shared";
export { raftStatusOptions } from "@/lib/settings/raft-master-shared";

const raftStatusSet = new Set<string>(Object.values(RaftStatus));

export function serializeRaftMaster(raft: Raft): RaftMasterRecord {
  return {
    id: raft.id,
    number: raft.number,
    name: raft.name,
    capacity: raft.capacity,
    basePrice: Number(raft.basePrice),
    status: raft.status,
  };
}

type RaftFieldSource = Record<string, unknown>;

function readTrimmedString(
  source: RaftFieldSource,
  key: string,
): string | undefined {
  const value = source[key];
  if (value === undefined) return undefined;
  return typeof value === "string" ? value.trim() : "";
}

function readPositiveNumber(
  source: RaftFieldSource,
  key: string,
): number | undefined | null {
  const value = source[key];
  if (value === undefined) return undefined;
  const numeric = typeof value === "number" ? value : Number(value);
  if (!Number.isFinite(numeric)) return null;
  return numeric;
}

function readCapacity(
  source: RaftFieldSource,
  key: string,
): number | undefined | null {
  const value = readPositiveNumber(source, key);
  if (value === undefined || value === null) return value;
  if (!Number.isInteger(value) || value < 1) return null;
  return value;
}

function readStatus(
  source: RaftFieldSource,
  key: string,
): RaftStatus | undefined | null {
  const value = source[key];
  if (value === undefined) return undefined;
  if (typeof value !== "string" || !raftStatusSet.has(value)) return null;
  return value as RaftStatus;
}

export type ParsedRaftInput = {
  number?: string;
  name?: string;
  capacity?: number;
  basePrice?: number;
  status?: RaftStatus;
};

export function parseRaftInput(
  body: RaftFieldSource,
  mode: "create" | "update",
): { ok: true; data: ParsedRaftInput } | { ok: false; issues: ValidationIssue[] } {
  const issues: ValidationIssue[] = [];
  const data: ParsedRaftInput = {};

  const number = readTrimmedString(body, "number");
  if (mode === "create" || number !== undefined) {
    if (!number) {
      issues.push({ path: "number", message: "กรุณาระบุหมายเลขแพ" });
    } else {
      data.number = number;
    }
  }

  const name = readTrimmedString(body, "name");
  if (mode === "create" || name !== undefined) {
    if (!name) {
      issues.push({ path: "name", message: "กรุณาระบุชื่อแพ" });
    } else {
      data.name = name;
    }
  }

  const capacity = readCapacity(body, "capacity");
  if (mode === "create" || capacity !== undefined) {
    if (capacity === undefined && mode === "create") {
      issues.push({ path: "capacity", message: "กรุณาระบุความจุ" });
    } else if (capacity === null) {
      issues.push({
        path: "capacity",
        message: "ความจุต้องเป็นจำนวนเต็มอย่างน้อย 1",
      });
    } else if (capacity !== undefined) {
      data.capacity = capacity;
    }
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

  const status = readStatus(body, "status");
  if (status === null) {
    issues.push({ path: "status", message: "สถานะแพไม่ถูกต้อง" });
  } else if (status !== undefined) {
    data.status = status;
  }

  if (mode === "update" && Object.keys(data).length === 0) {
    issues.push({ path: "body", message: "ไม่มีข้อมูลที่จะอัปเดต" });
  }

  if (issues.length) {
    return { ok: false, issues };
  }

  return { ok: true, data };
}

export function isRaftUuid(value: string): boolean {
  return /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(
    value,
  );
}
