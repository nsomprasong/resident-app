import { apiErrorResponse } from "@/lib/api/validation";
import { sortRoomsByZoneAndNumber } from "@/lib/bookings/room-sort";
import { prisma } from "@/lib/prisma";
import { serializeRoomMaster } from "@/lib/settings/rooms";
import { NextResponse } from "next/server";

const roomInclude = {
  zone: { select: { id: true, name: true, isActive: true } },
  roomType: { select: { id: true, name: true, isActive: true } },
} as const;

export async function GET() {
  try {
    const rooms = await prisma.room.findMany({
      include: roomInclude,
      orderBy: [{ zone: { name: "asc" } }, { number: "asc" }],
    });
    return NextResponse.json(
      sortRoomsByZoneAndNumber(rooms).map(serializeRoomMaster),
    );
  } catch (error) {
    console.error("GET /api/rooms/master failed", error);
    return apiErrorResponse("ไม่สามารถโหลดรายการห้องได้", 500, "INTERNAL_ERROR");
  }
}
