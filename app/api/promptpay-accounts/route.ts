import {
  apiErrorResponse,
  readJsonObject,
  validationErrorResponse,
} from "@/lib/api/validation";
import { recordAuditLog } from "@/lib/audit/audit-log";
import { getCurrentUser } from "@/lib/auth/current-user";
import { prisma } from "@/lib/prisma";
import {
  parsePromptPayAccountInput,
  serializePromptPayAccount,
} from "@/lib/settings/promptpay-accounts";
import { NextRequest, NextResponse } from "next/server";

const accountInclude = {
  _count: { select: { payments: true } },
} as const;

export async function GET() {
  try {
    const accounts = await prisma.promptPayAccount.findMany({
      where: { isActive: true },
      include: accountInclude,
      orderBy: [{ isPrimary: "desc" }, { displayName: "asc" }],
    });
    return NextResponse.json(
      accounts.map((account) => serializePromptPayAccount(account)),
    );
  } catch (error) {
    console.error("GET /api/promptpay-accounts failed", error);
    return apiErrorResponse(
      "ไม่สามารถโหลดบัญชีพร้อมเพย์ได้",
      500,
      "INTERNAL_ERROR",
    );
  }
}

export async function POST(request: NextRequest) {
  try {
    const currentUser = await getCurrentUser();
    const parsed = await readJsonObject(request);
    if (!parsed.ok) return parsed.response;

    const validated = parsePromptPayAccountInput(parsed.body, "create");
    if (!validated.ok) {
      return validationErrorResponse(
        "กรุณาตรวจสอบข้อมูลบัญชีพร้อมเพย์",
        validated.issues,
      );
    }

    const account = await prisma.$transaction(async (tx) => {
      if (validated.data.isPrimary) {
        await tx.promptPayAccount.updateMany({
          where: { isPrimary: true, isActive: true },
          data: { isPrimary: false },
        });
      }
      return tx.promptPayAccount.create({
        data: {
          displayName: validated.data.displayName!,
          idType: validated.data.idType!,
          identifier: validated.data.identifier!,
          accountName: validated.data.accountName!,
          bankName: validated.data.bankName ?? null,
          notes: validated.data.notes ?? null,
          isActive: validated.data.isActive ?? true,
          isPrimary: validated.data.isPrimary ?? false,
          createdById: currentUser?.employee?.id,
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
      action: "PROMPTPAY_ACCOUNT_CREATED",
      entityType: "PROMPTPAY_ACCOUNT",
      entityId: account.id,
      metadata: {
        displayName: account.displayName,
        idType: account.idType,
        isPrimary: account.isPrimary,
        identifierMasked: serializePromptPayAccount(account).identifierMasked,
      },
    });

    return NextResponse.json(
      serializePromptPayAccount(account, { includeFullIdentifier: true }),
      { status: 201 },
    );
  } catch (error) {
    console.error("POST /api/promptpay-accounts failed", error);
    return apiErrorResponse("สร้างบัญชีพร้อมเพย์ไม่สำเร็จ", 500, "INTERNAL_ERROR");
  }
}
