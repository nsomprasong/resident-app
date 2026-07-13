import type { ProductType } from "@/generated/prisma/client";

import type { ValidationIssue } from "@/lib/api/validation";
import type { ProductTypeRecord } from "@/lib/settings/product-master-shared";

export type { ProductTypeRecord } from "@/lib/settings/product-master-shared";

export function serializeProductType(type: ProductType): ProductTypeRecord {
  return {
    id: type.id,
    name: type.name,
    requiresFoodCategory: type.requiresFoodCategory,
    isActive: type.isActive,
  };
}

type FieldSource = Record<string, unknown>;

export function parseProductTypeInput(
  body: FieldSource,
): { ok: true; name: string } | { ok: false; issues: ValidationIssue[] } {
  const raw = body.name;
  const name = typeof raw === "string" ? raw.trim() : "";
  if (!name) {
    return {
      ok: false,
      issues: [{ path: "name", message: "กรุณาระบุชื่อประเภทสินค้า" }],
    };
  }
  if (name.length > 80) {
    return {
      ok: false,
      issues: [{ path: "name", message: "ชื่อประเภทยาวเกินไป" }],
    };
  }
  return { ok: true, name };
}
