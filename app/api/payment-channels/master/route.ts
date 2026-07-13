import { apiErrorResponse } from "@/lib/api/validation";
import { prisma } from "@/lib/prisma";
import { serializePaymentChannelMaster } from "@/lib/settings/payment-channels";
import { NextResponse } from "next/server";

const channelInclude = {
  _count: { select: { payments: true } },
} as const;

export async function GET() {
  try {
    const channels = await prisma.paymentChannel.findMany({
      include: channelInclude,
      orderBy: [{ isActive: "desc" }, { name: "asc" }],
    });
    return NextResponse.json(channels.map(serializePaymentChannelMaster));
  } catch (error) {
    console.error("GET /api/payment-channels/master failed", error);
    return apiErrorResponse(
      "ไม่สามารถโหลดช่องทางรับชำระได้",
      500,
      "INTERNAL_ERROR",
    );
  }
}
