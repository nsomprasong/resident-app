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
  parseFoodCategoryInput,
  serializeFoodCategory,
} from "@/lib/settings/food-categories";
import { NextRequest, NextResponse } from "next/server";

export async function GET(request: NextRequest) {
  try {
    const activeOnly =
      request.nextUrl.searchParams.get("active") !== "false";
    const categories = await prisma.foodCategory.findMany({
      where: activeOnly ? { isActive: true } : undefined,
      orderBy: [{ name: "asc" }],
    });
    return NextResponse.json(categories.map(serializeFoodCategory));
  } catch (error) {
    console.error("GET /api/food-categories failed", error);
    return apiErrorResponse(
      "ไม่สามารถโหลดหมวดอาหารได้",
      500,
      "INTERNAL_ERROR",
    );
  }
}

export async function POST(request: NextRequest) {
  try {
    const currentUser = await getCurrentUser();
    const parsed = await readJsonObject(request);
    if (!parsed.ok) return parsed.response;

    const validated = parseFoodCategoryInput(parsed.body);
    if (!validated.ok) {
      return validationErrorResponse(
        "กรุณาตรวจสอบชื่อหมวดอาหาร",
        validated.issues,
      );
    }

    const existing = await prisma.foodCategory.findFirst({
      where: { name: { equals: validated.name, mode: "insensitive" } },
    });
    if (existing) {
      if (!existing.isActive) {
        const reactivated = await prisma.foodCategory.update({
          where: { id: existing.id },
          data: { isActive: true, name: validated.name },
        });
        return NextResponse.json(serializeFoodCategory(reactivated), {
          status: 200,
        });
      }
      return NextResponse.json(serializeFoodCategory(existing), { status: 200 });
    }

    const category = await prisma.foodCategory.create({
      data: { name: validated.name, isActive: true },
    });

    await recordAuditLog({
      actor: {
        employeeId: currentUser?.employee?.id,
        authUserId: currentUser?.user.id,
      },
      action: "FOOD_CATEGORY_CREATED",
      entityType: "FOOD_CATEGORY",
      entityId: category.id,
      metadata: { name: category.name },
    });

    return NextResponse.json(serializeFoodCategory(category), { status: 201 });
  } catch (error) {
    if (
      error instanceof Prisma.PrismaClientKnownRequestError &&
      error.code === "P2002"
    ) {
      return validationErrorResponse("หมวดอาหารนี้มีอยู่แล้ว", [
        { path: "name", message: "ชื่อซ้ำ" },
      ]);
    }
    console.error("POST /api/food-categories failed", error);
    return apiErrorResponse("เพิ่มหมวดอาหารไม่สำเร็จ", 500, "INTERNAL_ERROR");
  }
}
