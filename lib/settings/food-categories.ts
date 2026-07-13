import type { FoodCategory } from "@/generated/prisma/client";

import type { ValidationIssue } from "@/lib/api/validation";
import type { FoodCategoryRecord } from "@/lib/settings/product-master-shared";

export type { FoodCategoryRecord } from "@/lib/settings/product-master-shared";

export function serializeFoodCategory(
  category: FoodCategory,
): FoodCategoryRecord {
  return {
    id: category.id,
    name: category.name,
    isActive: category.isActive,
  };
}

type FieldSource = Record<string, unknown>;

export function parseFoodCategoryInput(
  body: FieldSource,
): { ok: true; name: string } | { ok: false; issues: ValidationIssue[] } {
  const raw = body.name;
  const name = typeof raw === "string" ? raw.trim() : "";
  if (!name) {
    return {
      ok: false,
      issues: [{ path: "name", message: "กรุณาระบุชื่อหมวดอาหาร" }],
    };
  }
  if (name.length > 80) {
    return {
      ok: false,
      issues: [{ path: "name", message: "ชื่อหมวดยาวเกินไป" }],
    };
  }
  return { ok: true, name };
}
