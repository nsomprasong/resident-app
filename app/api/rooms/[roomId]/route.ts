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
  isRoomUuid,
  parseRoomInput,
  serializeRoomMaster,
  validateRoomRelationIds,
} from "@/lib/settings/rooms";
import { NextRequest, NextResponse } from "next/server";

const roomInclude = {
  zone: { select: { id: true, name: true, isActive: true } },
  roomType: { select: { id: true, name: true, isActive: true } },
} as const;

type RouteContext = {
  params: Promise<{ roomId: string }>;
};

export async function PATCH(request: NextRequest, context: RouteContext) {
  try {
    const { roomId } = await context.params;
    if (!isRoomUuid(roomId)) {
      return apiErrorResponse("ไม่พบห้อง", 404, "NOT_FOUND");
    }

    const currentUser = await getCurrentUser();
    const parsed = await readJsonObject(request);
    if (!parsed.ok) return parsed.response;

    const validated = parseRoomInput(parsed.body, "update");
    if (!validated.ok) {
      return validationErrorResponse("กรุณาตรวจสอบข้อมูลห้อง", validated.issues);
    }

    const existing = await prisma.room.findUnique({ where: { id: roomId } });
    if (!existing) {
      return apiErrorResponse("ไม่พบห้อง", 404, "NOT_FOUND");
    }

    const nextZoneId = validated.data.zoneId ?? existing.zoneId;
    const nextRoomTypeId = validated.data.roomTypeId ?? existing.roomTypeId;

    if (validated.data.zoneId !== undefined || validated.data.roomTypeId !== undefined) {
      const relationIssues = await validateRoomRelationIds(
        nextZoneId,
        nextRoomTypeId,
        prisma,
      );
      if (relationIssues.length) {
        return validationErrorResponse("ความสัมพันธ์ข้อมูลไม่ถูกต้อง", relationIssues);
      }
    }

    const room = await prisma.room.update({
      where: { id: roomId },
      data: validated.data,
      include: roomInclude,
    });

    await recordAuditLog({
      actor: {
        employeeId: currentUser?.employee?.id,
        authUserId: currentUser?.user.id,
      },
      action: "ROOM_UPDATED",
      entityType: "ROOM",
      entityId: room.id,
      metadata: {
        number: room.number,
        status: room.status,
        zoneId: room.zoneId,
        roomTypeId: room.roomTypeId,
      },
    });

    return NextResponse.json(serializeRoomMaster(room));
  } catch (error) {
    if (
      error instanceof Prisma.PrismaClientKnownRequestError &&
      error.code === "P2002"
    ) {
      return validationErrorResponse("เลขห้องนี้มีอยู่แล้ว", [
        { path: "number", message: "เลขห้องซ้ำ" },
      ]);
    }
    console.error("PATCH /api/rooms/[roomId] failed", error);
    return apiErrorResponse("อัปเดตห้องไม่สำเร็จ", 500, "INTERNAL_ERROR");
  }
}
