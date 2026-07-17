export const ACCESS_DENIAL_CODES = [
  "EMPLOYEE_NOT_FOUND",
  "ROLE_NOT_ASSIGNED",
  "ROLE_INACTIVE",
  "PERMISSIONS_EMPTY",
  "EMPLOYEE_DISABLED",
] as const;

export type AccessDenialCode = (typeof ACCESS_DENIAL_CODES)[number];

const ACCESS_DENIAL_MESSAGES: Readonly<Record<AccessDenialCode, string>> = {
  EMPLOYEE_NOT_FOUND:
    "บัญชีนี้เข้าสู่ระบบสำเร็จ แต่ยังไม่ได้เชื่อมกับข้อมูลพนักงาน กรุณาติดต่อผู้ดูแลระบบ",
  ROLE_NOT_ASSIGNED:
    "บัญชีนี้ยังไม่ได้กำหนดบทบาท (Role) กรุณาติดต่อผู้ดูแลระบบ",
  ROLE_INACTIVE:
    "บทบาทของบัญชีนี้ถูกปิดใช้งานแล้ว กรุณาติดต่อผู้ดูแลระบบ",
  PERMISSIONS_EMPTY:
    "บัญชีนี้ยังไม่มีสิทธิ์ใช้งานระบบ กรุณาติดต่อผู้ดูแลระบบ",
  EMPLOYEE_DISABLED:
    "บัญชีพนักงานถูกปิดใช้งานแล้ว กรุณาติดต่อผู้ดูแลระบบ",
};

export function isAccessDenialCode(value: unknown): value is AccessDenialCode {
  return (
    typeof value === "string" &&
    (ACCESS_DENIAL_CODES as readonly string[]).includes(value)
  );
}

export function accessDenialMessage(code: AccessDenialCode | null | undefined) {
  if (code && isAccessDenialCode(code)) {
    return ACCESS_DENIAL_MESSAGES[code];
  }
  return "บัญชีนี้เข้าสู่ระบบสำเร็จ แต่ยังไม่ได้เชื่อมกับข้อมูลพนักงาน หรือยังไม่ได้กำหนดบทบาท/สิทธิ์ กรุณาติดต่อผู้ดูแลระบบ";
}

export function logAccessDenial(
  code: AccessDenialCode,
  details: Record<string, string | number | boolean | null | undefined> = {},
) {
  console.error(`[auth/access-denied] ${code}`, details);
}
