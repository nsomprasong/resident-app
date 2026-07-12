import { PaymentMethod, PaymentStatus } from "@/generated/prisma/client";
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
      method?: PaymentMethod;
      channelId?: string;
      reference?: string;
    };
    const amount = Number(body.amount);
    const method =
      body.method && Object.values(PaymentMethod).includes(body.method)
        ? body.method
        : PaymentMethod.TRANSFER;
    if (!Number.isFinite(amount) || amount <= 0)
      return NextResponse.json(
        { message: "กรุณาระบุจำนวนเงินมากกว่า 0 บาท" },
        { status: 400 },
      );
    const payment = await prisma.$transaction(async (tx) => {
      const channel = body.channelId
        ? await tx.paymentChannel.findFirst({
            where: { id: body.channelId, isActive: true },
          })
        : null;
      if (body.channelId && !channel) throw new Error("CHANNEL_NOT_FOUND");
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
      const grand =
        booking.charges.reduce((sum, item) => sum + Number(item.amount), 0) +
        booking.orders.reduce(
          (sum, order) =>
            sum +
            order.items.reduce(
              (sub, item) =>
                sub +
                (item.isExtra ? Number(item.unitPrice) * item.quantity : 0),
              0,
            ),
          0,
        );
      const paid = booking.payments.reduce(
        (sum, item) => sum + Number(item.amount),
        0,
      );
      const outstanding = Math.max(0, grand - paid);
      if (outstanding <= 0) throw new Error("ALREADY_PAID");
      if (amount > outstanding) throw new Error("OVERPAY");
      const installment = booking.payments.length + 1;
      return tx.payment.create({
        data: {
          bookingId,
          amount,
          method: channel?.method ?? method,
          channelId: channel?.id,
          status: PaymentStatus.PAID,
          reference:
            body.reference?.trim() ||
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
    });
    return NextResponse.json(
      { ...payment, amount: Number(payment.amount) },
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
      return NextResponse.json(
        { message: errors[message][0] },
        { status: errors[message][1] },
      );
    console.error("POST payment failed", error);
    return NextResponse.json(
      { message: "ไม่สามารถบันทึกการชำระเงินได้" },
      { status: 500 },
    );
  }
}
