"use client";

import Link from "next/link";
import { useEffect } from "react";

export default function AppError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    console.error("[app-error]", {
      message: error.message,
      digest: error.digest ?? null,
      stack: error.stack ?? null,
    });
  }, [error]);

  return (
    <main className="flex min-h-screen items-center justify-center bg-muted px-4 py-10">
      <section className="w-full max-w-md rounded-3xl border border-border bg-surface p-7 text-center shadow-xl shadow-border/60 sm:p-9">
        <p className="text-sm font-semibold text-warning">APP_ERROR</p>
        <h1 className="mt-2 text-2xl font-semibold text-foreground">
          โหลดหน้าไม่สำเร็จ
        </h1>
        <p className="mt-3 text-sm leading-6 text-muted-foreground">
          เกิดข้อผิดพลาดระหว่างแสดงผล กรุณาลองใหม่ หรือออกจากระบบแล้วเข้าอีกครั้ง
        </p>
        {error.digest ? (
          <p className="mt-3 break-all rounded-xl bg-muted px-3 py-2 text-xs text-muted-foreground">
            รหัส: {error.digest}
          </p>
        ) : null}
        <div className="mt-7 grid gap-2">
          <button
            type="button"
            onClick={reset}
            className="w-full rounded-xl bg-foreground px-4 py-3 text-sm font-semibold text-surface transition hover:bg-muted-foreground"
          >
            ลองอีกครั้ง
          </button>
          <Link
            href="/login"
            className="w-full rounded-xl border border-border bg-background px-4 py-3 text-sm font-medium text-foreground transition hover:bg-muted"
          >
            ไปหน้าเข้าสู่ระบบ
          </Link>
        </div>
      </section>
    </main>
  );
}
