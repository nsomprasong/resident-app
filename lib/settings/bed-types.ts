/**
 * Resort bed layouts used by room types.
 * Stored as Thai labels on RoomType.bedType (text) for compatibility.
 */

export const BED_LAYOUTS = [
  {
    code: "SINGLE",
    label: "เตียงเดี่ยว",
    capacity: 1,
    aliases: ["เตียงเดี่ยว", "เดี่ยว", "single", "1"],
  },
  {
    code: "DOUBLE",
    label: "เตียงคู่",
    capacity: 2,
    aliases: ["เตียงคู่", "คู่", "double", "2"],
  },
  {
    code: "TRIPLE",
    label: "3 เตียง",
    capacity: 3,
    aliases: ["3 เตียง", "สามเตียง", "triple", "3"],
  },
  {
    code: "QUAD",
    label: "4 เตียง",
    capacity: 4,
    aliases: ["4 เตียง", "สี่เตียง", "quad", "family", "4"],
  },
  {
    code: "DORM",
    label: "บ้านรวมพัก",
    capacity: 12,
    aliases: [
      "บ้านรวมพัก",
      "รวมพัก",
      "บ้านรวม",
      "dorm",
      "dormitory",
      "12 คน",
      "12",
    ],
  },
] as const;

export type BedLayoutCode = (typeof BED_LAYOUTS)[number]["code"];
export type BedLayout = (typeof BED_LAYOUTS)[number];

function normalizeBedKey(value: string) {
  return value.trim().toLowerCase().replace(/\s+/g, " ");
}

export function getBedLayoutByCode(
  code: string | null | undefined,
): BedLayout | null {
  if (!code) return null;
  const normalized = code.trim().toUpperCase();
  return BED_LAYOUTS.find((item) => item.code === normalized) ?? null;
}

export function resolveBedLayout(
  bedType: string | null | undefined,
  capacity?: number | null,
): BedLayout | null {
  if (bedType?.trim()) {
    const key = normalizeBedKey(bedType);
    for (const layout of BED_LAYOUTS) {
      if (normalizeBedKey(layout.label) === key) return layout;
      if (layout.aliases.some((alias) => normalizeBedKey(alias) === key)) {
        return layout;
      }
      if (key.includes(normalizeBedKey(layout.label))) return layout;
    }
  }

  if (typeof capacity === "number" && Number.isInteger(capacity)) {
    return BED_LAYOUTS.find((item) => item.capacity === capacity) ?? null;
  }

  return null;
}

export function bedLayoutLabel(
  bedType: string | null | undefined,
  capacity?: number | null,
): string {
  const layout = resolveBedLayout(bedType, capacity);
  if (layout) return layout.label;
  if (bedType?.trim()) return bedType.trim();
  if (typeof capacity === "number" && capacity > 0) return `${capacity} คน`;
  return "ไม่ระบุเตียง";
}

export function isKnownBedLayoutLabel(value: string | null | undefined): boolean {
  if (!value?.trim()) return true;
  return resolveBedLayout(value) !== null;
}

export function normalizeBedTypeInput(
  value: string | null | undefined,
): string | null {
  if (value == null) return null;
  const trimmed = value.trim();
  if (!trimmed) return null;
  const layout = resolveBedLayout(trimmed);
  return layout ? layout.label : trimmed;
}
