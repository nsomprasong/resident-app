/** Shared Thai date display — วัน เดือน ปี (เช่น 13 กรกฎาคม 2569) */

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

/** วันที่อย่างเดียว จาก YYYY-MM-DD หรือ Date */
export function formatThaiDate(value: string | Date | null | undefined): string {
  const date = toValidDate(value);
  if (!date) return value == null ? "" : String(value);

  const isDateKey = typeof value === "string" && DATE_KEY.test(value);
  return new Intl.DateTimeFormat("th-TH", {
    day: "numeric",
    month: "long",
    year: "numeric",
    timeZone: isDateKey ? "UTC" : "Asia/Bangkok",
  }).format(date);
}

/** วันเดือนปี + เวลา */
export function formatThaiDateTime(
  value: string | Date | null | undefined,
): string {
  const date = toValidDate(value);
  if (!date) return value == null ? "" : String(value);

  return new Intl.DateTimeFormat("th-TH", {
    day: "numeric",
    month: "long",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
    timeZone: "Asia/Bangkok",
  }).format(date);
}

/** ช่วงวันที่ เช่น "13 กรกฎาคม 2569 ถึง 15 กรกฎาคม 2569" */
export function formatThaiDateRange(
  start: string | Date | null | undefined,
  end: string | Date | null | undefined,
): string {
  const startText = formatThaiDate(start);
  const endText = formatThaiDate(end);
  if (!startText && !endText) return "";
  if (!endText) return startText;
  if (!startText) return endText;
  return `${startText} ถึง ${endText}`;
}
