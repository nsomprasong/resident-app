import {
  apiErrorResponse,
  readJsonObject,
  validationErrorResponse,
} from "@/lib/api/validation";
import { recordAuditLog } from "@/lib/audit/audit-log";
import { getCurrentUser } from "@/lib/auth/current-user";
import { prisma } from "@/lib/prisma";
import {
  foodSetItemInclude,
  isUuid,
  parseTourGroupFoodSetInput,
  serializeTourGroupFoodSet,
} from "@/lib/settings/food-sets";
import { NextRequest, NextResponse } from "next/server";

type RouteContext = {
  params: Promise<{ tourGroupId: string }>;
};

const tourGroupFoodSetInclude = {
  items: {
    include: foodSetItemInclude,
    orderBy: [{ createdAt: "asc" as const }],
  },
};

export async function GET(_request: NextRequest, context: RouteContext) {
  try {
    const { tourGroupId } = await context.params;
    if (!isUuid(tourGroupId)) {
      return apiErrorResponse("ไม่พบกรุ๊ปทัวร์", 404, "NOT_FOUND");
    }

    const tourGroup = await prisma.tourGroup.findUnique({
      where: { id: tourGroupId },
      select: { id: true },
    });
    if (!tourGroup) {
      return apiErrorResponse("ไม่พบกรุ๊ปทัวร์", 404, "NOT_FOUND");
    }

    const foodSet = await prisma.tourGroupFoodSet.findUnique({
      where: { tourGroupId },
      include: tourGroupFoodSetInclude,
    });

    return NextResponse.json(foodSet ? serializeTourGroupFoodSet(foodSet) : null);
  } catch (error) {
    console.error("GET /api/tour-groups/[tourGroupId]/food-set failed", error);
    return apiErrorResponse(
      "ไม่สามารถโหลดชุดอาหารของกรุ๊ปได้",
      500,
      "INTERNAL_ERROR",
    );
  }
}

export async function PUT(request: NextRequest, context: RouteContext) {
  try {
    const { tourGroupId } = await context.params;
    if (!isUuid(tourGroupId)) {
      return apiErrorResponse("ไม่พบกรุ๊ปทัวร์", 404, "NOT_FOUND");
    }

    const currentUser = await getCurrentUser();
    const parsed = await readJsonObject(request);
    if (!parsed.ok) return parsed.response;

    const validated = parseTourGroupFoodSetInput(parsed.body);
    if (!validated.ok) {
      return validationErrorResponse(
        "กรุณาตรวจสอบข้อมูลชุดอาหารของกรุ๊ป",
        validated.issues,
      );
    }

    const tourGroup = await prisma.tourGroup.findUnique({
      where: { id: tourGroupId },
      select: { id: true, name: true },
    });
    if (!tourGroup) {
      return apiErrorResponse("ไม่พบกรุ๊ปทัวร์", 404, "NOT_FOUND");
    }

    const { name, sourceFoodSetId, items } = validated.data;

    if (sourceFoodSetId) {
      const source = await prisma.foodSet.findUnique({
        where: { id: sourceFoodSetId },
        select: { id: true },
      });
      if (!source) {
        return validationErrorResponse("ไม่พบชุดอาหารต้นทาง", [
          { path: "sourceFoodSetId", message: "ชุดอาหารไม่พบ" },
        ]);
      }
    }

    const catalogIds = [
      ...new Set(
        items
          .map((item) => item.productId)
          .filter((id): id is string => Boolean(id)),
      ),
    ];
    if (catalogIds.length) {
      const products = await prisma.product.findMany({
        where: { id: { in: catalogIds }, isActive: true },
        select: { id: true },
      });
      if (products.length !== catalogIds.length) {
        return validationErrorResponse("พบสินค้าที่ไม่พร้อมใช้", [
          { path: "items", message: "สินค้าบางรายการไม่พบหรือปิดขาย" },
        ]);
      }
    }

    const itemCreates = items.map((item) =>
      item.productId
        ? {
            productId: item.productId,
            customName: null,
            customUnitPrice: null,
            quantity: item.quantity,
            isExtra: item.isExtra,
            optionNote: item.optionNote,
          }
        : {
            productId: null,
            customName: item.customName,
            customUnitPrice: item.customUnitPrice,
            quantity: item.quantity,
            isExtra: item.isExtra,
            optionNote: item.optionNote,
          },
    );

    const foodSet = await prisma.$transaction(async (tx) => {
      const existing = await tx.tourGroupFoodSet.findUnique({
        where: { tourGroupId },
        select: { id: true },
      });

      if (existing) {
        await tx.tourGroupFoodSetItem.deleteMany({
          where: { tourGroupFoodSetId: existing.id },
        });
        return tx.tourGroupFoodSet.update({
          where: { id: existing.id },
          data: {
            name,
            sourceFoodSetId,
            items: { create: itemCreates },
          },
          include: tourGroupFoodSetInclude,
        });
      }

      return tx.tourGroupFoodSet.create({
        data: {
          tourGroupId,
          name,
          sourceFoodSetId,
          items: { create: itemCreates },
        },
        include: tourGroupFoodSetInclude,
      });
    });

    await recordAuditLog({
      actor: {
        employeeId: currentUser?.employee?.id,
        authUserId: currentUser?.user.id,
      },
      action: "TOUR_GROUP_FOOD_SET_SAVED",
      entityType: "TOUR_GROUP_FOOD_SET",
      entityId: foodSet.id,
      metadata: {
        tourGroupId,
        tourGroupName: tourGroup.name,
        name: foodSet.name,
        itemCount: items.length,
      },
    });

    return NextResponse.json(serializeTourGroupFoodSet(foodSet));
  } catch (error) {
    console.error("PUT /api/tour-groups/[tourGroupId]/food-set failed", error);
    return apiErrorResponse(
      "บันทึกชุดอาหารของกรุ๊ปไม่สำเร็จ",
      500,
      "INTERNAL_ERROR",
    );
  }
}

export async function DELETE(_request: NextRequest, context: RouteContext) {
  try {
    const { tourGroupId } = await context.params;
    if (!isUuid(tourGroupId)) {
      return apiErrorResponse("ไม่พบกรุ๊ปทัวร์", 404, "NOT_FOUND");
    }

    const currentUser = await getCurrentUser();
    const existing = await prisma.tourGroupFoodSet.findUnique({
      where: { tourGroupId },
      select: { id: true, name: true },
    });
    if (!existing) {
      return NextResponse.json({ ok: true });
    }

    await prisma.tourGroupFoodSet.delete({ where: { id: existing.id } });

    await recordAuditLog({
      actor: {
        employeeId: currentUser?.employee?.id,
        authUserId: currentUser?.user.id,
      },
      action: "TOUR_GROUP_FOOD_SET_CLEARED",
      entityType: "TOUR_GROUP_FOOD_SET",
      entityId: existing.id,
      metadata: { tourGroupId, name: existing.name },
    });

    return NextResponse.json({ ok: true });
  } catch (error) {
    console.error(
      "DELETE /api/tour-groups/[tourGroupId]/food-set failed",
      error,
    );
    return apiErrorResponse(
      "ล้างชุดอาหารของกรุ๊ปไม่สำเร็จ",
      500,
      "INTERNAL_ERROR",
    );
  }
}
