import {
  apiErrorResponse,
  readJsonObject,
  validationErrorResponse,
} from "@/lib/api/validation";
import { recordAuditLog } from "@/lib/audit/audit-log";
import { getCurrentUser } from "@/lib/auth/current-user";
import { prisma } from "@/lib/prisma";
import {
  isPromptPayAccountUuid,
  parsePromptPayAccountInput,
  serializePromptPayAccount,
} from "@/lib/settings/promptpay-accounts";
import { NextRequest, NextResponse } from "next/server";

const accountInclude = {
  _count: { select: { payments: true } },
} as const;

type RouteContext = {
  params: Promise<{ accountId: string }>;
};

export async function PATCH(request: NextRequest, context: RouteContext) {
  try {
    const { accountId } = await context.params;
    if (!isPromptPayAccountUuid(accountId)) {
      return apiErrorResponse("ไม่พบบัญชีพร้อมเพย์", 404, "NOT_FOUND");
    }

    const currentUser = await getCurrentUser();
    const parsed = await readJsonObject(request);
    if (!parsed.ok) return parsed.response;

    const validated = parsePromptPayAccountInput(parsed.body, "update");
    if (!validated.ok) {
      return validationErrorResponse(
        "กรุณาตรวจสอบข้อมูลบัญชีพร้อมเพย์",
        validated.issues,
      );
    }

    const existing = await prisma.promptPayAccount.findUnique({
      where: { id: accountId },
      include: accountInclude,
    });
    if (!existing) {
      return apiErrorResponse("ไม่พบบัญชีพร้อมเพย์", 404, "NOT_FOUND");
    }

    if (
      validated.data.isActive === false &&
      existing._count.payments > 0
    ) {
      await recordAuditLog({
        actor: {
          employeeId: currentUser?.employee?.id,
          authUserId: currentUser?.user.id,
        },
        action: "PROMPTPAY_ACCOUNT_DEACTIVATE_WITH_PAYMENTS",
        entityType: "PROMPTPAY_ACCOUNT",
        entityId: existing.id,
        metadata: {
          displayName: existing.displayName,
          paymentCount: existing._count.payments,
        },
      });
    }

    const account = await prisma.$transaction(async (tx) => {
      if (validated.data.isPrimary === true) {
        await tx.promptPayAccount.updateMany({
          where: {
            isPrimary: true,
            isActive: true,
            id: { not: accountId },
          },
          data: { isPrimary: false },
        });
      }
      return tx.promptPayAccount.update({
        where: { id: accountId },
        data: {
          ...validated.data,
          updatedById: currentUser?.employee?.id,
        },
        include: accountInclude,
      });
    });

    await recordAuditLog({
      actor: {
        employeeId: currentUser?.employee?.id,
        authUserId: currentUser?.user.id,
      },
      action: "PROMPTPAY_ACCOUNT_UPDATED",
      entityType: "PROMPTPAY_ACCOUNT",
      entityId: account.id,
      metadata: {
        displayName: account.displayName,
        isActive: account.isActive,
        isPrimary: account.isPrimary,
        identifierMasked: serializePromptPayAccount(account).identifierMasked,
      },
    });

    return NextResponse.json(
      serializePromptPayAccount(account, { includeFullIdentifier: true }),
    );
  } catch (error) {
    console.error("PATCH /api/promptpay-accounts/[accountId] failed", error);
    return apiErrorResponse("อัปเดตบัญชีพร้อมเพย์ไม่สำเร็จ", 500, "INTERNAL_ERROR");
  }
}
