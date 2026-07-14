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

export type ResolveAuthUserResult =
  | { ok: true; authUserId: string; created: boolean }
  | { ok: false; message: string };

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
