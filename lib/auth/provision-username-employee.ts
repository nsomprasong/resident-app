import {
  createEmployeeAuthUser,
  createTemporaryPassword,
  deleteAuthUserById,
} from "@/lib/supabase/admin";
import { prisma } from "@/lib/prisma";

/**
 * Shared Auth provisioning for Settings / HR / self-register.
 * Password login uses username-bound Auth email; contact email stays on Employee only.
 * Caller must persist Employee with mustResetPassword: true.
 */
export async function provisionUsernamePhoneAuth(input: {
  username: string;
  phone: string;
}): Promise<
  | { ok: true; authUserId: string }
  | { ok: false; message: string; code: "AUTH_EXISTS" | "AUTH_PROVISION_FAILED" }
> {
  const authResolved = await createEmployeeAuthUser({
    username: input.username,
    phone: input.phone,
    password: createTemporaryPassword(),
  });

  if (!authResolved.ok) {
    const conflict =
      authResolved.message.includes("มีบัญชี Auth อยู่แล้ว") ||
      authResolved.message.toLowerCase().includes("already");
    return {
      ok: false,
      message: authResolved.message,
      code: conflict ? "AUTH_EXISTS" : "AUTH_PROVISION_FAILED",
    };
  }

  const authOwner = await prisma.employee.findUnique({
    where: { authUserId: authResolved.authUserId },
    select: { id: true },
  });
  if (authOwner) {
    await deleteAuthUserById(authResolved.authUserId);
    return {
      ok: false,
      message: "Auth user นี้ถูกผูกกับพนักงานอื่นแล้ว",
      code: "AUTH_EXISTS",
    };
  }

  return { ok: true, authUserId: authResolved.authUserId };
}
