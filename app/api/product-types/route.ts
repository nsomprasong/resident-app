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
  parseProductTypeInput,
  serializeProductType,
} from "@/lib/settings/product-types";
import { NextRequest, NextResponse } from "next/server";

export async function GET(request: NextRequest) {
  try {
    const activeOnly =
      request.nextUrl.searchParams.get("active") !== "false";
    const types = await prisma.productType.findMany({
      where: activeOnly ? { isActive: true } : undefined,
      orderBy: [{ name: "asc" }],
    });
    return NextResponse.json(types.map(serializeProductType));
  } catch (error) {
    console.error("GET /api/product-types failed", error);
    return apiErrorResponse(
      "ไม่สามารถโหลดประเภทสินค้าได้",
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

    const validated = parseProductTypeInput(parsed.body);
    if (!validated.ok) {
      return validationErrorResponse(
        "กรุณาตรวจสอบชื่อประเภทสินค้า",
        validated.issues,
      );
    }

    const existing = await prisma.productType.findFirst({
      where: { name: { equals: validated.name, mode: "insensitive" } },
    });
    if (existing) {
      if (!existing.isActive) {
        const reactivated = await prisma.productType.update({
          where: { id: existing.id },
          data: { isActive: true, name: validated.name },
        });
        return NextResponse.json(serializeProductType(reactivated), {
          status: 200,
        });
      }
      return NextResponse.json(serializeProductType(existing), { status: 200 });
    }

    const requiresFoodCategory =
      validated.name === "อาหาร" ||
      validated.name.toLowerCase().includes("อาหาร");

    const type = await prisma.productType.create({
      data: {
        name: validated.name,
        requiresFoodCategory,
        isActive: true,
      },
    });

    await recordAuditLog({
      actor: {
        employeeId: currentUser?.employee?.id,
        authUserId: currentUser?.user.id,
      },
      action: "PRODUCT_TYPE_CREATED",
      entityType: "PRODUCT_TYPE",
      entityId: type.id,
      metadata: {
        name: type.name,
        requiresFoodCategory: type.requiresFoodCategory,
      },
    });

    return NextResponse.json(serializeProductType(type), { status: 201 });
  } catch (error) {
    if (
      error instanceof Prisma.PrismaClientKnownRequestError &&
      error.code === "P2002"
    ) {
      return validationErrorResponse("ประเภทสินค้านี้มีอยู่แล้ว", [
        { path: "name", message: "ชื่อซ้ำ" },
      ]);
    }
    console.error("POST /api/product-types failed", error);
    return apiErrorResponse("เพิ่มประเภทสินค้าไม่สำเร็จ", 500, "INTERNAL_ERROR");
  }
}
