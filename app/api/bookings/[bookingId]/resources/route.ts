import { BookingStatus, ChargeType, RoomStatus } from "@/generated/prisma/client";
import { prisma } from "@/lib/prisma";
import { NextRequest, NextResponse } from "next/server";

export async function POST(request: NextRequest, { params }: { params: Promise<{ bookingId: string }> }) {
  try {
    const { bookingId } = await params; const body = await request.json() as { roomIds?: string[]; raftIds?: string[] }; const roomIds = body.roomIds ?? []; const raftIds = body.raftIds ?? [];
    if (!roomIds.length && !raftIds.length) return NextResponse.json({ message: "กรุณาเลือกห้องหรือแพอย่างน้อย 1 รายการ" }, { status: 400 });
    await prisma.$transaction(async (tx) => {
      const booking = await tx.booking.findUnique({ where: { id: bookingId }, include: { rooms: true, rafts: true } });
      if (!booking) throw new Error("NOT_FOUND");
      if (booking.status === BookingStatus.CHECKED_OUT || booking.status === BookingStatus.CANCELLED) throw new Error("BOOKING_CLOSED");
      if (roomIds.some((id) => booking.rooms.some((item) => item.roomId === id)) || raftIds.some((id) => booking.rafts.some((item) => item.raftId === id))) throw new Error("ALREADY_ADDED");
      const rooms = await tx.room.findMany({ where: { id: { in: roomIds } }, include: { roomType: true } }); const rafts = await tx.raft.findMany({ where: { id: { in: raftIds } } });
      if (rooms.length !== roomIds.length || rafts.length !== raftIds.length) throw new Error("NOT_FOUND_RESOURCE");
      const roomConflict = await tx.bookingRoom.findFirst({ where: { roomId: { in: roomIds }, bookingId: { not: bookingId }, booking: { status: { notIn: [BookingStatus.CANCELLED, BookingStatus.CHECKED_OUT] }, checkIn: { lt: booking.checkOut }, checkOut: { gt: booking.checkIn } } }, include: { room: true } });
      if (roomConflict) throw new Error(`ROOM_CONFLICT:${roomConflict.room.number}`);
      const raftConflict = await tx.bookingRaft.findFirst({ where: { raftId: { in: raftIds }, bookingId: { not: bookingId }, booking: { status: { notIn: [BookingStatus.CANCELLED, BookingStatus.CHECKED_OUT] }, checkIn: { lt: booking.checkOut }, checkOut: { gt: booking.checkIn } } }, include: { raft: true } });
      if (raftConflict) throw new Error(`RAFT_CONFLICT:${raftConflict.raft.number}`);
      const nights = Math.max(1, Math.ceil((booking.checkOut.getTime() - booking.checkIn.getTime()) / 86_400_000));
      if (rooms.length) { await tx.bookingRoom.createMany({ data: rooms.map((room) => ({ bookingId, roomId: room.id, rate: room.roomType.basePrice, isExtra: true })) }); await tx.charge.create({ data: { bookingId, type: ChargeType.ROOM, description: `เพิ่มห้องพัก ${rooms.length} ห้อง · ${nights} คืน`, amount: rooms.reduce((sum, room) => sum + Number(room.roomType.basePrice) * nights, 0) } }); if (booking.status === BookingStatus.CHECKED_IN) { await tx.room.updateMany({ where: { id: { in: roomIds } }, data: { status: RoomStatus.OCCUPIED } }); const added = await tx.bookingRoom.findMany({ where: { bookingId, roomId: { in: roomIds } }, select: { id: true } }); await tx.roomInspection.createMany({ data: added.map((item) => ({ bookingRoomId: item.id })) }); } }
      if (rafts.length) { await tx.bookingRaft.createMany({ data: rafts.map((raft) => ({ bookingId, raftId: raft.id, rate: raft.basePrice, isExtra: true })) }); await tx.charge.create({ data: { bookingId, type: ChargeType.RAFT, description: `เพิ่มแพ ${rafts.length} หลัง · ${nights} คืน`, amount: rafts.reduce((sum, raft) => sum + Number(raft.basePrice) * nights, 0) } }); }
    });
    return NextResponse.json({ success: true }, { status: 201 });
  } catch (error) {
    const message = error instanceof Error ? error.message : "";
    const labels: Record<string, string> = { NOT_FOUND: "ไม่พบรายการจอง", BOOKING_CLOSED: "รายการจองนี้ปิดแล้ว", ALREADY_ADDED: "มีรายการที่เลือกอยู่ในการจองแล้ว", NOT_FOUND_RESOURCE: "ไม่พบห้องหรือแพที่เลือก" };
    if (labels[message]) return NextResponse.json({ message: labels[message] }, { status: message === "NOT_FOUND" ? 404 : 400 });
    if (message.startsWith("ROOM_CONFLICT:")) return NextResponse.json({ message: `ห้อง ${message.split(":")[1]} ไม่ว่าง` }, { status: 409 });
    if (message.startsWith("RAFT_CONFLICT:")) return NextResponse.json({ message: `แพ ${message.split(":")[1]} ไม่ว่าง` }, { status: 409 });
    console.error("POST booking resources failed", error); return NextResponse.json({ message: "ไม่สามารถเพิ่มห้องหรือแพได้" }, { status: 500 });
  }
}
