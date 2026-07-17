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
  parseFoodSetInput,
  serializeFoodSet,
} from "@/lib/settings/food-sets";
import { NextRequest, NextResponse } from "next/server";

export async function GET(request: NextRequest) {
  try {
    const activeOnly = request.nextUrl.searchParams.get("active") !== "false";
    const foodSets = await prisma.foodSet.findMany({
      where: activeOnly ? { isActive: true } : undefined,
      include: foodSetInclude,
      orderBy: [{ name: "asc" }],
    });
    return NextResponse.json(foodSets.map(serializeFoodSet));
  } catch (error) {
    console.error("GET /api/food-sets failed", error);
    return apiErrorResponse("ไม่สามารถโหลดชุดอาหารได้", 500, "INTERNAL_ERROR");
  }
}

export async function POST(request: NextRequest) {
  try {
    const currentUser = await getCurrentUser();
    const parsed = await readJsonObject(request);
    if (!parsed.ok) return parsed.response;

    const validated = parseFoodSetInput(parsed.body, "create");
    if (!validated.ok) {
      return validationErrorResponse("กรุณาตรวจสอบข้อมูลชุดอาหาร", validated.issues);
    }

    const { name, description, isActive, items } = validated.data;
    if (!name || !items?.length) {
      return validationErrorResponse("กรุณาตรวจสอบข้อมูลชุดอาหาร", [
        { path: "body", message: "ข้อมูลไม่ครบ" },
      ]);
    }

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

    const foodSet = await prisma.foodSet.create({
      data: {
        name,
        description: description ?? null,
        isActive: isActive ?? true,
        items: {
          create: items.map((item) => ({
            productId: item.productId,
            quantity: item.quantity,
            sortOrder: item.sortOrder ?? 0,
            requireOptions: item.requireOptions ?? false,
          })),
        },
      },
      include: foodSetInclude,
    });

    await recordAuditLog({
      actor: {
        employeeId: currentUser?.employee?.id,
        authUserId: currentUser?.user.id,
      },
      action: "FOOD_SET_CREATED",
      entityType: "FOOD_SET",
      entityId: foodSet.id,
      metadata: { name: foodSet.name, itemCount: items.length },
    });

    return NextResponse.json(serializeFoodSet(foodSet), { status: 201 });
  } catch (error) {
    if (
      error instanceof Prisma.PrismaClientKnownRequestError &&
      error.code === "P2002"
    ) {
      return validationErrorResponse("ชื่อชุดอาหารนี้มีอยู่แล้ว", [
        { path: "name", message: "ชื่อซ้ำ" },
      ]);
    }
    console.error("POST /api/food-sets failed", error);
    return apiErrorResponse("สร้างชุดอาหารไม่สำเร็จ", 500, "INTERNAL_ERROR");
  }
}
