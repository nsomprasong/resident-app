import { Prisma, RaftStatus } from "@/generated/prisma/client";
import {
  activeBookingConflictStatuses,
  bookingNightOverlapWhere,
} from "@/lib/bookings/availability";
import {
  apiErrorResponse,
  readJsonObject,
  validationErrorResponse,
} from "@/lib/api/validation";
import { recordAuditLog } from "@/lib/audit/audit-log";
import { getCurrentUser } from "@/lib/auth/current-user";
import { prisma } from "@/lib/prisma";
import { parseRaftInput, serializeRaftMaster } from "@/lib/settings/rafts";
import { NextRequest, NextResponse } from "next/server";

export async function GET(request: NextRequest) {
  try {
    const checkInValue = request.nextUrl.searchParams.get("checkIn");
    const checkOutValue = request.nextUrl.searchParams.get("checkOut");
    const excludeBookingId =
      request.nextUrl.searchParams.get("excludeBookingId")?.trim() || null;
    const checkIn = checkInValue ? new Date(`${checkInValue}T00:00:00.000Z`) : null;
    const checkOut = checkOutValue ? new Date(`${checkOutValue}T00:00:00.000Z`) : null;
    if (
      (checkInValue || checkOutValue) &&
      (!checkIn ||
        !checkOut ||
        Number.isNaN(checkIn.getTime()) ||
        Number.isNaN(checkOut.getTime()) ||
        checkOut <= checkIn)
    ) {
      return NextResponse.json({ message: "ช่วงวันที่ไม่ถูกต้อง" }, { status: 400 });
    }
    const [rafts, conflictRows] = await Promise.all([
      prisma.raft.findMany({
        where: { status: RaftStatus.AVAILABLE },
        orderBy: { number: "asc" },
      }),
      checkIn && checkOut
        ? prisma.bookingRaft.findMany({
            where: {
              ...(excludeBookingId
                ? { bookingId: { not: excludeBookingId } }
                : {}),
              booking: {
                status: { in: activeBookingConflictStatuses },
                ...bookingNightOverlapWhere(checkIn, checkOut),
              },
            },
            select: { raftId: true },
          })
        : Promise.resolve([] as Array<{ raftId: string }>),
    ]);
    const conflictingRaftIds = new Set(conflictRows.map((row) => row.raftId));
    return NextResponse.json(
      rafts.map((raft) => ({
        id: raft.id,
        number: raft.number,
        name: raft.name,
        capacity: raft.capacity,
        basePrice: Number(raft.basePrice),
        booked: conflictingRaftIds.has(raft.id),
      })),
    );
  } catch (error) {
    console.error("GET /api/rafts failed", error);
    return NextResponse.json({ message: "ไม่สามารถโหลดข้อมูลแพได้" }, { status: 500 });
  }
}

export async function POST(request: NextRequest) {
  try {
    const currentUser = await getCurrentUser();
    const parsed = await readJsonObject(request);
    if (!parsed.ok) return parsed.response;

    const validated = parseRaftInput(parsed.body, "create");
    if (!validated.ok) {
      return validationErrorResponse("กรุณาตรวจสอบข้อมูลแพ", validated.issues);
    }

    const { number, name, capacity, basePrice, status } = validated.data;
    if (
      number === undefined ||
      name === undefined ||
      capacity === undefined ||
      basePrice === undefined
    ) {
      return validationErrorResponse("กรุณาตรวจสอบข้อมูลแพ", [
        { path: "body", message: "ข้อมูลไม่ครบ" },
      ]);
    }

    const raft = await prisma.raft.create({
      data: {
        number,
        name,
        capacity,
        basePrice,
        status: status ?? RaftStatus.AVAILABLE,
      },
    });

    await recordAuditLog({
      actor: {
        employeeId: currentUser?.employee?.id,
        authUserId: currentUser?.user.id,
      },
      action: "RAFT_CREATED",
      entityType: "RAFT",
      entityId: raft.id,
      metadata: { number: raft.number, status: raft.status },
    });

    return NextResponse.json(serializeRaftMaster(raft), { status: 201 });
  } catch (error) {
    if (
      error instanceof Prisma.PrismaClientKnownRequestError &&
      error.code === "P2002"
    ) {
      return validationErrorResponse("หมายเลขแพนี้มีอยู่แล้ว", [
        { path: "number", message: "หมายเลขซ้ำ" },
      ]);
    }
    console.error("POST /api/rafts failed", error);
    return apiErrorResponse("เพิ่มแพไม่สำเร็จ", 500, "INTERNAL_ERROR");
  }
}
