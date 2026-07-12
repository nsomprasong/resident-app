import { PaymentStatus } from "@/generated/prisma/client";
import { prisma } from "@/lib/prisma";
import { NextRequest, NextResponse } from "next/server";
export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ bookingId: string }> },
) {
  try {
    const { bookingId } = await params;
    const body = (await request.json()) as {
      amount?: number;
      channelId?: string;
    };
    const amount = Number(body.amount);
    if (!Number.isFinite(amount) || amount <= 0)
      return NextResponse.json(
        { message: "กรุณาระบุจำนวนเงินคืนมากกว่า 0 บาท" },
        { status: 400 },
      );
    const refund = await prisma.$transaction(async (tx) => {
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
      const channel = body.channelId
        ? await tx.paymentChannel.findFirst({
            where: { id: body.channelId, isActive: true },
          })
        : null;
      if (!channel) throw new Error("CHANNEL_NOT_FOUND");
      const refundable = booking.payments.reduce(
        (sum, payment) =>
          sum +
          (payment.status === PaymentStatus.REFUNDED
            ? -Number(payment.amount)
            : Number(payment.amount)),
        0,
      );
      if (amount > refundable) throw new Error("OVER_REFUND");
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
      return NextResponse.json(
        { message: errors[message][0] },
        { status: errors[message][1] },
      );
    console.error("POST refund failed", error);
    return NextResponse.json(
      { message: "บันทึกคืนเงินไม่สำเร็จ" },
      { status: 500 },
    );
  }
}
