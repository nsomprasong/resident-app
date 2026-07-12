export default function ForbiddenPage() {
  return (
    <main className="flex min-h-screen items-center justify-center bg-slate-50 px-6">
      <section className="w-full max-w-md rounded-2xl bg-white p-8 text-center shadow-sm ring-1 ring-slate-200">
        <p className="text-sm font-semibold text-indigo-600">403</p>
        <h1 className="mt-2 text-2xl font-bold text-slate-900">ไม่มีสิทธิ์เข้าถึงหน้านี้</h1>
        <p className="mt-3 text-sm text-slate-600">
          บัญชีของคุณไม่มีสิทธิ์สำหรับหน้านี้ กรุณาเลือกเมนูที่ได้รับอนุญาต
        </p>
        <form action="/api/auth/logout" method="post" className="mt-6">
          <button className="w-full rounded-xl bg-indigo-600 px-4 py-2.5 font-medium text-white hover:bg-indigo-700">
            ออกจากระบบ
          </button>
        </form>
      </section>
    </main>
  );
}
