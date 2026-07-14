import Image from "next/image";
import { redirect } from "next/navigation";

import LoginForm from "@/app/login/LoginForm";
import { prisma } from "@/lib/prisma";
import { createClient } from "@/lib/supabase/server";

type LoginPageProps = {
  searchParams: Promise<{ passwordUpdated?: string }>;
};

export default async function LoginPage({ searchParams }: LoginPageProps) {
  const params = await searchParams;
  const passwordUpdated = params.passwordUpdated === "1";

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
          <Image
            src="/logo.png"
            alt="Resident"
            width={72}
            height={72}
            className="mx-auto mb-4 size-[72px] rounded-2xl shadow-sm"
            priority
          />
          <p className="text-sm font-medium text-primary">Resident</p>
          <h1 className="mt-1 text-2xl font-semibold text-foreground">
            เข้าสู่ระบบ / ลงทะเบียน
          </h1>
          <p className="mt-2 text-sm text-muted-foreground">
            ระบบจัดการที่พักสำหรับพนักงาน
          </p>
        </div>
        {passwordUpdated ? (
          <p
            role="status"
            className="mb-5 rounded-xl bg-success/10 px-4 py-3 text-sm text-success"
          >
            ตั้งรหัสผ่านใหม่สำเร็จแล้ว กรุณาเข้าสู่ระบบด้วยรหัสผ่านใหม่
          </p>
        ) : null}
        <LoginForm />
      </section>
    </main>
  );
}
