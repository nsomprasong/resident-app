import { apiErrorResponse } from "@/lib/api/validation";
import { prisma } from "@/lib/prisma";
import { serializeRaftMaster } from "@/lib/settings/rafts";
import { NextResponse } from "next/server";

export async function GET() {
  try {
    const rafts = await prisma.raft.findMany({
      orderBy: { number: "asc" },
    });
    return NextResponse.json(rafts.map(serializeRaftMaster));
  } catch (error) {
    console.error("GET /api/rafts/master failed", error);
    return apiErrorResponse("ไม่สามารถโหลดรายการแพได้", 500, "INTERNAL_ERROR");
  }
}
