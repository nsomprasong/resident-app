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
  isUuid,
  parseRoomTypeInput,
  serializeRoomType,
} from "@/lib/settings/room-types";
import { NextRequest, NextResponse } from "next/server";

type RouteContext = {
  params: Promise<{ roomTypeId: string }>;
};

export async function PATCH(request: NextRequest, context: RouteContext) {
  try {
    const { roomTypeId } = await context.params;
    if (!isUuid(roomTypeId)) {
      return apiErrorResponse("ไม่พบประเภทห้อง", 404, "NOT_FOUND");
    }

    const currentUser = await getCurrentUser();
    const parsed = await readJsonObject(request);
    if (!parsed.ok) return parsed.response;

    const validated = parseRoomTypeInput(parsed.body, "update");
    if (!validated.ok) {
      return validationErrorResponse("กรุณาตรวจสอบข้อมูลประเภทห้อง", validated.issues);
    }

    const existing = await prisma.roomType.findUnique({
      where: { id: roomTypeId },
    });
    if (!existing) {
      return apiErrorResponse("ไม่พบประเภทห้อง", 404, "NOT_FOUND");
    }

    const roomType = await prisma.roomType.update({
      where: { id: roomTypeId },
      data: validated.data,
    });

    await recordAuditLog({
      actor: {
        employeeId: currentUser?.employee?.id,
        authUserId: currentUser?.user.id,
      },
      action: "ROOM_TYPE_UPDATED",
      entityType: "ROOM_TYPE",
      entityId: roomType.id,
      metadata: {
        name: roomType.name,
        isActive: roomType.isActive,
      },
    });

    return NextResponse.json(serializeRoomType(roomType));
  } catch (error) {
    if (
      error instanceof Prisma.PrismaClientKnownRequestError &&
      error.code === "P2002"
    ) {
      return validationErrorResponse("ชื่อประเภทห้องนี้มีอยู่แล้ว", [
        { path: "name", message: "ชื่อซ้ำ" },
      ]);
    }
    console.error("PATCH /api/room-types/[roomTypeId] failed", error);
    return apiErrorResponse("อัปเดตประเภทห้องไม่สำเร็จ", 500, "INTERNAL_ERROR");
  }
}

export async function DELETE(_request: NextRequest, context: RouteContext) {
  try {
    const { roomTypeId } = await context.params;
    if (!isUuid(roomTypeId)) {
      return apiErrorResponse("ไม่พบประเภทห้อง", 404, "NOT_FOUND");
    }

    const currentUser = await getCurrentUser();
    const existing = await prisma.roomType.findUnique({
      where: { id: roomTypeId },
      include: { _count: { select: { rooms: true } } },
    });
    if (!existing) {
      return apiErrorResponse("ไม่พบประเภทห้อง", 404, "NOT_FOUND");
    }

    if (existing._count.rooms > 0) {
      return apiErrorResponse(
        `ลบไม่ได้ เพราะยังมีห้อง ${existing._count.rooms} ห้องใช้ประเภทนี้ — ย้ายหรือลบห้องก่อน`,
        409,
        "ROOM_TYPE_IN_USE",
      );
    }

    await prisma.roomType.delete({ where: { id: roomTypeId } });

    await recordAuditLog({
      actor: {
        employeeId: currentUser?.employee?.id,
        authUserId: currentUser?.user.id,
      },
      action: "ROOM_TYPE_DELETED",
      entityType: "ROOM_TYPE",
      entityId: roomTypeId,
      metadata: {
        name: existing.name,
        bedType: existing.bedType,
        capacity: existing.capacity,
      },
    });

    return NextResponse.json({ ok: true, id: roomTypeId });
  } catch (error) {
    if (
      error instanceof Prisma.PrismaClientKnownRequestError &&
      error.code === "P2003"
    ) {
      return apiErrorResponse(
        "ลบไม่ได้ เพราะยังมีข้อมูลที่อ้างอิงประเภทห้องนี้",
        409,
        "DEPENDENCY_BLOCKED",
      );
    }
    console.error("DELETE /api/room-types/[roomTypeId] failed", error);
    return apiErrorResponse("ลบประเภทห้องไม่สำเร็จ", 500, "INTERNAL_ERROR");
  }
}
