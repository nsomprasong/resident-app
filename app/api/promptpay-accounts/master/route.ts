import { apiErrorResponse } from "@/lib/api/validation";
import { prisma } from "@/lib/prisma";
import { serializePromptPayAccount } from "@/lib/settings/promptpay-accounts";
import { NextResponse } from "next/server";

const accountInclude = {
  _count: { select: { payments: true } },
} as const;

export async function GET() {
  try {
    const accounts = await prisma.promptPayAccount.findMany({
      include: accountInclude,
      orderBy: [{ isActive: "desc" }, { isPrimary: "desc" }, { displayName: "asc" }],
    });
    return NextResponse.json(
      accounts.map((account) =>
        serializePromptPayAccount(account, { includeFullIdentifier: true }),
      ),
    );
  } catch (error) {
    console.error("GET /api/promptpay-accounts/master failed", error);
    return apiErrorResponse(
      "ไม่สามารถโหลดบัญชีพร้อมเพย์ได้",
      500,
      "INTERNAL_ERROR",
    );
  }
}
