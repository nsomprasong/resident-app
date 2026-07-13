import { apiErrorResponse } from "@/lib/api/validation";
import { prisma } from "@/lib/prisma";
import { serializeProductMaster } from "@/lib/settings/products";
import { NextResponse } from "next/server";

export async function GET() {
  try {
    const products = await prisma.product.findMany({
      include: {
        type: {
          select: { id: true, name: true, requiresFoodCategory: true },
        },
        category: { select: { id: true, name: true } },
      },
      orderBy: [{ type: { name: "asc" } }, { name: "asc" }],
    });
    return NextResponse.json(products.map(serializeProductMaster));
  } catch (error) {
    console.error("GET /api/products/master failed", error);
    return apiErrorResponse("ไม่สามารถโหลดรายการสินค้าได้", 500, "INTERNAL_ERROR");
  }
}
