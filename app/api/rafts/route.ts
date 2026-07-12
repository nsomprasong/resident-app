import { BookingStatus, RaftStatus } from "@/generated/prisma/client";
import { prisma } from "@/lib/prisma";
import { NextRequest, NextResponse } from "next/server";

export async function GET(request: NextRequest) {
  try {
    const checkInValue = request.nextUrl.searchParams.get("checkIn"); const checkOutValue = request.nextUrl.searchParams.get("checkOut");
    const checkIn = checkInValue ? new Date(`${checkInValue}T00:00:00.000Z`) : null; const checkOut = checkOutValue ? new Date(`${checkOutValue}T00:00:00.000Z`) : null;
    if ((checkInValue || checkOutValue) && (!checkIn || !checkOut || Number.isNaN(checkIn.getTime()) || Number.isNaN(checkOut.getTime()) || checkOut <= checkIn)) return NextResponse.json({ message: "ช่วงวันที่ไม่ถูกต้อง" }, { status: 400 });
    const rafts = await prisma.raft.findMany({
      include: { bookingRafts: checkIn && checkOut ? { where: { booking: { status: { notIn: [BookingStatus.CANCELLED, BookingStatus.CHECKED_OUT] }, checkIn: { lt: checkOut }, checkOut: { gt: checkIn } } }, select: { id: true } } : false },
      orderBy: { number: "asc" },
    });
    return NextResponse.json(rafts.map((raft) => ({ id: raft.id, number: raft.number, name: raft.name, capacity: raft.capacity, basePrice: Number(raft.basePrice), booked: raft.status !== RaftStatus.AVAILABLE || ("bookingRafts" in raft && raft.bookingRafts.length > 0) })));
  } catch (error) {
    console.error("GET /api/rafts failed", error);
    return NextResponse.json({ message: "ไม่สามารถโหลดข้อมูลแพได้" }, { status: 500 });
  }
}
