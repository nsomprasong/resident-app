import { SESSION_EPOCH_CLAIM } from "@/lib/auth/session-epoch";
import { prisma } from "@/lib/prisma";
import { createAdminClient } from "@/lib/supabase/admin";

/**
 * Rotate the employee's session epoch and stamp it on Auth app_metadata.
 * Returns the new epoch so the active session JWT can be refreshed.
 */
export async function rotateEmployeeSessionEpoch(input: {
  employeeId: string;
  authUserId: string;
}): Promise<{ ok: true; sessionEpoch: number } | { ok: false; message: string }> {
  try {
    const updated = await prisma.employee.update({
      where: { id: input.employeeId },
      data: { sessionEpoch: { increment: 1 } },
      select: { sessionEpoch: true },
    });

    const admin = createAdminClient();
    const { data: existing, error: getError } = await admin.auth.admin.getUserById(
      input.authUserId,
    );
    if (getError || !existing.user) {
      return { ok: false, message: "ไม่พบ Auth user สำหรับหมุน session" };
    }

    const { error: updateError } = await admin.auth.admin.updateUserById(
      input.authUserId,
      {
        app_metadata: {
          ...(existing.user.app_metadata ?? {}),
          [SESSION_EPOCH_CLAIM]: updated.sessionEpoch,
        },
      },
    );
    if (updateError) {
      return {
        ok: false,
        message: `อัปเดต session epoch ไม่สำเร็จ: ${updateError.message}`,
      };
    }

    return { ok: true, sessionEpoch: updated.sessionEpoch };
  } catch (error) {
    const message =
      error instanceof Error ? error.message : "หมุน session epoch ไม่สำเร็จ";
    return { ok: false, message };
  }
}
