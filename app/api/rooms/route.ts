import { NextRequest, NextResponse } from "next/server";

import { Prisma } from "@/generated/prisma/client";
import { activeBookingConflictStatuses } from "@/lib/bookings/availability";
import {
  apiErrorResponse,
  readJsonObject,
  validationErrorResponse,
} from "@/lib/api/validation";
import { recordAuditLog } from "@/lib/audit/audit-log";
import { getCurrentUser } from "@/lib/auth/current-user";
import { prisma } from "@/lib/prisma";
import {
  parseRoomInput,
  serializeRoomMaster,
  validateRoomRelationIds,
} from "@/lib/settings/rooms";

const roomMasterInclude = {
  zone: { select: { id: true, name: true, isActive: true } },
  roomType: { select: { id: true, name: true, isActive: true } },
} as const;

export async function GET(request: NextRequest) {
  try {
    const checkInValue = request.nextUrl.searchParams.get("checkIn");
    const checkOutValue = request.nextUrl.searchParams.get("checkOut");
    const excludeBookingId =
      request.nextUrl.searchParams.get("excludeBookingId")?.trim() || null;
    const checkIn = checkInValue ? new Date(`${checkInValue}T00:00:00.000Z`) : null;
    const checkOut = checkOutValue ? new Date(`${checkOutValue}T00:00:00.000Z`) : null;
    if ((checkInValue || checkOutValue) && (!checkIn || !checkOut || Number.isNaN(checkIn.getTime()) || Number.isNaN(checkOut.getTime()) || checkOut <= checkIn)) {
      return NextResponse.json({ message: "ช่วงวันที่เข้าพักไม่ถูกต้อง" }, { status: 400 });
    }
    const rooms = await prisma.room.findMany({
      where: {
        zone: { isActive: true },
        roomType: { isActive: true },
      },
      include: {
        zone: true,
        roomType: true,
        bookingRooms: checkIn && checkOut ? {
          where: {
            booking: {
              status: { in: activeBookingConflictStatuses },
              checkIn: { lt: checkOut },
              checkOut: { gt: checkIn },
            },
          },
          select: { id: true, bookingId: true },
        } : false,
      },
      orderBy: { number: "asc" },
    });
    return NextResponse.json(rooms.map((room) => {
      const bookingRooms =
        "bookingRooms" in room && Array.isArray(room.bookingRooms)
          ? room.bookingRooms
          : [];
      const foreignConflicts = bookingRooms.filter(
        (item) => item.bookingId !== excludeBookingId,
      );
      const ownedByExcluded = Boolean(
        excludeBookingId &&
          bookingRooms.some((item) => item.bookingId === excludeBookingId),
      );
      return {
        id: room.id,
        number: room.number,
        floor: room.floor,
        status: room.status,
        booked:
          foreignConflicts.length > 0 ||
          (room.status !== "AVAILABLE" && !ownedByExcluded),
        zone: { id: room.zone.id, name: room.zone.name },
        roomType: {
          id: room.roomType.id,
          name: room.roomType.name,
          basePrice: Number(room.roomType.basePrice),
          capacity: room.roomType.capacity,
          bedType: room.roomType.bedType,
        },
      };
    }));
  } catch (error) {
    console.error("GET /api/rooms failed", error);
    return NextResponse.json({ message: "ไม่สามารถโหลดข้อมูลห้องพักได้" }, { status: 500 });
  }
}

export async function POST(request: NextRequest) {
  try {
    const currentUser = await getCurrentUser();
    const parsed = await readJsonObject(request);
    if (!parsed.ok) return parsed.response;

    const validated = parseRoomInput(parsed.body, "create");
    if (!validated.ok) {
      return validationErrorResponse("กรุณาตรวจสอบข้อมูลห้อง", validated.issues);
    }

    const { number, zoneId, roomTypeId, floor, status } = validated.data;
    if (number === undefined || zoneId === undefined || roomTypeId === undefined) {
      return validationErrorResponse("กรุณาตรวจสอบข้อมูลห้อง", [
        { path: "body", message: "ข้อมูลไม่ครบ" },
      ]);
    }

    const relationIssues = await validateRoomRelationIds(zoneId, roomTypeId, prisma);
    if (relationIssues.length) {
      return validationErrorResponse("ความสัมพันธ์ข้อมูลไม่ถูกต้อง", relationIssues);
    }

    const room = await prisma.room.create({
      data: {
        number,
        zoneId,
        roomTypeId,
        floor: floor ?? null,
        status: status ?? "AVAILABLE",
      },
      include: roomMasterInclude,
    });

    await recordAuditLog({
      actor: {
        employeeId: currentUser?.employee?.id,
        authUserId: currentUser?.user.id,
      },
      action: "ROOM_CREATED",
      entityType: "ROOM",
      entityId: room.id,
      metadata: {
        number: room.number,
        status: room.status,
      },
    });

    return NextResponse.json(serializeRoomMaster(room), { status: 201 });
  } catch (error) {
    if (
      error instanceof Prisma.PrismaClientKnownRequestError &&
      error.code === "P2002"
    ) {
      return validationErrorResponse("เลขห้องนี้มีอยู่แล้ว", [
        { path: "number", message: "เลขห้องซ้ำ" },
      ]);
    }
    console.error("POST /api/rooms failed", error);
    return apiErrorResponse("เพิ่มห้องไม่สำเร็จ", 500, "INTERNAL_ERROR");
  }
}
