import { Prisma } from "@/generated/prisma/client";
import {
  apiErrorResponse,
  readJsonObject,
  validationErrorResponse,
} from "@/lib/api/validation";
import { recordAuditLog } from "@/lib/audit/audit-log";
import { getCurrentUser } from "@/lib/auth/current-user";
import { prisma } from "@/lib/prisma";
import {
  isZoneUuid,
  parseZoneInput,
  serializeZone,
} from "@/lib/settings/zones";
import { NextRequest, NextResponse } from "next/server";

type RouteContext = {
  params: Promise<{ zoneId: string }>;
};

const zoneListInclude = {
  _count: { select: { rooms: true } },
} as const;

export async function PATCH(request: NextRequest, context: RouteContext) {
  try {
    const { zoneId } = await context.params;
    if (!isZoneUuid(zoneId)) {
      return apiErrorResponse("ไม่พบโซน", 404, "NOT_FOUND");
    }

    const currentUser = await getCurrentUser();
    const parsed = await readJsonObject(request);
    if (!parsed.ok) return parsed.response;

    const validated = parseZoneInput(parsed.body, "update");
    if (!validated.ok) {
      return validationErrorResponse("กรุณาตรวจสอบข้อมูลโซน", validated.issues);
    }

    const existing = await prisma.zone.findUnique({
      where: { id: zoneId },
      include: zoneListInclude,
    });
    if (!existing) {
      return apiErrorResponse("ไม่พบโซน", 404, "NOT_FOUND");
    }

    if (
      validated.data.isActive === false &&
      existing._count.rooms > 0
    ) {
      await recordAuditLog({
        actor: {
          employeeId: currentUser?.employee?.id,
          authUserId: currentUser?.user.id,
        },
        action: "ZONE_DEACTIVATE_WITH_ROOMS",
        entityType: "ZONE",
        entityId: existing.id,
        metadata: {
          name: existing.name,
          roomCount: existing._count.rooms,
        },
      });
    }

    const zone = await prisma.zone.update({
      where: { id: zoneId },
      data: validated.data,
      include: zoneListInclude,
    });

    await recordAuditLog({
      actor: {
        employeeId: currentUser?.employee?.id,
        authUserId: currentUser?.user.id,
      },
      action: "ZONE_UPDATED",
      entityType: "ZONE",
      entityId: zone.id,
      metadata: {
        name: zone.name,
        isActive: zone.isActive,
        roomCount: zone._count.rooms,
      },
    });

    return NextResponse.json(serializeZone(zone));
  } catch (error) {
    if (
      error instanceof Prisma.PrismaClientKnownRequestError &&
      error.code === "P2002"
    ) {
      return validationErrorResponse("ชื่อโซนนี้มีอยู่แล้ว", [
        { path: "name", message: "ชื่อซ้ำ" },
      ]);
    }
    console.error("PATCH /api/zones/[zoneId] failed", error);
    return apiErrorResponse("อัปเดตโซนไม่สำเร็จ", 500, "INTERNAL_ERROR");
  }
}
