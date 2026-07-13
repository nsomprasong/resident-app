import { apiErrorResponse } from "@/lib/api/validation";
import { prisma } from "@/lib/prisma";
import { serializePermission } from "@/lib/settings/role-permissions";
import { NextResponse } from "next/server";

export async function GET() {
  try {
    const permissions = await prisma.permission.findMany({
      orderBy: { code: "asc" },
    });
    return NextResponse.json(permissions.map(serializePermission));
  } catch (error) {
    console.error("GET /api/permissions failed", error);
    return apiErrorResponse(
      "ไม่สามารถโหลด permissions ได้",
      500,
      "INTERNAL_ERROR",
    );
  }
}
