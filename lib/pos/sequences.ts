import type { Prisma } from "@/generated/prisma/client";

type Transaction = Prisma.TransactionClient;

export const POS_SKU_PREFIX = "SKU";

export function formatPosSku(value: number): string {
  if (!Number.isInteger(value) || value < 1) {
    throw new Error("INVALID_SKU_SEQUENCE");
  }
  return `${POS_SKU_PREFIX}-${String(value).padStart(4, "0")}`;
}

export function parsePosSkuNumber(sku: string): number | null {
  const match = new RegExp(`^${POS_SKU_PREFIX}-(\\d+)$`, "i").exec(sku.trim());
  if (!match) return null;
  const value = Number(match[1]);
  return Number.isInteger(value) && value > 0 ? value : null;
}

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

async function resolveSkuSequenceBase(tx: Transaction): Promise<number> {
  const existing = await tx.posReceiptSequence.findUnique({
    where: { prefix: POS_SKU_PREFIX },
    select: { lastValue: true },
  });
  if (existing) return existing.lastValue;

  const products = await tx.posProduct.findMany({
    where: { sku: { startsWith: `${POS_SKU_PREFIX}-` } },
    select: { sku: true },
  });
  const maxFromProducts = products.reduce((max, product) => {
    const value = parsePosSkuNumber(product.sku);
    return value && value > max ? value : max;
  }, 0);

  await tx.posReceiptSequence.create({
    data: { prefix: POS_SKU_PREFIX, lastValue: maxFromProducts },
  });
  return maxFromProducts;
}

/** Running SKU in format SKU-0001 */
export async function nextSkuNumber(tx: Transaction): Promise<string> {
  await resolveSkuSequenceBase(tx);
  const sequence = await tx.posReceiptSequence.update({
    where: { prefix: POS_SKU_PREFIX },
    data: { lastValue: { increment: 1 } },
    select: { lastValue: true },
  });
  return formatPosSku(sequence.lastValue);
}
