import { redirect } from "next/navigation";
import { Building2 } from "lucide-react";

import LoginForm from "@/app/login/LoginForm";
import { prisma } from "@/lib/prisma";
import { createClient } from "@/lib/supabase/server";

export default async function LoginPage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (user) {
    const employee = await prisma.employee.findUnique({
      where: { authUserId: user.id },
      select: { isActive: true, mustResetPassword: true, roleId: true },
    });
    if (employee?.isActive && employee.mustResetPassword) {
      redirect("/set-password");
    }
    if (employee?.isActive && employee.roleId) {
      redirect("/");
    }
  }

  return (
    <main className="flex min-h-screen items-center justify-center bg-muted px-4 py-10">
      <section className="w-full max-w-md rounded-3xl border border-border bg-surface p-7 shadow-xl shadow-border/60 sm:p-9">
        <div className="mb-8 text-center">
          <div className="mx-auto mb-4 flex size-14 items-center justify-center rounded-2xl bg-primary text-primary-foreground">
            <Building2 size={28} />
          </div>
          <p className="text-sm font-medium text-primary">Resident</p>
          <h1 className="mt-1 text-2xl font-semibold text-foreground">
            เข้าสู่ระบบ / ลงทะเบียน
          </h1>
          <p className="mt-2 text-sm text-muted-foreground">
            ระบบจัดการที่พักสำหรับพนักงาน
          </p>
        </div>
        <LoginForm />
      </section>
    </main>
  );
}
