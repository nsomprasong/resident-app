import {
  BookingStatus,
  PaymentMethod,
  PaymentStatus,
} from "@/generated/prisma/client";
import {
  apiErrorResponse,
  readJsonObject,
  validationErrorResponse,
  type ValidationIssue,
} from "@/lib/api/validation";
import { getCurrentUser } from "@/lib/auth/current-user";
import { recordAuditLog } from "@/lib/audit/audit-log";
import { cancelUnfinishedOrdersForBooking } from "@/lib/orders/kitchen-workflow";
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
    const methodValue = parsed.body.method;
    const channelId =
      typeof parsed.body.channelId === "string"
        ? parsed.body.channelId.trim()
        : undefined;
    const reference =
      typeof parsed.body.reference === "string"
        ? parsed.body.reference.trim()
        : undefined;

    if (!Number.isFinite(amount) || amount <= 0) {
      issues.push({ path: "amount", message: "Payment amount must be greater than 0" });
    }
    if (
      methodValue !== undefined &&
      (typeof methodValue !== "string" ||
        !Object.values(PaymentMethod).includes(methodValue as PaymentMethod))
    ) {
      issues.push({ path: "method", message: "Payment method is invalid" });
    }
    if (parsed.body.channelId !== undefined && !channelId) {
      issues.push({ path: "channelId", message: "Payment channel id must be a string" });
    }
    if (parsed.body.reference !== undefined && typeof parsed.body.reference !== "string") {
      issues.push({ path: "reference", message: "Payment reference must be a string" });
    }
    if (issues.length)
      return validationErrorResponse(
        "กรุณาระบุจำนวนเงินมากกว่า 0 บาท",
        issues,
      );

    const method = methodValue ? (methodValue as PaymentMethod) : PaymentMethod.TRANSFER;
    const payment = await prisma.$transaction(async (tx) => {
      await acquireBookingFinancialLock(tx, bookingId);
      const channel = channelId
        ? await tx.paymentChannel.findFirst({
            where: { id: channelId, isActive: true },
          })
        : null;
      if (channelId && !channel) throw new Error("CHANNEL_NOT_FOUND");
      const booking = await tx.booking.findUnique({
        where: { id: bookingId },
        include: {
          charges: true,
          payments: {
            where: { status: PaymentStatus.PAID },
            orderBy: { createdAt: "asc" },
          },
          orders: {
            where: { status: { not: "CANCELLED" } },
            include: { items: true },
          },
        },
      });
      if (!booking) throw new Error("NOT_FOUND");
      if (booking.status === "CANCELLED") throw new Error("CANCELLED");
      const summary = calculateBookingFinancialSummary({
        charges: booking.charges,
        orders: booking.orders,
        payments: booking.payments,
      });
      const outstanding = summary.outstandingTotal;
      if (outstanding <= 0) throw new Error("ALREADY_PAID");
      if (amount > outstanding) throw new Error("OVERPAY");
      const installment = booking.payments.length + 1;
      const created = await tx.payment.create({
        data: {
          bookingId,
          amount,
          method: channel?.method ?? method,
          channelId: channel?.id,
          status: PaymentStatus.PAID,
          reference:
            reference ||
            (installment === 1
              ? "เงินมัดจำ"
              : `ชำระเงินครั้งที่ ${installment}`),
          paidAt: new Date(),
        },
        select: {
          id: true,
          amount: true,
          method: true,
          status: true,
          reference: true,
        },
      });

      let cancelledUnfinishedOrders = 0;
      const paymentsAfterPay = [
        ...booking.payments,
        { amount, status: PaymentStatus.PAID },
      ];
      const settlementAfterPay = calculateBookingFinancialSummary({
        charges: booking.charges,
        orders: booking.orders.filter((order) => order.status === "DELIVERED"),
        payments: paymentsAfterPay,
      });
      if (
        booking.status === BookingStatus.CHECKED_OUT &&
        settlementAfterPay.outstandingTotal <= 0
      ) {
        const cancelled = await cancelUnfinishedOrdersForBooking(tx, bookingId);
        cancelledUnfinishedOrders = cancelled.count;
      }

      return { created, cancelledUnfinishedOrders };
    });
    await recordAuditLog({
      actor: {
        employeeId: currentUser?.employee?.id,
        authUserId: currentUser?.user.id,
      },
      action: "PAYMENT_COLLECTED",
      entityType: "PAYMENT",
      entityId: payment.created.id,
      metadata: {
        bookingId,
        amount,
        method: payment.created.method,
        status: payment.created.status,
        cancelledUnfinishedOrders: payment.cancelledUnfinishedOrders,
      },
    });
    return NextResponse.json(
      {
        ...payment.created,
        amount: Number(payment.created.amount),
        cancelledUnfinishedOrders: payment.cancelledUnfinishedOrders,
      },
      { status: 201 },
    );
  } catch (error) {
    const message = error instanceof Error ? error.message : "";
    const errors: Record<string, [string, number]> = {
      NOT_FOUND: ["ไม่พบรายการจอง", 404],
      CHANNEL_NOT_FOUND: ["ไม่พบช่องทางรับชำระ", 400],
      CANCELLED: ["ไม่สามารถรับเงินจากรายการที่ยกเลิกแล้ว", 409],
      ALREADY_PAID: ["รายการนี้ชำระครบแล้ว", 409],
      OVERPAY: ["จำนวนเงินต้องไม่เกินยอดคงเหลือ", 400],
    };
    if (errors[message])
      return apiErrorResponse(errors[message][0], errors[message][1], message);
    console.error("POST payment failed", error);
    return apiErrorResponse(
      "ไม่สามารถบันทึกการชำระเงินได้",
      500,
      "INTERNAL_ERROR",
    );
  }
}
