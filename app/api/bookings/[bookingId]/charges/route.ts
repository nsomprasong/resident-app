import { NextRequest, NextResponse } from "next/server";

import {
  apiErrorResponse,
  readJsonObject,
  validationErrorResponse,
} from "@/lib/api/validation";
import { recordAuditLog } from "@/lib/audit/audit-log";
import { getCurrentUser } from "@/lib/auth/current-user";
import { parseBookingExtraCharges } from "@/lib/bookings/extra-charges";
import { prisma } from "@/lib/prisma";

type RouteContext = {
  params: Promise<{ bookingId: string }>;
};

export async function POST(request: NextRequest, context: RouteContext) {
  try {
    const { bookingId } = await context.params;
    const currentUser = await getCurrentUser();
    const parsed = await readJsonObject(request);
    if (!parsed.ok) return parsed.response;

    const chargesRaw =
      parsed.body.charges !== undefined
        ? parsed.body.charges
        : parsed.body.extraCharges;
    const validated = parseBookingExtraCharges(chargesRaw, "charges");
    if (!validated.ok) {
      return validationErrorResponse(
        "ข้อมูลค่าใช้จ่ายไม่ถูกต้อง",
        validated.issues,
      );
    }
    if (!validated.charges.length) {
      return validationErrorResponse("กรุณาเพิ่มค่าใช้จ่ายอย่างน้อย 1 รายการ", [
        { path: "charges", message: "At least one charge is required" },
      ]);
    }

    const booking = await prisma.booking.findUnique({
      where: { id: bookingId },
      select: { id: true, status: true, closedAt: true },
    });
    if (!booking) {
      return apiErrorResponse("ไม่พบรายการจอง", 404, "NOT_FOUND");
    }
    if (booking.status === "CANCELLED" || booking.closedAt) {
      return apiErrorResponse("รายการจองนี้ปิดแล้ว", 400, "BOOKING_CLOSED");
    }

    const created = await prisma.charge.createMany({
      data: validated.charges.map((charge) => ({
        bookingId,
        type: charge.type,
        description: charge.description,
        amount: charge.amount,
      })),
    });

    await recordAuditLog({
      actor: {
        employeeId: currentUser?.employee?.id,
        authUserId: currentUser?.user.id,
      },
      action: "BOOKING_CHARGES_ADDED",
      entityType: "BOOKING",
      entityId: bookingId,
      metadata: {
        chargeCount: created.count,
        total: validated.charges.reduce((sum, item) => sum + item.amount, 0),
      },
    });

    return NextResponse.json(
      {
        success: true,
        created: created.count,
      },
      { status: 201 },
    );
  } catch (error) {
    console.error("POST /api/bookings/[bookingId]/charges failed", error);
    return NextResponse.json(
      { message: "ไม่สามารถเพิ่มค่าใช้จ่ายได้" },
      { status: 500 },
    );
  }
}
