import {
  apiErrorResponse,
  readJsonObject,
  validationErrorResponse,
} from "@/lib/api/validation";
import { recordAuditLog } from "@/lib/audit/audit-log";
import { getCurrentUser } from "@/lib/auth/current-user";
import { prisma } from "@/lib/prisma";
import {
  parseRoomTypeInput,
  serializeRoomType,
} from "@/lib/settings/room-types";
import { Prisma } from "@/generated/prisma/client";
import { NextRequest, NextResponse } from "next/server";

export async function GET() {
  try {
    const roomTypes = await prisma.roomType.findMany({
      orderBy: [{ isActive: "desc" }, { name: "asc" }],
    });
    return NextResponse.json(roomTypes.map(serializeRoomType));
  } catch (error) {
    console.error("GET /api/room-types failed", error);
    return apiErrorResponse("ไม่สามารถโหลดประเภทห้องได้", 500, "INTERNAL_ERROR");
  }
}

export async function POST(request: NextRequest) {
  try {
    const currentUser = await getCurrentUser();
    const parsed = await readJsonObject(request);
    if (!parsed.ok) return parsed.response;

    const validated = parseRoomTypeInput(parsed.body, "create");
    if (!validated.ok) {
      return validationErrorResponse("กรุณาตรวจสอบข้อมูลประเภทห้อง", validated.issues);
    }

    const { name, description, basePrice, capacity, bedType } = validated.data;
    if (
      name === undefined ||
      basePrice === undefined ||
      capacity === undefined
    ) {
      return validationErrorResponse("กรุณาตรวจสอบข้อมูลประเภทห้อง", [
        { path: "body", message: "ข้อมูลไม่ครบ" },
      ]);
    }

    const roomType = await prisma.roomType.create({
      data: {
        name,
        description: description ?? null,
        basePrice,
        capacity,
        bedType: bedType ?? null,
        isActive: true,
      },
    });

    await recordAuditLog({
      actor: {
        employeeId: currentUser?.employee?.id,
        authUserId: currentUser?.user.id,
      },
      action: "ROOM_TYPE_CREATED",
      entityType: "ROOM_TYPE",
      entityId: roomType.id,
      metadata: { name: roomType.name, isActive: roomType.isActive },
    });

    return NextResponse.json(serializeRoomType(roomType), { status: 201 });
  } catch (error) {
    if (
      error instanceof Prisma.PrismaClientKnownRequestError &&
      error.code === "P2002"
    ) {
      return validationErrorResponse("ชื่อประเภทห้องนี้มีอยู่แล้ว", [
        { path: "name", message: "ชื่อซ้ำ" },
      ]);
    }
    console.error("POST /api/room-types failed", error);
    return apiErrorResponse("เพิ่มประเภทห้องไม่สำเร็จ", 500, "INTERNAL_ERROR");
  }
}
