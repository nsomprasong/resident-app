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
  parseInspectionCatalogInput,
  serializeInspectionCatalogMaster,
} from "@/lib/settings/inspection-catalog";
import { NextRequest, NextResponse } from "next/server";

export async function GET() {
  const items = await prisma.inspectionCatalog.findMany({
    where: { isActive: true },
    orderBy: [{ type: "asc" }, { name: "asc" }],
  });
  return NextResponse.json(
    items.map((item) => ({
      id: item.id,
      name: item.name,
      type: item.type,
      unitPrice: Number(item.unitPrice),
    })),
  );
}

export async function POST(request: NextRequest) {
  try {
    const currentUser = await getCurrentUser();
    const parsed = await readJsonObject(request);
    if (!parsed.ok) return parsed.response;

    const validated = parseInspectionCatalogInput(parsed.body, "create");
    if (!validated.ok) {
      return validationErrorResponse(
        "กรุณาตรวจสอบข้อมูลราคากลาง",
        validated.issues,
      );
    }

    const { name, type, unitPrice } = validated.data;
    if (name === undefined || type === undefined || unitPrice === undefined) {
      return validationErrorResponse("กรุณาตรวจสอบข้อมูลราคากลาง", [
        { path: "body", message: "ข้อมูลไม่ครบ" },
      ]);
    }

    const item = await prisma.inspectionCatalog.create({
      data: {
        name,
        type,
        unitPrice,
        isActive: true,
      },
    });

    await recordAuditLog({
      actor: {
        employeeId: currentUser?.employee?.id,
        authUserId: currentUser?.user.id,
      },
      action: "INSPECTION_CATALOG_CREATED",
      entityType: "INSPECTION_CATALOG",
      entityId: item.id,
      metadata: { name: item.name, type: item.type },
    });

    return NextResponse.json(serializeInspectionCatalogMaster(item), {
      status: 201,
    });
  } catch (error) {
    if (
      error instanceof Prisma.PrismaClientKnownRequestError &&
      error.code === "P2002"
    ) {
      return validationErrorResponse("ชื่อรายการตรวจนี้มีอยู่แล้ว", [
        { path: "name", message: "ชื่อซ้ำ" },
      ]);
    }
    console.error("POST /api/inspection-catalog failed", error);
    return apiErrorResponse("เพิ่มรายการตรวจไม่สำเร็จ", 500, "INTERNAL_ERROR");
  }
}
