import {
  BookingStatus,
  InspectionStatus,
  RoomStatus,
} from "@/generated/prisma/client";
import {
  apiErrorResponse,
  readJsonObject,
  validationErrorResponse,
  type ValidationIssue,
} from "@/lib/api/validation";
import { getCurrentUser } from "@/lib/auth/current-user";
import { recordAuditLog } from "@/lib/audit/audit-log";
import { cancelUnfinishedOrdersForBooking } from "@/lib/orders/kitchen-workflow";
import { acquireBookingFinancialLock } from "@/lib/payments/financial-locks";
import { calculateBookingFinancialSummary } from "@/lib/payments/financial-summary";
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
  // Skip confirm step — check in directly from pending.
  PENDING: [BookingStatus.CHECKED_IN, BookingStatus.CANCELLED],
  // Keep path for bookings that were confirmed before this change.
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
            inspection: {
              include: {
                completedBy: { select: { id: true, name: true } },
              },
            },
          },
        },
        rafts: { include: { raft: true } },
        charges: { orderBy: { createdAt: "asc" } },
        payments: {
          orderBy: { createdAt: "desc" },
        },
        paymentRefunds: { select: { amount: true } },
        orders: {
          where: { status: { not: "CANCELLED" } },
          include: {
            items: {
              include: {
                product: {
                  include: {
                    type: { select: { name: true } },
                  },
                },
              },
            },
            room: { select: { id: true, number: true } },
          },
          orderBy: { createdAt: "desc" },
        },
      },
    });
    if (!booking)
      return NextResponse.json({ message: "ไม่พบรายการจอง" }, { status: 404 });
    const financialSummary = calculateBookingFinancialSummary({
      charges: booking.charges,
      orders: booking.orders,
      payments: booking.payments,
      paymentRefunds: booking.paymentRefunds,
    });
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
      rooms: booking.rooms.map(({ room, rate, extraBeds, isExtra, inspection }) => ({
        id: room.id,
        number: room.number,
        zone: room.zone.name,
        roomType: room.roomType.name,
        rate: Number(rate),
        extraBeds,
        isExtra,
        inspectionStatus: inspection?.status ?? null,
        inspectionCompletedAt: inspection?.completedAt?.toISOString() ?? null,
        inspectionCompletedByName: inspection?.completedBy?.name ?? null,
      })),
      rafts: booking.rafts.map(({ raft, rate, isExtra }) => ({
        id: raft.id,
        number: raft.number,
        name: raft.name,
        capacity: raft.capacity,
        rate: Number(rate),
        isExtra,
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
          orderId: order.id,
          orderStatus: order.status,
          type: item.product.type.name,
          typeName: item.product.type.name,
          isMinibar: item.product.isMinibar,
          title: `${item.product.name}${item.isExtra ? "" : " (รวมในราคาเหมา)"}`,
          productName: item.product.name,
          quantity: item.quantity,
          unitPrice: Number(item.unitPrice),
          price: item.isExtra ? Number(item.unitPrice) * item.quantity : 0,
          isExtra: item.isExtra,
          editable: order.status === "PENDING",
          chargeTo: order.roomId ? "room" : "group",
          roomId: order.room?.id ?? null,
          roomNumber: order.room?.number ?? null,
        })),
      ),
      payments: booking.payments
        .filter((payment) =>
          ["PAID", "VERIFIED", "REFUNDED", "PARTIALLY_REFUNDED"].includes(
            payment.status,
          ),
        )
        .map((payment, index) => ({
          id: payment.id,
          type: "PAYMENT",
          title:
            payment.reference ||
            (payment.status === "REFUNDED"
              ? "คืนเงิน"
              : index === 0
                ? "เงินมัดจำ"
                : "รับชำระเงิน"),
          price:
            payment.status === "REFUNDED"
              ? -Number(payment.amount)
              : Number(payment.amount),
        })),
      totals: {
        charges: financialSummary.chargeTotal,
        orders: financialSummary.extraOrderTotal,
        paid: financialSummary.netPaidTotal,
        pending: financialSummary.pendingTotal,
        grand: financialSummary.grandTotal,
        outstanding: financialSummary.outstandingTotal,
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
    const currentUser = await getCurrentUser();
    const parsed = await readJsonObject(request);
    if (!parsed.ok) return parsed.response;

    const issues: ValidationIssue[] = [];
    const closeJobValue = parsed.body.closeJob;
    const statusValue = parsed.body.status;

    if (closeJobValue !== undefined && typeof closeJobValue !== "boolean") {
      issues.push({ path: "closeJob", message: "Close job flag must be boolean" });
    }
    if (
      closeJobValue !== true &&
      (typeof statusValue !== "string" ||
        !Object.values(BookingStatus).includes(statusValue as BookingStatus))
    ) {
      issues.push({ path: "status", message: "Booking status is invalid" });
    }
    if (issues.length)
      return validationErrorResponse("สถานะไม่ถูกต้อง", issues);

    if (closeJobValue === true) {
      const closed = await prisma.$transaction(async (tx) => {
        await acquireBookingFinancialLock(tx, bookingId);
        const booking = await tx.booking.findUnique({
          where: { id: bookingId },
          include: {
            rooms: { include: { inspection: true } },
            charges: true,
            payments: true,
            paymentRefunds: { select: { amount: true } },
            orders: {
              where: { status: { not: "CANCELLED" } },
              include: { items: true },
            },
          },
        });
        if (!booking) throw new Error("NOT_FOUND");
        if (booking.status !== BookingStatus.CHECKED_OUT)
          throw new Error("NOT_CHECKED_OUT");
        const financialSummary = calculateBookingFinancialSummary({
          charges: booking.charges,
          orders: booking.orders,
          payments: booking.payments,
          paymentRefunds: booking.paymentRefunds,
        });
        if (financialSummary.outstandingTotal > 0)
          throw new Error("PAYMENT_OUTSTANDING");
        if (
          booking.rooms.some(
            (room) => room.inspection?.status !== InspectionStatus.COMPLETED,
          )
        )
          throw new Error("INSPECTION_PENDING");
        const cancelled = await cancelUnfinishedOrdersForBooking(tx, bookingId);
        const updatedBooking = await tx.booking.update({
          where: { id: bookingId },
          data: { closedAt: new Date() },
          select: { id: true, closedAt: true },
        });
        return {
          ...updatedBooking,
          cancelledUnfinishedOrders: cancelled.count,
        };
      });
      await recordAuditLog({
        actor: {
          employeeId: currentUser?.employee?.id,
          authUserId: currentUser?.user.id,
        },
        action: "BOOKING_JOB_CLOSED",
        entityType: "BOOKING",
        entityId: closed.id,
        metadata: {
          bookingId,
          closedAt: closed.closedAt?.toISOString() ?? null,
          cancelledUnfinishedOrders: closed.cancelledUnfinishedOrders,
        },
      });
      return NextResponse.json({
        ...closed,
        jobClosed: true,
        cancelledUnfinishedOrders: closed.cancelledUnfinishedOrders,
      });
    }
    const status = statusValue as BookingStatus;
    const updated = await prisma.$transaction(async (tx) => {
      const booking = await tx.booking.findUnique({
        where: { id: bookingId },
        include: { rooms: { include: { inspection: true } } },
      });
      if (!booking) throw new Error("NOT_FOUND");
      const previousStatus = booking.status;
      if (!transitions[booking.status].includes(status))
        throw new Error("INVALID_TRANSITION");
      const roomIds = booking.rooms.map((item) => item.roomId);
      if (status === BookingStatus.CHECKED_IN)
        await tx.room.updateMany({
          where: { id: { in: roomIds } },
          data: { status: RoomStatus.OCCUPIED },
        });
      if (status === BookingStatus.CHECKED_OUT) {
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
      if (status === BookingStatus.CANCELLED)
        await tx.room.updateMany({
          where: { id: { in: roomIds } },
          data: { status: RoomStatus.AVAILABLE },
        });
      const updatedBooking = await tx.booking.update({
        where: { id: bookingId },
        data: { status },
        select: { id: true, status: true },
      });

      let cancelledUnfinishedOrders = 0;
      if (status === BookingStatus.CHECKED_OUT) {
        const cancelled = await cancelUnfinishedOrdersForBooking(tx, bookingId);
        cancelledUnfinishedOrders = cancelled.count;
      }

      return {
        updatedBooking,
        previousStatus,
        cancelledUnfinishedOrders,
      };
    });
    await recordAuditLog({
      actor: {
        employeeId: currentUser?.employee?.id,
        authUserId: currentUser?.user.id,
      },
      action: "BOOKING_STATUS_CHANGED",
      entityType: "BOOKING",
      entityId: updated.updatedBooking.id,
      metadata: {
        bookingId,
        previousStatus: updated.previousStatus,
        status: updated.updatedBooking.status,
        cancelledUnfinishedOrders: updated.cancelledUnfinishedOrders,
      },
    });
    return NextResponse.json({
      ...updated.updatedBooking,
      statusLabel: labels[updated.updatedBooking.status],
      cancelledUnfinishedOrders: updated.cancelledUnfinishedOrders,
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : "";
    if (message === "NOT_FOUND")
      return apiErrorResponse("ไม่พบรายการจอง", 404, "NOT_FOUND");
    if (message === "INVALID_TRANSITION")
      return apiErrorResponse(
        "ไม่สามารถเปลี่ยนไปยังสถานะนี้ได้",
        409,
        "INVALID_TRANSITION",
      );
    if (message === "NOT_CHECKED_OUT")
      return apiErrorResponse(
        "ต้องเช็กเอาต์ก่อนปิดงาน",
        409,
        "NOT_CHECKED_OUT",
      );
    if (message === "INSPECTION_PENDING")
      return apiErrorResponse(
        "ต้องตรวจสอบให้ครบทุกห้องก่อนปิดงาน",
        409,
        "INSPECTION_PENDING",
      );
    if (message === "PAYMENT_OUTSTANDING")
      return apiErrorResponse(
        "กรุณาชำระเงินให้ครบก่อนปิดงาน",
        409,
        "PAYMENT_OUTSTANDING",
      );
    console.error("PATCH booking failed", error);
    return apiErrorResponse("ไม่สามารถเปลี่ยนสถานะได้", 500, "INTERNAL_ERROR");
  }
}
