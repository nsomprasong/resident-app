import { redirect } from "next/navigation";
import { Building2 } from "lucide-react";

import LoginForm from "@/app/login/LoginForm";
import { createClient } from "@/lib/supabase/server";

export default async function LoginPage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (user) {
    redirect("/");
  }

  return (
    <main className="flex min-h-screen items-center justify-center bg-slate-100 px-4 py-10">
      <section className="w-full max-w-md rounded-3xl border border-slate-200 bg-white p-7 shadow-xl shadow-slate-200/60 sm:p-9">
        <div className="mb-8 text-center">
          <div className="mx-auto mb-4 flex size-14 items-center justify-center rounded-2xl bg-indigo-600 text-white">
            <Building2 size={28} />
          </div>
          <p className="text-sm font-medium text-indigo-600">Resident</p>
          <h1 className="mt-1 text-2xl font-semibold text-slate-900">เข้าสู่ระบบ</h1>
          <p className="mt-2 text-sm text-slate-500">ระบบจัดการที่พักสำหรับพนักงาน</p>
        </div>
        <LoginForm />
      </section>
    </main>
  );
}
