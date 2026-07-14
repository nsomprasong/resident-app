import type { Prisma } from "@/generated/prisma/client";

type Transaction = Prisma.TransactionClient;

export async function nextDocumentNumber(
  tx: Transaction,
  prefix: string,
): Promise<string> {
  const sequence = await tx.posReceiptSequence.upsert({
    where: { prefix },
    create: { prefix, lastValue: 1 },
    update: { lastValue: { increment: 1 } },
    select: { lastValue: true },
  });
  return `${prefix}-${String(sequence.lastValue).padStart(6, "0")}`;
}

export function nextReceiptNumber(tx: Transaction, prefix: string) {
  return nextDocumentNumber(tx, prefix);
}

export function nextHoldNumber(tx: Transaction, prefix: string) {
  return nextDocumentNumber(tx, `${prefix}-HOLD`);
}

export function nextRefundNumber(tx: Transaction, prefix: string) {
  return nextDocumentNumber(tx, `${prefix}-REFUND`);
}

export function nextStockDocumentNumber(tx: Transaction, prefix: string) {
  return nextDocumentNumber(tx, `${prefix}-STOCK`);
}
