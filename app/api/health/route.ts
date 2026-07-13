import { buildHealthResponse } from "@/lib/production/readiness";
import { NextResponse } from "next/server";

export async function GET() {
  return NextResponse.json(buildHealthResponse(), {
    headers: {
      "Cache-Control": "no-store",
    },
  });
}
