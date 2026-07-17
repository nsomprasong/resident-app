"use client";

import { useEffect } from "react";
import { usePathname } from "next/navigation";

import { useEmployeePermissions } from "@/components/auth/EmployeePermissionsProvider";

type ClientErrorPayload = {
  message: string;
  stack: string | null;
  route: string;
  role: string | null;
  userAgent: string;
  source: "error" | "unhandledrejection";
};

/**
 * Temporary client-side error probe for mobile Application error triage.
 * Remove after the non-admin mobile crash is confirmed fixed in production.
 */
export function ClientErrorLogger() {
  const pathname = usePathname();
  const { employee } = useEmployeePermissions();

  useEffect(() => {
    function report(payload: ClientErrorPayload) {
      try {
        console.error("[client-error]", payload);
        const body = JSON.stringify(payload);
        if (typeof navigator !== "undefined" && typeof navigator.sendBeacon === "function") {
          const blob = new Blob([body], { type: "application/json" });
          navigator.sendBeacon("/api/system/client-error", blob);
          return;
        }
        void fetch("/api/system/client-error", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body,
          keepalive: true,
        }).catch(() => {
          /* ignore logging failures */
        });
      } catch {
        /* never throw from the logger */
      }
    }

    function onError(event: ErrorEvent) {
      report({
        message: event.message || "Unknown client error",
        stack: event.error instanceof Error ? event.error.stack ?? null : null,
        route: pathname || (typeof window !== "undefined" ? window.location.pathname : ""),
        role: employee?.role ?? null,
        userAgent: typeof navigator !== "undefined" ? navigator.userAgent : "",
        source: "error",
      });
    }

    function onRejection(event: PromiseRejectionEvent) {
      const reason = event.reason;
      const message =
        reason instanceof Error
          ? reason.message
          : typeof reason === "string"
            ? reason
            : "Unhandled promise rejection";
      report({
        message,
        stack: reason instanceof Error ? reason.stack ?? null : null,
        route: pathname || (typeof window !== "undefined" ? window.location.pathname : ""),
        role: employee?.role ?? null,
        userAgent: typeof navigator !== "undefined" ? navigator.userAgent : "",
        source: "unhandledrejection",
      });
    }

    window.addEventListener("error", onError);
    window.addEventListener("unhandledrejection", onRejection);
    return () => {
      window.removeEventListener("error", onError);
      window.removeEventListener("unhandledrejection", onRejection);
    };
  }, [employee?.role, pathname]);

  return null;
}
