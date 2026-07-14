import { KeyRound } from "lucide-react";
import { redirect } from "next/navigation";

import SetPasswordForm from "@/app/set-password/SetPasswordForm";
import { verifyPasswordResetTicket } from "@/lib/auth/password-reset-ticket";
import { prisma } from "@/lib/prisma";
import { createClient } from "@/lib/supabase/server";

type SetPasswordPageProps = {
  searchParams: Promise<{ ticket?: string }>;
};

export default async function SetPasswordPage({
  searchParams,
}: SetPasswordPageProps) {
  const params = await searchParams;
  const ticket =
    typeof params.ticket === "string" && params.ticket.trim()
      ? params.ticket.trim()
      : null;

  if (ticket) {
    const payload = verifyPasswordResetTicket(ticket);
    if (!payload) {
      redirect("/login");
    }

    const employee = await prisma.employee.findUnique({
      where: { id: payload.employeeId },
      select: {
        id: true,
        isActive: true,
        roleId: true,
        mustResetPassword: true,
        authUserId: true,
      },
    });

    if (
      !employee?.isActive ||
      !employee.roleId ||
      !employee.mustResetPassword ||
      employee.authUserId !== payload.authUserId
    ) {
      redirect("/login");
    }

    return (
      <main className="flex min-h-screen items-center justify-center bg-muted px-4 py-10">
        <section className="w-full max-w-md rounded-3xl border border-border bg-surface p-7 shadow-xl shadow-border/60 sm:p-9">
          <div className="mb-8 text-center">
            <div className="mx-auto mb-4 flex size-14 items-center justify-center rounded-2xl bg-primary text-primary-foreground">
              <KeyRound size={28} />
            </div>
            <p className="text-sm font-medium text-primary">Resident</p>
            <h1 className="mt-1 text-2xl font-semibold text-foreground">
              ตั้งรหัสผ่านใหม่
            </h1>
            <p className="mt-2 text-sm text-muted-foreground">
              ผู้ดูแลได้รีเซ็ตรหัสผ่านของบัญชีนี้ กรุณาตั้งรหัสผ่านใหม่ก่อนเข้าใช้งาน
            </p>
          </div>
          <SetPasswordForm ticket={ticket} />
        </section>
      </main>
    );
  }

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    redirect("/login");
  }

  const employee = await prisma.employee.findUnique({
    where: { authUserId: user.id },
    select: { isActive: true, mustResetPassword: true, roleId: true },
  });

  if (!employee?.isActive || !employee.roleId) {
    redirect("/login");
  }

  if (!employee.mustResetPassword) {
    redirect("/");
  }

  return (
    <main className="flex min-h-screen items-center justify-center bg-muted px-4 py-10">
      <section className="w-full max-w-md rounded-3xl border border-border bg-surface p-7 shadow-xl shadow-border/60 sm:p-9">
        <div className="mb-8 text-center">
          <div className="mx-auto mb-4 flex size-14 items-center justify-center rounded-2xl bg-primary text-primary-foreground">
            <KeyRound size={28} />
          </div>
          <p className="text-sm font-medium text-primary">Resident</p>
          <h1 className="mt-1 text-2xl font-semibold text-foreground">
            ตั้งรหัสผ่านใหม่
          </h1>
          <p className="mt-2 text-sm text-muted-foreground">
            ผู้ดูแลได้รีเซ็ตรหัสผ่านของบัญชีนี้ กรุณาตั้งรหัสผ่านใหม่ก่อนเข้าใช้งาน
          </p>
        </div>
        <SetPasswordForm />
      </section>
    </main>
  );
}
