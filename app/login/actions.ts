"use server";

import { createPasswordResetTicket } from "@/lib/auth/password-reset-ticket";
import {
  GENERIC_LOGIN_ERROR,
  resolveLoginIdentifier,
} from "@/lib/auth/login-identifier";
import { prisma } from "@/lib/prisma";
import { createClient } from "@/lib/supabase/server";

export type LoginState = {
  error: string | null;
  nextPath?: string | null;
};

type PendingResetEmployee = {
  id: string;
  isActive: boolean;
  roleId: string | null;
  authUserId: string | null;
  email: string | null;
  mustResetPassword: boolean;
};

async function findPendingResetByEmail(
  email: string,
): Promise<PendingResetEmployee | null> {
  return prisma.employee.findFirst({
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
}

async function findPendingResetByPhone(
  phone: string,
): Promise<PendingResetEmployee | null> {
  return prisma.employee.findFirst({
    where: {
      phone,
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
}

async function findPendingResetByUsername(
  username: string,
): Promise<PendingResetEmployee | null> {
  return prisma.employee.findFirst({
    where: {
      username,
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
}

function ticketRedirect(employee: PendingResetEmployee): LoginState {
  if (!employee.isActive) {
    return {
      error:
        "บัญชีรอการเปิดใช้งานจากผู้ดูแลระบบ กรุณาติดต่อผู้จัดการเพื่อกำหนดสิทธิ์",
    };
  }
  if (!employee.roleId || !employee.authUserId) {
    return {
      error: "บัญชียังไม่ได้กำหนดสิทธิ์ กรุณาติดต่อผู้ดูแลระบบ",
    };
  }

  // Email-based ticket path (legacy). Phone-auth users without email go through
  // session login + /set-password middleware instead.
  if (employee.email) {
    const ticket = createPasswordResetTicket({
      employeeId: employee.id,
      authUserId: employee.authUserId,
      email: employee.email,
    });
    return {
      error: null,
      nextPath: `/set-password?ticket=${encodeURIComponent(ticket)}`,
    };
  }

  return {
    error: null,
    nextPath: "/set-password",
  };
}

export async function login(
  _previousState: LoginState,
  formData: FormData,
): Promise<LoginState> {
  const identifierRaw = formData.get("identifier") ?? formData.get("email");
  const passwordRaw = formData.get("password");

  if (typeof identifierRaw !== "string" || !identifierRaw.trim()) {
    return {
      error: "กรุณากรอกชื่อผู้ใช้ เบอร์โทรศัพท์ หรืออีเมล",
    };
  }

  const resolved = resolveLoginIdentifier(identifierRaw);
  if (!resolved.ok) {
    return { error: resolved.message };
  }

  const password =
    typeof passwordRaw === "string" ? passwordRaw : "";

  let pendingReset: PendingResetEmployee | null = null;
  if (resolved.kind === "email") {
    pendingReset = await findPendingResetByEmail(resolved.email);
  } else if (resolved.kind === "phone") {
    pendingReset = await findPendingResetByPhone(resolved.phone);
  } else {
    pendingReset = await findPendingResetByUsername(resolved.username);
  }

  // Legacy email reset-ticket shortcut (no password required).
  if (pendingReset?.email && resolved.kind === "email") {
    return ticketRedirect(pendingReset);
  }

  if (!password) {
    return {
      error: "กรุณากรอกรหัสผ่าน",
    };
  }

  const supabase = await createClient();
  let authCredential:
    | { email: string; password: string }
    | { phone: string; password: string };

  if (resolved.kind === "email") {
    authCredential = { email: resolved.email, password };
  } else if (resolved.kind === "phone") {
    authCredential = { phone: resolved.phone, password };
  } else {
    const employee = await prisma.employee.findUnique({
      where: { username: resolved.username },
      select: {
        phone: true,
        isActive: true,
        roleId: true,
        authUserId: true,
      },
    });

    if (!employee?.phone || !employee.authUserId) {
      return { error: GENERIC_LOGIN_ERROR };
    }
    if (!employee.isActive) {
      return {
        error:
          "บัญชีรอการเปิดใช้งานจากผู้ดูแลระบบ กรุณาติดต่อผู้จัดการเพื่อกำหนดสิทธิ์",
      };
    }
    if (!employee.roleId) {
      return {
        error: "บัญชียังไม่ได้กำหนดสิทธิ์ กรุณาติดต่อผู้ดูแลระบบ",
      };
    }

    authCredential = { phone: employee.phone, password };
  }

  const {
    data: { user },
    error,
  } = await supabase.auth.signInWithPassword(authCredential);

  if (error || !user) {
    return { error: GENERIC_LOGIN_ERROR };
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
