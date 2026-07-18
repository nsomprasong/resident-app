import type { ValidationIssue } from "@/lib/api/validation";

export function formatGroupPackageDescription(
  guestCount: number,
  pricePerPerson: number,
): string {
  return `ราคาเหมากลุ่ม ${guestCount} คน × ฿${pricePerPerson}`;
}

export function isGroupPackageChargeDescription(description: string): boolean {
  return description.startsWith("ราคาเหมากลุ่ม ");
}

export function groupPackageAmount(
  guestCount: number,
  pricePerPerson: number,
): number {
  return guestCount * pricePerPerson;
}

export type GroupPackageInput =
  | {
      ok: true;
      guestCount: number;
      pricePerPerson: number;
      amount: number;
      description: string;
    }
  | { ok: false; issues: ValidationIssue[] };

export function parseGroupPackageInput(body: {
  guestCount?: unknown;
  pricePerPerson?: unknown;
}): GroupPackageInput {
  const issues: ValidationIssue[] = [];
  const guestCountRaw = Number(body.guestCount);
  const pricePerPersonRaw = Number(body.pricePerPerson);

  if (
    !Number.isFinite(guestCountRaw) ||
    !Number.isInteger(guestCountRaw) ||
    guestCountRaw < 1
  ) {
    issues.push({
      path: "guestCount",
      message: "Guest count must be an integer greater than 0",
    });
  }

  if (!Number.isFinite(pricePerPersonRaw) || pricePerPersonRaw < 0) {
    issues.push({
      path: "pricePerPerson",
      message: "Price per person must be 0 or greater",
    });
  }

  if (issues.length) {
    return { ok: false, issues };
  }

  const guestCount = guestCountRaw;
  const pricePerPerson = Math.round(pricePerPersonRaw * 100) / 100;
  return {
    ok: true,
    guestCount,
    pricePerPerson,
    amount: groupPackageAmount(guestCount, pricePerPerson),
    description: formatGroupPackageDescription(guestCount, pricePerPerson),
  };
}
