"use server";

import { createPasswordResetTicket } from "@/lib/auth/password-reset-ticket";
import { prisma } from "@/lib/prisma";
import { createClient } from "@/lib/supabase/server";

export type LoginState = {
  error: string | null;
  nextPath?: string | null;
};

function normalizeEmail(email: string) {
  return email.trim().toLowerCase();
}

export async function login(
  _previousState: LoginState,
  formData: FormData,
): Promise<LoginState> {
  const emailRaw = formData.get("email");
  const passwordRaw = formData.get("password");

  if (typeof emailRaw !== "string" || !emailRaw.trim()) {
    return { error: "กรุณากรอกอีเมล" };
  }

  const email = normalizeEmail(emailRaw);
  const password =
    typeof passwordRaw === "string" ? passwordRaw : "";

  const pendingReset = await prisma.employee.findFirst({
    where: {
      email: { equals: email, mode: "insensitive" },
      mustResetPassword: true,
      authUserId: { not: null },
    },
    select: {
      id: true,
      isActive: true,
      roleId: true,
      authUserId: true,
      email: true,
      mustResetPassword: true,
    },
  });

  if (pendingReset) {
    if (!pendingReset.isActive) {
      return {
        error:
          "บัญชีรอการเปิดใช้งานจากผู้ดูแลระบบ กรุณาติดต่อผู้จัดการเพื่อกำหนดสิทธิ์",
      };
    }
    if (!pendingReset.roleId || !pendingReset.authUserId || !pendingReset.email) {
      return {
        error: "บัญชียังไม่ได้กำหนดสิทธิ์ กรุณาติดต่อผู้ดูแลระบบ",
      };
    }

    const ticket = createPasswordResetTicket({
      employeeId: pendingReset.id,
      authUserId: pendingReset.authUserId,
      email: pendingReset.email,
    });

    return {
      error: null,
      nextPath: `/set-password?ticket=${encodeURIComponent(ticket)}`,
    };
  }

  if (!password) {
    return { error: "กรุณากรอกอีเมลและรหัสผ่าน" };
  }

  const supabase = await createClient();
  const {
    data: { user },
    error,
  } = await supabase.auth.signInWithPassword({
    email,
    password,
  });

  if (error || !user) {
    return { error: "อีเมลหรือรหัสผ่านไม่ถูกต้อง" };
  }

  const employee = await prisma.employee.findUnique({
    where: { authUserId: user.id },
    select: {
      id: true,
      isActive: true,
      roleId: true,
      mustResetPassword: true,
    },
  });

  if (!employee) {
    await supabase.auth.signOut();
    return { error: "บัญชีนี้ยังไม่ได้รับสิทธิ์เข้าใช้งานระบบ" };
  }

  if (!employee.isActive) {
    await supabase.auth.signOut();
    return {
      error:
        "บัญชีรอการเปิดใช้งานจากผู้ดูแลระบบ กรุณาติดต่อผู้จัดการเพื่อกำหนดสิทธิ์",
    };
  }

  if (!employee.roleId) {
    await supabase.auth.signOut();
    return {
      error: "บัญชียังไม่ได้กำหนดสิทธิ์ กรุณาติดต่อผู้ดูแลระบบ",
    };
  }

  return {
    error: null,
    nextPath: employee.mustResetPassword ? "/set-password" : "/",
  };
}
