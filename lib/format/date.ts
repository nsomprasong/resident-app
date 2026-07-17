/** Shared Thai date display — วว/ดด/ปปปป (เช่น 14/07/2569) */

const DATE_KEY = /^\d{4}-\d{2}-\d{2}$/;

function toValidDate(value: string | Date | null | undefined): Date | null {
  if (value == null || value === "") return null;
  if (value instanceof Date) {
    return Number.isNaN(value.getTime()) ? null : value;
  }
  if (DATE_KEY.test(value)) {
    const date = new Date(`${value}T00:00:00.000Z`);
    return Number.isNaN(date.getTime()) ? null : date;
  }
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? null : date;
}

function pad2(value: string | undefined) {
  return (value ?? "").padStart(2, "0");
}

function formatParts(
  date: Date,
  options: Intl.DateTimeFormatOptions,
): Record<string, string> {
  const parts = new Intl.DateTimeFormat("th-TH", options).formatToParts(date);
  const map: Record<string, string> = {};
  for (const part of parts) {
    if (part.type !== "literal") {
      map[part.type] = part.value;
    }
  }
  return map;
}

/** วันที่อย่างเดียว จาก YYYY-MM-DD หรือ Date → วว/ดด/ปปปป */
export function formatThaiDate(value: string | Date | null | undefined): string {
  const date = toValidDate(value);
  if (!date) return value == null ? "" : String(value);

  const isDateKey = typeof value === "string" && DATE_KEY.test(value);
  const parts = formatParts(date, {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
    timeZone: isDateKey ? "UTC" : "Asia/Bangkok",
  });

  return `${pad2(parts.day)}/${pad2(parts.month)}/${parts.year ?? ""}`;
}

/**
 * เวลาอย่างเดียว → ชม:นท (24 ชม.)
 * ค่าเริ่มต้น Asia/Bangkok; ส่ง timeZone: "UTC" สำหรับ wall-clock ของกะงาน
 */
export function formatThaiTime(
  value: string | Date | null | undefined,
  options?: { timeZone?: string },
): string {
  const date = toValidDate(value);
  if (!date) return value == null ? "" : String(value);

  const parts = formatParts(date, {
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
    timeZone: options?.timeZone ?? "Asia/Bangkok",
  });

  return `${pad2(parts.hour)}:${pad2(parts.minute)}`;
}

/** เวลากะ/ลงเวลา HR — เก็บเป็น wall-clock บน UTC (เช่น 08:00Z = 08:00 น.) */
export function formatShiftWallClockTime(
  value: string | Date | null | undefined,
): string {
  return formatThaiTime(value, { timeZone: "UTC" });
}

/** วันเดือนปี + เวลา → วว/ดด/ปปปป ชม:นท */
export function formatThaiDateTime(
  value: string | Date | null | undefined,
): string {
  const date = toValidDate(value);
  if (!date) return value == null ? "" : String(value);

  const parts = formatParts(date, {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
    timeZone: "Asia/Bangkok",
  });

  return `${pad2(parts.day)}/${pad2(parts.month)}/${parts.year ?? ""} ${pad2(parts.hour)}:${pad2(parts.minute)}`;
}

/** ช่วงวันที่ เช่น "14/07/2569 – 16/07/2569" (วันเดียวกันแสดงครั้งเดียว) */
export function formatThaiDateRange(
  start: string | Date | null | undefined,
  end: string | Date | null | undefined,
): string {
  const startText = formatThaiDate(start);
  const endText = formatThaiDate(end);
  if (!startText && !endText) return "";
  if (!endText) return startText;
  if (!startText) return endText;
  if (startText === endText) return startText;
  return `${startText} – ${endText}`;
}
