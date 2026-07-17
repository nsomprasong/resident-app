import type {
  FoodSet,
  FoodSetItem,
  Product,
  ProductOption,
  ProductOptionGroup,
  TourGroupFoodSet,
  TourGroupFoodSetItem,
} from "@/generated/prisma/client";

import type { ValidationIssue } from "@/lib/api/validation";

const uuidPattern =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

export function isUuid(value: string): boolean {
  return uuidPattern.test(value);
}

export type ProductOptionRecord = {
  id: string;
  label: string;
  sortOrder: number;
};

export type ProductOptionGroupRecord = {
  id: string;
  name: string;
  isRequired: boolean;
  sortOrder: number;
  options: ProductOptionRecord[];
};

export type FoodSetItemRecord = {
  productId: string;
  productName: string;
  productPrice: number;
  quantity: number;
  sortOrder: number;
  requireOptions: boolean;
  optionGroups: ProductOptionGroupRecord[];
};

export type FoodSetRecord = {
  id: string;
  name: string;
  description: string | null;
  isActive: boolean;
  itemCount: number;
  items: FoodSetItemRecord[];
};

export type TourGroupFoodSetRecord = {
  id: string;
  tourGroupId: string;
  sourceFoodSetId: string | null;
  name: string;
  items: Array<
    FoodSetItemRecord & { isExtra: boolean; optionNote: string | null }
  >;
};

type ProductWithOptions = Pick<Product, "id" | "name" | "price"> & {
  optionGroups: Array<
    ProductOptionGroup & {
      options: ProductOption[];
    }
  >;
};

type FoodSetWithItems = FoodSet & {
  items: Array<
    FoodSetItem & {
      product: ProductWithOptions;
    }
  >;
};

type TourGroupFoodSetWithItems = TourGroupFoodSet & {
  items: Array<
    TourGroupFoodSetItem & {
      product: ProductWithOptions;
    }
  >;
};

function serializeOptionGroups(
  groups: ProductWithOptions["optionGroups"],
): ProductOptionGroupRecord[] {
  return [...groups]
    .sort((a, b) => a.sortOrder - b.sortOrder || a.name.localeCompare(b.name))
    .map((group) => ({
      id: group.id,
      name: group.name,
      isRequired: group.isRequired,
      sortOrder: group.sortOrder,
      options: [...group.options]
        .filter((option) => option.isActive)
        .sort(
          (a, b) => a.sortOrder - b.sortOrder || a.label.localeCompare(b.label),
        )
        .map((option) => ({
          id: option.id,
          label: option.label,
          sortOrder: option.sortOrder,
        })),
    }))
    .filter((group) => group.options.length > 0);
}

export function serializeFoodSet(foodSet: FoodSetWithItems): FoodSetRecord {
  const items = [...foodSet.items]
    .sort(
      (a, b) =>
        a.sortOrder - b.sortOrder ||
        a.product.name.localeCompare(b.product.name),
    )
    .map((item) => ({
      productId: item.productId,
      productName: item.product.name,
      productPrice: Number(item.product.price),
      quantity: item.quantity,
      sortOrder: item.sortOrder,
      requireOptions: item.requireOptions,
      optionGroups: serializeOptionGroups(item.product.optionGroups),
    }));

  return {
    id: foodSet.id,
    name: foodSet.name,
    description: foodSet.description,
    isActive: foodSet.isActive,
    itemCount: items.length,
    items,
  };
}

export function serializeTourGroupFoodSet(
  row: TourGroupFoodSetWithItems,
): TourGroupFoodSetRecord {
  return {
    id: row.id,
    tourGroupId: row.tourGroupId,
    sourceFoodSetId: row.sourceFoodSetId,
    name: row.name,
    items: row.items.map((item) => ({
      productId: item.productId,
      productName: item.product.name,
      productPrice: Number(item.product.price),
      quantity: item.quantity,
      sortOrder: 0,
      requireOptions: item.product.optionGroups.some((group) => group.isRequired),
      optionGroups: serializeOptionGroups(item.product.optionGroups),
      isExtra: item.isExtra,
      optionNote: item.optionNote,
    })),
  };
}

type FieldSource = Record<string, unknown>;

function readTrimmedString(
  source: FieldSource,
  key: string,
): string | undefined {
  const value = source[key];
  if (value === undefined) return undefined;
  return typeof value === "string" ? value.trim() : "";
}

function readBoolean(source: FieldSource, key: string): boolean | undefined {
  const value = source[key];
  if (value === undefined) return undefined;
  return typeof value === "boolean" ? value : undefined;
}

export type FoodSetItemInput = {
  productId: string;
  quantity: number;
  sortOrder?: number;
  requireOptions?: boolean;
};

export type ParsedFoodSetInput = {
  name?: string;
  description?: string | null;
  isActive?: boolean;
  items?: FoodSetItemInput[];
};

export type ParsedTourGroupFoodSetInput = {
  name: string;
  sourceFoodSetId: string | null;
  items: Array<
    FoodSetItemInput & { isExtra: boolean; optionNote: string | null }
  >;
};

function parseItems(
  value: unknown,
  path: string,
  options?: { requireIsExtra?: boolean; allowOptionNote?: boolean },
):
  | {
      ok: true;
      items: Array<
        FoodSetItemInput & { isExtra?: boolean; optionNote?: string | null }
      >;
    }
  | { ok: false; issues: ValidationIssue[] } {
  const issues: ValidationIssue[] = [];
  if (!Array.isArray(value)) {
    return {
      ok: false,
      issues: [{ path, message: "รายการอาหารต้องเป็นอาร์เรย์" }],
    };
  }
  if (!value.length) {
    return {
      ok: false,
      issues: [{ path, message: "ต้องมีอย่างน้อย 1 รายการอาหาร" }],
    };
  }

  const items: Array<
    FoodSetItemInput & { isExtra?: boolean; optionNote?: string | null }
  > = [];
  const seen = new Set<string>();

  value.forEach((entry, index) => {
    if (typeof entry !== "object" || entry === null || Array.isArray(entry)) {
      issues.push({
        path: `${path}.${index}`,
        message: "รายการต้องเป็นอ็อบเจ็กต์",
      });
      return;
    }
    const record = entry as FieldSource;
    const productId =
      typeof record.productId === "string" ? record.productId.trim() : "";
    if (!isUuid(productId)) {
      issues.push({
        path: `${path}.${index}.productId`,
        message: "รหัสสินค้าไม่ถูกต้อง",
      });
      return;
    }
    if (seen.has(productId)) {
      issues.push({
        path: `${path}.${index}.productId`,
        message: "สินค้าซ้ำในชุด",
      });
      return;
    }
    seen.add(productId);

    const quantityValue = record.quantity;
    const quantity =
      quantityValue === undefined
        ? 1
        : typeof quantityValue === "number" &&
            Number.isInteger(quantityValue) &&
            quantityValue > 0
          ? quantityValue
          : null;
    if (quantity === null) {
      issues.push({
        path: `${path}.${index}.quantity`,
        message: "จำนวนต้องเป็นจำนวนเต็มที่มากกว่า 0",
      });
      return;
    }

    const sortOrderValue = record.sortOrder;
    const sortOrder =
      sortOrderValue === undefined
        ? index
        : typeof sortOrderValue === "number" &&
            Number.isInteger(sortOrderValue) &&
            sortOrderValue >= 0
          ? sortOrderValue
          : null;
    if (sortOrder === null) {
      issues.push({
        path: `${path}.${index}.sortOrder`,
        message: "ลำดับต้องเป็นจำนวนเต็มที่ไม่ติดลบ",
      });
      return;
    }

    const item: FoodSetItemInput & {
      isExtra?: boolean;
      optionNote?: string | null;
    } = {
      productId,
      quantity,
      sortOrder,
    };

    const requireOptions = readBoolean(record, "requireOptions");
    if (requireOptions !== undefined) {
      item.requireOptions = requireOptions;
    }

    if (options?.requireIsExtra || "isExtra" in record) {
      if (typeof record.isExtra !== "boolean") {
        issues.push({
          path: `${path}.${index}.isExtra`,
          message: "isExtra ต้องเป็น boolean",
        });
        return;
      }
      item.isExtra = record.isExtra;
    }

    if (options?.allowOptionNote && "optionNote" in record) {
      const note = record.optionNote;
      if (note === null || note === "") {
        item.optionNote = null;
      } else if (typeof note === "string") {
        item.optionNote = note.trim() || null;
      } else {
        issues.push({
          path: `${path}.${index}.optionNote`,
          message: "optionNote ต้องเป็นข้อความ",
        });
        return;
      }
    }

    items.push(item);
  });

  if (issues.length) return { ok: false, issues };
  return { ok: true, items };
}

export function parseFoodSetInput(
  body: FieldSource,
  mode: "create" | "update",
):
  | { ok: true; data: ParsedFoodSetInput }
  | { ok: false; issues: ValidationIssue[] } {
  const issues: ValidationIssue[] = [];
  const data: ParsedFoodSetInput = {};

  const name = readTrimmedString(body, "name");
  if (mode === "create" || name !== undefined) {
    if (!name) {
      issues.push({ path: "name", message: "กรุณาระบุชื่อชุดอาหาร" });
    } else {
      data.name = name;
    }
  }

  if ("description" in body) {
    const description = readTrimmedString(body, "description");
    data.description = description === "" ? null : (description ?? null);
  }

  const isActive = readBoolean(body, "isActive");
  if (isActive !== undefined) {
    data.isActive = isActive;
  }

  if (mode === "create" || "items" in body) {
    const parsedItems = parseItems(body.items, "items");
    if (!parsedItems.ok) {
      issues.push(...parsedItems.issues);
    } else {
      data.items = parsedItems.items.map((item) => ({
        productId: item.productId,
        quantity: item.quantity,
        sortOrder: item.sortOrder ?? 0,
        requireOptions: item.requireOptions ?? false,
      }));
    }
  }

  if (issues.length) return { ok: false, issues };
  return { ok: true, data };
}

export function parseTourGroupFoodSetInput(
  body: FieldSource,
):
  | { ok: true; data: ParsedTourGroupFoodSetInput }
  | { ok: false; issues: ValidationIssue[] } {
  const issues: ValidationIssue[] = [];

  const name = readTrimmedString(body, "name");
  if (!name) {
    issues.push({ path: "name", message: "กรุณาระบุชื่อชุดอาหาร" });
  }

  let sourceFoodSetId: string | null = null;
  if ("sourceFoodSetId" in body) {
    const value = body.sourceFoodSetId;
    if (value === null || value === "") {
      sourceFoodSetId = null;
    } else if (typeof value === "string" && isUuid(value.trim())) {
      sourceFoodSetId = value.trim();
    } else {
      issues.push({
        path: "sourceFoodSetId",
        message: "รหัสชุดอาหารต้นทางไม่ถูกต้อง",
      });
    }
  }

  const parsedItems = parseItems(body.items, "items", {
    requireIsExtra: true,
    allowOptionNote: true,
  });
  if (!parsedItems.ok) {
    issues.push(...parsedItems.issues);
  }

  if (issues.length || !parsedItems.ok || !name) {
    return { ok: false, issues };
  }

  return {
    ok: true,
    data: {
      name,
      sourceFoodSetId,
      items: parsedItems.items.map((item) => ({
        productId: item.productId,
        quantity: item.quantity,
        isExtra: item.isExtra === true,
        optionNote: item.optionNote ?? null,
      })),
    },
  };
}

export const foodSetItemInclude = {
  product: {
    select: {
      id: true,
      name: true,
      price: true,
      optionGroups: {
        include: {
          options: {
            where: { isActive: true },
            orderBy: [
              { sortOrder: "asc" as const },
              { label: "asc" as const },
            ],
          },
        },
        orderBy: [{ sortOrder: "asc" as const }, { name: "asc" as const }],
      },
    },
  },
};

export const foodSetInclude = {
  items: {
    include: foodSetItemInclude,
    orderBy: [
      { sortOrder: "asc" as const },
      { product: { name: "asc" as const } },
    ],
  },
};
