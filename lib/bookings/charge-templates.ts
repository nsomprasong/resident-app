import type { ChargeType, Prisma } from "@/generated/prisma/client";

import { BOOKING_EXTRA_CHARGE_PRESETS } from "@/lib/bookings/extra-charges";

export type BookingChargeTemplateRecord = {
  id: string;
  name: string;
  type: ChargeType;
  defaultAmount: number;
  isActive: boolean;
  sortOrder: number;
};

export function serializeBookingChargeTemplate(row: {
  id: string;
  name: string;
  type: ChargeType;
  defaultAmount: Prisma.Decimal | number | string;
  isActive: boolean;
  sortOrder: number;
}): BookingChargeTemplateRecord {
  return {
    id: row.id,
    name: row.name,
    type: row.type,
    defaultAmount: Number(row.defaultAmount),
    isActive: row.isActive,
    sortOrder: row.sortOrder,
  };
}

export function parseBookingChargeTemplateInput(body: Record<string, unknown>) {
  const issues: Array<{ path: string; message: string }> = [];
  const name = typeof body.name === "string" ? body.name.trim() : "";
  const amount = Number(body.defaultAmount ?? body.amount);
  const typeRaw =
    typeof body.type === "string" ? body.type.trim().toUpperCase() : "OTHER";
  const allowed = new Set(BOOKING_EXTRA_CHARGE_PRESETS.map((p) => p.type).concat([
    "OTHER",
    "CLEANING",
    "DAMAGE",
    "FOOD",
    "MINIBAR",
    "ROOM",
    "RAFT",
    "SUPERMARKET",
  ]));
  const type = allowed.has(typeRaw as ChargeType)
    ? (typeRaw as ChargeType)
    : null;
  const isActive =
    body.isActive === undefined
      ? true
      : typeof body.isActive === "boolean"
        ? body.isActive
        : null;

  if (!name) {
    issues.push({ path: "name", message: "Name is required" });
  }
  if (!Number.isFinite(amount) || amount < 0) {
    issues.push({
      path: "defaultAmount",
      message: "defaultAmount must be 0 or greater",
    });
  }
  if (!type) {
    issues.push({ path: "type", message: "type is invalid" });
  }
  if (isActive === null) {
    issues.push({ path: "isActive", message: "isActive must be boolean" });
  }

  if (issues.length) {
    return { ok: false as const, issues };
  }

  return {
    ok: true as const,
    data: {
      name,
      defaultAmount: amount,
      type: type!,
      isActive: isActive!,
    },
  };
}
