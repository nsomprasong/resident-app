import { prisma } from "@/lib/prisma";

export type PosSettings = {
  allowNegativeStock: boolean;
  receiptPrefix: string;
  maxRefundDays: number;
  defaultLowStock: number;
  storeName: string;
};

export const defaultPosSettings: PosSettings = {
  allowNegativeStock: false,
  receiptPrefix: "POS",
  maxRefundDays: 7,
  defaultLowStock: 5,
  storeName: "Resident Hotel Supermarket",
};

export async function getPosSettings(): Promise<PosSettings> {
  const rows = await prisma.posSetting.findMany();
  const values = new Map(rows.map((row) => [row.key, row.value]));
  return {
    allowNegativeStock: values.get("allowNegativeStock") === true,
    receiptPrefix: typeof values.get("receiptPrefix") === "string" ? String(values.get("receiptPrefix")) : defaultPosSettings.receiptPrefix,
    maxRefundDays: typeof values.get("maxRefundDays") === "number" ? Number(values.get("maxRefundDays")) : defaultPosSettings.maxRefundDays,
    defaultLowStock: typeof values.get("defaultLowStock") === "number" ? Number(values.get("defaultLowStock")) : defaultPosSettings.defaultLowStock,
    storeName: typeof values.get("storeName") === "string" ? String(values.get("storeName")) : defaultPosSettings.storeName,
  };
}
