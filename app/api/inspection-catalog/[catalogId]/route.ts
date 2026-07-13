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
  isInspectionCatalogUuid,
  parseInspectionCatalogInput,
  serializeInspectionCatalogMaster,
} from "@/lib/settings/inspection-catalog";
import { NextRequest, NextResponse } from "next/server";

type RouteContext = {
  params: Promise<{ catalogId: string }>;
};

export async function PATCH(request: NextRequest, context: RouteContext) {
  try {
    const { catalogId } = await context.params;
    if (!isInspectionCatalogUuid(catalogId)) {
      return apiErrorResponse("ไม่พบรายการตรวจ", 404, "NOT_FOUND");
    }

    const currentUser = await getCurrentUser();
    const parsed = await readJsonObject(request);
    if (!parsed.ok) return parsed.response;

    const validated = parseInspectionCatalogInput(parsed.body, "update");
    if (!validated.ok) {
      return validationErrorResponse(
        "กรุณาตรวจสอบข้อมูลราคากลาง",
        validated.issues,
      );
    }

    const existing = await prisma.inspectionCatalog.findUnique({
      where: { id: catalogId },
    });
    if (!existing) {
      return apiErrorResponse("ไม่พบรายการตรวจ", 404, "NOT_FOUND");
    }

    const item = await prisma.inspectionCatalog.update({
      where: { id: catalogId },
      data: validated.data,
    });

    await recordAuditLog({
      actor: {
        employeeId: currentUser?.employee?.id,
        authUserId: currentUser?.user.id,
      },
      action: "INSPECTION_CATALOG_UPDATED",
      entityType: "INSPECTION_CATALOG",
      entityId: item.id,
      metadata: {
        name: item.name,
        type: item.type,
        isActive: item.isActive,
      },
    });

    return NextResponse.json(serializeInspectionCatalogMaster(item));
  } catch (error) {
    if (
      error instanceof Prisma.PrismaClientKnownRequestError &&
      error.code === "P2002"
    ) {
      return validationErrorResponse("ชื่อรายการตรวจนี้มีอยู่แล้ว", [
        { path: "name", message: "ชื่อซ้ำ" },
      ]);
    }
    console.error("PATCH /api/inspection-catalog/[catalogId] failed", error);
    return apiErrorResponse("อัปเดตรายการตรวจไม่สำเร็จ", 500, "INTERNAL_ERROR");
  }
}
