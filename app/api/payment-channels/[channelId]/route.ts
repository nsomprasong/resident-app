import { Prisma } from "@/generated/prisma/client";
import {
  apiErrorResponse,
  readJsonObject,
  validationErrorResponse,
} from "@/lib/api/validation";
import { recordAuditLog } from "@/lib/audit/audit-log";
import { getCurrentUser } from "@/lib/auth/current-user";
import { prisma } from "@/lib/prisma";
import {
  isPaymentChannelUuid,
  parsePaymentChannelInput,
  serializePaymentChannelMaster,
} from "@/lib/settings/payment-channels";
import { NextRequest, NextResponse } from "next/server";

const channelInclude = {
  _count: { select: { payments: true } },
} as const;

type RouteContext = {
  params: Promise<{ channelId: string }>;
};

export async function PATCH(request: NextRequest, context: RouteContext) {
  try {
    const { channelId } = await context.params;
    if (!isPaymentChannelUuid(channelId)) {
      return apiErrorResponse("ไม่พบช่องทางรับชำระ", 404, "NOT_FOUND");
    }

    const currentUser = await getCurrentUser();
    const parsed = await readJsonObject(request);
    if (!parsed.ok) return parsed.response;

    const validated = parsePaymentChannelInput(parsed.body, "update");
    if (!validated.ok) {
      return validationErrorResponse(
        "กรุณาตรวจสอบข้อมูลช่องทางรับชำระ",
        validated.issues,
      );
    }

    const existing = await prisma.paymentChannel.findUnique({
      where: { id: channelId },
      include: channelInclude,
    });
    if (!existing) {
      return apiErrorResponse("ไม่พบช่องทางรับชำระ", 404, "NOT_FOUND");
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
        action: "PAYMENT_CHANNEL_DEACTIVATE_WITH_PAYMENTS",
        entityType: "PAYMENT_CHANNEL",
        entityId: existing.id,
        metadata: {
          name: existing.name,
          paymentCount: existing._count.payments,
        },
      });
    }

    const channel = await prisma.paymentChannel.update({
      where: { id: channelId },
      data: validated.data,
      include: channelInclude,
    });

    await recordAuditLog({
      actor: {
        employeeId: currentUser?.employee?.id,
        authUserId: currentUser?.user.id,
      },
      action: "PAYMENT_CHANNEL_UPDATED",
      entityType: "PAYMENT_CHANNEL",
      entityId: channel.id,
      metadata: {
        name: channel.name,
        method: channel.method,
        isActive: channel.isActive,
        paymentCount: channel._count.payments,
      },
    });

    return NextResponse.json(serializePaymentChannelMaster(channel));
  } catch (error) {
    if (
      error instanceof Prisma.PrismaClientKnownRequestError &&
      error.code === "P2002"
    ) {
      return validationErrorResponse("ชื่อช่องทางนี้มีอยู่แล้ว", [
        { path: "name", message: "ชื่อซ้ำ" },
      ]);
    }
    console.error("PATCH /api/payment-channels/[channelId] failed", error);
    return apiErrorResponse(
      "อัปเดตช่องทางรับชำระไม่สำเร็จ",
      500,
      "INTERNAL_ERROR",
    );
  }
}
