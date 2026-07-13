import { Prisma } from "@/generated/prisma/client";
import {
  apiErrorResponse,
  readJsonObject,
  validationErrorResponse,
} from "@/lib/api/validation";
import { recordAuditLog } from "@/lib/audit/audit-log";
import { getCurrentUser } from "@/lib/auth/current-user";
import { prisma } from "@/lib/prisma";
import { parseZoneInput, serializeZone } from "@/lib/settings/zones";
import { NextRequest, NextResponse } from "next/server";

const zoneListInclude = {
  _count: { select: { rooms: true } },
} as const;

export async function GET() {
  try {
    const zones = await prisma.zone.findMany({
      include: zoneListInclude,
      orderBy: [{ isActive: "desc" }, { name: "asc" }],
    });
    return NextResponse.json(zones.map(serializeZone));
  } catch (error) {
    console.error("GET /api/zones failed", error);
    return apiErrorResponse("ไม่สามารถโหลดโซนได้", 500, "INTERNAL_ERROR");
  }
}

export async function POST(request: NextRequest) {
  try {
    const currentUser = await getCurrentUser();
    const parsed = await readJsonObject(request);
    if (!parsed.ok) return parsed.response;

    const validated = parseZoneInput(parsed.body, "create");
    if (!validated.ok) {
      return validationErrorResponse("กรุณาตรวจสอบข้อมูลโซน", validated.issues);
    }

    const { name } = validated.data;
    if (name === undefined) {
      return validationErrorResponse("กรุณาตรวจสอบข้อมูลโซน", [
        { path: "name", message: "กรุณาระบุชื่อ" },
      ]);
    }

    const zone = await prisma.zone.create({
      data: { name, isActive: true },
      include: zoneListInclude,
    });

    await recordAuditLog({
      actor: {
        employeeId: currentUser?.employee?.id,
        authUserId: currentUser?.user.id,
      },
      action: "ZONE_CREATED",
      entityType: "ZONE",
      entityId: zone.id,
      metadata: { name: zone.name, isActive: zone.isActive },
    });

    return NextResponse.json(serializeZone(zone), { status: 201 });
  } catch (error) {
    if (
      error instanceof Prisma.PrismaClientKnownRequestError &&
      error.code === "P2002"
    ) {
      return validationErrorResponse("ชื่อโซนนี้มีอยู่แล้ว", [
        { path: "name", message: "ชื่อซ้ำ" },
      ]);
    }
    console.error("POST /api/zones failed", error);
    return apiErrorResponse("เพิ่มโซนไม่สำเร็จ", 500, "INTERNAL_ERROR");
  }
}
