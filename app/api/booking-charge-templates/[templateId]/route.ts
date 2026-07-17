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

type RouteContext = {
  params: Promise<{ templateId: string }>;
};

export async function PATCH(request: NextRequest, context: RouteContext) {
  try {
    const { templateId } = await context.params;
    const currentUser = await getCurrentUser();
    const parsed = await readJsonObject(request);
    if (!parsed.ok) return parsed.response;

    const existing = await prisma.bookingChargeTemplate.findUnique({
      where: { id: templateId },
    });
    if (!existing) {
      return apiErrorResponse("ไม่พบรายการค่าใช้จ่าย", 404, "NOT_FOUND");
    }

    const validated = parseBookingChargeTemplateInput({
      name:
        parsed.body.name === undefined ? existing.name : parsed.body.name,
      type:
        parsed.body.type === undefined ? existing.type : parsed.body.type,
      defaultAmount:
        parsed.body.defaultAmount === undefined &&
        parsed.body.amount === undefined
          ? Number(existing.defaultAmount)
          : (parsed.body.defaultAmount ?? parsed.body.amount),
      isActive:
        parsed.body.isActive === undefined
          ? existing.isActive
          : parsed.body.isActive,
    });
    if (!validated.ok) {
      return validationErrorResponse(
        "ข้อมูลรายการค่าใช้จ่ายไม่ถูกต้อง",
        validated.issues,
      );
    }

    if (validated.data.name !== existing.name) {
      const clash = await prisma.bookingChargeTemplate.findUnique({
        where: { name: validated.data.name },
        select: { id: true },
      });
      if (clash && clash.id !== existing.id) {
        return validationErrorResponse("มีรายการชื่อนี้อยู่แล้ว", [
          { path: "name", message: "Name already exists" },
        ]);
      }
    }

    const row = await prisma.bookingChargeTemplate.update({
      where: { id: templateId },
      data: {
        name: validated.data.name,
        type: validated.data.type,
        defaultAmount: validated.data.defaultAmount,
        isActive: validated.data.isActive,
      },
    });

    await recordAuditLog({
      actor: {
        employeeId: currentUser?.employee?.id,
        authUserId: currentUser?.user.id,
      },
      action: "BOOKING_CHARGE_TEMPLATE_UPDATED",
      entityType: "BOOKING_CHARGE_TEMPLATE",
      entityId: row.id,
      metadata: {
        name: row.name,
        defaultAmount: Number(row.defaultAmount),
      },
    });

    return NextResponse.json(serializeBookingChargeTemplate(row));
  } catch (error) {
    console.error("PATCH /api/booking-charge-templates/[id] failed", error);
    return apiErrorResponse(
      "ไม่สามารถแก้ไขรายการค่าใช้จ่ายได้",
      500,
      "INTERNAL_ERROR",
    );
  }
}

export async function DELETE(_request: NextRequest, context: RouteContext) {
  try {
    const { templateId } = await context.params;
    const currentUser = await getCurrentUser();
    const existing = await prisma.bookingChargeTemplate.findUnique({
      where: { id: templateId },
      select: { id: true, name: true },
    });
    if (!existing) {
      return apiErrorResponse("ไม่พบรายการค่าใช้จ่าย", 404, "NOT_FOUND");
    }

    await prisma.bookingChargeTemplate.update({
      where: { id: templateId },
      data: { isActive: false },
    });

    await recordAuditLog({
      actor: {
        employeeId: currentUser?.employee?.id,
        authUserId: currentUser?.user.id,
      },
      action: "BOOKING_CHARGE_TEMPLATE_DEACTIVATED",
      entityType: "BOOKING_CHARGE_TEMPLATE",
      entityId: existing.id,
      metadata: { name: existing.name },
    });

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("DELETE /api/booking-charge-templates/[id] failed", error);
    return apiErrorResponse(
      "ไม่สามารถลบรายการค่าใช้จ่ายได้",
      500,
      "INTERNAL_ERROR",
    );
  }
}
