import { OrderStatus } from "@/generated/prisma/client";
import { prisma } from "@/lib/prisma";
import { NextRequest, NextResponse } from "next/server";

interface OrderBody { bookingId: string; items: Array<{ productId?: string; note?: string }> }

export async function POST(request: NextRequest) {
  try {
    const body = await request.json() as OrderBody;
    if (!body.bookingId || !Array.isArray(body.items) || !body.items.length || body.items.some((item) => !item.productId)) {
      return NextResponse.json({ message: "ข้อมูลลูกค้าหรือรายการสินค้าไม่ครบ" }, { status: 400 });
    }
    const booking = await prisma.booking.findUnique({ where: { id: body.bookingId }, include: { rooms: { take: 1 } } });
    if (!booking || booking.status === "CANCELLED" || booking.status === "CHECKED_OUT") return NextResponse.json({ message: "ไม่พบลูกค้าที่กำลังเข้าพัก" }, { status: 404 });
    const productIds = [...new Set(body.items.map((item) => item.productId!))];
    const products = await prisma.product.findMany({ where: { id: { in: productIds }, isActive: true } });
    if (products.length !== productIds.length) return NextResponse.json({ message: "มีสินค้าที่ไม่พบหรือหยุดจำหน่าย" }, { status: 400 });
    const grouped = new Map<string, { productId: string; note?: string; quantity: number }>();
    for (const item of body.items) {
      const key = `${item.productId}:${item.note ?? ""}`; const current = grouped.get(key);
      grouped.set(key, current ? { ...current, quantity: current.quantity + 1 } : { productId: item.productId!, note: item.note, quantity: 1 });
    }
    const productMap = new Map(products.map((product) => [product.id, product]));
    const order = await prisma.order.create({
      data: {
        number: `ORD-${Date.now()}-${Math.random().toString(36).slice(2, 6).toUpperCase()}`,
        status: OrderStatus.PENDING, roomId: booking.rooms[0]?.roomId, bookingId: booking.id,
        items: { create: [...grouped.values()].map((item) => ({ productId: item.productId, quantity: item.quantity, unitPrice: productMap.get(item.productId)!.price, note: item.note, isExtra: true })) },
      },
      select: { id: true, number: true, status: true },
    });
    return NextResponse.json(order, { status: 201 });
  } catch (error) {
    console.error("POST /api/orders failed", error);
    return NextResponse.json({ message: "ไม่สามารถบันทึกออเดอร์ได้" }, { status: 500 });
  }
}
