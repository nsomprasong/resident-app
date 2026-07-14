import { apiErrorResponse } from "@/lib/api/validation";
import { prisma } from "@/lib/prisma";
import { PaymentStatus } from "@/generated/prisma/client";
import { NextRequest, NextResponse } from "next/server";

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const from = searchParams.get("from");
    const to = searchParams.get("to");
    const status = searchParams.get("status");
    const method = searchParams.get("method");

    const createdAtFilter =
      from || to
        ? {
            ...(from ? { gte: new Date(from) } : {}),
            ...(to ? { lt: new Date(to) } : {}),
          }
        : undefined;

    const payments = await prisma.payment.findMany({
      where: {
        ...(createdAtFilter ? { createdAt: createdAtFilter } : {}),
        ...(status ? { status: status as PaymentStatus } : {}),
        ...(method ? { method: method as never } : {}),
      },
      include: {
        booking: { select: { id: true, reference: true } },
        createdBy: { select: { id: true, name: true } },
        refunds: { select: { amount: true } },
      },
      orderBy: { createdAt: "desc" },
      take: 200,
    });

    const verified = payments.filter((p) =>
      (
        [
          PaymentStatus.PAID,
          PaymentStatus.VERIFIED,
          PaymentStatus.PARTIALLY_REFUNDED,
        ] as PaymentStatus[]
      ).includes(p.status),
    );
    const pending = payments.filter((p) =>
      (
        [
          PaymentStatus.AWAITING_PAYMENT,
          PaymentStatus.PENDING_VERIFICATION,
        ] as PaymentStatus[]
      ).includes(p.status),
    );
    const refundedTotal =
      payments
        .filter((p) => p.status === PaymentStatus.REFUNDED)
        .reduce((sum, p) => sum + Number(p.amount), 0) +
      payments.reduce(
        (sum, p) =>
          sum + p.refunds.reduce((sub, r) => sub + Number(r.amount), 0),
        0,
      );

    const summary = {
      count: payments.length,
      verifiedTotal: verified.reduce((sum, p) => sum + Number(p.amount), 0),
      pendingTotal: pending.reduce((sum, p) => sum + Number(p.amount), 0),
      refundedTotal,
    };

    return NextResponse.json({
      summary,
      items: payments.map((payment) => ({
        id: payment.id,
        paymentNumber: payment.paymentNumber,
        bookingId: payment.bookingId,
        bookingReference: payment.booking.reference,
        amount: Number(payment.amount),
        method: payment.method,
        status: payment.status,
        purpose: payment.purpose,
        createdAt: payment.createdAt.toISOString(),
        createdByName: payment.createdBy?.name ?? null,
      })),
    });
  } catch (error) {
    console.error("GET /api/payments/report failed", error);
    return apiErrorResponse("โหลดรายงานรับชำระไม่สำเร็จ", 500, "INTERNAL_ERROR");
  }
}
