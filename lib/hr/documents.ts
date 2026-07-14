import type { EmployeeDocumentType } from "@/generated/prisma/client";

export const EMPLOYEE_DOCUMENT_TYPES = [
  "CONTRACT",
  "NATIONAL_ID",
  "BANK_ACCOUNT",
  "CERTIFICATE",
  "LEAVE_DOCUMENT",
  "OTHER",
] as const satisfies readonly EmployeeDocumentType[];

export type EmployeeDocumentTypeCode = (typeof EMPLOYEE_DOCUMENT_TYPES)[number];

export const EMPLOYEE_DOCUMENT_TYPE_LABELS: Record<
  EmployeeDocumentTypeCode,
  string
> = {
  CONTRACT: "สัญญาจ้าง",
  NATIONAL_ID: "บัตรประชาชน",
  BANK_ACCOUNT: "บัญชีธนาคาร",
  CERTIFICATE: "ใบรับรอง",
  LEAVE_DOCUMENT: "เอกสารลา",
  OTHER: "อื่นๆ",
};

/** Default warning window before expiry (days). Configurable later via settings. */
export const DOCUMENT_EXPIRY_WARNING_DAYS = 30;

export const EMPLOYEE_DOCUMENT_MAX_BYTES = 10 * 1024 * 1024;

export const EMPLOYEE_DOCUMENT_ALLOWED_TYPES = new Set([
  "application/pdf",
  "image/jpeg",
  "image/png",
  "image/webp",
  "application/msword",
  "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
]);

export function isAllowedEmployeeDocumentType(mime: string): boolean {
  return EMPLOYEE_DOCUMENT_ALLOWED_TYPES.has(mime);
}

export function extensionForDocumentMime(mime: string): string {
  switch (mime) {
    case "application/pdf":
      return "pdf";
    case "image/jpeg":
      return "jpg";
    case "image/png":
      return "png";
    case "image/webp":
      return "webp";
    case "application/msword":
      return "doc";
    case "application/vnd.openxmlformats-officedocument.wordprocessingml.document":
      return "docx";
    default:
      return "bin";
  }
}

export function isEmployeeDocumentType(
  value: string,
): value is EmployeeDocumentTypeCode {
  return (EMPLOYEE_DOCUMENT_TYPES as readonly string[]).includes(value);
}

export type DocumentExpiryStatus = "OK" | "EXPIRING_SOON" | "EXPIRED" | "NONE";

export function classifyDocumentExpiry(
  expiresAt: Date | null,
  options?: { now?: Date; warningDays?: number },
): DocumentExpiryStatus {
  if (!expiresAt) return "NONE";
  const now = options?.now ?? new Date();
  const warningDays = options?.warningDays ?? DOCUMENT_EXPIRY_WARNING_DAYS;
  const todayUtc = Date.UTC(
    now.getUTCFullYear(),
    now.getUTCMonth(),
    now.getUTCDate(),
  );
  const expiryUtc = Date.UTC(
    expiresAt.getUTCFullYear(),
    expiresAt.getUTCMonth(),
    expiresAt.getUTCDate(),
  );
  if (expiryUtc < todayUtc) return "EXPIRED";
  const diffDays = Math.round((expiryUtc - todayUtc) / 86_400_000);
  if (diffDays <= warningDays) return "EXPIRING_SOON";
  return "OK";
}

export function sanitizeOriginalFileName(fileName: string): string {
  const base = fileName.split(/[/\\]/).pop()?.trim() || "document";
  return base.replace(/[^\w.\-()\u0E00-\u0E7F ]+/g, "_").slice(0, 180);
}
