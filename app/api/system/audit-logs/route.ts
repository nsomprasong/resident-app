import { apiErrorResponse } from "@/lib/api/validation";
import {
  listAuditLogFilterOptions,
  listAuditLogs,
} from "@/lib/system/audit-logs";
import { NextRequest, NextResponse } from "next/server";

function parsePositiveInt(value: string | null, fallback: number) {
  if (!value) return fallback;
  const parsed = Number.parseInt(value, 10);
  return Number.isFinite(parsed) ? parsed : fallback;
}

export async function GET(request: NextRequest) {
  try {
    const params = request.nextUrl.searchParams;
    const [list, filters] = await Promise.all([
      listAuditLogs({
        page: parsePositiveInt(params.get("page"), 1),
        pageSize: parsePositiveInt(params.get("pageSize"), 30),
        q: params.get("q") ?? undefined,
        action: params.get("action") ?? undefined,
        entityType: params.get("entityType") ?? undefined,
        from: params.get("from") ?? undefined,
        to: params.get("to") ?? undefined,
      }),
      listAuditLogFilterOptions(),
    ]);

    return NextResponse.json({ ...list, filters });
  } catch (error) {
    console.error("GET /api/system/audit-logs failed", error);
    return apiErrorResponse(
      "ไม่สามารถโหลดบันทึกตรวจสอบระบบได้",
      500,
      "INTERNAL_ERROR",
    );
  }
}
