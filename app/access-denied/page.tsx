import { ShieldAlert } from "lucide-react";

export default function AccessDeniedPage() {
  return (
    <main className="flex min-h-screen items-center justify-center bg-muted px-4 py-10">
      <section className="w-full max-w-md rounded-3xl border border-border bg-surface p-7 text-center shadow-xl shadow-border/60 sm:p-9">
        <div className="mx-auto mb-5 flex size-14 items-center justify-center rounded-2xl bg-warning/15 text-warning">
          <ShieldAlert size={28} />
        </div>
        <h1 className="text-2xl font-semibold text-foreground">ยังไม่ได้กำหนดสิทธิ์พนักงาน</h1>
        <p className="mt-3 text-sm leading-6 text-muted-foreground">
          บัญชีนี้เข้าสู่ระบบสำเร็จ แต่ยังไม่ได้เชื่อมกับข้อมูลพนักงาน
          กรุณาติดต่อผู้ดูแลระบบ
        </p>
        <form action="/api/auth/logout" method="post" className="mt-7">
          <button
            type="submit"
            className="w-full rounded-xl bg-foreground px-4 py-3 text-sm font-semibold text-surface transition hover:bg-muted-foreground"
          >
            ออกจากระบบ
          </button>
        </form>
      </section>
    </main>
  );
}
