"use server";

import { createPasswordResetTicket } from "@/lib/auth/password-reset-ticket";
import {
  GENERIC_LOGIN_ERROR,
  resolveLoginIdentifier,
} from "@/lib/auth/login-identifier";
import { rotateEmployeeSessionEpoch } from "@/lib/auth/rotate-session-epoch";
import { readSessionEpochFromAccessToken } from "@/lib/auth/session-epoch";
import { prisma } from "@/lib/prisma";
import { ensureAuthLoginEmail } from "@/lib/supabase/admin";
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
  phone: string | null;
  mustResetPassword: boolean;
};

const pendingSelect = {
  id: true,
  isActive: true,
  roleId: true,
  authUserId: true,
  email: true,
  phone: true,
  mustResetPassword: true,
} as const;

async function findPendingResetByEmail(
  email: string,
): Promise<PendingResetEmployee | null> {
  return prisma.employee.findFirst({
    where: {
      email: { equals: email, mode: "insensitive" },
      mustResetPassword: true,
      authUserId: { not: null },
    },
    select: pendingSelect,
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
    select: pendingSelect,
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
    select: pendingSelect,
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
  if (!employee.email && !employee.phone) {
    return {
      error: "บัญชียังไม่มีช่องทางสำหรับตั้งรหัสผ่าน กรุณาติดต่อผู้ดูแลระบบ",
    };
  }

  const ticket = createPasswordResetTicket({
    employeeId: employee.id,
    authUserId: employee.authUserId,
    email: employee.email,
    phone: employee.phone,
  });

  return {
    error: null,
    nextPath: `/set-password?ticket=${encodeURIComponent(ticket)}`,
  };
}

type LoginEmployeeGate = {
  username: string | null;
  email: string | null;
  isActive: boolean;
  roleId: string | null;
  authUserId: string | null;
};

function gateLoginEmployee(
  employee: LoginEmployeeGate | null,
): LoginState | null {
  if (!employee?.authUserId) {
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
  return null;
}

async function resolvePasswordLoginEmail(employee: {
  username: string | null;
  authUserId: string;
  email: string | null;
}): Promise<string | null> {
  if (employee.username) {
    const ensured = await ensureAuthLoginEmail({
      authUserId: employee.authUserId,
      username: employee.username,
    });
    if (ensured.ok) return ensured.email;
  }

  // Legacy employees that login with contact email Auth identity.
  if (employee.email) return employee.email.toLowerCase();
  return null;
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

  // First login / forced reset: identifier alone is enough (set password next).
  if (pendingReset) {
    return ticketRedirect(pendingReset);
  }

  if (!password) {
    return {
      error: "กรุณากรอกรหัสผ่าน",
    };
  }

  const supabase = await createClient();
  let authEmail: string | null = null;
  const employeeSelect = {
    username: true,
    email: true,
    isActive: true,
    roleId: true,
    authUserId: true,
  } as const;

  if (resolved.kind === "email") {
    // Prefer Employee.contact email → username Auth mailbox.
    // Self-registered / HR users store contact email separately from Auth login.
    const byContact = await prisma.employee.findFirst({
      where: { email: { equals: resolved.email, mode: "insensitive" } },
      select: employeeSelect,
    });
    if (byContact) {
      const gate = gateLoginEmployee(byContact);
      if (gate) return gate;
      authEmail = await resolvePasswordLoginEmail({
        username: byContact.username,
        authUserId: byContact.authUserId!,
        email: byContact.email,
      });
    } else {
      // Legacy: typed email is the Auth identity itself.
      authEmail = resolved.email;
    }
  } else if (resolved.kind === "phone") {
    const employee = await prisma.employee.findFirst({
      where: { phone: resolved.phone },
      select: employeeSelect,
    });

    const gate = gateLoginEmployee(employee);
    if (gate) return gate;

    authEmail = await resolvePasswordLoginEmail({
      username: employee!.username,
      authUserId: employee!.authUserId!,
      email: employee!.email,
    });
  } else {
    const employee = await prisma.employee.findUnique({
      where: { username: resolved.username },
      select: employeeSelect,
    });

    const gate = gateLoginEmployee(employee);
    if (gate) return gate;

    authEmail = await resolvePasswordLoginEmail({
      username: employee!.username ?? resolved.username,
      authUserId: employee!.authUserId!,
      email: employee!.email,
    });
  }

  if (!authEmail) {
    return { error: GENERIC_LOGIN_ERROR };
  }

  const {
    data: { user },
    error,
  } = await supabase.auth.signInWithPassword({
    email: authEmail,
    password,
  });

  if (error || !user) {
    return { error: GENERIC_LOGIN_ERROR };
  }

  let employee = await prisma.employee.findUnique({
    where: { authUserId: user.id },
    select: {
      id: true,
      isActive: true,
      roleId: true,
      mustResetPassword: true,
      username: true,
    },
  });

  // Repair: Auth mailbox matched username login but Employee.authUserId pointed
  // at a different (contact-email) Auth user after an admin email edit.
  if (!employee && resolved.kind === "username") {
    const byUsername = await prisma.employee.findUnique({
      where: { username: resolved.username },
      select: {
        id: true,
        isActive: true,
        roleId: true,
        mustResetPassword: true,
        username: true,
        authUserId: true,
      },
    });
    if (byUsername?.isActive && byUsername.roleId) {
      await prisma.employee.update({
        where: { id: byUsername.id },
        data: { authUserId: user.id },
      });
      employee = {
        id: byUsername.id,
        isActive: byUsername.isActive,
        roleId: byUsername.roleId,
        mustResetPassword: byUsername.mustResetPassword,
        username: byUsername.username,
      };
    }
  } else if (!employee && resolved.kind === "phone") {
    const byPhone = await prisma.employee.findFirst({
      where: { phone: resolved.phone },
      select: {
        id: true,
        isActive: true,
        roleId: true,
        mustResetPassword: true,
        username: true,
      },
    });
    if (byPhone?.isActive && byPhone.roleId && byPhone.username) {
      await prisma.employee.update({
        where: { id: byPhone.id },
        data: { authUserId: user.id },
      });
      employee = {
        id: byPhone.id,
        isActive: byPhone.isActive,
        roleId: byPhone.roleId,
        mustResetPassword: byPhone.mustResetPassword,
        username: byPhone.username,
      };
    }
  } else if (!employee && resolved.kind === "email") {
    const byContact = await prisma.employee.findFirst({
      where: { email: { equals: resolved.email, mode: "insensitive" } },
      select: {
        id: true,
        isActive: true,
        roleId: true,
        mustResetPassword: true,
        username: true,
      },
    });
    if (byContact?.isActive && byContact.roleId && byContact.username) {
      await prisma.employee.update({
        where: { id: byContact.id },
        data: { authUserId: user.id },
      });
      employee = {
        id: byContact.id,
        isActive: byContact.isActive,
        roleId: byContact.roleId,
        mustResetPassword: byContact.mustResetPassword,
        username: byContact.username,
      };
    }
  }

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

  // Single-device login: bump session epoch, stamp JWT, then revoke other devices.
  const rotated = await rotateEmployeeSessionEpoch({
    employeeId: employee.id,
    authUserId: user.id,
  });
  if (!rotated.ok) {
    console.error("rotateEmployeeSessionEpoch failed", rotated.message);
    await supabase.auth.signOut();
    return { error: "เข้าสู่ระบบไม่สำเร็จ กรุณาลองใหม่" };
  }

  // Refresh until the new access token carries the epoch. Prefer the token
  // returned by refreshSession (cookie reads in the same Server Action can lag).
  let epochInJwt = false;
  for (let attempt = 0; attempt < 3; attempt += 1) {
    const { data: refreshData, error: refreshError } =
      await supabase.auth.refreshSession();
    if (refreshError) {
      console.error("refreshSession after epoch rotate failed", refreshError);
      await supabase.auth.signOut();
      return { error: "เข้าสู่ระบบไม่สำเร็จ กรุณาลองใหม่" };
    }

    const tokenEpoch = readSessionEpochFromAccessToken(
      refreshData.session?.access_token,
    );
    if (tokenEpoch === rotated.sessionEpoch) {
      epochInJwt = true;
      break;
    }

    await new Promise((resolve) => setTimeout(resolve, 150 * (attempt + 1)));
  }

  if (!epochInJwt) {
    console.error("session epoch missing from JWT after refresh", {
      expected: rotated.sessionEpoch,
    });
    await supabase.auth.signOut();
    return { error: "เข้าสู่ระบบไม่สำเร็จ กรุณาลองใหม่" };
  }

  const { error: othersError } = await supabase.auth.signOut({
    scope: "others",
  });
  if (othersError) {
    // Best-effort: epoch check still blocks stale access tokens.
    console.warn("signOut(scope=others) failed", othersError.message);
  }

  return {
    error: null,
    nextPath: employee.mustResetPassword ? "/set-password" : "/",
  };
}
