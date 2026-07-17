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
  return value
    .normalize("NFKC")
    .replace(/[\u200B-\u200D\uFEFF]/g, "")
    .replace(/\s/g, "")
    .trim()
    .toLowerCase();
}

export function isValidUsername(value: string): boolean {
  return USERNAME_PATTERN.test(normalizeUsername(value));
}

/** Human-readable reason when username fails validation (null = OK). */
export function describeUsernameIssue(value: string): string | null {
  const trimmed = value.trim();
  if (!trimmed) {
    return "กรุณาระบุ Username";
  }
  if (trimmed.includes("@")) {
    return "Username ห้ามเป็นอีเมล — ใส่เฉพาะชื่อ login (เช่น nonza) ไม่ใส่ @";
  }
  const normalized = normalizeUsername(trimmed);
  if (normalized.length < 3) {
    return `Username สั้นเกินไป (${normalized.length} ตัว — ต้องอย่างน้อย 3 ตัว)`;
  }
  if (normalized.length > 40) {
    return "Username ยาวเกิน 40 ตัว";
  }
  if (!USERNAME_PATTERN.test(normalized)) {
    const bad = [...normalized].filter((ch) => !/[a-z0-9._-]/.test(ch));
    if (bad.length) {
      return `Username มีอักขระที่ใช้ไม่ได้ (${[...new Set(bad)].join("")}) — ใช้ได้เฉพาะ a-z 0-9 . _ -`;
    }
    return "Username ต้องเป็น a-z 0-9 . _ - ความยาว 3–40 ตัว";
  }
  return null;
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
