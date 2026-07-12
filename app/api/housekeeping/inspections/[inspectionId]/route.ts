import {
  ChargeType,
  InspectionItemType,
  InspectionStatus,
  RoomStatus,
} from "@/generated/prisma/client";
import { prisma } from "@/lib/prisma";
import { NextRequest, NextResponse } from "next/server";

interface Item {
  catalogId?: string;
  type: InspectionItemType;
  description: string;
  quantity: number;
  unitPrice: number;
}
export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ inspectionId: string }> },
) {
  try {
    const { inspectionId } = await params;
    const body = (await request.json()) as {
      notes?: string;
      items?: Item[];
      complete?: boolean;
    };
    const items = (body.items ?? []).filter(
      (item) =>
        item.description?.trim() &&
        item.quantity > 0 &&
        item.unitPrice >= 0 &&
        Object.values(InspectionItemType).includes(item.type),
    );
    await prisma.$transaction(async (tx) => {
      const catalogs = await tx.inspectionCatalog.findMany({
        where: {
          id: {
            in: items
              .map((item) => item.catalogId)
              .filter((id): id is string => Boolean(id)),
          },
          isActive: true,
        },
      });
      if (catalogs.length !== items.length) throw new Error("INVALID_CATALOG");
      const catalogMap = new Map(catalogs.map((item) => [item.id, item]));
      const pricedItems = items.map((item) => {
        const catalog = catalogMap.get(item.catalogId!);
        if (!catalog) throw new Error("INVALID_CATALOG");
        return {
          catalogId: catalog.id,
          type: catalog.type,
          description: catalog.name,
          quantity: item.quantity,
          unitPrice: Number(catalog.unitPrice),
        };
      });
      const current = await tx.roomInspection.findUnique({
        where: { id: inspectionId },
        include: {
          charge: true,
          bookingRoom: {
            include: {
              room: true,
              booking: {
                include: {
                  charges: true,
                  payments: { where: { status: "PAID" } },
                  orders: {
                    where: { status: { not: "CANCELLED" } },
                    include: { items: true },
                  },
                },
              },
            },
          },
        },
      });
      if (!current) throw new Error("NOT_FOUND");
      const booking = current.bookingRoom.booking;
      await tx.inspectionItem.deleteMany({ where: { inspectionId } });
      if (pricedItems.length)
        await tx.inspectionItem.createMany({
          data: pricedItems.map((item) => ({
            inspectionId,
            catalogId: item.catalogId,
            type: item.type,
            description: item.description.trim(),
            quantity: item.quantity,
            unitPrice: item.unitPrice,
          })),
        });
      const completed =
        body.complete || current.status === InspectionStatus.COMPLETED;
      await tx.roomInspection.update({
        where: { id: inspectionId },
        data: {
          notes: body.notes?.trim() || null,
          status: completed
            ? InspectionStatus.COMPLETED
            : InspectionStatus.IN_PROGRESS,
          completedAt: completed ? (current.completedAt ?? new Date()) : null,
        },
      });
      if (completed)
        await tx.room.update({
          where: { id: current.bookingRoom.roomId },
          data: { status: RoomStatus.AVAILABLE },
        });
      const amount = pricedItems.reduce(
        (sum, item) => sum + item.quantity * item.unitPrice,
        0,
      );
      const description = pricedItems.length
        ? `ตรวจห้อง ${current.bookingRoom.room.number}: ${pricedItems.map((item) => `${item.description} x${item.quantity}`).join(", ")}`
        : `ตรวจห้อง ${current.bookingRoom.room.number}: ไม่มีค่าใช้จ่ายเพิ่ม`;
      if (amount > 0)
        await tx.charge.upsert({
          where: { inspectionId },
          update: { amount, description },
          create: {
            bookingId: booking.id,
            inspectionId,
            type: ChargeType.OTHER,
            description,
            amount,
          },
        });
      else if (current.charge)
        await tx.charge.delete({ where: { id: current.charge.id } });
    });
    return NextResponse.json({ success: true });
  } catch (error) {
    const message = error instanceof Error ? error.message : "";
    if (message === "NOT_FOUND")
      return NextResponse.json(
        { message: "ไม่พบรายการตรวจห้อง" },
        { status: 404 },
      );
    if (message === "INVALID_CATALOG")
      return NextResponse.json(
        { message: "พบรายการที่ไม่มีในราคากลาง กรุณาเลือกใหม่" },
        { status: 400 },
      );
    console.error("PATCH inspection failed", error);
    return NextResponse.json(
      { message: "ไม่สามารถบันทึกผลตรวจได้" },
      { status: 500 },
    );
  }
}
