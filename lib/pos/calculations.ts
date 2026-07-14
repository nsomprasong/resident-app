import { money, sumMoney, type MoneyInput } from "@/lib/pos/money";

export const POS_PAYMENT_METHODS = [
  "CASH",
  "PROMPTPAY",
  "TRANSFER",
  "ROOM_CHARGE",
  "TOUR_CHARGE",
] as const;

export type PosPaymentMethodCode = (typeof POS_PAYMENT_METHODS)[number];

export type ShiftSaleForSummary = {
  status: string;
  netTotal: MoneyInput;
  payments: Array<{ method: string; amount: MoneyInput }>;
  refunds: Array<{ refundMethod: string; refundTotal: MoneyInput }>;
};

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

export function summarizeShiftPayments(sales: readonly ShiftSaleForSummary[]) {
  const activeSales = sales.filter((sale) => sale.status !== "CANCELLED");
  const paymentTotals = Object.fromEntries(
    POS_PAYMENT_METHODS.map((method) => [
      method,
      sumMoney(
        activeSales.flatMap((sale) =>
          sale.payments
            .filter((payment) => payment.method === method)
            .map((payment) => payment.amount),
        ),
      ),
    ]),
  ) as Record<PosPaymentMethodCode, ReturnType<typeof sumMoney>>;
  return {
    billCount: activeSales.length,
    netSales: sumMoney(activeSales.map((sale) => sale.netTotal)),
    paymentTotals,
  };
}

export function summarizeShiftCash(shift: {
  openingFloat: MoneyInput;
  cashMovements: Array<{ type: string; amount: MoneyInput }>;
  sales: readonly ShiftSaleForSummary[];
}) {
  const activeSales = shift.sales.filter((sale) => sale.status !== "CANCELLED");
  return calculateExpectedCash({
    openingFloat: shift.openingFloat,
    cashSales: activeSales.flatMap((sale) =>
      sale.payments
        .filter((payment) => payment.method === "CASH")
        .map((payment) => payment.amount),
    ),
    cashIns: shift.cashMovements
      .filter((movement) => movement.type === "IN")
      .map((movement) => movement.amount),
    cashOuts: shift.cashMovements
      .filter((movement) => movement.type === "OUT")
      .map((movement) => movement.amount),
    cashRefunds: activeSales.flatMap((sale) =>
      sale.refunds
        .filter((refund) => refund.refundMethod === "CASH")
        .map((refund) => refund.refundTotal),
    ),
  });
}

export function summarizeCashVariances(
  rows: ReadonlyArray<{ cashVariance: MoneyInput }>,
) {
  const over = sumMoney(
    rows
      .map((row) => money(row.cashVariance))
      .filter((value) => value.gt(0)),
  );
  const short = sumMoney(
    rows
      .map((row) => money(row.cashVariance))
      .filter((value) => value.lt(0))
      .map((value) => value.abs()),
  );
  const net = sumMoney(rows.map((row) => row.cashVariance));
  return {
    shiftCount: rows.length,
    cashOver: over,
    cashShort: short,
    cashVarianceNet: net,
  };
}
