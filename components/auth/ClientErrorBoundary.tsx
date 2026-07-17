"use client";

import { Component, type ErrorInfo, type ReactNode } from "react";
import Link from "next/link";

type Props = {
  children: ReactNode;
  role?: string | null;
};

type State = {
  error: Error | null;
};

/**
 * Prevents Next.js "Application error" white screen for account-specific
 * client exceptions. Shows a Thai recovery page with an error code instead.
 */
export class ClientErrorBoundary extends Component<Props, State> {
  state: State = { error: null };

  static getDerivedStateFromError(error: Error): State {
    return { error };
  }

  componentDidCatch(error: Error, info: ErrorInfo) {
    try {
      const payload = {
        message: error.message,
        stack: error.stack ?? null,
        componentStack: info.componentStack ?? null,
        route:
          typeof window !== "undefined" ? window.location.pathname : "",
        role: this.props.role ?? null,
        userAgent:
          typeof navigator !== "undefined" ? navigator.userAgent : "",
        source: "react-boundary",
      };
      console.error("[client-error-boundary]", payload);
      const body = JSON.stringify(payload);
      if (typeof navigator !== "undefined" && typeof navigator.sendBeacon === "function") {
        navigator.sendBeacon(
          "/api/system/client-error",
          new Blob([body], { type: "application/json" }),
        );
      }
    } catch {
      /* never throw from the boundary logger */
    }
  }

  render() {
    if (!this.state.error) return this.props.children;

    return (
      <main className="flex min-h-screen items-center justify-center bg-muted px-4 py-10">
        <section className="w-full max-w-md rounded-3xl border border-border bg-surface p-7 text-center shadow-xl shadow-border/60 sm:p-9">
          <p className="text-sm font-semibold text-warning">CLIENT_RENDER_ERROR</p>
          <h1 className="mt-2 text-2xl font-semibold text-foreground">
            เกิดข้อผิดพลาดบนอุปกรณ์นี้
          </h1>
          <p className="mt-3 text-sm leading-6 text-muted-foreground">
            ระบบป้องกันไม่ให้หน้าจอค้างแบบ Application error แล้ว
            กรุณาออกจากระบบแล้วเข้าใหม่ หรือติดต่อผู้ดูแลระบบพร้อมรหัสด้านบน
          </p>
          <p className="mt-3 break-words rounded-xl bg-muted px-3 py-2 text-left text-xs text-muted-foreground">
            {this.state.error.message}
          </p>
          <div className="mt-7 grid gap-2">
            <Link
              href="/"
              className="w-full rounded-xl bg-foreground px-4 py-3 text-sm font-semibold text-surface transition hover:bg-muted-foreground"
            >
              ลองโหลดหน้าแรกอีกครั้ง
            </Link>
            <form action="/api/auth/logout" method="post">
              <button
                type="submit"
                className="w-full rounded-xl border border-border bg-background px-4 py-3 text-sm font-medium text-foreground transition hover:bg-muted"
              >
                ออกจากระบบ
              </button>
            </form>
          </div>
        </section>
      </main>
    );
  }
}
