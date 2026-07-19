/** Shared helpers for catalog vs tour-group-only custom food lines. */

export type FoodLineInput = {
  productId?: string;
  customName?: string;
  customUnitPrice?: number;
  quantity: number;
  isExtra: boolean;
  note?: string | null;
};

export function newFoodLineKey(prefix = "line"): string {
  if (typeof crypto !== "undefined" && "randomUUID" in crypto) {
    return `${prefix}_${crypto.randomUUID()}`;
  }
  return `${prefix}_${Date.now()}_${Math.random().toString(36).slice(2, 9)}`;
}

export function isCustomFoodLine(item: {
  productId?: string | null;
  customName?: string | null;
}): boolean {
  return !item.productId && Boolean(item.customName?.trim());
}

export function foodLineUnitPrice(
  item: {
    productId?: string | null;
    customUnitPrice?: number | null;
  },
  catalogPrice?: number,
): number {
  if (item.customUnitPrice != null && Number.isFinite(item.customUnitPrice)) {
    return item.customUnitPrice;
  }
  return Number(catalogPrice ?? 0);
}

export function foodLineDisplayName(item: {
  productId?: string | null;
  customName?: string | null;
  productName?: string | null;
}): string {
  if (item.customName?.trim()) return item.customName.trim();
  return item.productName?.trim() || "เมนูพิเศษ";
}
