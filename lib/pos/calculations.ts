import { money, sumMoney, type MoneyInput } from "@/lib/pos/money";

export function calculateSaleTotals(
  lines: ReadonlyArray<{ quantity: MoneyInput; unitPrice: MoneyInput; discount?: MoneyInput }>,
  billDiscount: MoneyInput = 0,
) {
  const subtotal = sumMoney(lines.map((line) => money(line.quantity).mul(money(line.unitPrice))));
  const itemDiscountTotal = sumMoney(lines.map((line) => line.discount ?? 0));
  const netTotal = subtotal.minus(itemDiscountTotal).minus(money(billDiscount));
  if (netTotal.lt(0)) throw new Error("INVALID_DISCOUNT");
  return { subtotal, itemDiscountTotal, billDiscount: money(billDiscount), netTotal };
}

export function calculateExpectedCash(input: {
  openingFloat: MoneyInput;
  cashSales: readonly MoneyInput[];
  cashIns: readonly MoneyInput[];
  cashOuts: readonly MoneyInput[];
  cashRefunds: readonly MoneyInput[];
}) {
  return money(input.openingFloat).plus(sumMoney(input.cashSales)).plus(sumMoney(input.cashIns)).minus(sumMoney(input.cashOuts)).minus(sumMoney(input.cashRefunds));
}
