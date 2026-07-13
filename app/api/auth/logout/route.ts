import { NextResponse, type NextRequest } from "next/server";

import { getCurrentUser } from "@/lib/auth/current-user";
import { recordAuditLog } from "@/lib/audit/audit-log";
import { createClient } from "@/lib/supabase/server";

export async function POST(request: NextRequest) {
  const currentUser = await getCurrentUser();
  const supabase = await createClient();
  await supabase.auth.signOut({ scope: "local" });
  await recordAuditLog({
    actor: {
      employeeId: currentUser?.employee?.id,
      authUserId: currentUser?.user.id,
    },
    action: "AUTH_LOGOUT",
    entityType: "AUTH_SESSION",
    metadata: {
      scope: "local",
    },
  });

  return NextResponse.redirect(new URL("/login", request.url), 303);
}
