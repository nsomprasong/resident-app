import {
  PosAccountingEntryType,
  PosPaymentMethod,
  PosSaleStatus,
  PosStockMovementType,
} from "@/generated/prisma/client";
import { money, sumMoney } from "@/lib/pos/money";
import { getPosSettings } from "@/lib/pos/settings";
import { nextRefundNumber } from "@/lib/pos/sequences";
import { applyStockChange } from "@/lib/pos/stock";
import { prisma } from "@/lib/prisma";

export async function refundSale(input: {
  saleId: string;
  employeeId: string;
  reason: string;
  refundMethod:
    | "CASH"
    | "PROMPTPAY"
    | "TRANSFER"
    | "ROOM_CHARGE"
    | "TOUR_CHARGE";
  items: readonly {
    saleItemId: string;
    quantity: string | number;
    restock?: boolean;
  }[];
}) {
  const settings = await getPosSettings();
  return prisma.$transaction(async (tx) => {
    const sale = await tx.posSale.findUnique({
      where: { id: input.saleId },
      include: { items: { include: { refundItems: true } }, refunds: true },
    });
    if (
      !sale ||
      sale.status === PosSaleStatus.CANCELLED ||
      sale.status === PosSaleStatus.REFUNDED
    ) {
      throw new Error("SALE_NOT_REFUNDABLE");
    }
    if (
      (Date.now() - sale.soldAt.getTime()) / 86_400_000 >
      settings.maxRefundDays
    ) {
      throw new Error("REFUND_WINDOW_EXPIRED");
    }
    const itemById = new Map(sale.items.map((item) => [item.id, item]));
    const entries = input.items.map((request) => {
      const item = itemById.get(request.saleItemId);
      if (!item) throw new Error("INVALID_SALE_ITEM");
      const remaining = item.quantity.minus(
        sumMoney(item.refundItems.map((refund) => refund.quantity)),
      );
      const requested = money(request.quantity);
      if (requested.lte(0) || requested.gt(remaining)) throw new Error("OVER_REFUND");
      return {
        request,
        item,
        quantity: requested,
        amount: requested
          .mul(item.unitPrice)
          .minus(item.discount.div(item.quantity).mul(requested))
          .toDecimalPlaces(2),
      };
    });
    const refundTotal = sumMoney(entries.map((entry) => entry.amount));
    const refund = await tx.posRefund.create({
      data: {
        refundNumber: await nextRefundNumber(tx, settings.receiptPrefix),
        saleId: sale.id,
        reason: input.reason,
        refundMethod: input.refundMethod,
        refundTotal,
        actorEmployeeId: input.employeeId,
        restock: entries.every((entry) => entry.request.restock !== false),
        items: {
          create: entries.map((entry) => ({
            saleItemId: entry.item.id,
            productId: entry.item.productId,
            quantity: entry.quantity,
            amount: entry.amount,
          })),
        },
      },
    });
    for (const entry of entries) {
      if (entry.request.restock !== false) {
        await applyStockChange(tx, {
          productId: entry.item.productId,
          delta: entry.quantity,
          type: PosStockMovementType.REFUND_RESTOCK,
          actorEmployeeId: input.employeeId,
          documentNumber: refund.refundNumber,
          reason: input.reason,
          referenceType: "POS_REFUND",
          referenceId: refund.id,
        });
      }
    }
    if (
      sale.bookingId &&
      (input.refundMethod === PosPaymentMethod.ROOM_CHARGE ||
        input.refundMethod === PosPaymentMethod.TOUR_CHARGE)
    ) {
      await tx.charge.create({
        data: {
          bookingId: sale.bookingId,
          type: "SUPERMARKET",
          description: `คืนสินค้า POS ${refund.refundNumber}`,
          amount: refundTotal.negated(),
          sourceType: "POS_REFUND",
          sourceId: refund.id,
        },
      });
    }
    await tx.posAccountingEntry.create({
      data: {
        entryType: PosAccountingEntryType.REFUND,
        amount: refundTotal,
        occurredAt: new Date(),
        referenceType: "POS_REFUND",
        referenceId: refund.id,
        saleId: sale.id,
        description: `คืนสินค้า ${refund.refundNumber}`,
        idempotencyKey: `${refund.id}:refund`,
      },
    });
    const fullyRefunded = sale.items.every((item) =>
      item.quantity.equals(
        sumMoney([
          ...item.refundItems.map((refundItem) => refundItem.quantity),
          ...entries
            .filter((entry) => entry.item.id === item.id)
            .map((entry) => entry.quantity),
        ]),
      ),
    );
    await tx.posSale.update({
      where: { id: sale.id },
      data: {
        status: fullyRefunded
          ? PosSaleStatus.REFUNDED
          : PosSaleStatus.PARTIALLY_REFUNDED,
      },
    });
    return refund;
  });
}
