import { Prisma } from "@/generated/prisma/client";
import {
  apiErrorResponse,
  readJsonObject,
  validationErrorResponse,
} from "@/lib/api/validation";
import { recordAuditLog } from "@/lib/audit/audit-log";
import { getCurrentUser } from "@/lib/auth/current-user";
import { prisma } from "@/lib/prisma";
import { parsePaymentChannelInput } from "@/lib/settings/payment-channels";
import { NextRequest, NextResponse } from "next/server";

export async function GET() {
  const channels = await prisma.paymentChannel.findMany({
    where: { isActive: true },
    orderBy: { createdAt: "asc" },
  });
  return NextResponse.json(
    channels.map((item) => ({
      id: item.id,
      name: item.name,
      method: item.method,
    })),
  );
}

export async function POST(request: NextRequest) {
  try {
    const currentUser = await getCurrentUser();
    const parsed = await readJsonObject(request);
    if (!parsed.ok) return parsed.response;

    const validated = parsePaymentChannelInput(parsed.body, "create");
    if (!validated.ok) {
      return validationErrorResponse(
        "กรุณาระบุชื่อและประเภทช่องทาง",
        validated.issues,
      );
    }

    const { name, method } = validated.data;
    if (name === undefined || method === undefined) {
      return validationErrorResponse("กรุณาระบุชื่อและประเภทช่องทาง", [
        { path: "body", message: "ข้อมูลไม่ครบ" },
      ]);
    }

    // Upsert keeps PayButton "add channel" compatible: same name reactivates.
    const channel = await prisma.paymentChannel.upsert({
      where: { name },
      update: { method, isActive: true },
      create: { name, method },
    });

    await recordAuditLog({
      actor: {
        employeeId: currentUser?.employee?.id,
        authUserId: currentUser?.user.id,
      },
      action: "PAYMENT_CHANNEL_UPSERTED",
      entityType: "PAYMENT_CHANNEL",
      entityId: channel.id,
      metadata: {
        method: channel.method,
        isActive: channel.isActive,
      },
    });

    return NextResponse.json(
      { id: channel.id, name: channel.name, method: channel.method },
      { status: 201 },
    );
  } catch (error) {
    if (
      error instanceof Prisma.PrismaClientKnownRequestError &&
      error.code === "P2002"
    ) {
      return validationErrorResponse("ชื่อช่องทางนี้มีอยู่แล้ว", [
        { path: "name", message: "ชื่อซ้ำ" },
      ]);
    }
    console.error("POST payment channel failed", error);
    return apiErrorResponse(
      "เพิ่มช่องทางรับชำระไม่สำเร็จ",
      500,
      "INTERNAL_ERROR",
    );
  }
}
