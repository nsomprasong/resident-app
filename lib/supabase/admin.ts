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
 * Creates email-only first (phone provider is often disabled and doubles latency),
 * then best-effort attaches phone for lookup/display.
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
      phone,
    };

    // Email-only create is the fast path — login uses Auth email, not phone.
    // Avoid listUsers pre-scans and phone-first create (often fails then retries).
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

    // Best-effort phone attach; do not fail employee create if phone sync fails.
    const phoneSync = await updateAuthUserPhone({
      authUserId: data.user.id,
      phone,
    });
    if (!phoneSync.ok) {
      console.warn(
        "createEmployeeAuthUser: phone sync skipped",
        phoneSync.message,
      );
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
        message: `ผูก Auth login email ไม่สำเร็จ: ${updateError.message}`,
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
 * Sync Employee phone onto the Auth user record (display / lookup).
 * Does not switch login identity — password login still uses Auth email when present.
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
      return { ok: false, message: error.message };
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
          const emailOk = await ensureAuthLoginEmail({
            authUserId: input.authUserId,
            username,
          });
          if (!emailOk.ok) return emailOk;
        }
        if (phone) {
          const phoneOk = await updateAuthUserPhone({
            authUserId: input.authUserId,
            phone,
          });
          if (!phoneOk.ok) {
            // Phone sync is best-effort when Auth email login already works.
            console.warn("ensureEmployeeAuthProvisioned phone sync", phoneOk.message);
          }
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
        const phoneOk = await updateAuthUserPhone({
          authUserId: existingByEmail,
          phone,
        });
        if (!phoneOk.ok) {
          console.warn("ensureEmployeeAuthProvisioned phone sync", phoneOk.message);
        }
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
