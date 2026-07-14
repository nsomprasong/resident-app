import { BookingStatus } from "@/generated/prisma/client";
import { calculateBookingFinancialSummary } from "@/lib/payments/financial-summary";
import { prisma } from "@/lib/prisma";
import { NextResponse } from "next/server";

export async function GET() {
  try {
    const missing = await prisma.bookingRoom.findMany({
      where: {
        booking: { status: BookingStatus.CHECKED_OUT, closedAt: null },
        inspection: null,
      },
      select: { id: true },
    });
    if (missing.length)
      await prisma.roomInspection.createMany({
        data: missing.map((item) => ({ bookingRoomId: item.id })),
      });
    const inspections = await prisma.roomInspection.findMany({
      where: {
        bookingRoom: {
          booking: { status: BookingStatus.CHECKED_OUT, closedAt: null },
        },
      },
      include: {
        items: true,
        completedBy: { select: { id: true, name: true } },
        bookingRoom: {
          include: {
            room: true,
            booking: {
              include: {
                guest: true,
                tourGroup: true,
                charges: true,
                payments: { where: { status: "PAID" } },
                orders: {
                  where: { status: { not: "CANCELLED" } },
                  include: { items: true },
                },
              },
            },
          },
        },
      },
      orderBy: { createdAt: "asc" },
    });
    return NextResponse.json(
      inspections.map((inspection) => {
        const booking = inspection.bookingRoom.booking;
        const financialSummary = calculateBookingFinancialSummary({
          charges: booking.charges,
          orders: booking.orders,
          payments: booking.payments,
        });
        return {
          id: inspection.id,
          status: inspection.status,
          notes: inspection.notes,
          room: inspection.bookingRoom.room.number,
          bookingId: booking.id,
          customerName:
            booking.tourGroup?.name ??
            [booking.guest?.firstName, booking.guest?.lastName]
              .filter(Boolean)
              .join(" "),
          completedAt: inspection.completedAt?.toISOString() ?? null,
          completedByName: inspection.completedBy?.name ?? null,
          paid:
            financialSummary.netPaidTotal >= financialSummary.grandTotal &&
            financialSummary.grandTotal > 0,
          items: inspection.items.map((item) => ({
            id: item.id,
            catalogId: item.catalogId,
            type: item.type,
            description: item.description,
            quantity: item.quantity,
            unitPrice: Number(item.unitPrice),
          })),
        };
      }),
    );
  } catch (error) {
    console.error("GET inspections failed", error);
    return NextResponse.json(
      { message: "ไม่สามารถโหลดงานตรวจห้องได้" },
      { status: 500 },
    );
  }
}
