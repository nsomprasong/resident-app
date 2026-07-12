import { ProductType } from "@/generated/prisma/client";
import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

export async function GET(request: NextRequest) {
  try {
    const requestedType = request.nextUrl.searchParams.get("type")?.toUpperCase();
    const type = requestedType && Object.values(ProductType).includes(requestedType as ProductType)
      ? requestedType as ProductType
      : undefined;
    const products = await prisma.product.findMany({
      where: { isActive: true, ...(type ? { type } : {}) },
      orderBy: [{ type: "asc" }, { name: "asc" }],
    });
    return NextResponse.json(products.map((product) => ({
      id: product.id,
      title: product.name,
      description: product.description,
      price: Number(product.price),
      type: product.type,
      image: product.imageUrl ?? "/images/food/frychicken.jpg",
      alt: product.name,
    })));
  } catch (error) {
    console.error("GET /api/products failed", error);
    return NextResponse.json({ message: "ไม่สามารถโหลดรายการสินค้าได้" }, { status: 500 });
  }
}
