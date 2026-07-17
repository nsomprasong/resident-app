import {
  apiErrorResponse,
  readJsonObject,
  validationErrorResponse,
} from "@/lib/api/validation";
import { recordAuditLog } from "@/lib/audit/audit-log";
import { getCurrentUser } from "@/lib/auth/current-user";
import { prisma } from "@/lib/prisma";
import { parseProductInput, serializeProductMaster } from "@/lib/settings/products";
import { NextRequest, NextResponse } from "next/server";

const productInclude = {
  type: {
    select: { id: true, name: true, requiresFoodCategory: true },
  },
  category: { select: { id: true, name: true } },
  optionGroups: {
    include: {
      options: {
        where: { isActive: true },
        orderBy: [{ sortOrder: "asc" as const }, { label: "asc" as const }],
      },
    },
    orderBy: [{ sortOrder: "asc" as const }, { name: "asc" as const }],
  },
};

export async function GET(request: NextRequest) {
  try {
    const minibarParam = request.nextUrl.searchParams.get("minibar");
    const typeId = request.nextUrl.searchParams.get("typeId")?.trim();
    const isMinibar =
      minibarParam === "true" ? true : minibarParam === "false" ? false : undefined;

    const products = await prisma.product.findMany({
      where: {
        isActive: true,
        ...(isMinibar !== undefined ? { isMinibar } : {}),
        ...(typeId ? { typeId } : {}),
      },
      include: productInclude,
      orderBy: [
        { type: { name: "asc" } },
        { category: { name: "asc" } },
        { name: "asc" },
      ],
    });
    return NextResponse.json(
      products.map((product) => ({
        id: product.id,
        title: product.name,
        description: product.description,
        price: Number(product.price),
        typeId: product.typeId,
        typeName: product.type.name,
        categoryId: product.categoryId,
        categoryName: product.category?.name ?? null,
        isMinibar: product.isMinibar,
        image: product.imageUrl ?? "/images/food/frychicken.jpg",
        alt: product.name,
        optionGroups: product.optionGroups.map((group) => ({
          id: group.id,
          name: group.name,
          isRequired: group.isRequired,
          sortOrder: group.sortOrder,
          options: group.options.map((option) => ({
            id: option.id,
            label: option.label,
            sortOrder: option.sortOrder,
          })),
        })),
      })),
    );
  } catch (error) {
    console.error("GET /api/products failed", error);
    return NextResponse.json(
      { message: "ไม่สามารถโหลดรายการสินค้าได้" },
      { status: 500 },
    );
  }
}

export async function POST(request: NextRequest) {
  try {
    const currentUser = await getCurrentUser();
    const parsed = await readJsonObject(request);
    if (!parsed.ok) return parsed.response;

    const validated = parseProductInput(parsed.body, "create");
    if (!validated.ok) {
      return validationErrorResponse("กรุณาตรวจสอบข้อมูลสินค้า", validated.issues);
    }

    const { name, description, price, typeId, categoryId, isMinibar, imageUrl } =
      validated.data;
    if (name === undefined || price === undefined || typeId === undefined) {
      return validationErrorResponse("กรุณาตรวจสอบข้อมูลสินค้า", [
        { path: "body", message: "ข้อมูลไม่ครบ" },
      ]);
    }

    const productType = await prisma.productType.findFirst({
      where: { id: typeId, isActive: true },
    });
    if (!productType) {
      return validationErrorResponse("ประเภทสินค้าไม่ถูกต้อง", [
        { path: "typeId", message: "ไม่พบประเภทสินค้า" },
      ]);
    }

    let nextCategoryId: string | null = null;
    if (productType.requiresFoodCategory) {
      if (!categoryId) {
        return validationErrorResponse("กรุณาเลือกหมวดอาหาร", [
          { path: "categoryId", message: "กรุณาเลือกหมวดอาหาร" },
        ]);
      }
      const category = await prisma.foodCategory.findFirst({
        where: { id: categoryId, isActive: true },
      });
      if (!category) {
        return validationErrorResponse("หมวดอาหารไม่ถูกต้อง", [
          { path: "categoryId", message: "ไม่พบหมวดอาหาร" },
        ]);
      }
      nextCategoryId = categoryId;
    }

    const product = await prisma.product.create({
      data: {
        name,
        description: description ?? null,
        price,
        typeId,
        categoryId: nextCategoryId,
        isMinibar: isMinibar ?? false,
        imageUrl: imageUrl ?? null,
        isActive: true,
      },
      include: productInclude,
    });

    await recordAuditLog({
      actor: {
        employeeId: currentUser?.employee?.id,
        authUserId: currentUser?.user.id,
      },
      action: "PRODUCT_CREATED",
      entityType: "PRODUCT",
      entityId: product.id,
      metadata: {
        name: product.name,
        typeId: product.typeId,
        isMinibar: product.isMinibar,
      },
    });

    return NextResponse.json(serializeProductMaster(product), { status: 201 });
  } catch (error) {
    console.error("POST /api/products failed", error);
    return apiErrorResponse("เพิ่มสินค้าไม่สำเร็จ", 500, "INTERNAL_ERROR");
  }
}
