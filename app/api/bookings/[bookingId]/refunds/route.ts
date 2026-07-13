import { PaymentStatus } from "@/generated/prisma/client";
import {
  apiErrorResponse,
  readJsonObject,
  validationErrorResponse,
  type ValidationIssue,
} from "@/lib/api/validation";
import { getCurrentUser } from "@/lib/auth/current-user";
import { recordAuditLog } from "@/lib/audit/audit-log";
import { acquireBookingFinancialLock } from "@/lib/payments/financial-locks";
import { calculateBookingFinancialSummary } from "@/lib/payments/financial-summary";
import { prisma } from "@/lib/prisma";
import { NextRequest, NextResponse } from "next/server";
export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ bookingId: string }> },
) {
  try {
    const { bookingId } = await params;
    const currentUser = await getCurrentUser();
    const parsed = await readJsonObject(request);
    if (!parsed.ok) return parsed.response;

    const issues: ValidationIssue[] = [];
    const amount = Number(parsed.body.amount);
    const channelId =
      typeof parsed.body.channelId === "string"
        ? parsed.body.channelId.trim()
        : undefined;

    if (!Number.isFinite(amount) || amount <= 0) {
      issues.push({ path: "amount", message: "Refund amount must be greater than 0" });
    }
    if (!channelId) {
      issues.push({ path: "channelId", message: "Refund channel id is required" });
    }
    if (issues.length)
      return validationErrorResponse(
        "กรุณาระบุจำนวนเงินคืนมากกว่า 0 บาท",
        issues,
      );
    const refund = await prisma.$transaction(async (tx) => {
      await acquireBookingFinancialLock(tx, bookingId);
      const booking = await tx.booking.findUnique({
        where: { id: bookingId },
        include: {
          payments: {
            where: {
              status: { in: [PaymentStatus.PAID, PaymentStatus.REFUNDED] },
            },
          },
        },
      });
      if (!booking) throw new Error("NOT_FOUND");
      if (booking.status !== "CANCELLED") throw new Error("NOT_CANCELLED");
      const channel = await tx.paymentChannel.findFirst({
        where: { id: channelId, isActive: true },
      });
      if (!channel) throw new Error("CHANNEL_NOT_FOUND");
      const summary = calculateBookingFinancialSummary({
        charges: [],
        orders: [],
        payments: booking.payments,
      });
      if (amount > summary.refundableTotal) throw new Error("OVER_REFUND");
      const refundCount =
        booking.payments.filter(
          (item) => item.status === PaymentStatus.REFUNDED,
        ).length + 1;
      return tx.payment.create({
        data: {
          bookingId,
          amount,
          method: channel.method,
          channelId: channel.id,
          status: PaymentStatus.REFUNDED,
          reference:
            refundCount === 1
              ? "คืนเงินการยกเลิก"
              : `คืนเงินครั้งที่ ${refundCount}`,
          paidAt: new Date(),
        },
        select: { id: true, amount: true },
      });
    });
    await recordAuditLog({
      actor: {
        employeeId: currentUser?.employee?.id,
        authUserId: currentUser?.user.id,
      },
      action: "REFUND_CREATED",
      entityType: "PAYMENT",
      entityId: refund.id,
      metadata: {
        bookingId,
        amount,
        status: PaymentStatus.REFUNDED,
      },
    });
    return NextResponse.json(
      { ...refund, amount: Number(refund.amount) },
      { status: 201 },
    );
  } catch (error) {
    const message = error instanceof Error ? error.message : "";
    const errors: Record<string, [string, number]> = {
      NOT_FOUND: ["ไม่พบรายการจอง", 404],
      NOT_CANCELLED: ["คืนเงินได้เฉพาะรายการที่ยกเลิกแล้ว", 409],
      CHANNEL_NOT_FOUND: ["ไม่พบช่องทางคืนเงิน", 400],
      OVER_REFUND: ["จำนวนเงินคืนต้องไม่เกินยอดที่รับไว้", 400],
    };
    if (errors[message])
      return apiErrorResponse(errors[message][0], errors[message][1], message);
    console.error("POST refund failed", error);
    return apiErrorResponse("บันทึกคืนเงินไม่สำเร็จ", 500, "INTERNAL_ERROR");
  }
}
