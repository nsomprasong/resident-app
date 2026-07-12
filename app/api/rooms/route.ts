import { BookingStatus } from "@/generated/prisma/client";
import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

export async function GET(request: NextRequest) {
  try {
    const checkInValue = request.nextUrl.searchParams.get("checkIn");
    const checkOutValue = request.nextUrl.searchParams.get("checkOut");
    const checkIn = checkInValue ? new Date(`${checkInValue}T00:00:00.000Z`) : null;
    const checkOut = checkOutValue ? new Date(`${checkOutValue}T00:00:00.000Z`) : null;
    if ((checkInValue || checkOutValue) && (!checkIn || !checkOut || Number.isNaN(checkIn.getTime()) || Number.isNaN(checkOut.getTime()) || checkOut <= checkIn)) {
      return NextResponse.json({ message: "ช่วงวันที่เข้าพักไม่ถูกต้อง" }, { status: 400 });
    }
    const rooms = await prisma.room.findMany({
      include: {
        zone: true,
        roomType: true,
        bookingRooms: checkIn && checkOut ? {
          where: {
            booking: {
              status: { notIn: [BookingStatus.CANCELLED, BookingStatus.CHECKED_OUT] },
              checkIn: { lt: checkOut },
              checkOut: { gt: checkIn },
            },
          },
          select: { id: true },
        } : false,
      },
      orderBy: { number: "asc" },
    });
    return NextResponse.json(rooms.map((room) => ({
      id: room.id,
      number: room.number,
      floor: room.floor,
      status: room.status,
      booked: room.status !== "AVAILABLE" || ("bookingRooms" in room && room.bookingRooms.length > 0),
      zone: { id: room.zone.id, name: room.zone.name },
      roomType: {
        id: room.roomType.id,
        name: room.roomType.name,
        basePrice: Number(room.roomType.basePrice),
        capacity: room.roomType.capacity,
        bedType: room.roomType.bedType,
      },
    })));
  } catch (error) {
    console.error("GET /api/rooms failed", error);
    return NextResponse.json({ message: "ไม่สามารถโหลดข้อมูลห้องพักได้" }, { status: 500 });
  }
}
