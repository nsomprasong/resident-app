import { InspectionItemType } from "@/generated/prisma/client";
import type { InspectionCatalog } from "@/generated/prisma/client";

import type { ValidationIssue } from "@/lib/api/validation";
import type { InspectionCatalogMasterRecord } from "@/lib/settings/inspection-catalog-shared";

export type { InspectionCatalogMasterRecord } from "@/lib/settings/inspection-catalog-shared";
export { inspectionItemTypeOptions } from "@/lib/settings/inspection-catalog-shared";

const inspectionTypeSet = new Set<string>(Object.values(InspectionItemType));

export function serializeInspectionCatalogMaster(
  item: InspectionCatalog,
): InspectionCatalogMasterRecord {
  return {
    id: item.id,
    name: item.name,
    type: item.type,
    unitPrice: Number(item.unitPrice),
    isActive: item.isActive,
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

function readBoolean(
  source: FieldSource,
  key: string,
): boolean | undefined {
  const value = source[key];
  if (value === undefined) return undefined;
  return typeof value === "boolean" ? value : undefined;
}

function readPositiveNumber(
  source: FieldSource,
  key: string,
): number | undefined | null {
  const value = source[key];
  if (value === undefined) return undefined;
  const numeric = typeof value === "number" ? value : Number(value);
  if (!Number.isFinite(numeric)) return null;
  return numeric;
}

function readInspectionType(
  source: FieldSource,
  key: string,
): InspectionItemType | undefined | null {
  const value = source[key];
  if (value === undefined) return undefined;
  if (typeof value !== "string" || !inspectionTypeSet.has(value)) return null;
  return value as InspectionItemType;
}

export type ParsedInspectionCatalogInput = {
  name?: string;
  type?: InspectionItemType;
  unitPrice?: number;
  isActive?: boolean;
};

export function parseInspectionCatalogInput(
  body: FieldSource,
  mode: "create" | "update",
):
  | { ok: true; data: ParsedInspectionCatalogInput }
  | { ok: false; issues: ValidationIssue[] } {
  const issues: ValidationIssue[] = [];
  const data: ParsedInspectionCatalogInput = {};

  const name = readTrimmedString(body, "name");
  if (mode === "create" || name !== undefined) {
    if (!name) {
      issues.push({ path: "name", message: "กรุณาระบุชื่อรายการตรวจ" });
    } else {
      data.name = name;
    }
  }

  const type = readInspectionType(body, "type");
  if (mode === "create" || type !== undefined) {
    if (type === undefined && mode === "create") {
      issues.push({ path: "type", message: "กรุณาเลือกประเภท" });
    } else if (type === null) {
      issues.push({ path: "type", message: "ประเภทไม่ถูกต้อง" });
    } else if (type !== undefined) {
      data.type = type;
    }
  }

  const unitPrice = readPositiveNumber(body, "unitPrice");
  if (mode === "create" || unitPrice !== undefined) {
    if (unitPrice === undefined && mode === "create") {
      issues.push({ path: "unitPrice", message: "กรุณาระบุราคากลาง" });
    } else if (
      unitPrice === null ||
      (unitPrice !== undefined && unitPrice < 0)
    ) {
      issues.push({
        path: "unitPrice",
        message: "ราคากลางต้องเป็นตัวเลขที่ไม่ติดลบ",
      });
    } else if (unitPrice !== undefined) {
      data.unitPrice = unitPrice;
    }
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

export function isInspectionCatalogUuid(value: string): boolean {
  return /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(
    value,
  );
}
