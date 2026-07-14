import { PosSaleStatus } from "@/generated/prisma/client";
import { sumMoney } from "@/lib/pos/money";
import { prisma } from "@/lib/prisma";

export async function getPosSalesReport(from: Date, to: Date) {
  const sales = await prisma.posSale.findMany({
    where: { soldAt: { gte: from, lte: to }, status: { in: [PosSaleStatus.COMPLETED, PosSaleStatus.PARTIALLY_REFUNDED, PosSaleStatus.REFUNDED] } },
    include: { items: { include: { product: { select: { categoryId: true } } } }, payments: true, refunds: true },
  });
  const grossSales = sumMoney(sales.map((sale) => sale.netTotal));
  const refunds = sumMoney(sales.flatMap((sale) => sale.refunds.map((refund) => refund.refundTotal)));
  const cost = sumMoney(sales.map((sale) => sale.costTotal));
  return {
    billCount: sales.length,
    grossSales,
    refunds,
    netSales: grossSales.minus(refunds),
    cost,
    grossProfit: grossSales.minus(refunds).minus(cost),
    paymentTotals: Object.fromEntries(["CASH", "PROMPTPAY", "TRANSFER", "ROOM_CHARGE", "TOUR_CHARGE"].map((method) => [method, sumMoney(sales.flatMap((sale) => sale.payments.filter((payment) => payment.method === method).map((payment) => payment.amount)))])),
    lowStock: await prisma.posProduct.findMany({ where: { isActive: true, quantityOnHand: { lte: 5 } }, orderBy: { quantityOnHand: "asc" } }),
  };
}

export function serializeDecimalRecord<T>(value: T): T {
  return value;
}
