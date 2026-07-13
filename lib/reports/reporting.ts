export type CsvRow = Record<string, string | number | null | undefined>;

export function startOfUtcMonth(date: Date) {
  return new Date(Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), 1));
}

export function endOfUtcMonth(date: Date) {
  const end = startOfUtcMonth(date);
  end.setUTCMonth(end.getUTCMonth() + 1);
  return end;
}

export function formatReportDate(date: Date) {
  return date.toISOString().slice(0, 10);
}

function escapeCsvValue(value: string | number | null | undefined) {
  const text = value === null || value === undefined ? "" : String(value);
  if (!/[",\r\n]/.test(text)) return text;
  return `"${text.replaceAll('"', '""')}"`;
}

export function toCsv(headers: readonly string[], rows: readonly CsvRow[]) {
  return [
    headers.map(escapeCsvValue).join(","),
    ...rows.map((row) => headers.map((header) => escapeCsvValue(row[header])).join(",")),
  ].join("\r\n");
}
