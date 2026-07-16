/** Shared login-identifier helpers for employee auth (email + phone + username). */

const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const USERNAME_PATTERN = /^[a-z0-9._-]{3,40}$/;

export function looksLikeEmail(value: string): boolean {
  const trimmed = value.trim();
  return trimmed.includes("@") && EMAIL_PATTERN.test(trimmed);
}

/**
 * Accept common Thai mobile forms: 08xxxxxxxx, 8xxxxxxxx, +668xxxxxxxx, 668xxxxxxxx
 */
export function looksLikePhone(value: string): boolean {
  const digits = value.replace(/[^\d+]/g, "").replace(/^\+/, "");
  if (/^0[689]\d{8}$/.test(digits)) return true;
  if (/^[689]\d{8}$/.test(digits)) return true;
  if (/^66[689]\d{8}$/.test(digits)) return true;
  return false;
}

export function normalizeUsername(value: string): string {
  return value.trim().toLowerCase();
}

export function isValidUsername(value: string): boolean {
  return USERNAME_PATTERN.test(normalizeUsername(value));
}

/** Normalize Thai mobile numbers to E.164 (+66…). Returns null if invalid. */
export function normalizeThaiPhone(value: string): string | null {
  const raw = value.trim();
  if (!raw) return null;

  let digits = raw.replace(/[^\d+]/g, "");
  if (digits.startsWith("+")) {
    digits = digits.slice(1);
  }

  if (/^0[689]\d{8}$/.test(digits)) {
    return `+66${digits.slice(1)}`;
  }
  if (/^[689]\d{8}$/.test(digits)) {
    return `+66${digits}`;
  }
  if (/^66[689]\d{8}$/.test(digits)) {
    return `+${digits}`;
  }
  return null;
}

export type ResolvedLoginIdentifier =
  | { ok: true; kind: "email"; email: string }
  | { ok: true; kind: "phone"; phone: string }
  | { ok: true; kind: "username"; username: string }
  | { ok: false; message: string };

/**
 * Classify a free-text login identifier without revealing whether an account exists.
 */
export function resolveLoginIdentifier(raw: string): ResolvedLoginIdentifier {
  const trimmed = raw.trim();
  if (!trimmed) {
    return {
      ok: false,
      message: "กรุณากรอกชื่อผู้ใช้ เบอร์โทรศัพท์ หรืออีเมล",
    };
  }

  if (looksLikeEmail(trimmed)) {
    return { ok: true, kind: "email", email: trimmed.toLowerCase() };
  }

  if (looksLikePhone(trimmed)) {
    const phone = normalizeThaiPhone(trimmed);
    if (!phone) {
      return { ok: false, message: "รูปแบบเบอร์โทรศัพท์ไม่ถูกต้อง" };
    }
    return { ok: true, kind: "phone", phone };
  }

  const username = normalizeUsername(trimmed);
  if (!isValidUsername(username)) {
    return {
      ok: false,
      message: "ชื่อผู้ใช้ เบอร์โทรศัพท์ หรืออีเมลไม่ถูกต้อง",
    };
  }
  return { ok: true, kind: "username", username };
}

export const GENERIC_LOGIN_ERROR =
  "ชื่อผู้ใช้ เบอร์โทรศัพท์ อีเมล หรือรหัสผ่านไม่ถูกต้อง";

/**
 * Auth-only mailbox bound to username for password login.
 * Never store this on Employee.email (contact email stays optional/null).
 * Used because Supabase projects may have Phone logins disabled even when
 * Admin API can create phone users.
 */
export function authLoginEmailForUsername(username: string): string {
  return `${normalizeUsername(username)}@employee-auth.local`;
}
