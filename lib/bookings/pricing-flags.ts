import type { ValidationIssue } from "@/lib/api/validation";

export type PricingFlagInput = { id: string; isExtra: boolean };

export type ParsePricingFlagsResult =
  | { ok: true; items: PricingFlagInput[] }
  | { ok: false; issues: ValidationIssue[] };

export function parsePricingFlagInputs(
  value: unknown,
  path: string,
): ParsePricingFlagsResult {
  if (value === undefined) {
    return { ok: true, items: [] };
  }
  if (!Array.isArray(value)) {
    return {
      ok: false,
      issues: [{ path, message: `${path} must be an array` }],
    };
  }

  const issues: ValidationIssue[] = [];
  const byId = new Map<string, PricingFlagInput>();

  value.forEach((entry, index) => {
    if (typeof entry !== "object" || entry === null || Array.isArray(entry)) {
      issues.push({
        path: `${path}.${index}`,
        message: "Entry must be an object",
      });
      return;
    }
    const record = entry as Record<string, unknown>;
    const id = typeof record.id === "string" ? record.id.trim() : "";
    if (!id) {
      issues.push({ path: `${path}.${index}.id`, message: "Id is required" });
      return;
    }
    if (typeof record.isExtra !== "boolean") {
      issues.push({
        path: `${path}.${index}.isExtra`,
        message: "isExtra must be boolean",
      });
      return;
    }
    byId.set(id, { id, isExtra: record.isExtra });
  });

  if (issues.length) return { ok: false, issues };
  return { ok: true, items: [...byId.values()] };
}

export function bookingNights(checkIn: Date, checkOut: Date): number {
  return Math.max(
    1,
    Math.ceil((checkOut.getTime() - checkIn.getTime()) / 86_400_000),
  );
}
