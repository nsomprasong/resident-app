import type { PromptPayAccount, PromptPayIdType } from "@/generated/prisma/client";

import type { ValidationIssue } from "@/lib/api/validation";
import type {
  PromptPayAccountDetailRecord,
  PromptPayAccountRecord,
  PromptPayIdTypeValue,
} from "@/lib/settings/promptpay-account-shared";

export type {
  PromptPayAccountRecord,
  PromptPayAccountDetailRecord,
  PromptPayIdTypeValue,
};
export { promptPayIdTypeOptions } from "@/lib/settings/promptpay-account-shared";

type AccountWithCount = PromptPayAccount & {
  _count: { payments: number };
};

export function normalizePromptPayIdentifier(raw: string): string {
  return raw.replace(/[\s\-]/g, "").trim();
}

export function maskPromptPayIdentifier(
  identifier: string,
  idType: PromptPayIdTypeValue | PromptPayIdType,
): string {
  const value = normalizePromptPayIdentifier(identifier);
  if (idType === "PHONE") {
    if (value.length < 4) return "****";
    const local = value.startsWith("66") ? `0${value.slice(2)}` : value;
    return `${local.slice(0, 3)}-XXX-${local.slice(-4)}`;
  }
  if (idType === "NATIONAL_ID_OR_TAX_ID") {
    if (value.length < 4) return "****";
    return `${value.slice(0, 1)}-XXXX-XXXXX-${value.slice(-2)}`;
  }
  if (value.length <= 6) return "****";
  return `${value.slice(0, 4)}…${value.slice(-4)}`;
}

export function isValidPromptPayIdentifier(
  identifier: string,
  idType: PromptPayIdTypeValue | PromptPayIdType,
): boolean {
  const value = normalizePromptPayIdentifier(identifier);
  if (idType === "PHONE") {
    const local = value.startsWith("66") ? `0${value.slice(2)}` : value;
    return /^0[0-9]{8,9}$/.test(local);
  }
  if (idType === "NATIONAL_ID_OR_TAX_ID") {
    return /^[0-9]{13}$/.test(value);
  }
  return /^[0-9]{15}$/.test(value);
}

/** Convert Thai mobile to PromptPay target expected by payload generator */
export function toPromptPayTarget(
  identifier: string,
  idType: PromptPayIdTypeValue | PromptPayIdType,
): string {
  const value = normalizePromptPayIdentifier(identifier);
  if (idType === "PHONE") {
    if (value.startsWith("66")) return value;
    if (value.startsWith("0")) return `66${value.slice(1)}`;
    return value;
  }
  return value;
}

export function serializePromptPayAccount(
  account: AccountWithCount,
  options?: { includeFullIdentifier?: boolean },
): PromptPayAccountRecord | PromptPayAccountDetailRecord {
  const base: PromptPayAccountRecord = {
    id: account.id,
    displayName: account.displayName,
    idType: account.idType,
    identifierMasked: maskPromptPayIdentifier(account.identifier, account.idType),
    accountName: account.accountName,
    bankName: account.bankName,
    isActive: account.isActive,
    isPrimary: account.isPrimary,
    notes: account.notes,
    paymentCount: account._count.payments,
  };
  if (options?.includeFullIdentifier) {
    return { ...base, identifier: account.identifier };
  }
  return base;
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

const idTypeSet = new Set<string>([
  "PHONE",
  "NATIONAL_ID_OR_TAX_ID",
  "EWALLET",
]);

export type ParsedPromptPayAccountInput = {
  displayName?: string;
  idType?: PromptPayIdTypeValue;
  identifier?: string;
  accountName?: string;
  bankName?: string | null;
  isActive?: boolean;
  isPrimary?: boolean;
  notes?: string | null;
};

export function isPromptPayAccountUuid(value: string): boolean {
  return /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(
    value,
  );
}

export function parsePromptPayAccountInput(
  body: FieldSource,
  mode: "create" | "update",
):
  | { ok: true; data: ParsedPromptPayAccountInput }
  | { ok: false; issues: ValidationIssue[] } {
  const issues: ValidationIssue[] = [];
  const data: ParsedPromptPayAccountInput = {};

  const displayName = readTrimmedString(body, "displayName");
  if (mode === "create" || displayName !== undefined) {
    if (!displayName) {
      issues.push({ path: "displayName", message: "กรุณาระบุชื่อเรียกบัญชี" });
    } else if (displayName.length > 120) {
      issues.push({ path: "displayName", message: "ชื่อเรียกยาวเกินไป" });
    } else {
      data.displayName = displayName;
    }
  }

  const accountName = readTrimmedString(body, "accountName");
  if (mode === "create" || accountName !== undefined) {
    if (!accountName) {
      issues.push({ path: "accountName", message: "กรุณาระบุชื่อบัญชี" });
    } else if (accountName.length > 160) {
      issues.push({ path: "accountName", message: "ชื่อบัญชียาวเกินไป" });
    } else {
      data.accountName = accountName;
    }
  }

  let idType: PromptPayIdTypeValue | undefined;
  if (mode === "create" || "idType" in body) {
    const raw = readTrimmedString(body, "idType");
    if (!raw || !idTypeSet.has(raw)) {
      issues.push({ path: "idType", message: "ประเภทพร้อมเพย์ไม่ถูกต้อง" });
    } else {
      idType = raw as PromptPayIdTypeValue;
      data.idType = idType;
    }
  }

  if (mode === "create" || "identifier" in body) {
    const raw = readTrimmedString(body, "identifier");
    if (!raw) {
      issues.push({ path: "identifier", message: "กรุณาระบุหมายเลขพร้อมเพย์" });
    } else {
      const normalized = normalizePromptPayIdentifier(raw);
      const typeForValidation =
        idType ??
        (typeof body.idType === "string" && idTypeSet.has(body.idType)
          ? (body.idType as PromptPayIdTypeValue)
          : undefined);
      if (
        typeForValidation &&
        !isValidPromptPayIdentifier(normalized, typeForValidation)
      ) {
        issues.push({
          path: "identifier",
          message: "รูปแบบหมายเลขพร้อมเพย์ไม่ถูกต้อง",
        });
      } else {
        data.identifier = normalized;
      }
    }
  }

  if ("bankName" in body) {
    const bankName = readTrimmedString(body, "bankName");
    data.bankName = bankName ? bankName : null;
  }

  if ("notes" in body) {
    const notes = readTrimmedString(body, "notes");
    data.notes = notes ? notes : null;
  }

  const isActive = readBoolean(body, "isActive");
  if (isActive !== undefined) data.isActive = isActive;
  else if ("isActive" in body) {
    issues.push({ path: "isActive", message: "isActive ต้องเป็น boolean" });
  }

  const isPrimary = readBoolean(body, "isPrimary");
  if (isPrimary !== undefined) data.isPrimary = isPrimary;
  else if ("isPrimary" in body) {
    issues.push({ path: "isPrimary", message: "isPrimary ต้องเป็น boolean" });
  }

  if (mode === "update" && Object.keys(data).length === 0) {
    issues.push({ path: "body", message: "ไม่มีข้อมูลที่จะอัปเดต" });
  }

  if (issues.length) return { ok: false, issues };
  return { ok: true, data };
}
