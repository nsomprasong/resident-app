import { apiErrorResponse } from "@/lib/api/validation";
import { prisma } from "@/lib/prisma";
import { serializeInspectionCatalogMaster } from "@/lib/settings/inspection-catalog";
import { NextResponse } from "next/server";

export async function GET() {
  try {
    const items = await prisma.inspectionCatalog.findMany({
      orderBy: [{ type: "asc" }, { name: "asc" }],
    });
    return NextResponse.json(items.map(serializeInspectionCatalogMaster));
  } catch (error) {
    console.error("GET /api/inspection-catalog/master failed", error);
    return apiErrorResponse(
      "ไม่สามารถโหลดราคากลางตรวจห้องได้",
      500,
      "INTERNAL_ERROR",
    );
  }
}
