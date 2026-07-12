import { prisma } from "@/lib/prisma";
import { NextResponse } from "next/server";

export async function GET() {
  const items = await prisma.inspectionCatalog.findMany({
    where: { isActive: true },
    orderBy: [{ type: "asc" }, { name: "asc" }],
  });
  return NextResponse.json(
    items.map((item) => ({
      id: item.id,
      name: item.name,
      type: item.type,
      unitPrice: Number(item.unitPrice),
    })),
  );
}
