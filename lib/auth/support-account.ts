/**
 * Protected system-support employee accounts.
 * Configured via SUPPORT_ACCOUNT_EMAILS (comma-separated).
 * Others must not list, mutate, archive, or reset these accounts.
 */

import type { Prisma } from "@/generated/prisma/client";
import { findAuthUserIdByEmail } from "@/lib/supabase/admin";

function normalizeEmail(email: string) {
  return email.trim().toLowerCase();
}

/** Fallback when env is unset — product support account. Override via SUPPORT_ACCOUNT_EMAILS. */
const FALLBACK_SUPPORT_EMAILS = ["nsomprasong@gmail.com"] as const;

export function getProtectedSupportEmails(): readonly string[] {
  const raw = process.env.SUPPORT_ACCOUNT_EMAILS?.trim();
  const source = raw
    ? raw.split(",").map((part) => part.trim()).filter(Boolean)
    : [...FALLBACK_SUPPORT_EMAILS];
  const unique = new Set(source.map(normalizeEmail).filter(Boolean));
  return [...unique];
}

export function isProtectedSupportEmail(
  email: string | null | undefined,
): boolean {
  if (!email?.trim()) return false;
  const normalized = normalizeEmail(email);
  return getProtectedSupportEmails().includes(normalized);
}

export function isProtectedSupportEmployee(employee: {
  email?: string | null;
}): boolean {
  return isProtectedSupportEmail(employee.email);
}

/** Actor may only manage a protected account when they are that same account. */
export function canActorAccessSupportEmployee(
  actorEmail: string | null | undefined,
  targetEmail: string | null | undefined,
): boolean {
  if (!isProtectedSupportEmail(targetEmail)) return true;
  if (!actorEmail?.trim()) return false;
  return normalizeEmail(actorEmail) === normalizeEmail(targetEmail!);
}

/**
 * Hide support accounts from management lists for non-support actors.
 * When the logged-in user is a support mailbox, do not hide — they must see
 * their own account (and the rest of the staff list).
 * Keep employees with null email visible for everyone else.
 */
export function protectedSupportEmployeeListFilter(
  actorEmail?: string | null,
): Prisma.EmployeeWhereInput {
  const protectedEmails = getProtectedSupportEmails();
  if (protectedEmails.length === 0) return {};

  if (actorEmail && isProtectedSupportEmail(actorEmail)) {
    return {};
  }

  return {
    OR: [
      { email: null },
      {
        AND: protectedEmails.map((email) => ({
          NOT: {
            email: { equals: email, mode: "insensitive" as const },
          },
        })),
      },
    ],
  };
}

type AuthIdCache = { expiresAt: number; authUserIds: string[] };
let protectedAuthIdCache: AuthIdCache | null = null;
const AUTH_ID_CACHE_MS = 60_000;

async function resolveProtectedAuthUserIds(): Promise<string[]> {
  const now = Date.now();
  if (protectedAuthIdCache && protectedAuthIdCache.expiresAt > now) {
    return protectedAuthIdCache.authUserIds;
  }

  const authUserIds: string[] = [];
  for (const email of getProtectedSupportEmails()) {
    try {
      const id = await findAuthUserIdByEmail(email);
      if (id) authUserIds.push(id);
    } catch (error) {
      console.error("resolveProtectedAuthUserIds failed", email, error);
    }
  }

  protectedAuthIdCache = {
    expiresAt: now + AUTH_ID_CACHE_MS,
    authUserIds,
  };
  return authUserIds;
}

/**
 * Hide support employees by Employee.email and by linked Auth user email.
 * Support actors see the full list (including themselves).
 */
export async function protectedSupportEmployeeWhere(actor?: {
  email?: string | null;
  authUserId?: string | null;
}): Promise<Prisma.EmployeeWhereInput> {
  if (actor?.email && isProtectedSupportEmail(actor.email)) {
    return {};
  }

  const emailFilter = protectedSupportEmployeeListFilter(actor?.email);
  const authUserIds = await resolveProtectedAuthUserIds();

  if (actor?.authUserId && authUserIds.includes(actor.authUserId)) {
    return {};
  }

  if (authUserIds.length === 0) {
    return emailFilter;
  }

  return {
    AND: [
      emailFilter,
      {
        OR: [
          { authUserId: null },
          { authUserId: { notIn: authUserIds } },
        ],
      },
    ],
  };
}

export function supportAccountForbiddenResponseMessage() {
  return "บัญชีนี้เป็นบัญชี support ของระบบ ไม่สามารถดูหรือแก้ไขได้";
}

/** Sole system-admin role — visible/assignable only to support mailbox. */
export const SYSTEM_ADMIN_ROLE_CODE = "ADMIN" as const;

export function canActorManageSystemAdminRole(
  actorEmail: string | null | undefined,
): boolean {
  return isProtectedSupportEmail(actorEmail);
}

export function systemAdminRoleListFilter(
  actorEmail: string | null | undefined,
): Prisma.RoleWhereInput {
  if (canActorManageSystemAdminRole(actorEmail)) return {};
  return { NOT: { code: SYSTEM_ADMIN_ROLE_CODE } };
}

export function systemAdminRoleForbiddenMessage() {
  return "บทบาทผู้ดูแลระบบสงวนไว้สำหรับบัญชี support เท่านั้น";
}

export function isSystemAdminRoleCode(
  roleCode: string | null | undefined,
): boolean {
  return (roleCode?.trim().toUpperCase() ?? "") === SYSTEM_ADMIN_ROLE_CODE;
}

/**
 * Prisma filter: exclude system ADMIN accounts from workforce / payroll.
 * Admins are system operators, not billable staff.
 */
export function excludeSystemAdminEmployeeWhere(): Prisma.EmployeeWhereInput {
  return {
    NOT: {
      roleRecord: { code: SYSTEM_ADMIN_ROLE_CODE },
    },
  };
}

/** Active workforce used for schedules, attendance, and payroll. */
export function workforceEmployeeWhere(
  extra: Prisma.EmployeeWhereInput = {},
): Prisma.EmployeeWhereInput {
  return {
    AND: [
      excludeSystemAdminEmployeeWhere(),
      {
        isActive: true,
        hrStatus: { in: ["ACTIVE", "PROBATION"] },
      },
      extra,
    ],
  };
}

export function assertActorMayAssignRoleCode(
  actorEmail: string | null | undefined,
  roleCode: string | null | undefined,
): { ok: true } | { ok: false; message: string } {
  if (!isSystemAdminRoleCode(roleCode)) {
    return { ok: true };
  }
  if (canActorManageSystemAdminRole(actorEmail)) {
    return { ok: true };
  }
  return { ok: false, message: systemAdminRoleForbiddenMessage() };
}

/** True when target employee is support via email column or auth user id. */
export async function isProtectedSupportEmployeeRecord(employee: {
  email?: string | null;
  authUserId?: string | null;
}): Promise<boolean> {
  if (isProtectedSupportEmail(employee.email)) return true;
  if (!employee.authUserId) return false;
  const authUserIds = await resolveProtectedAuthUserIds();
  return authUserIds.includes(employee.authUserId);
}

/**
 * Protected records are mutable only by the matching support Auth user.
 * Non-support actors are always denied.
 */
export async function canActorMutateSupportEmployee(
  actor: {
    email?: string | null;
    authUserId?: string | null;
  },
  employee: {
    email?: string | null;
    authUserId?: string | null;
  },
): Promise<boolean> {
  if (!(await isProtectedSupportEmployeeRecord(employee))) {
    return true;
  }
  if (!isProtectedSupportEmail(actor.email)) {
    return false;
  }
  if (employee.authUserId && actor.authUserId) {
    return employee.authUserId === actor.authUserId;
  }
  if (employee.email && actor.email) {
    return normalizeEmail(actor.email) === normalizeEmail(employee.email);
  }
  return false;
}
