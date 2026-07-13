import { PaymentMethod } from "@/generated/prisma/client";
import type { PaymentChannel } from "@/generated/prisma/client";

import type { ValidationIssue } from "@/lib/api/validation";
import type { PaymentChannelMasterRecord } from "@/lib/settings/payment-channel-shared";

export type { PaymentChannelMasterRecord } from "@/lib/settings/payment-channel-shared";
export { paymentMethodOptions } from "@/lib/settings/payment-channel-shared";

const paymentMethodSet = new Set<string>(Object.values(PaymentMethod));

type ChannelWithCount = PaymentChannel & {
  _count: { payments: number };
};

export function serializePaymentChannelMaster(
  channel: ChannelWithCount,
): PaymentChannelMasterRecord {
  return {
    id: channel.id,
    name: channel.name,
    method: channel.method,
    isActive: channel.isActive,
    paymentCount: channel._count.payments,
  };
}

type FieldSource = Record<string, unknown>;

function readTrimmedString(
  source: FieldSource,
  key: string,
): string | undefined {
  const value = source[key];
  if (value === undefined) return undefined;
  return typeof value === "string" ? value.trim() : "";
}

function readBoolean(
  source: FieldSource,
  key: string,
): boolean | undefined {
  const value = source[key];
  if (value === undefined) return undefined;
  return typeof value === "boolean" ? value : undefined;
}

function readPaymentMethod(
  source: FieldSource,
  key: string,
): PaymentMethod | undefined | null {
  const value = source[key];
  if (value === undefined) return undefined;
  if (typeof value !== "string" || !paymentMethodSet.has(value)) return null;
  return value as PaymentMethod;
}

export type ParsedPaymentChannelInput = {
  name?: string;
  method?: PaymentMethod;
  isActive?: boolean;
};

export function parsePaymentChannelInput(
  body: FieldSource,
  mode: "create" | "update",
):
  | { ok: true; data: ParsedPaymentChannelInput }
  | { ok: false; issues: ValidationIssue[] } {
  const issues: ValidationIssue[] = [];
  const data: ParsedPaymentChannelInput = {};

  const name = readTrimmedString(body, "name");
  if (mode === "create" || name !== undefined) {
    if (!name) {
      issues.push({ path: "name", message: "กรุณาระบุชื่อช่องทางรับชำระ" });
    } else {
      data.name = name;
    }
  }

  const method = readPaymentMethod(body, "method");
  if (mode === "create" || method !== undefined) {
    if (method === undefined && mode === "create") {
      issues.push({ path: "method", message: "กรุณาเลือกประเภทช่องทาง" });
    } else if (method === null) {
      issues.push({ path: "method", message: "ประเภทช่องทางไม่ถูกต้อง" });
    } else if (method !== undefined) {
      data.method = method;
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

export function isPaymentChannelUuid(value: string): boolean {
  return /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(
    value,
  );
}
