import { PaymentStatus } from "@/generated/prisma/client";
import { prisma } from "@/lib/prisma";
import {
  endOfUtcMonth,
  formatReportDate,
  startOfUtcMonth,
  toCsv,
} from "@/lib/reports/reporting";
import { NextResponse } from "next/server";

export async function GET() {
  try {
    const monthStart = startOfUtcMonth(new Date());
    const monthEnd = endOfUtcMonth(new Date());
    const payments = await prisma.payment.findMany({
      where: {
        status: { in: [PaymentStatus.PAID, PaymentStatus.REFUNDED] },
        paidAt: { gte: monthStart, lt: monthEnd },
      },
      include: {
        booking: {
          select: {
            reference: true,
            guest: { select: { firstName: true, lastName: true } },
            tourGroup: { select: { name: true } },
          },
        },
        channel: { select: { name: true } },
      },
      orderBy: { paidAt: "asc" },
    });

    const csv = toCsv(
      [
        "paid_date",
        "booking_reference",
        "customer_name",
        "status",
        "method",
        "channel",
        "amount",
      ],
      payments.map((payment) => ({
        paid_date: payment.paidAt ? formatReportDate(payment.paidAt) : "",
        booking_reference: payment.booking.reference,
        customer_name:
          payment.booking.tourGroup?.name ??
          [payment.booking.guest?.firstName, payment.booking.guest?.lastName]
            .filter(Boolean)
            .join(" "),
        status: payment.status,
        method: payment.method,
        channel: payment.channel?.name ?? "",
        amount:
          payment.status === PaymentStatus.REFUNDED
            ? -Number(payment.amount)
            : Number(payment.amount),
      })),
    );

    return new NextResponse(csv, {
      headers: {
        "Content-Type": "text/csv; charset=utf-8",
        "Content-Disposition": `attachment; filename="revenue-${formatReportDate(monthStart)}.csv"`,
      },
    });
  } catch (error) {
    console.error("GET /api/reports/export failed", error);
    return NextResponse.json(
      { message: "ไม่สามารถ export รายงานได้" },
      { status: 500 },
    );
  }
}
