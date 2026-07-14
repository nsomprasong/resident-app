import {
  PosAccountingEntryType,
  PosPaymentMethod,
  PosSaleStatus,
  PosStockMovementType,
  Prisma,
} from "@/generated/prisma/client";
import { calculateSaleTotals } from "@/lib/pos/calculations";
import { calculateLineTotal, money, sumMoney } from "@/lib/pos/money";
import { getPosSettings } from "@/lib/pos/settings";
import { nextReceiptNumber } from "@/lib/pos/sequences";
import { applyStockChange } from "@/lib/pos/stock";
import type { PosPaymentInput, PosSaleLineInput } from "@/lib/pos/validation";
import { prisma } from "@/lib/prisma";

export { calculateSaleTotals } from "@/lib/pos/calculations";

export async function createSale(input: {
  employeeId: string;
  shiftId: string;
  idempotencyKey: string;
  lines: readonly PosSaleLineInput[];
  payments: readonly PosPaymentInput[];
  billDiscount?: string | number;
  bookingId?: string;
  note?: string;
}) {
  if (!input.idempotencyKey.trim() || !input.lines.length || !input.payments.length) throw new Error("INVALID_SALE");
  return prisma.$transaction(async (tx) => {
    const existing = await tx.posSale.findUnique({ where: { idempotencyKey: input.idempotencyKey }, include: { items: true, payments: true } });
    if (existing) return existing;
    const shift = await tx.posShift.findFirst({ where: { id: input.shiftId, status: "OPEN" } });
    if (!shift) throw new Error("SHIFT_NOT_OPEN");
    const products = await tx.posProduct.findMany({ where: { id: { in: input.lines.map((line) => line.productId) }, isActive: true } });
    if (products.length !== input.lines.length || new Set(input.lines.map((line) => line.productId)).size !== input.lines.length) throw new Error("INVALID_PRODUCT");
    const productById = new Map(products.map((product) => [product.id, product]));
    const computedLines = input.lines.map((line) => {
      const product = productById.get(line.productId);
      if (!product) throw new Error("INVALID_PRODUCT");
      const lineTotal = calculateLineTotal(line.quantity, product.sellPrice, line.discount ?? 0);
      return { line, product, lineTotal };
    });
    const totals = calculateSaleTotals(computedLines.map(({ line, product }) => ({ quantity: line.quantity, unitPrice: product.sellPrice, discount: line.discount })), input.billDiscount ?? 0);
    if (!sumMoney(input.payments.map((payment) => payment.amount)).equals(totals.netTotal)) throw new Error("PAYMENT_TOTAL_MISMATCH");
    const settings = await getPosSettings();
    const receiptNumber = await nextReceiptNumber(tx, settings.receiptPrefix);
    const sale = await tx.posSale.create({
      data: {
        receiptNumber, idempotencyKey: input.idempotencyKey, shiftId: input.shiftId, soldById: input.employeeId,
        bookingId: input.bookingId ?? null, subtotal: totals.subtotal, itemDiscountTotal: totals.itemDiscountTotal,
        billDiscount: totals.billDiscount, netTotal: totals.netTotal, costTotal: sumMoney(computedLines.map(({ line, product }) => money(line.quantity).mul(product.costPrice))),
        note: input.note ?? null,
        items: { create: computedLines.map(({ line, product, lineTotal }) => ({ productId: product.id, productName: product.name, sku: product.sku, quantity: money(line.quantity), unitPrice: product.sellPrice, costPrice: product.costPrice, discount: money(line.discount ?? 0), lineTotal })) },
        payments: { create: input.payments.map((payment) => ({ method: payment.method, amount: money(payment.amount), reference: payment.reference ?? null })) },
      }, include: { items: true, payments: true },
    });
    for (const { line, product } of computedLines) {
      await applyStockChange(tx, { productId: product.id, delta: money(line.quantity).negated(), type: PosStockMovementType.SALE, actorEmployeeId: input.employeeId, allowNegativeStock: settings.allowNegativeStock, documentNumber: receiptNumber, referenceType: "POS_SALE", referenceId: sale.id });
    }
    if (input.bookingId && input.payments.some((payment) => payment.method === PosPaymentMethod.ROOM_CHARGE || payment.method === PosPaymentMethod.TOUR_CHARGE)) {
      await tx.charge.create({ data: { bookingId: input.bookingId, type: "SUPERMARKET", description: `POS ${receiptNumber}`, amount: totals.netTotal, sourceType: "POS_SALE", sourceId: sale.id } });
    }
    const paymentEntries = input.payments.map((payment, index) => {
      const method = payment.method;
      const entryType =
        method === PosPaymentMethod.CASH
          ? PosAccountingEntryType.CASH_REVENUE
          : method === PosPaymentMethod.PROMPTPAY
            ? PosAccountingEntryType.PROMPTPAY_REVENUE
            : method === PosPaymentMethod.TRANSFER
              ? PosAccountingEntryType.TRANSFER_REVENUE
              : method === PosPaymentMethod.ROOM_CHARGE
                ? PosAccountingEntryType.ROOM_RECEIVABLE
                : PosAccountingEntryType.TOUR_RECEIVABLE;
      return {
        entryType,
        amount: money(payment.amount),
        occurredAt: new Date(),
        referenceType: "POS_SALE",
        referenceId: sale.id,
        saleId: sale.id,
        description: `รับชำระ ${method} ${receiptNumber}`,
        idempotencyKey: `${sale.id}:pay:${index}:${method}`,
      };
    });
    await tx.posAccountingEntry.createMany({
      data: [
        {
          entryType: PosAccountingEntryType.NET_SALES,
          amount: totals.netTotal,
          occurredAt: new Date(),
          referenceType: "POS_SALE",
          referenceId: sale.id,
          saleId: sale.id,
          description: `ยอดขาย ${receiptNumber}`,
          idempotencyKey: `${sale.id}:net-sales`,
        },
        {
          entryType: PosAccountingEntryType.COGS,
          amount: sale.costTotal,
          occurredAt: new Date(),
          referenceType: "POS_SALE",
          referenceId: sale.id,
          saleId: sale.id,
          description: `ต้นทุน ${receiptNumber}`,
          idempotencyKey: `${sale.id}:cogs`,
        },
        {
          entryType: PosAccountingEntryType.GROSS_PROFIT,
          amount: money(totals.netTotal).minus(sale.costTotal),
          occurredAt: new Date(),
          referenceType: "POS_SALE",
          referenceId: sale.id,
          saleId: sale.id,
          description: `กำไรขั้นต้น ${receiptNumber}`,
          idempotencyKey: `${sale.id}:gross-profit`,
        },
        ...paymentEntries,
      ],
    });
    return sale;
  }, { isolationLevel: Prisma.TransactionIsolationLevel.Serializable });
}

export async function cancelSale(saleId: string, employeeId: string, reason: string) {
  return prisma.$transaction(async (tx) => {
    const sale = await tx.posSale.findUnique({
      where: { id: saleId },
      include: { items: true, payments: true },
    });
    if (!sale || sale.status !== PosSaleStatus.COMPLETED) throw new Error("SALE_NOT_CANCELLABLE");
    for (const item of sale.items) {
      await applyStockChange(tx, {
        productId: item.productId,
        delta: item.quantity,
        type: PosStockMovementType.REFUND_RESTOCK,
        actorEmployeeId: employeeId,
        documentNumber: sale.receiptNumber,
        reason,
        referenceType: "POS_CANCEL",
        referenceId: sale.id,
      });
    }
    if (
      sale.bookingId &&
      sale.payments.some(
        (payment) =>
          payment.method === PosPaymentMethod.ROOM_CHARGE ||
          payment.method === PosPaymentMethod.TOUR_CHARGE,
      )
    ) {
      await tx.charge.create({
        data: {
          bookingId: sale.bookingId,
          type: "SUPERMARKET",
          description: `ยกเลิก POS ${sale.receiptNumber}`,
          amount: money(sale.netTotal).negated(),
          sourceType: "POS_SALE_CANCEL",
          sourceId: sale.id,
        },
      });
    }
    await tx.posAccountingEntry.create({
      data: {
        entryType: PosAccountingEntryType.REFUND,
        amount: sale.netTotal,
        occurredAt: new Date(),
        referenceType: "POS_CANCEL",
        referenceId: sale.id,
        saleId: sale.id,
        description: `ยกเลิกบิล ${sale.receiptNumber}`,
        idempotencyKey: `${sale.id}:cancel-refund`,
      },
    });
    return tx.posSale.update({
      where: { id: saleId },
      data: {
        status: PosSaleStatus.CANCELLED,
        voidedById: employeeId,
        voidedAt: new Date(),
        voidReason: reason,
      },
    });
  });
}
