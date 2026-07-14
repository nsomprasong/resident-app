import { PosStockMovementType, type Prisma } from "@/generated/prisma/client";
import { Decimal } from "@prisma/client/runtime/client";
import type { MoneyInput } from "@/lib/pos/money";

type Transaction = Prisma.TransactionClient;

export type StockChangeInput = {
  productId: string;
  delta: MoneyInput;
  type: PosStockMovementType;
  actorEmployeeId: string;
  allowNegativeStock?: boolean;
  documentNumber?: string;
  reason?: string;
  referenceType?: string;
  referenceId?: string;
};

export async function applyStockChange(tx: Transaction, input: StockChangeInput) {
  const locked = await tx.$queryRaw<Array<{ id: string; quantity_on_hand: unknown }>>`
    SELECT id, quantity_on_hand FROM pos_products WHERE id = ${input.productId}::uuid FOR UPDATE
  `;
  const row = locked[0];
  if (!row) throw new Error("PRODUCT_NOT_FOUND");

  const before = quantityOrZero(row.quantity_on_hand);
  const delta = new Decimal(input.delta).toDecimalPlaces(3);
  const after = before.plus(delta);
  if (after.lt(0) && !input.allowNegativeStock) throw new Error("INSUFFICIENT_STOCK");

  await tx.posProduct.update({
    where: { id: input.productId },
    data: { quantityOnHand: after },
  });
  return tx.posStockMovement.create({
    data: {
      productId: input.productId,
      type: input.type,
      quantityDelta: delta,
      quantityBefore: before,
      quantityAfter: after,
      documentNumber: input.documentNumber ?? null,
      reason: input.reason ?? null,
      referenceType: input.referenceType ?? null,
      referenceId: input.referenceId ?? null,
      actorEmployeeId: input.actorEmployeeId,
    },
  });
}

function quantityOrZero(value: unknown) {
  return new Decimal(value === null || value === undefined ? 0 : String(value)).toDecimalPlaces(3);
}
