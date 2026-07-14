import { PosAccountingEntryType, PosShiftStatus } from "@/generated/prisma/client";
import { calculateExpectedCash } from "@/lib/pos/calculations";
import { money, type MoneyInput } from "@/lib/pos/money";
import { prisma } from "@/lib/prisma";

export { calculateExpectedCash } from "@/lib/pos/calculations";

export async function openShift(employeeId: string, openingFloat: MoneyInput, note?: string) {
  return prisma.$transaction(async (tx) => {
    const existing = await tx.posShift.findFirst({ where: { openedById: employeeId, status: PosShiftStatus.OPEN } });
    if (existing) throw new Error("SHIFT_ALREADY_OPEN");
    return tx.posShift.create({ data: { openedById: employeeId, openingFloat: money(openingFloat), note: note ?? null } });
  });
}

export async function closeShift(shiftId: string, employeeId: string, counted: MoneyInput, note?: string) {
  return prisma.$transaction(async (tx) => {
    const shift = await tx.posShift.findFirst({ where: { id: shiftId, status: PosShiftStatus.OPEN }, include: { cashMovements: true, sales: { include: { payments: true, refunds: true } } } });
    if (!shift) throw new Error("SHIFT_NOT_OPEN");
    const cashSales = shift.sales.flatMap((sale) => sale.payments.filter((payment) => payment.method === "CASH").map((payment) => payment.amount));
    const cashRefunds = shift.sales.flatMap((sale) => sale.refunds.filter((refund) => refund.refundMethod === "CASH").map((refund) => refund.refundTotal));
    const expected = calculateExpectedCash({ openingFloat: shift.openingFloat, cashSales, cashIns: shift.cashMovements.filter((movement) => movement.type === "IN").map((movement) => movement.amount), cashOuts: shift.cashMovements.filter((movement) => movement.type === "OUT").map((movement) => movement.amount), cashRefunds });
    const countedMoney = money(counted);
    const variance = countedMoney.minus(expected);
    const updated = await tx.posShift.update({ where: { id: shiftId }, data: { status: PosShiftStatus.CLOSED, closedById: employeeId, closedAt: new Date(), closingCashCounted: countedMoney, expectedCash: expected, cashVariance: variance, note: note ?? shift.note } });
    if (!variance.isZero()) {
      await tx.posAccountingEntry.create({
        data: {
          entryType: PosAccountingEntryType.CASH_OVER_SHORT,
          amount: variance,
          occurredAt: new Date(),
          referenceType: "POS_SHIFT",
          referenceId: shift.id,
          description: `เงินสดเกิน/ขาดกะ ${shift.id.slice(0, 8)}`,
          idempotencyKey: `${shift.id}:cash-variance`,
        },
      });
    }
    return updated;
  });
}

export function approveShift(shiftId: string, employeeId: string) {
  return prisma.posShift.updateMany({ where: { id: shiftId, status: PosShiftStatus.CLOSED }, data: { status: PosShiftStatus.APPROVED, approvedById: employeeId, approvedAt: new Date() } });
}
