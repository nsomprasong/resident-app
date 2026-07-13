import type { FoodCategory, Product, ProductType } from "@/generated/prisma/client";

import type { ValidationIssue } from "@/lib/api/validation";
import type { ProductMasterRecord } from "@/lib/settings/product-master-shared";

export type { ProductMasterRecord } from "@/lib/settings/product-master-shared";

const uuidPattern =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

export type ProductWithRelations = Product & {
  type?: Pick<ProductType, "id" | "name" | "requiresFoodCategory"> | null;
  category?: Pick<FoodCategory, "id" | "name"> | null;
};

export function serializeProductMaster(
  product: ProductWithRelations,
): ProductMasterRecord {
  return {
    id: product.id,
    name: product.name,
    description: product.description,
    price: Number(product.price),
    typeId: product.typeId,
    typeName: product.type?.name ?? "",
    requiresFoodCategory: product.type?.requiresFoodCategory ?? false,
    categoryId: product.categoryId,
    categoryName: product.category?.name ?? null,
    isMinibar: product.isMinibar,
    imageUrl: product.imageUrl,
    isActive: product.isActive,
  };
}

type ProductFieldSource = Record<string, unknown>;

function readTrimmedString(
  source: ProductFieldSource,
  key: string,
): string | undefined {
  const value = source[key];
  if (value === undefined) return undefined;
  return typeof value === "string" ? value.trim() : "";
}

function readBoolean(
  source: ProductFieldSource,
  key: string,
): boolean | undefined {
  const value = source[key];
  if (value === undefined) return undefined;
  return typeof value === "boolean" ? value : undefined;
}

function readPositiveNumber(
  source: ProductFieldSource,
  key: string,
): number | undefined | null {
  const value = source[key];
  if (value === undefined) return undefined;
  const numeric = typeof value === "number" ? value : Number(value);
  if (!Number.isFinite(numeric)) return null;
  return numeric;
}

function readUuid(
  source: ProductFieldSource,
  key: string,
): string | undefined | null | "invalid" {
  if (!(key in source)) return undefined;
  const value = source[key];
  if (value === null || value === "") return null;
  if (typeof value !== "string" || !uuidPattern.test(value.trim())) {
    return "invalid";
  }
  return value.trim();
}

export type ParsedProductInput = {
  name?: string;
  description?: string | null;
  price?: number;
  typeId?: string;
  categoryId?: string | null;
  isMinibar?: boolean;
  imageUrl?: string | null;
  isActive?: boolean;
};

export function parseProductInput(
  body: ProductFieldSource,
  mode: "create" | "update",
): { ok: true; data: ParsedProductInput } | { ok: false; issues: ValidationIssue[] } {
  const issues: ValidationIssue[] = [];
  const data: ParsedProductInput = {};

  const name = readTrimmedString(body, "name");
  if (mode === "create" || name !== undefined) {
    if (!name) {
      issues.push({ path: "name", message: "กรุณาระบุชื่อสินค้า" });
    } else {
      data.name = name;
    }
  }

  if ("description" in body) {
    const description = readTrimmedString(body, "description");
    data.description = description === "" ? null : description ?? null;
  }

  const price = readPositiveNumber(body, "price");
  if (mode === "create" || price !== undefined) {
    if (price === undefined && mode === "create") {
      issues.push({ path: "price", message: "กรุณาระบุราคา" });
    } else if (price === null || (price !== undefined && price < 0)) {
      issues.push({ path: "price", message: "ราคาต้องเป็นตัวเลขที่ไม่ติดลบ" });
    } else if (price !== undefined) {
      data.price = price;
    }
  }

  const typeId = readUuid(body, "typeId");
  if (mode === "create" || typeId !== undefined) {
    if ((typeId === undefined || typeId === null) && mode === "create") {
      issues.push({ path: "typeId", message: "กรุณาเลือกประเภทสินค้า" });
    } else if (typeId === "invalid" || typeId === null) {
      issues.push({ path: "typeId", message: "ประเภทสินค้าไม่ถูกต้อง" });
    } else if (typeId !== undefined) {
      data.typeId = typeId;
    }
  }

  const categoryId = readUuid(body, "categoryId");
  if (categoryId === "invalid") {
    issues.push({ path: "categoryId", message: "หมวดอาหารไม่ถูกต้อง" });
  } else if (categoryId !== undefined) {
    data.categoryId = categoryId;
  }

  const isMinibar = readBoolean(body, "isMinibar");
  if (isMinibar !== undefined) {
    data.isMinibar = isMinibar;
  } else if (mode === "create") {
    data.isMinibar = false;
  }

  if ("imageUrl" in body) {
    const imageUrl = readTrimmedString(body, "imageUrl");
    data.imageUrl = imageUrl === "" ? null : imageUrl ?? null;
  }

  const isActive = readBoolean(body, "isActive");
  if (isActive !== undefined) {
    data.isActive = isActive;
  }

  if (mode === "update" && Object.keys(data).length === 0) {
    issues.push({ path: "body", message: "ไม่มีข้อมูลที่จะอัปเดต" });
  }

  if (issues.length) {
    return { ok: false, issues };
  }

  return { ok: true, data };
}

export function isProductUuid(value: string): boolean {
  return uuidPattern.test(value);
}
