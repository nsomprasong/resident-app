import { NextRequest, NextResponse } from "next/server";

import {
  apiErrorResponse,
  readJsonObject,
  validationErrorResponse,
} from "@/lib/api/validation";
import { recordAuditLog } from "@/lib/audit/audit-log";
import { getCurrentUser } from "@/lib/auth/current-user";
import {
  parseBookingChargeTemplateInput,
  serializeBookingChargeTemplate,
} from "@/lib/bookings/charge-templates";
import { prisma } from "@/lib/prisma";

export async function GET(request: NextRequest) {
  try {
    const activeOnly = request.nextUrl.searchParams.get("active") !== "false";
    const rows = await prisma.bookingChargeTemplate.findMany({
      where: activeOnly ? { isActive: true } : undefined,
      orderBy: [{ sortOrder: "asc" }, { name: "asc" }],
    });
    return NextResponse.json(rows.map(serializeBookingChargeTemplate));
  } catch (error) {
    console.error("GET /api/booking-charge-templates failed", error);
    return apiErrorResponse(
      "ไม่สามารถโหลดรายการค่าใช้จ่ายที่บันทึกไว้ได้",
      500,
      "INTERNAL_ERROR",
    );
  }
}

/** Upsert template by name — saves price for reuse on next booking. */
export async function POST(request: NextRequest) {
  try {
    const currentUser = await getCurrentUser();
    const parsed = await readJsonObject(request);
    if (!parsed.ok) return parsed.response;

    const validated = parseBookingChargeTemplateInput(parsed.body);
    if (!validated.ok) {
      return validationErrorResponse(
        "ข้อมูลรายการค่าใช้จ่ายไม่ถูกต้อง",
        validated.issues,
      );
    }

    const existing = await prisma.bookingChargeTemplate.findUnique({
      where: { name: validated.data.name },
      select: { id: true, sortOrder: true },
    });

    const row = existing
      ? await prisma.bookingChargeTemplate.update({
          where: { id: existing.id },
          data: {
            type: validated.data.type,
            defaultAmount: validated.data.defaultAmount,
            isActive: validated.data.isActive,
          },
        })
      : await prisma.bookingChargeTemplate.create({
          data: {
            name: validated.data.name,
            type: validated.data.type,
            defaultAmount: validated.data.defaultAmount,
            isActive: validated.data.isActive,
            sortOrder: 100,
          },
        });

    await recordAuditLog({
      actor: {
        employeeId: currentUser?.employee?.id,
        authUserId: currentUser?.user.id,
      },
      action: existing
        ? "BOOKING_CHARGE_TEMPLATE_UPDATED"
        : "BOOKING_CHARGE_TEMPLATE_CREATED",
      entityType: "BOOKING_CHARGE_TEMPLATE",
      entityId: row.id,
      metadata: {
        name: row.name,
        defaultAmount: Number(row.defaultAmount),
      },
    });

    return NextResponse.json(serializeBookingChargeTemplate(row), {
      status: existing ? 200 : 201,
    });
  } catch (error) {
    console.error("POST /api/booking-charge-templates failed", error);
    return apiErrorResponse(
      "ไม่สามารถบันทึกราคาค่าใช้จ่ายได้",
      500,
      "INTERNAL_ERROR",
    );
  }
}
