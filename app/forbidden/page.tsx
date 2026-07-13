export default function ForbiddenPage() {
  return (
    <main className="flex min-h-screen items-center justify-center bg-background px-6">
      <section className="w-full max-w-md rounded-2xl bg-surface p-8 text-center shadow-sm ring-1 ring-border">
        <p className="text-sm font-semibold text-primary">403</p>
        <h1 className="mt-2 text-2xl font-bold text-foreground">ไม่มีสิทธิ์เข้าถึงหน้านี้</h1>
        <p className="mt-3 text-sm text-muted-foreground">
          บัญชีของคุณไม่มีสิทธิ์สำหรับหน้านี้ กรุณาเลือกเมนูที่ได้รับอนุญาต
        </p>
        <form action="/api/auth/logout" method="post" className="mt-6">
          <button className="w-full rounded-xl bg-primary px-4 py-2.5 font-medium text-primary-foreground hover:bg-primary/90">
            ออกจากระบบ
          </button>
        </form>
      </section>
    </main>
  );
}
