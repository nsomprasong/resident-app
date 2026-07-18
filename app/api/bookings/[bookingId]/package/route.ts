import { NextRequest, NextResponse } from "next/server";

import {
  apiErrorResponse,
  readJsonObject,
  validationErrorResponse,
} from "@/lib/api/validation";
import { recordAuditLog } from "@/lib/audit/audit-log";
import { getCurrentUser } from "@/lib/auth/current-user";
import { parseGroupPackageInput } from "@/lib/bookings/group-package";
import {
  StayResourceConflictError,
  applyBookingStayUpdate,
  parseStayDatesInput,
  parseStayResourceFlags,
} from "@/lib/bookings/stay-update";
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
    const parsed = await readJsonObject(request);
    if (!parsed.ok) return parsed.response;

    const dates = parseStayDatesInput(parsed.body);
    if (!dates.ok) {
      return validationErrorResponse(
        "กรุณาระบุวันที่เข้าพักให้ถูกต้อง",
        dates.issues,
      );
    }

    const roomsParsed = parseStayResourceFlags(parsed.body.rooms, "rooms");
    const raftsParsed = parseStayResourceFlags(parsed.body.rafts, "rafts");
    if (!roomsParsed.ok || !raftsParsed.ok) {
      return validationErrorResponse("ข้อมูลห้อง/แพไม่ถูกต้อง", [
        ...(roomsParsed.ok ? [] : roomsParsed.issues),
        ...(raftsParsed.ok ? [] : raftsParsed.issues),
      ]);
    }

    const existing = await prisma.booking.findUnique({
      where: { id: bookingId },
      select: { tourGroupId: true },
    });
    if (!existing) {
      return apiErrorResponse("ไม่พบรายการจอง", 404, "NOT_FOUND");
    }

    const isGroup = Boolean(existing.tourGroupId);
    let guestCount: number | undefined;
    let pricePerPerson: number | undefined;

    if (isGroup) {
      const packageInput = parseGroupPackageInput(parsed.body);
      if (!packageInput.ok) {
        return validationErrorResponse(
          "กรุณาระบุจำนวนคนและราคาต่อหัวให้ถูกต้อง",
          packageInput.issues,
        );
      }
      guestCount = packageInput.guestCount;
      pricePerPerson = packageInput.pricePerPerson;
    }

    const updated = await prisma.$transaction(async (tx) => {
      await acquireBookingFinancialLock(tx, bookingId);
      const stay = await applyBookingStayUpdate(tx, bookingId, {
        checkIn: dates.checkIn,
        checkOut: dates.checkOut,
        guestCount,
        pricePerPerson,
        enforceFutureCheckIn: true,
        rooms:
          parsed.body.rooms !== undefined ? roomsParsed.items : undefined,
        rafts:
          parsed.body.rafts !== undefined ? raftsParsed.items : undefined,
      });

      const summarySource = await tx.booking.findUnique({
        where: { id: bookingId },
        select: {
          charges: {
            select: { id: true, type: true, description: true, amount: true },
          },
          payments: { select: { amount: true, status: true } },
          paymentRefunds: { select: { amount: true } },
          orders: {
            where: { status: { not: "CANCELLED" } },
            select: {
              items: {
                select: { unitPrice: true, quantity: true, isExtra: true },
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
        stay,
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
      action: "BOOKING_STAY_UPDATED",
      entityType: "BOOKING",
      entityId: bookingId,
      metadata: {
        checkIn: updated.stay.checkIn,
        checkOut: updated.stay.checkOut,
        previousCheckIn: updated.stay.previousCheckIn,
        previousCheckOut: updated.stay.previousCheckOut,
        previousNights: updated.stay.previousNights,
        nextNights: updated.stay.nextNights,
        deltaNights: updated.stay.deltaNights,
        guestCount: updated.stay.guestCount,
        pricePerPerson: updated.stay.pricePerPerson,
        previousGuestCount: updated.stay.previousGuestCount,
        previousPricePerPerson: updated.stay.previousPricePerPerson,
        nightChargeCount: updated.stay.nightChargeCount,
        replacedResources: updated.stay.replacedResources,
      },
    });

    return NextResponse.json({
      success: true,
      checkIn: updated.stay.checkIn,
      checkOut: updated.stay.checkOut,
      nights: updated.stay.nextNights,
      deltaNights: updated.stay.deltaNights,
      guestCount: updated.stay.guestCount,
      pricePerPerson: updated.stay.pricePerPerson,
      amount: updated.stay.packageAmount,
      charges: updated.charges,
      totals: updated.totals,
    });
  } catch (error) {
    if (error instanceof StayResourceConflictError) {
      return NextResponse.json(
        {
          message: "ห้อง/แพบางรายการไม่ว่างในช่วงวันใหม่ กรุณาเลือกใหม่",
          code: "RESOURCE_CONFLICT",
          conflicts: error.payload.conflicts,
          keepable: error.payload.keepable,
        },
        { status: 409 },
      );
    }
    if (error instanceof Error) {
      if (error.message === "NOT_FOUND") {
        return apiErrorResponse("ไม่พบรายการจอง", 404, "NOT_FOUND");
      }
      if (error.message === "PACKAGE_REQUIRED") {
        return apiErrorResponse(
          "การจองแบบกรุ๊ปต้องระบุจำนวนคนและราคาต่อหัว",
          400,
          "PACKAGE_REQUIRED",
        );
      }
      if (error.message === "RESOURCES_REQUIRED") {
        return apiErrorResponse(
          "ต้องเลือกห้องหรือแพอย่างน้อย 1 รายการ",
          400,
          "RESOURCES_REQUIRED",
        );
      }
      if (error.message === "BOOKING_CLOSED") {
        return apiErrorResponse(
          "รายการจองนี้ปิดแล้ว ไม่สามารถแก้ไขได้",
          400,
          "BOOKING_CLOSED",
        );
      }
      if (error.message === "CHECKIN_IN_PAST") {
        return apiErrorResponse(
          "วันเช็กอินต้องไม่เป็นวันในอดีต",
          400,
          "CHECKIN_IN_PAST",
        );
      }
      if (error.message === "ROOM_NOT_AVAILABLE" || error.message === "RAFT_NOT_AVAILABLE") {
        return apiErrorResponse(
          "ห้องหรือแพที่เลือกยังไม่ว่าง",
          409,
          "RESOURCE_UNAVAILABLE",
        );
      }
      if (error.message === "NOT_FOUND_RESOURCE") {
        return apiErrorResponse("ไม่พบห้องหรือแพที่เลือก", 404, "NOT_FOUND");
      }
      if (error.message.startsWith("ROOM_CONFLICT:")) {
        const roomNumber = error.message.slice("ROOM_CONFLICT:".length);
        return apiErrorResponse(
          `ห้อง ${roomNumber} ถูกจองในช่วงวันใหม่แล้ว`,
          409,
          "ROOM_CONFLICT",
        );
      }
      if (error.message.startsWith("RAFT_CONFLICT:")) {
        const raftName = error.message.slice("RAFT_CONFLICT:".length);
        return apiErrorResponse(
          `แพ ${raftName} ถูกจองในช่วงวันใหม่แล้ว`,
          409,
          "RAFT_CONFLICT",
        );
      }
    }
    console.error("PATCH /api/bookings/[bookingId]/package failed", error);
    return NextResponse.json(
      { message: "ไม่สามารถแก้ไขวันเข้าพัก/ราคาเหมาได้" },
      { status: 500 },
    );
  }
}
