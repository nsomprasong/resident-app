import type { PosPaymentMethod } from "@/generated/prisma/client";
import { money, quantity, type MoneyInput } from "@/lib/pos/money";

export type PosSaleLineInput = {
  productId: string;
  quantity: MoneyInput;
  discount?: MoneyInput;
};

export type PosPaymentInput = {
  method: PosPaymentMethod;
  amount: MoneyInput;
  reference?: string;
};

export function requiredString(value: unknown, field: string): string {
  if (typeof value !== "string" || !value.trim()) throw new Error(`INVALID_${field.toUpperCase()}`);
  return value.trim();
}

export function parseMoney(value: unknown) {
  if (typeof value !== "string" && typeof value !== "number") throw new Error("INVALID_AMOUNT");
  return money(value);
}

export function parseQuantity(value: unknown) {
  if (typeof value !== "string" && typeof value !== "number") throw new Error("INVALID_QUANTITY");
  return quantity(value);
}
