import { createClient } from "@supabase/supabase-js";

import {
  authLoginEmailForUsername,
  normalizeThaiPhone,
  normalizeUsername,
} from "@/lib/auth/login-identifier";
import { getSupabasePublicEnvironment } from "@/lib/supabase/config";

function getSupabaseServiceRoleKey() {
  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!serviceRoleKey) {
    throw new Error(
      "Supabase Admin is not configured. Set SUPABASE_SERVICE_ROLE_KEY on the server.",
    );
  }
  return serviceRoleKey;
}

/**
 * Auth Admin paths never use Realtime, but supabase-js still constructs a
 * Realtime client. Node < 22 has no native WebSocket — stub just enough to boot.
 */
function ensureAdminClientWebSocketStub() {
  if (typeof globalThis.WebSocket !== "undefined") return;
  class AdminWebSocketStub {
    readonly CONNECTING = 0;
    readonly OPEN = 1;
    readonly CLOSING = 2;
    readonly CLOSED = 3;
    readyState = 3;
    url = "";
    protocol = "";
    close() {}
    send() {}
    addEventListener() {}
    removeEventListener() {}
    dispatchEvent() {
      return false;
    }
  }
  Object.defineProperty(globalThis, "WebSocket", {
    value: AdminWebSocketStub,
    configurable: true,
    writable: true,
  });
}

/** Server-only Supabase client with service role. Never import from Client Components. */
export function createAdminClient() {
  ensureAdminClientWebSocketStub();
  const { url } = getSupabasePublicEnvironment();
  return createClient(url, getSupabaseServiceRoleKey(), {
    auth: {
      autoRefreshToken: false,
      persistSession: false,
    },
  });
}

function normalizeEmail(email: string) {
  return email.trim().toLowerCase();
}

export async function findAuthUserIdByEmail(email: string): Promise<string | null> {
  const admin = createAdminClient();
  const normalized = normalizeEmail(email);
  const perPage = 200;
  let page = 1;

  for (;;) {
    const { data, error } = await admin.auth.admin.listUsers({
      page,
      perPage,
    });
    if (error) {
      throw new Error(`ไม่สามารถค้นหา Auth user ได้: ${error.message}`);
    }

    const matched = data.users.find(
      (user) => user.email?.toLowerCase() === normalized,
    );
    if (matched?.id) return matched.id;

    if (data.users.length < perPage) return null;
    page += 1;
    if (page > 50) return null;
  }
}

export function createTemporaryPassword() {
  const bytes = crypto.getRandomValues(new Uint8Array(24));
  const encoded = Buffer.from(bytes).toString("base64url");
  return `${encoded}Aa1!`;
}

/** Best-effort Auth user removal after an employee row is wiped. */
export async function deleteAuthUserById(
  authUserId: string,
): Promise<{ ok: true } | { ok: false; message: string }> {
  try {
    const admin = createAdminClient();
    const { error } = await admin.auth.admin.deleteUser(authUserId);
    if (error) {
      return { ok: false, message: error.message };
    }
    return { ok: true };
  } catch (error) {
    const message =
      error instanceof Error ? error.message : "ลบ Auth user ไม่สำเร็จ";
    return { ok: false, message };
  }
}

export type ResolveAuthUserResult =
  | { ok: true; authUserId: string; created: boolean }
  | { ok: false; message: string };

function phoneDigits(phone: string) {
  return phone.replace(/\D/g, "");
}

/**
 * Find Auth user by phone. Compares digit forms because GoTrue may store
 * `6681…` while app data uses `+6681…`.
 */
export async function findAuthUserIdByPhone(phone: string): Promise<string | null> {
  const admin = createAdminClient();
  const target = phoneDigits(phone);
  if (!target) return null;
  const perPage = 200;
  let page = 1;

  for (;;) {
    const { data, error } = await admin.auth.admin.listUsers({
      page,
      perPage,
    });
    if (error) {
      throw new Error(`ไม่สามารถค้นหา Auth user ได้: ${error.message}`);
    }

    const matched = data.users.find(
      (user) => user.phone && phoneDigits(user.phone) === target,
    );
    if (matched?.id) return matched.id;

    if (data.users.length < perPage) return null;
    page += 1;
    if (page > 50) return null;
  }
}

function isAuthNetworkErrorMessage(message: string) {
  return /failed to fetch|fetch failed|network|ECONNRESET|ETIMEDOUT|ENOTFOUND|socket/i.test(
    message,
  );
}

function mapAuthProvisionErrorMessage(message: string): string {
  const lower = message.toLowerCase();
  if (isAuthNetworkErrorMessage(message)) {
    return "เชื่อมต่อระบบยืนยันตัวตนไม่สำเร็จ กรุณาลองใหม่";
  }
  if (
    lower.includes("already been registered") ||
    lower.includes("already registered") ||
    lower.includes("user already exists") ||
    lower.includes("email address has already")
  ) {
    return "Username นี้มีบัญชี Auth อยู่แล้ว";
  }
  if (lower.includes("phone") && lower.includes("already")) {
    return "เบอร์โทรนี้มีบัญชี Auth อยู่แล้ว";
  }
  return `สร้าง Auth user ไม่สำเร็จ: ${message}`;
}

/**
 * Create Auth user for a new username/phone employee.
 * Password login uses username-bound Auth email (Employee.email stays null).
 * Email-only Auth — do not attach phone identity (breaks mobile Server Actions).
 */
export async function createEmployeeAuthUser(input: {
  username: string;
  phone: string;
  password: string;
}): Promise<ResolveAuthUserResult> {
  const username = normalizeUsername(input.username);
  const phone = normalizeThaiPhone(input.phone);
  const authEmail = authLoginEmailForUsername(username);

  if (!username) {
    return { ok: false, message: "Username ไม่ถูกต้อง" };
  }
  if (!phone) {
    return { ok: false, message: "เบอร์โทรศัพท์ไม่ถูกต้อง" };
  }
  if (!input.password || input.password.length < 8) {
    return { ok: false, message: "รหัสผ่านต้องมีอย่างน้อย 8 ตัวอักษร" };
  }

  try {
    const admin = createAdminClient();
    const metadata = {
      provisioned_by: "employee_manage_username",
      username,
      // Keep phone in metadata for ops only — not as Auth phone identity.
      employee_phone: phone,
    };

    const { data, error } = await admin.auth.admin.createUser({
      email: authEmail,
      password: input.password,
      email_confirm: true,
      user_metadata: metadata,
    });

    if (error) {
      return { ok: false, message: mapAuthProvisionErrorMessage(error.message) };
    }

    if (!data.user?.id) {
      return { ok: false, message: "สร้าง Auth user ไม่สำเร็จ" };
    }

    return { ok: true, authUserId: data.user.id, created: true };
  } catch (error) {
    const raw =
      error instanceof Error ? error.message : "เชื่อมต่อ Supabase Admin ไม่สำเร็จ";
    return { ok: false, message: mapAuthProvisionErrorMessage(raw) };
  }
}

/**
 * Ensure phone-only Auth users (created before username-email provisioning)
 * get a confirmed Auth email so password login works when Phone logins are disabled.
 */
export async function ensureAuthLoginEmail(input: {
  authUserId: string;
  username: string;
}): Promise<{ ok: true; email: string } | { ok: false; message: string }> {
  const username = normalizeUsername(input.username);
  const expected = authLoginEmailForUsername(username);

  try {
    const admin = createAdminClient();
    const { data, error } = await admin.auth.admin.getUserById(input.authUserId);
    if (error || !data.user) {
      return { ok: false, message: "ไม่พบ Auth user" };
    }

    const current = (data.user.email ?? "").trim().toLowerCase();
    if (current === expected) {
      return { ok: true, email: expected };
    }

    // Username accounts always authenticate via the username mailbox.
    // Do not keep a contact email on Auth — that orphans the registration password.
    const { error: updateError } = await admin.auth.admin.updateUserById(
      input.authUserId,
      {
        email: expected,
        email_confirm: true,
      },
    );
    if (updateError) {
      // Expected mailbox may already belong to the original Auth user — use it.
      const existingId = await findAuthUserIdByEmail(expected);
      if (existingId) {
        return { ok: true, email: expected };
      }
      return {
        ok: false,
        message: `ผูก Auth login email ไม่สำเร็จ: ${
          typeof updateError.message === "string" && updateError.message.trim()
            ? updateError.message
            : "ไม่สามารถอัปเดตอีเมล Auth ได้"
        }`,
      };
    }

    return { ok: true, email: expected };
  } catch (error) {
    const message =
      error instanceof Error ? error.message : "ผูก Auth login email ไม่สำเร็จ";
    return { ok: false, message };
  }
}

/**
 * Remove phone from Auth user so sessions stay email-only.
 * Username login does not need a phone identity (Phone provider is often disabled),
 * and dual email+phone identities have caused mobile Server Action cookie failures.
 */
export async function clearAuthUserPhone(input: {
  authUserId: string;
}): Promise<{ ok: true } | { ok: false; message: string }> {
  try {
    const admin = createAdminClient();
    const { data: existing, error: getError } = await admin.auth.admin.getUserById(
      input.authUserId,
    );
    if (getError || !existing.user) {
      return { ok: false, message: "ไม่พบ Auth user" };
    }

    const authPhone = (existing.user.phone ?? "").trim();
    const phoneIdentities = (existing.user.identities ?? []).filter(
      (identity) => identity.provider === "phone",
    );
    if (!authPhone && phoneIdentities.length === 0) {
      return { ok: true };
    }

    // updateUserById({ phone: "" }) is a no-op in GoTrue — must DELETE phone identities.
    const { url } = getSupabasePublicEnvironment();
    const serviceRoleKey = getSupabaseServiceRoleKey();
    for (const identity of phoneIdentities) {
      const identityId = identity.identity_id || identity.id;
      if (!identityId) continue;
      const response = await fetch(
        `${url}/auth/v1/admin/users/${input.authUserId}/identities/${identityId}`,
        {
          method: "DELETE",
          headers: {
            Authorization: `Bearer ${serviceRoleKey}`,
            apikey: serviceRoleKey,
          },
        },
      );
      if (!response.ok) {
        const body = await response.text().catch(() => "");
        return {
          ok: false,
          message: `ลบ phone identity ไม่สำเร็จ (${response.status})${
            body ? `: ${body.slice(0, 200)}` : ""
          }`,
        };
      }
    }

    const { error } = await admin.auth.admin.updateUserById(input.authUserId, {
      phone: "",
      user_metadata: {
        ...(existing.user.user_metadata ?? {}),
        phone: null,
      },
    });
    // Identity may already be gone; phone field clear is best-effort.

    const verify = await admin.auth.admin.getUserById(input.authUserId);
    const stillHasPhone = Boolean((verify.data.user?.phone ?? "").trim());
    const stillHasPhoneIdentity = (verify.data.user?.identities ?? []).some(
      (identity) => identity.provider === "phone",
    );
    if (stillHasPhone || stillHasPhoneIdentity) {
      return {
        ok: false,
        message: "ล้างเบอร์บน Auth ไม่สำเร็จ — ยังมี phone identity ค้างอยู่",
      };
    }

    return { ok: true };
  } catch (error) {
    const message =
      error instanceof Error ? error.message : "ล้างเบอร์บน Auth ไม่สำเร็จ";
    return { ok: false, message };
  }
}

/**
 * Sync Employee phone onto the Auth user record (display / lookup).
 * Does not switch login identity — password login still uses Auth email when present.
 *
 * Prefer not calling this for username-mailbox accounts; dual phone+email
 * identities inflate auth cookies and break mobile Server Actions.
 */
export async function updateAuthUserPhone(input: {
  authUserId: string;
  phone: string;
}): Promise<{ ok: true } | { ok: false; message: string }> {
  try {
    const admin = createAdminClient();
    const { data: existing, error: getError } = await admin.auth.admin.getUserById(
      input.authUserId,
    );
    if (getError || !existing.user) {
      return { ok: false, message: "ไม่พบ Auth user" };
    }

    const authPhone = (existing.user.phone ?? "").trim();
    const phone = normalizeThaiPhone(input.phone) ?? input.phone.trim();
    if (!phone) {
      return { ok: false, message: "เบอร์โทรศัพท์ไม่ถูกต้อง" };
    }
    if (authPhone && phoneDigits(authPhone) === phoneDigits(phone)) {
      return { ok: true };
    }

    const { error } = await admin.auth.admin.updateUserById(input.authUserId, {
      phone,
      phone_confirm: true,
    });
    if (error) {
      const rawMessage =
        typeof error.message === "string" ? error.message.trim() : "";
      return {
        ok: false,
        message:
          rawMessage && rawMessage !== "{}"
            ? rawMessage
            : "ไม่สามารถซิงก์เบอร์โทรไปยัง Auth ได้ (ระบบเข้าสู่ระบบด้วย Username ยังใช้ได้ปกติ)",
      };
    }
    return { ok: true };
  } catch (error) {
    const message =
      error instanceof Error ? error.message : "อัปเดตเบอร์ Auth ไม่สำเร็จ";
    return { ok: false, message };
  }
}

/**
 * Ensure Auth user exists and is linked when activating / enabling an employee.
 * Recreates Auth if authUserId is missing or the Auth user was deleted.
 */
export async function ensureEmployeeAuthProvisioned(input: {
  authUserId: string | null;
  username: string | null;
  phone: string | null;
  contactEmail: string | null;
}): Promise<
  | {
      ok: true;
      authUserId: string;
      created: boolean;
      mustResetPassword: boolean;
    }
  | { ok: false; message: string }
> {
  const username = input.username ? normalizeUsername(input.username) : null;
  const phone = input.phone ? normalizeThaiPhone(input.phone) : null;
  const contactEmail = input.contactEmail
    ? normalizeEmail(input.contactEmail)
    : null;

  try {
    if (input.authUserId) {
      const admin = createAdminClient();
      const { data, error } = await admin.auth.admin.getUserById(input.authUserId);
      if (!error && data.user) {
        if (username) {
          // Soft-fail: profile/role updates must not be blocked by Auth email sync.
          await ensureAuthLoginEmail({
            authUserId: input.authUserId,
            username,
          });
          // Username-mailbox accounts must stay email-only on Auth.
          await clearAuthUserPhone({
            authUserId: input.authUserId,
          });
        } else if (phone) {
          // Phone sync is best-effort when Auth email login already works.
          await updateAuthUserPhone({
            authUserId: input.authUserId,
            phone,
          });
        }
        return {
          ok: true,
          authUserId: input.authUserId,
          created: false,
          mustResetPassword: false,
        };
      }
    }

    if (username && phone) {
      const authEmail = authLoginEmailForUsername(username);
      const existingByEmail = await findAuthUserIdByEmail(authEmail);
      if (existingByEmail) {
        await clearAuthUserPhone({
          authUserId: existingByEmail,
        });
        return {
          ok: true,
          authUserId: existingByEmail,
          created: false,
          mustResetPassword: false,
        };
      }

      const created = await createEmployeeAuthUser({
        username,
        phone,
        password: createTemporaryPassword(),
      });
      if (!created.ok) return created;
      return {
        ok: true,
        authUserId: created.authUserId,
        created: true,
        mustResetPassword: true,
      };
    }

    if (contactEmail) {
      const resolved = await resolveAuthUserIdForEmail(contactEmail);
      if (!resolved.ok) return resolved;
      return {
        ok: true,
        authUserId: resolved.authUserId,
        created: resolved.created,
        mustResetPassword: resolved.created,
      };
    }

    return {
      ok: false,
      message:
        "ไม่สามารถสร้างบัญชี Authentication ได้ — ต้องมี Username+เบอร์โทร หรืออีเมล",
    };
  } catch (error) {
    const message =
      error instanceof Error ? error.message : "เชื่อมต่อ Supabase Admin ไม่สำเร็จ";
    return { ok: false, message };
  }
}

/**
 * Find an existing Supabase Auth user by email, or create a confirmed user.
 * Temporary password is not returned to callers; use Supabase recovery/reset to set credentials.
 */
export async function resolveAuthUserIdForEmail(
  email: string,
): Promise<ResolveAuthUserResult> {
  const normalized = normalizeEmail(email);
  if (!normalized || !normalized.includes("@")) {
    return { ok: false, message: "อีเมลไม่ถูกต้อง" };
  }

  try {
    const existingId = await findAuthUserIdByEmail(normalized);
    if (existingId) {
      return { ok: true, authUserId: existingId, created: false };
    }

    const admin = createAdminClient();
    const { data, error } = await admin.auth.admin.createUser({
      email: normalized,
      password: createTemporaryPassword(),
      email_confirm: true,
      user_metadata: {
        provisioned_by: "employee_manage",
      },
    });

    if (error) {
      const raceId = await findAuthUserIdByEmail(normalized);
      if (raceId) {
        return { ok: true, authUserId: raceId, created: false };
      }
      return {
        ok: false,
        message: `สร้าง Auth user ไม่สำเร็จ: ${error.message}`,
      };
    }

    if (!data.user?.id) {
      return { ok: false, message: "สร้าง Auth user ไม่สำเร็จ" };
    }

    return { ok: true, authUserId: data.user.id, created: true };
  } catch (error) {
    const message =
      error instanceof Error ? error.message : "เชื่อมต่อ Supabase Admin ไม่สำเร็จ";
    return { ok: false, message };
  }
}
