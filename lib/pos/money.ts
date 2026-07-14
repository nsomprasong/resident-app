import { Decimal } from "@prisma/client/runtime/client";

export type MoneyInput = string | number | Decimal;

export function money(value: MoneyInput): Decimal {
  const decimal = new Decimal(value);
  if (!decimal.isFinite()) throw new Error("INVALID_MONEY");
  return decimal.toDecimalPlaces(2);
}

export function quantity(value: MoneyInput): Decimal {
  const decimal = new Decimal(value);
  if (!decimal.isFinite() || decimal.lte(0)) throw new Error("INVALID_QUANTITY");
  return decimal.toDecimalPlaces(3);
}

export function sumMoney(values: readonly MoneyInput[]): Decimal {
  return values.reduce<Decimal>((total, value) => total.plus(money(value)), new Decimal(0)).toDecimalPlaces(2);
}

export function calculateLineTotal(quantityValue: MoneyInput, unitPrice: MoneyInput, discount: MoneyInput = 0): Decimal {
  const total = quantity(quantityValue).mul(money(unitPrice)).minus(money(discount));
  if (total.lt(0)) throw new Error("NEGATIVE_LINE_TOTAL");
  return total.toDecimalPlaces(2);
}
