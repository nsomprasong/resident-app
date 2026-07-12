import { PaymentMethod } from "@/generated/prisma/client";
import { prisma } from "@/lib/prisma";
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
    const body = (await request.json()) as {
      name?: string;
      method?: PaymentMethod;
    };
    const name = body.name?.trim();
    if (
      !name ||
      !body.method ||
      !Object.values(PaymentMethod).includes(body.method)
    )
      return NextResponse.json(
        { message: "กรุณาระบุชื่อและประเภทช่องทาง" },
        { status: 400 },
      );
    const channel = await prisma.paymentChannel.upsert({
      where: { name },
      update: { method: body.method, isActive: true },
      create: { name, method: body.method },
    });
    return NextResponse.json(
      { id: channel.id, name: channel.name, method: channel.method },
      { status: 201 },
    );
  } catch (error) {
    console.error("POST payment channel failed", error);
    return NextResponse.json(
      { message: "เพิ่มช่องทางรับชำระไม่สำเร็จ" },
      { status: 500 },
    );
  }
}
