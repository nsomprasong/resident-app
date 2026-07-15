import { createClient } from "@supabase/supabase-js";

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

/** Server-only Supabase client with service role. Never import from Client Components. */
export function createAdminClient() {
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

function normalizePhoneLookup(phone: string) {
  return phone.trim();
}

/**
 * Find Auth user by phone (E.164). Paginates listUsers — same pattern as email lookup.
 */
export async function findAuthUserIdByPhone(phone: string): Promise<string | null> {
  const admin = createAdminClient();
  const normalized = normalizePhoneLookup(phone);
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

    const matched = data.users.find((user) => user.phone === normalized);
    if (matched?.id) return matched.id;

    if (data.users.length < perPage) return null;
    page += 1;
    if (page > 50) return null;
  }
}

/**
 * Create a confirmed phone Auth user with an explicit password.
 * Does not reuse existing users — callers must uniqueness-check first.
 */
export async function createAuthUserWithPhone(input: {
  phone: string;
  password: string;
}): Promise<ResolveAuthUserResult> {
  const phone = normalizePhoneLookup(input.phone);
  if (!phone.startsWith("+")) {
    return { ok: false, message: "เบอร์โทรศัพท์ไม่ถูกต้อง" };
  }
  if (!input.password || input.password.length < 8) {
    return { ok: false, message: "รหัสผ่านต้องมีอย่างน้อย 8 ตัวอักษร" };
  }

  try {
    const existingId = await findAuthUserIdByPhone(phone);
    if (existingId) {
      return {
        ok: false,
        message: "เบอร์โทรนี้มีบัญชี Auth อยู่แล้ว",
      };
    }

    const admin = createAdminClient();
    const { data, error } = await admin.auth.admin.createUser({
      phone,
      password: input.password,
      phone_confirm: true,
      user_metadata: {
        provisioned_by: "employee_manage_phone",
      },
    });

    if (error) {
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

/**
 * Update phone on an Auth user that already uses phone identity.
 * Do not call this for email-identity legacy accounts.
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

    if (existing.user.email && !existing.user.phone) {
      return {
        ok: false,
        message: "บัญชีนี้ยังใช้ Email Login — ห้ามเปลี่ยนเป็น Phone อัตโนมัติ",
      };
    }

    const phone = normalizePhoneLookup(input.phone);
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
