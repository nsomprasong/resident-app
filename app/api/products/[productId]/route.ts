import {
  apiErrorResponse,
  readJsonObject,
  validationErrorResponse,
} from "@/lib/api/validation";
import { recordAuditLog } from "@/lib/audit/audit-log";
import { getCurrentUser } from "@/lib/auth/current-user";
import { prisma } from "@/lib/prisma";
import {
  isProductUuid,
  parseProductInput,
  serializeProductMaster,
} from "@/lib/settings/products";
import { NextRequest, NextResponse } from "next/server";

type RouteContext = {
  params: Promise<{ productId: string }>;
};

const productInclude = {
  type: {
    select: { id: true, name: true, requiresFoodCategory: true },
  },
  category: { select: { id: true, name: true } },
} as const;

export async function PATCH(request: NextRequest, context: RouteContext) {
  try {
    const { productId } = await context.params;
    if (!isProductUuid(productId)) {
      return apiErrorResponse("ไม่พบสินค้า", 404, "NOT_FOUND");
    }

    const currentUser = await getCurrentUser();
    const parsed = await readJsonObject(request);
    if (!parsed.ok) return parsed.response;

    const validated = parseProductInput(parsed.body, "update");
    if (!validated.ok) {
      return validationErrorResponse("กรุณาตรวจสอบข้อมูลสินค้า", validated.issues);
    }

    const existing = await prisma.product.findUnique({
      where: { id: productId },
      include: { type: true },
    });
    if (!existing) {
      return apiErrorResponse("ไม่พบสินค้า", 404, "NOT_FOUND");
    }

    const nextTypeId = validated.data.typeId ?? existing.typeId;
    const productType = await prisma.productType.findFirst({
      where: { id: nextTypeId, isActive: true },
    });
    if (!productType) {
      return validationErrorResponse("ประเภทสินค้าไม่ถูกต้อง", [
        { path: "typeId", message: "ไม่พบประเภทสินค้า" },
      ]);
    }

    let nextCategoryId =
      validated.data.categoryId !== undefined
        ? validated.data.categoryId
        : existing.categoryId;

    if (productType.requiresFoodCategory) {
      if (!nextCategoryId) {
        return validationErrorResponse("กรุณาเลือกหมวดอาหาร", [
          { path: "categoryId", message: "กรุณาเลือกหมวดอาหาร" },
        ]);
      }
      const category = await prisma.foodCategory.findFirst({
        where: { id: nextCategoryId, isActive: true },
      });
      if (!category) {
        return validationErrorResponse("หมวดอาหารไม่ถูกต้อง", [
          { path: "categoryId", message: "ไม่พบหมวดอาหาร" },
        ]);
      }
    } else {
      nextCategoryId = null;
    }

    const product = await prisma.product.update({
      where: { id: productId },
      data: {
        ...validated.data,
        typeId: nextTypeId,
        categoryId: nextCategoryId,
      },
      include: productInclude,
    });

    await recordAuditLog({
      actor: {
        employeeId: currentUser?.employee?.id,
        authUserId: currentUser?.user.id,
      },
      action: "PRODUCT_UPDATED",
      entityType: "PRODUCT",
      entityId: product.id,
      metadata: {
        name: product.name,
        typeId: product.typeId,
        isMinibar: product.isMinibar,
        isActive: product.isActive,
      },
    });

    return NextResponse.json(serializeProductMaster(product));
  } catch (error) {
    console.error("PATCH /api/products/[productId] failed", error);
    return apiErrorResponse("อัปเดตสินค้าไม่สำเร็จ", 500, "INTERNAL_ERROR");
  }
}
