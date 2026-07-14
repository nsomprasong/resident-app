import { PosSaleStatus, PosShiftStatus } from "@/generated/prisma/client";
import { summarizeCashVariances } from "@/lib/pos/calculations";
import { sumMoney, type MoneyInput } from "@/lib/pos/money";
import { prisma } from "@/lib/prisma";

export type CashVarianceShiftRow = {
  shiftId: string;
  closedAt: Date | string | null;
  openedByName: string | null;
  expectedCash: MoneyInput;
  closingCashCounted: MoneyInput;
  cashVariance: MoneyInput;
  status: string;
};

export { summarizeCashVariances } from "@/lib/pos/calculations";

export async function getPosSalesReport(from: Date, to: Date) {
  const [sales, shifts] = await Promise.all([
    prisma.posSale.findMany({
      where: {
        soldAt: { gte: from, lte: to },
        status: {
          in: [
            PosSaleStatus.COMPLETED,
            PosSaleStatus.PARTIALLY_REFUNDED,
            PosSaleStatus.REFUNDED,
          ],
        },
      },
      include: {
        items: { include: { product: { select: { categoryId: true } } } },
        payments: true,
        refunds: true,
      },
    }),
    prisma.posShift.findMany({
      where: {
        closedAt: { gte: from, lte: to },
        status: { in: [PosShiftStatus.CLOSED, PosShiftStatus.APPROVED] },
        cashVariance: { not: null },
      },
      include: {
        openedBy: { select: { name: true } },
      },
      orderBy: { closedAt: "desc" },
    }),
  ]);

  const grossSales = sumMoney(sales.map((sale) => sale.netTotal));
  const refunds = sumMoney(
    sales.flatMap((sale) => sale.refunds.map((refund) => refund.refundTotal)),
  );
  const cost = sumMoney(sales.map((sale) => sale.costTotal));
  const cashVarianceRows: CashVarianceShiftRow[] = shifts.map((shift) => ({
    shiftId: shift.id,
    closedAt: shift.closedAt,
    openedByName: shift.openedBy?.name ?? null,
    expectedCash: shift.expectedCash ?? 0,
    closingCashCounted: shift.closingCashCounted ?? 0,
    cashVariance: shift.cashVariance ?? 0,
    status: shift.status,
  }));
  const cashSummary = summarizeCashVariances(cashVarianceRows);

  return {
    billCount: sales.length,
    grossSales,
    refunds,
    netSales: grossSales.minus(refunds),
    cost,
    grossProfit: grossSales.minus(refunds).minus(cost),
    paymentTotals: Object.fromEntries(
      ["CASH", "PROMPTPAY", "TRANSFER", "ROOM_CHARGE", "TOUR_CHARGE"].map(
        (method) => [
          method,
          sumMoney(
            sales.flatMap((sale) =>
              sale.payments
                .filter((payment) => payment.method === method)
                .map((payment) => payment.amount),
            ),
          ),
        ],
      ),
    ),
    cashOver: cashSummary.cashOver,
    cashShort: cashSummary.cashShort,
    cashVarianceNet: cashSummary.cashVarianceNet,
    cashVarianceShiftCount: cashSummary.shiftCount,
    cashVariances: cashVarianceRows,
    lowStock: await prisma.posProduct.findMany({
      where: { isActive: true, quantityOnHand: { lte: 5 } },
      orderBy: { quantityOnHand: "asc" },
    }),
  };
}
