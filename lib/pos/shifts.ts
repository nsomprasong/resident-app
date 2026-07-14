import {
  PosAccountingEntryType,
  PosSaleStatus,
  PosShiftStatus,
} from "@/generated/prisma/client";
import {
  summarizeShiftCash,
} from "@/lib/pos/calculations";
import { money, type MoneyInput } from "@/lib/pos/money";
import { prisma } from "@/lib/prisma";

export {
  calculateExpectedCash,
  summarizeShiftCash,
  summarizeShiftPayments,
  POS_PAYMENT_METHODS,
} from "@/lib/pos/calculations";

const shiftSalesInclude = {
  sales: {
    where: { status: { not: PosSaleStatus.CANCELLED } },
    include: { payments: true, refunds: true },
  },
} as const;

export async function openShift(employeeId: string, openingFloat: MoneyInput, note?: string) {
  return prisma.$transaction(async (tx) => {
    const existing = await tx.posShift.findFirst({ where: { openedById: employeeId, status: PosShiftStatus.OPEN } });
    if (existing) throw new Error("SHIFT_ALREADY_OPEN");
    return tx.posShift.create({ data: { openedById: employeeId, openingFloat: money(openingFloat), note: note ?? null } });
  });
}

export async function closeShift(shiftId: string, employeeId: string, counted: MoneyInput, note?: string) {
  return prisma.$transaction(async (tx) => {
    const shift = await tx.posShift.findFirst({
      where: { id: shiftId, status: PosShiftStatus.OPEN },
      include: { cashMovements: true, ...shiftSalesInclude },
    });
    if (!shift) throw new Error("SHIFT_NOT_OPEN");
    const expected = summarizeShiftCash(shift);
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
