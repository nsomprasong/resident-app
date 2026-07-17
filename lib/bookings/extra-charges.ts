import type { ChargeType } from "@/generated/prisma/client";

export type BookingExtraChargeDraft = {
  key: string;
  description: string;
  /** Unit price (บาท / หน่วย) */
  amount: number;
  quantity: number;
  type: ChargeType;
  /** Source catalog row when selected from DB templates */
  templateId?: string;
};

export const BOOKING_EXTRA_CHARGE_PRESETS: Array<{
  description: string;
  type: ChargeType;
}> = [
  { description: "ค่าทำความสะอาด", type: "CLEANING" },
  { description: "ค่าแก๊ส", type: "OTHER" },
  { description: "ค่าน้ำแข็ง", type: "OTHER" },
  { description: "ค่าถ่าน", type: "OTHER" },
];

const CHARGE_TYPES = new Set<ChargeType>([
  "ROOM",
  "RAFT",
  "FOOD",
  "MINIBAR",
  "DAMAGE",
  "CLEANING",
  "OTHER",
  "SUPERMARKET",
]);

export function createExtraChargeDraft(
  partial?: Partial<BookingExtraChargeDraft>,
): BookingExtraChargeDraft {
  return {
    key:
      partial?.key ??
      `chg-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
    description: partial?.description ?? "",
    amount: partial?.amount ?? 0,
    quantity: partial?.quantity ?? 1,
    type: partial?.type ?? "OTHER",
    ...(partial?.templateId ? { templateId: partial.templateId } : {}),
  };
}

export function extraChargeLineTotal(item: {
  amount: number;
  quantity: number;
}) {
  const unit = Number.isFinite(item.amount) ? item.amount : 0;
  const quantity = Number.isFinite(item.quantity)
    ? Math.max(0, item.quantity)
    : 0;
  return unit * quantity;
}

export function formatExtraChargeDescription(
  description: string,
  quantity: number,
) {
  const qty = Number.isFinite(quantity) ? Math.max(1, Math.floor(quantity)) : 1;
  const name = description.trim();
  return qty > 1 ? `${name} x${qty}` : name;
}

export function parseBookingExtraCharges(
  value: unknown,
  path: string,
):
  | {
      ok: true;
      charges: Array<{ description: string; amount: number; type: ChargeType }>;
    }
  | { ok: false; issues: Array<{ path: string; message: string }> } {
  if (value === undefined) {
    return { ok: true, charges: [] };
  }
  if (!Array.isArray(value)) {
    return {
      ok: false,
      issues: [{ path, message: "Extra charges must be an array" }],
    };
  }

  const charges: Array<{
    description: string;
    amount: number;
    type: ChargeType;
  }> = [];
  const issues: Array<{ path: string; message: string }> = [];

  value.forEach((entry, index) => {
    if (typeof entry !== "object" || entry === null || Array.isArray(entry)) {
      issues.push({
        path: `${path}.${index}`,
        message: "Charge entry must be an object",
      });
      return;
    }
    const record = entry as Record<string, unknown>;
    const description =
      typeof record.description === "string" ? record.description.trim() : "";
    const unitPrice = Number(
      record.unitPrice !== undefined ? record.unitPrice : record.amount,
    );
    const quantityRaw =
      record.quantity === undefined ? 1 : Number(record.quantity);
    const typeRaw =
      typeof record.type === "string"
        ? record.type.trim().toUpperCase()
        : "OTHER";
    const type = (
      CHARGE_TYPES.has(typeRaw as ChargeType) ? typeRaw : null
    ) as ChargeType | null;

    if (
      !description &&
      (!Number.isFinite(unitPrice) || unitPrice === 0) &&
      (!Number.isFinite(quantityRaw) || quantityRaw <= 1)
    ) {
      return;
    }
    if (!description) {
      issues.push({
        path: `${path}.${index}.description`,
        message: "Description is required",
      });
    }
    if (!Number.isFinite(unitPrice) || unitPrice < 0) {
      issues.push({
        path: `${path}.${index}.amount`,
        message: "Amount must be 0 or greater",
      });
    }
    if (
      !Number.isFinite(quantityRaw) ||
      quantityRaw <= 0 ||
      !Number.isInteger(quantityRaw)
    ) {
      issues.push({
        path: `${path}.${index}.quantity`,
        message: "Quantity must be a positive integer",
      });
    }
    if (!type) {
      issues.push({
        path: `${path}.${index}.type`,
        message: "Charge type is invalid",
      });
    }

    const quantity = Number.isFinite(quantityRaw)
      ? Math.floor(quantityRaw)
      : 0;
    const lineAmount =
      Number.isFinite(unitPrice) && quantity > 0 ? unitPrice * quantity : 0;

    if (description && lineAmount > 0 && type && quantity > 0) {
      charges.push({
        description: formatExtraChargeDescription(description, quantity),
        amount: lineAmount,
        type,
      });
    }
  });

  if (issues.length) return { ok: false, issues };
  return { ok: true, charges };
}
