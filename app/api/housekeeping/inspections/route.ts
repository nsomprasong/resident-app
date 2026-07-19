import { BookingStatus } from "@/generated/prisma/client";
import { compareRoomsByZoneAndNumber } from "@/lib/bookings/room-sort";
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
            room: { include: { zone: { select: { id: true, name: true } } } },
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
    });
    const sorted = [...inspections].sort((left, right) =>
      compareRoomsByZoneAndNumber(
        {
          number: left.bookingRoom.room.number,
          zoneName: left.bookingRoom.room.zone.name,
        },
        {
          number: right.bookingRoom.room.number,
          zoneName: right.bookingRoom.room.zone.name,
        },
      ),
    );
    return NextResponse.json(
      sorted.map((inspection) => {
        const booking = inspection.bookingRoom.booking;
        const room = inspection.bookingRoom.room;
        const financialSummary = calculateBookingFinancialSummary({
          charges: booking.charges,
          orders: booking.orders,
          payments: booking.payments,
        });
        return {
          id: inspection.id,
          status: inspection.status,
          notes: inspection.notes,
          room: room.number,
          zone: room.zone.name,
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
            imageUrl: item.imageUrl,
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
