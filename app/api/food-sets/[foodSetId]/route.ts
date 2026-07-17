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
  foodSetInclude,
  isUuid,
  parseFoodSetInput,
  serializeFoodSet,
} from "@/lib/settings/food-sets";
import { NextRequest, NextResponse } from "next/server";

type RouteContext = {
  params: Promise<{ foodSetId: string }>;
};

export async function GET(_request: NextRequest, context: RouteContext) {
  try {
    const { foodSetId } = await context.params;
    if (!isUuid(foodSetId)) {
      return apiErrorResponse("ไม่พบชุดอาหาร", 404, "NOT_FOUND");
    }

    const foodSet = await prisma.foodSet.findUnique({
      where: { id: foodSetId },
      include: foodSetInclude,
    });
    if (!foodSet) {
      return apiErrorResponse("ไม่พบชุดอาหาร", 404, "NOT_FOUND");
    }

    return NextResponse.json(serializeFoodSet(foodSet));
  } catch (error) {
    console.error("GET /api/food-sets/[foodSetId] failed", error);
    return apiErrorResponse("ไม่สามารถโหลดชุดอาหารได้", 500, "INTERNAL_ERROR");
  }
}

export async function PATCH(request: NextRequest, context: RouteContext) {
  try {
    const { foodSetId } = await context.params;
    if (!isUuid(foodSetId)) {
      return apiErrorResponse("ไม่พบชุดอาหาร", 404, "NOT_FOUND");
    }

    const currentUser = await getCurrentUser();
    const parsed = await readJsonObject(request);
    if (!parsed.ok) return parsed.response;

    const validated = parseFoodSetInput(parsed.body, "update");
    if (!validated.ok) {
      return validationErrorResponse("กรุณาตรวจสอบข้อมูลชุดอาหาร", validated.issues);
    }

    const existing = await prisma.foodSet.findUnique({
      where: { id: foodSetId },
    });
    if (!existing) {
      return apiErrorResponse("ไม่พบชุดอาหาร", 404, "NOT_FOUND");
    }

    const { name, description, isActive, items } = validated.data;

    if (items?.length) {
      const productIds = items.map((item) => item.productId);
      const products = await prisma.product.findMany({
        where: { id: { in: productIds }, isActive: true },
        select: { id: true },
      });
      if (products.length !== productIds.length) {
        return validationErrorResponse("พบสินค้าที่ไม่พร้อมใช้", [
          { path: "items", message: "สินค้าบางรายการไม่พบหรือปิดขาย" },
        ]);
      }
    }

    const foodSet = await prisma.$transaction(async (tx) => {
      if (items) {
        await tx.foodSetItem.deleteMany({ where: { foodSetId } });
        await tx.foodSetItem.createMany({
          data: items.map((item) => ({
            foodSetId,
            productId: item.productId,
            quantity: item.quantity,
            sortOrder: item.sortOrder ?? 0,
            requireOptions: item.requireOptions ?? false,
          })),
        });
      }

      return tx.foodSet.update({
        where: { id: foodSetId },
        data: {
          ...(name !== undefined ? { name } : {}),
          ...(description !== undefined ? { description } : {}),
          ...(isActive !== undefined ? { isActive } : {}),
        },
        include: foodSetInclude,
      });
    });

    await recordAuditLog({
      actor: {
        employeeId: currentUser?.employee?.id,
        authUserId: currentUser?.user.id,
      },
      action: "FOOD_SET_UPDATED",
      entityType: "FOOD_SET",
      entityId: foodSet.id,
      metadata: {
        name: foodSet.name,
        isActive: foodSet.isActive,
        itemCount: foodSet.items.length,
      },
    });

    return NextResponse.json(serializeFoodSet(foodSet));
  } catch (error) {
    if (
      error instanceof Prisma.PrismaClientKnownRequestError &&
      error.code === "P2002"
    ) {
      return validationErrorResponse("ชื่อชุดอาหารนี้มีอยู่แล้ว", [
        { path: "name", message: "ชื่อซ้ำ" },
      ]);
    }
    console.error("PATCH /api/food-sets/[foodSetId] failed", error);
    return apiErrorResponse("อัปเดตชุดอาหารไม่สำเร็จ", 500, "INTERNAL_ERROR");
  }
}

export async function DELETE(_request: NextRequest, context: RouteContext) {
  try {
    const { foodSetId } = await context.params;
    if (!isUuid(foodSetId)) {
      return apiErrorResponse("ไม่พบชุดอาหาร", 404, "NOT_FOUND");
    }

    const currentUser = await getCurrentUser();
    const existing = await prisma.foodSet.findUnique({
      where: { id: foodSetId },
      select: { id: true, name: true },
    });
    if (!existing) {
      return apiErrorResponse("ไม่พบชุดอาหาร", 404, "NOT_FOUND");
    }

    await prisma.foodSet.delete({ where: { id: foodSetId } });

    await recordAuditLog({
      actor: {
        employeeId: currentUser?.employee?.id,
        authUserId: currentUser?.user.id,
      },
      action: "FOOD_SET_DELETED",
      entityType: "FOOD_SET",
      entityId: existing.id,
      metadata: { name: existing.name },
    });

    return NextResponse.json({ ok: true });
  } catch (error) {
    console.error("DELETE /api/food-sets/[foodSetId] failed", error);
    return apiErrorResponse("ลบชุดอาหารไม่สำเร็จ", 500, "INTERNAL_ERROR");
  }
}
