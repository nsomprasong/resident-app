import {
  BookingStatus,
  ChargeType,
  OrderStatus,
} from "@/generated/prisma/client";
import { prisma } from "@/lib/prisma";
import { NextRequest, NextResponse } from "next/server";

interface Body {
  mode: "solo" | "group";
  name: string;
  contactName?: string;
  phone: string;
  checkIn: string;
  checkOut: string;
  guestCount?: number;
  pricePerPerson?: number;
  roomIds?: string[];
  raftIds?: string[];
  foodItems?: Array<{ productId: string; quantity: number }>;
}
const labels: Record<BookingStatus, string> = {
  PENDING: "รอดำเนินการ",
  CONFIRMED: "ยืนยันแล้ว",
  CHECKED_IN: "เช็กอิน",
  CHECKED_OUT: "เช็กเอาต์",
  CANCELLED: "ยกเลิก",
};
const images = [
  "/images/room/room1.jpg",
  "/images/room/room2.jpg",
  "/images/room/room3.jpg",
  "/images/room/room4.jpg",
];
const parseDate = (value: string) => new Date(`${value}T00:00:00.000Z`);
function todayBangkok() {
  const parts = new Intl.DateTimeFormat("en-US", {
    timeZone: "Asia/Bangkok",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).formatToParts(new Date());
  const get = (type: Intl.DateTimeFormatPartTypes) =>
    parts.find((part) => part.type === type)?.value ?? "";
  return parseDate(`${get("year")}-${get("month")}-${get("day")}`);
}

export async function GET(request: NextRequest) {
  try {
    const history = request.nextUrl.searchParams.get("history") === "true";
    const date = parseDate(
      request.nextUrl.searchParams.get("date") ??
        new Date().toISOString().slice(0, 10),
    );
    if (Number.isNaN(date.getTime()))
      return NextResponse.json(
        { message: "วันที่ไม่ถูกต้อง" },
        { status: 400 },
      );
    const bookings = await prisma.booking.findMany({
      where: history
        ? {
            status: {
              in: [BookingStatus.CHECKED_OUT, BookingStatus.CANCELLED],
            },
          }
        : {
            checkIn: { lte: date },
            checkOut: { gt: date },
            status: {
              notIn: [BookingStatus.CANCELLED, BookingStatus.CHECKED_OUT],
            },
          },
      include: {
        guest: true,
        tourGroup: true,
        rooms: { include: { room: true } },
        rafts: { include: { raft: true } },
      },
      orderBy: history ? { updatedAt: "desc" } : { createdAt: "desc" },
    });
    return NextResponse.json(
      bookings.map((booking) => ({
        id: booking.id,
        reference: booking.reference,
        mode: booking.tourGroupId ? "group" : "solo",
        customerName:
          booking.tourGroup?.name ??
          [booking.guest?.firstName, booking.guest?.lastName]
            .filter(Boolean)
            .join(" "),
        status: booking.closedAt ? "ปิดงานแล้ว" : labels[booking.status],
        rooms: booking.rooms.map(({ room }, index) => ({
          id: booking.id,
          roomId: room.id,
          name: `ห้อง ${room.number}`,
          status: booking.closedAt ? "ปิดงานแล้ว" : labels[booking.status],
          image: images[index % images.length],
        })),
        rafts: booking.rafts.map(({ raft }) => ({
          id: raft.id,
          name: raft.name,
          capacity: raft.capacity,
        })),
      })),
    );
  } catch (error) {
    console.error("GET bookings failed", error);
    return NextResponse.json(
      { message: "ไม่สามารถโหลดรายการจองได้" },
      { status: 500 },
    );
  }
}

export async function POST(request: NextRequest) {
  try {
    const body = (await request.json()) as Body;
    const roomIds = body.roomIds ?? [];
    const raftIds = body.raftIds ?? [];
    const foodItems = (body.foodItems ?? []).filter(
      (item) => item.quantity > 0,
    );
    if (
      !body.name?.trim() ||
      !body.phone?.trim() ||
      !body.checkIn ||
      !body.checkOut ||
      (!roomIds.length && !raftIds.length) ||
      !["solo", "group"].includes(body.mode)
    )
      return NextResponse.json(
        { message: "กรุณากรอกข้อมูลและเลือกห้องหรือแพอย่างน้อย 1 รายการ" },
        { status: 400 },
      );
    if (
      body.mode === "group" &&
      (!body.guestCount ||
        body.guestCount < 1 ||
        body.pricePerPerson === undefined ||
        body.pricePerPerson < 0)
    )
      return NextResponse.json(
        { message: "กรุณาระบุจำนวนคนและราคาต่อหัว" },
        { status: 400 },
      );
    const checkIn = parseDate(body.checkIn);
    const checkOut = parseDate(body.checkOut);
    if (
      Number.isNaN(checkIn.getTime()) ||
      Number.isNaN(checkOut.getTime()) ||
      checkOut <= checkIn
    )
      return NextResponse.json(
        { message: "วันเช็กเอาต์ต้องอยู่หลังวันเช็กอิน" },
        { status: 400 },
      );
    if (checkIn < todayBangkok())
      return NextResponse.json(
        { message: "วันเช็กอินต้องเป็นวันนี้หรือวันในอนาคต" },
        { status: 400 },
      );
    const result = await prisma.$transaction(async (tx) => {
      const rooms = await tx.room.findMany({
        where: { id: { in: roomIds } },
        include: { roomType: true },
      });
      const rafts = await tx.raft.findMany({ where: { id: { in: raftIds } } });
      const products = await tx.product.findMany({
        where: {
          id: { in: foodItems.map((item) => item.productId) },
          isActive: true,
        },
      });
      if (rooms.length !== roomIds.length) throw new Error("ROOM_NOT_FOUND");
      if (rafts.length !== raftIds.length) throw new Error("RAFT_NOT_FOUND");
      if (
        products.length !==
        new Set(foodItems.map((item) => item.productId)).size
      )
        throw new Error("PRODUCT_NOT_FOUND");
      const roomConflict = await tx.bookingRoom.findFirst({
        where: {
          roomId: { in: roomIds },
          booking: {
            status: {
              notIn: [BookingStatus.CANCELLED, BookingStatus.CHECKED_OUT],
            },
            checkIn: { lt: checkOut },
            checkOut: { gt: checkIn },
          },
        },
        include: { room: true },
      });
      if (roomConflict)
        throw new Error(`ROOM_CONFLICT:${roomConflict.room.number}`);
      const raftConflict = await tx.bookingRaft.findFirst({
        where: {
          raftId: { in: raftIds },
          booking: {
            status: { not: BookingStatus.CANCELLED },
            checkIn: { lt: checkOut },
            checkOut: { gt: checkIn },
          },
        },
        include: { raft: true },
      });
      if (raftConflict)
        throw new Error(`RAFT_CONFLICT:${raftConflict.raft.number}`);
      let guestId: string | undefined;
      let tourGroupId: string | undefined;
      if (body.mode === "group") {
        const group = await tx.tourGroup.create({
          data: {
            name: body.name.trim(),
            contactName: body.contactName?.trim() || body.name.trim(),
            phone: body.phone.trim(),
          },
        });
        tourGroupId = group.id;
      } else {
        const [firstName, ...last] = body.name.trim().split(/\s+/);
        const guest = await tx.guest.create({
          data: {
            firstName,
            lastName: last.join(" ") || "-",
            phone: body.phone.trim(),
          },
        });
        guestId = guest.id;
      }
      const nights = Math.max(
        1,
        Math.ceil((checkOut.getTime() - checkIn.getTime()) / 86_400_000),
      );
      const roomTotal = rooms.reduce(
        (sum, room) => sum + Number(room.roomType.basePrice) * nights,
        0,
      );
      const raftTotal = rafts.reduce(
        (sum, raft) => sum + Number(raft.basePrice) * nights,
        0,
      );
      const groupPackage =
        body.mode === "group"
          ? (body.guestCount ?? 0) * (body.pricePerPerson ?? 0)
          : 0;
      const booking = await tx.booking.create({
        data: {
          reference: `BK-${Date.now()}-${Math.random().toString(36).slice(2, 6).toUpperCase()}`,
          status: BookingStatus.PENDING,
          checkIn,
          checkOut,
          guestId,
          tourGroupId,
          guestCount: body.mode === "group" ? body.guestCount : undefined,
          pricePerPerson:
            body.mode === "group" ? body.pricePerPerson : undefined,
          rooms: {
            create: rooms.map((room) => ({
              roomId: room.id,
              rate: room.roomType.basePrice,
              isExtra: false,
            })),
          },
          rafts: {
            create: rafts.map((raft) => ({
              raftId: raft.id,
              rate: raft.basePrice,
              isExtra: false,
            })),
          },
          charges: {
            create:
              body.mode === "group"
                ? [
                    {
                      type: ChargeType.OTHER,
                      description: `ราคาเหมากลุ่ม ${body.guestCount} คน × ฿${body.pricePerPerson}`,
                      amount: groupPackage,
                    },
                  ]
                : [
                    ...(rooms.length
                      ? [
                          {
                            type: ChargeType.ROOM,
                            description: `ค่าห้องพัก ${nights} คืน`,
                            amount: roomTotal,
                          },
                        ]
                      : []),
                    ...(rafts.length
                      ? [
                          {
                            type: ChargeType.RAFT,
                            description: `ค่าแพ ${rafts.length} หลัง · ${nights} คืน`,
                            amount: raftTotal,
                          },
                        ]
                      : []),
                  ],
          },
        },
        select: { id: true, reference: true },
      });
      if (foodItems.length) {
        const productMap = new Map(
          products.map((product) => [product.id, product]),
        );
        await tx.order.create({
          data: {
            number: `ORD-${Date.now()}-${Math.random().toString(36).slice(2, 6).toUpperCase()}`,
            status: OrderStatus.PENDING,
            bookingId: booking.id,
            roomId: rooms[0]?.id,
            note:
              body.mode === "group"
                ? "อาหารหลักรวมในราคาเหมา"
                : "อาหารสั่งพร้อมการจอง",
            items: {
              create: foodItems.map((item) => ({
                productId: item.productId,
                quantity: item.quantity,
                unitPrice: productMap.get(item.productId)!.price,
                isExtra: body.mode !== "group",
              })),
            },
          },
        });
      }
      return booking;
    });
    return NextResponse.json(result, { status: 201 });
  } catch (error) {
    const message = error instanceof Error ? error.message : "";
    if (message === "ROOM_NOT_FOUND")
      return NextResponse.json(
        { message: "ไม่พบห้องที่เลือก" },
        { status: 400 },
      );
    if (message === "RAFT_NOT_FOUND")
      return NextResponse.json({ message: "ไม่พบแพที่เลือก" }, { status: 400 });
    if (message === "PRODUCT_NOT_FOUND")
      return NextResponse.json(
        { message: "ไม่พบอาหารที่เลือก" },
        { status: 400 },
      );
    if (message.startsWith("ROOM_CONFLICT:"))
      return NextResponse.json(
        { message: `ห้อง ${message.split(":")[1]} ไม่ว่าง` },
        { status: 409 },
      );
    if (message.startsWith("RAFT_CONFLICT:"))
      return NextResponse.json(
        { message: `แพ ${message.split(":")[1]} ไม่ว่าง` },
        { status: 409 },
      );
    console.error("POST bookings failed", error);
    return NextResponse.json(
      { message: "ไม่สามารถบันทึกการจองได้" },
      { status: 500 },
    );
  }
}
