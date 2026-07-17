import { NextRequest, NextResponse } from "next/server";

import { searchGuestHistory } from "@/lib/guests/search";

export async function GET(request: NextRequest) {
  try {
    const query = request.nextUrl.searchParams.get("q")?.trim() ?? "";
    const includeTourGroups =
      request.nextUrl.searchParams.get("includeTourGroups") === "1" ||
      request.nextUrl.searchParams.get("includeTourGroups") === "true";
    const limitRaw = Number(request.nextUrl.searchParams.get("limit") ?? "12");
    const limit = Number.isFinite(limitRaw) ? limitRaw : 12;

    if (query.length < 1) {
      return NextResponse.json({ items: [] });
    }

    const items = await searchGuestHistory({
      query,
      includeTourGroups,
      limit,
    });

    return NextResponse.json({ items });
  } catch (error) {
    console.error("GET /api/guests failed", error);
    return NextResponse.json(
      { message: "ไม่สามารถค้นหาลูกค้าได้" },
      { status: 500 },
    );
  }
}
