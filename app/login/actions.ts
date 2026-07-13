"use server";

import { redirect } from "next/navigation";

import { prisma } from "@/lib/prisma";
import { createClient } from "@/lib/supabase/server";

export type LoginState = {
  error: string | null;
};

export async function login(
  _previousState: LoginState,
  formData: FormData,
): Promise<LoginState> {
  const email = formData.get("email");
  const password = formData.get("password");

  if (
    typeof email !== "string" ||
    typeof password !== "string" ||
    !email.trim() ||
    !password
  ) {
    return { error: "กรุณากรอกอีเมลและรหัสผ่าน" };
  }

  const supabase = await createClient();
  const {
    data: { user },
    error,
  } = await supabase.auth.signInWithPassword({
    email: email.trim(),
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

  if (employee.mustResetPassword) {
    redirect("/set-password");
  }

  redirect("/");
}
