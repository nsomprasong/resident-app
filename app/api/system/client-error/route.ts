import { NextResponse } from "next/server";

import { getCurrentUser } from "@/lib/auth/current-user";

/**
 * Temporary sink for client Application error probes.
 * Authenticated users only — logs server-side for mobile triage.
 */
export async function POST(request: Request) {
  try {
    const currentUser = await getCurrentUser();
    if (!currentUser?.user) {
      return NextResponse.json({ ok: false }, { status: 401 });
    }

    const body = (await request.json().catch(() => null)) as {
      message?: unknown;
      stack?: unknown;
      route?: unknown;
      role?: unknown;
      userAgent?: unknown;
      source?: unknown;
    } | null;

    console.error("[client-error-report]", {
      authUserId: currentUser.user.id,
      employeeId: currentUser.employee?.id ?? null,
      employeeRole: currentUser.employee?.role?.code ?? null,
      message: typeof body?.message === "string" ? body.message : null,
      stack: typeof body?.stack === "string" ? body.stack : null,
      route: typeof body?.route === "string" ? body.route : null,
      role: typeof body?.role === "string" ? body.role : null,
      userAgent: typeof body?.userAgent === "string" ? body.userAgent : null,
      source: typeof body?.source === "string" ? body.source : null,
    });

    return NextResponse.json({ ok: true });
  } catch (error) {
    console.error("POST /api/system/client-error failed", error);
    return NextResponse.json({ ok: false }, { status: 500 });
  }
}
