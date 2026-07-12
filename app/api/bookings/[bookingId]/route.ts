import {
  BookingStatus,
  InspectionStatus,
  RoomStatus,
} from "@/generated/prisma/client";
import { prisma } from "@/lib/prisma";
import { NextRequest, NextResponse } from "next/server";
const labels: Record<BookingStatus, string> = {
  PENDING: "รอดำเนินการ",
  CONFIRMED: "ยืนยันแล้ว",
  CHECKED_IN: "เช็กอิน",
  CHECKED_OUT: "เช็กเอาต์",
  CANCELLED: "ยกเลิก",
};
const transitions: Record<BookingStatus, BookingStatus[]> = {
  PENDING: [BookingStatus.CONFIRMED, BookingStatus.CANCELLED],
  CONFIRMED: [BookingStatus.CHECKED_IN, BookingStatus.CANCELLED],
  CHECKED_IN: [BookingStatus.CHECKED_OUT],
  CHECKED_OUT: [],
  CANCELLED: [],
};

export async function GET(
  _: NextRequest,
  { params }: { params: Promise<{ bookingId: string }> },
) {
  try {
    const { bookingId } = await params;
    const booking = await prisma.booking.findUnique({
      where: { id: bookingId },
      include: {
        guest: true,
        tourGroup: true,
        rooms: {
          include: {
            room: { include: { zone: true, roomType: true } },
            inspection: true,
          },
        },
        rafts: { include: { raft: true } },
        charges: { orderBy: { createdAt: "asc" } },
        payments: {
          where: { status: { in: ["PAID", "REFUNDED"] } },
          orderBy: { createdAt: "desc" },
        },
        orders: {
          where: { status: { not: "CANCELLED" } },
          include: { items: { include: { product: true } } },
          orderBy: { createdAt: "desc" },
        },
      },
    });
    if (!booking)
      return NextResponse.json({ message: "ไม่พบรายการจอง" }, { status: 404 });
    const charges = booking.charges.reduce(
      (sum, item) => sum + Number(item.amount),
      0,
    );
    const orders = booking.orders.reduce(
      (sum, order) =>
        sum +
        order.items.reduce(
          (sub, item) =>
            sub + (item.isExtra ? Number(item.unitPrice) * item.quantity : 0),
          0,
        ),
      0,
    );
    const paid = booking.payments.reduce(
      (sum, item) =>
        sum +
        (item.status === "REFUNDED"
          ? -Number(item.amount)
          : Number(item.amount)),
      0,
    );
    return NextResponse.json({
      id: booking.id,
      reference: booking.reference,
      status: booking.status,
      jobClosed: Boolean(booking.closedAt),
      statusLabel: booking.closedAt ? "ปิดงานแล้ว" : labels[booking.status],
      customerName:
        booking.tourGroup?.name ??
        [booking.guest?.firstName, booking.guest?.lastName]
          .filter(Boolean)
          .join(" "),
      contactName: booking.tourGroup?.contactName,
      phone: booking.tourGroup?.phone ?? booking.guest?.phone ?? "-",
      mode: booking.tourGroupId ? "group" : "solo",
      guestCount: booking.guestCount,
      pricePerPerson: booking.pricePerPerson
        ? Number(booking.pricePerPerson)
        : null,
      checkIn: booking.checkIn.toISOString().slice(0, 10),
      checkOut: booking.checkOut.toISOString().slice(0, 10),
      rooms: booking.rooms.map(({ room, rate, extraBeds, inspection }) => ({
        id: room.id,
        number: room.number,
        zone: room.zone.name,
        roomType: room.roomType.name,
        rate: Number(rate),
        extraBeds,
        inspectionStatus: inspection?.status ?? null,
      })),
      rafts: booking.rafts.map(({ raft, rate }) => ({
        id: raft.id,
        number: raft.number,
        name: raft.name,
        capacity: raft.capacity,
        rate: Number(rate),
      })),
      charges: booking.charges.map((item) => ({
        id: item.id,
        type: item.type,
        title: item.description,
        price: Number(item.amount),
      })),
      orders: booking.orders.flatMap((order) =>
        order.items.map((item) => ({
          id: item.id,
          type: item.product.type,
          title: `${item.product.name} x ${item.quantity}${item.isExtra ? "" : " (รวมในราคาเหมา)"}`,
          price: item.isExtra ? Number(item.unitPrice) * item.quantity : 0,
          isExtra: item.isExtra,
        })),
      ),
      payments: booking.payments.map((payment, index) => ({
        id: payment.id,
        type: "PAYMENT",
        title:
          payment.reference ||
          (payment.status === "REFUNDED"
            ? "คืนเงิน"
            : index === booking.payments.length - 1
              ? "เงินมัดจำ"
              : "รับชำระเงิน"),
        price:
          payment.status === "REFUNDED"
            ? -Number(payment.amount)
            : Number(payment.amount),
      })),
      totals: {
        charges,
        orders,
        paid,
        grand: charges + orders,
        outstanding: Math.max(0, charges + orders - paid),
      },
      allowedStatuses: transitions[booking.status],
      housekeepingReady: booking.rooms.every(
        (item) => item.inspection?.status === InspectionStatus.COMPLETED,
      ),
    });
  } catch (error) {
    console.error("GET booking detail failed", error);
    return NextResponse.json(
      { message: "ไม่สามารถโหลดรายละเอียดการจองได้" },
      { status: 500 },
    );
  }
}

export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ bookingId: string }> },
) {
  try {
    const { bookingId } = await params;
    const body = (await request.json()) as {
      status?: BookingStatus;
      closeJob?: boolean;
    };
    if (body.closeJob) {
      const closed = await prisma.$transaction(async (tx) => {
        const booking = await tx.booking.findUnique({
          where: { id: bookingId },
          include: { rooms: { include: { inspection: true } } },
        });
        if (!booking) throw new Error("NOT_FOUND");
        if (booking.status !== BookingStatus.CHECKED_OUT)
          throw new Error("NOT_CHECKED_OUT");
        if (
          booking.rooms.some(
            (room) => room.inspection?.status !== InspectionStatus.COMPLETED,
          )
        )
          throw new Error("INSPECTION_PENDING");
        return tx.booking.update({
          where: { id: bookingId },
          data: { closedAt: new Date() },
          select: { id: true, closedAt: true },
        });
      });
      return NextResponse.json({ ...closed, jobClosed: true });
    }
    if (!body.status || !Object.values(BookingStatus).includes(body.status))
      return NextResponse.json({ message: "สถานะไม่ถูกต้อง" }, { status: 400 });
    const updated = await prisma.$transaction(async (tx) => {
      const booking = await tx.booking.findUnique({
        where: { id: bookingId },
        include: { rooms: { include: { inspection: true } } },
      });
      if (!booking) throw new Error("NOT_FOUND");
      if (!transitions[booking.status].includes(body.status!))
        throw new Error("INVALID_TRANSITION");
      const roomIds = booking.rooms.map((item) => item.roomId);
      if (body.status === BookingStatus.CHECKED_IN)
        await tx.room.updateMany({
          where: { id: { in: roomIds } },
          data: { status: RoomStatus.OCCUPIED },
        });
      if (body.status === BookingStatus.CHECKED_OUT) {
        await tx.room.updateMany({
          where: { id: { in: roomIds } },
          data: { status: RoomStatus.CLEANING },
        });
        const missing = booking.rooms.filter((item) => !item.inspection);
        if (missing.length)
          await tx.roomInspection.createMany({
            data: missing.map((item) => ({ bookingRoomId: item.id })),
          });
      }
      if (body.status === BookingStatus.CANCELLED)
        await tx.room.updateMany({
          where: { id: { in: roomIds } },
          data: { status: RoomStatus.AVAILABLE },
        });
      return tx.booking.update({
        where: { id: bookingId },
        data: { status: body.status },
        select: { id: true, status: true },
      });
    });
    return NextResponse.json({
      ...updated,
      statusLabel: labels[updated.status],
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : "";
    if (message === "NOT_FOUND")
      return NextResponse.json({ message: "ไม่พบรายการจอง" }, { status: 404 });
    if (message === "INVALID_TRANSITION")
      return NextResponse.json(
        { message: "ไม่สามารถเปลี่ยนไปยังสถานะนี้ได้" },
        { status: 409 },
      );
    if (message === "NOT_CHECKED_OUT")
      return NextResponse.json(
        { message: "ต้องเช็กเอาต์ก่อนปิดงาน" },
        { status: 409 },
      );
    if (message === "INSPECTION_PENDING")
      return NextResponse.json(
        { message: "ต้องตรวจสอบให้ครบทุกห้องก่อนปิดงาน" },
        { status: 409 },
      );
    console.error("PATCH booking failed", error);
    return NextResponse.json(
      { message: "ไม่สามารถเปลี่ยนสถานะได้" },
      { status: 500 },
    );
  }
}
