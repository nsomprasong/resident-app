import {
  BookingStatus,
  ChargeType,
  OrderStatus,
} from "@/generated/prisma/client";
import { NextRequest, NextResponse } from "next/server";

import {
  apiErrorResponse,
  readJsonObject,
  validationErrorResponse,
} from "@/lib/api/validation";
import { recordAuditLog } from "@/lib/audit/audit-log";
import { getCurrentUser } from "@/lib/auth/current-user";
import {
  bookingNights,
  parsePricingFlagInputs,
} from "@/lib/bookings/pricing-flags";
import { acquireBookingFinancialLock } from "@/lib/payments/financial-locks";
import { calculateBookingFinancialSummary } from "@/lib/payments/financial-summary";
import { prisma } from "@/lib/prisma";

type RouteContext = {
  params: Promise<{ bookingId: string }>;
};

export async function PATCH(request: NextRequest, context: RouteContext) {
  try {
    const { bookingId } = await context.params;
    const currentUser = await getCurrentUser();
    const permissions = currentUser?.employee?.role?.permissions ?? [];
    const canResource = permissions.includes("resource.manage");
    const canOrder = permissions.includes("order.write");

    const parsed = await readJsonObject(request);
    if (!parsed.ok) return parsed.response;

    const roomsParsed = parsePricingFlagInputs(parsed.body.rooms, "rooms");
    const raftsParsed = parsePricingFlagInputs(parsed.body.rafts, "rafts");
    const orderItemsParsed = parsePricingFlagInputs(
      parsed.body.orderItems,
      "orderItems",
    );

    const issues = [
      ...(roomsParsed.ok ? [] : roomsParsed.issues),
      ...(raftsParsed.ok ? [] : raftsParsed.issues),
      ...(orderItemsParsed.ok ? [] : orderItemsParsed.issues),
    ];
    if (issues.length) {
      return validationErrorResponse("ข้อมูลการคิดเงินไม่ถูกต้อง", issues);
    }

    const rooms = roomsParsed.ok ? roomsParsed.items : [];
    const rafts = raftsParsed.ok ? raftsParsed.items : [];
    const orderItems = orderItemsParsed.ok ? orderItemsParsed.items : [];

    if (!rooms.length && !rafts.length && !orderItems.length) {
      return validationErrorResponse("กรุณาเลือกรายการอย่างน้อย 1 รายการ", [
        { path: "body", message: "At least one pricing flag update is required" },
      ]);
    }

    if ((rooms.length || rafts.length) && !canResource) {
      return apiErrorResponse("ไม่มีสิทธิ์เปลี่ยนการคิดเงินห้อง/แพ", 403, "FORBIDDEN");
    }
    if (orderItems.length && !canOrder) {
      return apiErrorResponse(
        "ไม่มีสิทธิ์เปลี่ยนการคิดเงินอาหาร",
        403,
        "FORBIDDEN",
      );
    }

    const result = await prisma.$transaction(async (tx) => {
      await acquireBookingFinancialLock(tx, bookingId);

      const booking = await tx.booking.findUnique({
        where: { id: bookingId },
        select: {
          id: true,
          status: true,
          closedAt: true,
          tourGroupId: true,
          checkIn: true,
          checkOut: true,
          rooms: {
            include: { room: { select: { number: true } } },
          },
          rafts: {
            include: { raft: { select: { name: true } } },
          },
        },
      });

      if (!booking) throw new Error("NOT_FOUND");
      if (
        booking.status === BookingStatus.CHECKED_OUT ||
        booking.status === BookingStatus.CANCELLED ||
        booking.closedAt
      ) {
        throw new Error("BOOKING_CLOSED");
      }
      if (!booking.tourGroupId) throw new Error("NOT_GROUP");

      const nights = bookingNights(booking.checkIn, booking.checkOut);
      const roomById = new Map(booking.rooms.map((item) => [item.roomId, item]));
      const raftById = new Map(booking.rafts.map((item) => [item.raftId, item]));

      const updatedRooms: Array<{ id: string; isExtra: boolean }> = [];
      const updatedRafts: Array<{ id: string; isExtra: boolean }> = [];
      const updatedOrderItems: Array<{
        id: string;
        isExtra: boolean;
        price: number;
      }> = [];
      const chargeCreates: Array<{
        bookingId: string;
        type: ChargeType;
        description: string;
        amount: number;
      }> = [];

      for (const item of rooms) {
        const current = roomById.get(item.id);
        if (!current) throw new Error(`ROOM_NOT_IN_BOOKING:${item.id}`);
        if (current.isExtra === item.isExtra) continue;
        await tx.bookingRoom.update({
          where: { id: current.id },
          data: { isExtra: item.isExtra },
        });
        const amount = Number(current.rate) * nights;
        chargeCreates.push({
          bookingId,
          type: ChargeType.ROOM,
          description: item.isExtra
            ? `คิดเพิ่มห้อง ${current.room.number} · ${nights} คืน`
            : `ย้ายห้อง ${current.room.number} เข้าแพ็กเกจเหมา`,
          amount: item.isExtra ? amount : -amount,
        });
        updatedRooms.push({ id: item.id, isExtra: item.isExtra });
      }

      for (const item of rafts) {
        const current = raftById.get(item.id);
        if (!current) throw new Error(`RAFT_NOT_IN_BOOKING:${item.id}`);
        if (current.isExtra === item.isExtra) continue;
        await tx.bookingRaft.update({
          where: { id: current.id },
          data: { isExtra: item.isExtra },
        });
        const amount = Number(current.rate) * nights;
        chargeCreates.push({
          bookingId,
          type: ChargeType.RAFT,
          description: item.isExtra
            ? `คิดเพิ่มแพ ${current.raft.name} · ${nights} คืน`
            : `ย้ายแพ ${current.raft.name} เข้าแพ็กเกจเหมา`,
          amount: item.isExtra ? amount : -amount,
        });
        updatedRafts.push({ id: item.id, isExtra: item.isExtra });
      }

      if (orderItems.length) {
        const existingItems = await tx.orderItem.findMany({
          where: {
            id: { in: orderItems.map((item) => item.id) },
            order: { bookingId },
          },
          select: {
            id: true,
            isExtra: true,
            quantity: true,
            unitPrice: true,
            order: { select: { status: true } },
          },
        });
        if (existingItems.length !== orderItems.length) {
          throw new Error("ORDER_ITEM_NOT_FOUND");
        }
        const itemById = new Map(existingItems.map((item) => [item.id, item]));
        for (const item of orderItems) {
          const current = itemById.get(item.id);
          if (!current) throw new Error("ORDER_ITEM_NOT_FOUND");
          if (current.order.status !== OrderStatus.PENDING) {
            throw new Error("ORDER_LOCKED");
          }
          if (current.isExtra === item.isExtra) {
            updatedOrderItems.push({
              id: item.id,
              isExtra: item.isExtra,
              price: item.isExtra
                ? Number(current.unitPrice) * current.quantity
                : 0,
            });
            continue;
          }
          await tx.orderItem.update({
            where: { id: item.id },
            data: { isExtra: item.isExtra },
          });
          updatedOrderItems.push({
            id: item.id,
            isExtra: item.isExtra,
            price: item.isExtra
              ? Number(current.unitPrice) * current.quantity
              : 0,
          });
        }
      }

      if (chargeCreates.length) {
        await tx.charge.createMany({ data: chargeCreates });
      }

      const summarySource = await tx.booking.findUnique({
        where: { id: bookingId },
        select: {
          charges: { select: { id: true, type: true, description: true, amount: true } },
          payments: { select: { amount: true, status: true } },
          paymentRefunds: { select: { amount: true } },
          orders: {
            where: { status: { not: "CANCELLED" } },
            select: {
              items: {
                select: {
                  unitPrice: true,
                  quantity: true,
                  isExtra: true,
                },
              },
            },
          },
        },
      });
      if (!summarySource) throw new Error("NOT_FOUND");

      const financialSummary = calculateBookingFinancialSummary({
        charges: summarySource.charges,
        orders: summarySource.orders,
        payments: summarySource.payments,
        paymentRefunds: summarySource.paymentRefunds,
      });

      return {
        updatedRooms,
        updatedRafts,
        updatedOrderItems,
        chargeCount: chargeCreates.length,
        charges: summarySource.charges.map((item) => ({
          id: item.id,
          type: item.type,
          title: item.description,
          price: Number(item.amount),
        })),
        totals: {
          charges: financialSummary.chargeTotal,
          orders: financialSummary.extraOrderTotal,
          paid: financialSummary.netPaidTotal,
          pending: financialSummary.pendingTotal,
          grand: financialSummary.grandTotal,
          outstanding: financialSummary.outstandingTotal,
        },
      };
    });

    await recordAuditLog({
      actor: {
        employeeId: currentUser?.employee?.id,
        authUserId: currentUser?.user.id,
      },
      action: "BOOKING_PRICING_FLAGS_UPDATED",
      entityType: "BOOKING",
      entityId: bookingId,
      metadata: {
        roomCount: result.updatedRooms.length,
        raftCount: result.updatedRafts.length,
        orderItemCount: result.updatedOrderItems.length,
        chargeCount: result.chargeCount,
      },
    });

    return NextResponse.json({
      success: true,
      rooms: result.updatedRooms,
      rafts: result.updatedRafts,
      orderItems: result.updatedOrderItems,
      charges: result.charges,
      totals: result.totals,
    });
  } catch (error) {
    if (error instanceof Error) {
      if (error.message === "NOT_FOUND") {
        return apiErrorResponse("ไม่พบรายการจอง", 404, "NOT_FOUND");
      }
      if (error.message === "NOT_GROUP") {
        return apiErrorResponse(
          "เปลี่ยนการคิดเงินได้เฉพาะการจองแบบกรุ๊ป",
          400,
          "NOT_GROUP",
        );
      }
      if (error.message === "BOOKING_CLOSED") {
        return apiErrorResponse(
          "รายการจองนี้ปิดแล้ว ไม่สามารถแก้ไขได้",
          400,
          "BOOKING_CLOSED",
        );
      }
      if (error.message === "ORDER_LOCKED") {
        return apiErrorResponse(
          "มีออเดอร์ที่ครัวรับแล้ว แก้ไขการคิดเงินไม่ได้",
          409,
          "ORDER_LOCKED",
        );
      }
      if (error.message === "ORDER_ITEM_NOT_FOUND") {
        return apiErrorResponse("ไม่พบรายการอาหารในการจองนี้", 404, "NOT_FOUND");
      }
      if (error.message.startsWith("ROOM_NOT_IN_BOOKING:")) {
        return apiErrorResponse("มีห้องที่ไม่อยู่ในการจองนี้", 400, "INVALID_ROOM");
      }
      if (error.message.startsWith("RAFT_NOT_IN_BOOKING:")) {
        return apiErrorResponse("มีแพที่ไม่อยู่ในการจองนี้", 400, "INVALID_RAFT");
      }
    }
    console.error("PATCH /api/bookings/[bookingId]/pricing failed", error);
    return NextResponse.json(
      { message: "ไม่สามารถอัปเดตการคิดเงินได้" },
      { status: 500 },
    );
  }
}
