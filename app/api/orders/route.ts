import { OrderStatus } from "@/generated/prisma/client";
import {
  apiErrorResponse,
  readJsonObject,
  validationErrorResponse,
  type ValidationIssue,
} from "@/lib/api/validation";
import { getCurrentUser } from "@/lib/auth/current-user";
import { recordAuditLog } from "@/lib/audit/audit-log";
import { kitchenVisibleStatuses } from "@/lib/orders/kitchen-workflow";
import { prisma } from "@/lib/prisma";
import { NextRequest, NextResponse } from "next/server";

type OrderItemInput = {
  productId: string | null;
  customName: string | null;
  customUnitPrice: number | null;
  note?: string;
  quantity: number;
  isExtra: boolean;
};

export async function GET(request: NextRequest) {
  try {
    const requestedStatus = request.nextUrl.searchParams
      .get("status")
      ?.toUpperCase();
    const status =
      requestedStatus &&
      Object.values(OrderStatus).includes(requestedStatus as OrderStatus)
        ? (requestedStatus as OrderStatus)
        : undefined;
    const statuses = status ? [status] : kitchenVisibleStatuses;

    const orders = await prisma.order.findMany({
      where: { status: { in: statuses } },
      include: {
        booking: {
          select: {
            reference: true,
            guest: { select: { firstName: true, lastName: true } },
            tourGroup: { select: { name: true } },
          },
        },
        room: { select: { number: true } },
        items: {
          include: {
            product: {
              select: {
                name: true,
                isMinibar: true,
                type: { select: { name: true } },
              },
            },
          },
        },
      },
      orderBy: [{ createdAt: "asc" }],
    });

    return NextResponse.json(
      orders.map((order) => ({
        id: order.id,
        number: order.number,
        status: order.status,
        room: order.room ? { number: order.room.number } : null,
        booking: order.booking
          ? {
              reference: order.booking.reference,
              customerName:
                order.booking.tourGroup?.name ??
                [order.booking.guest?.firstName, order.booking.guest?.lastName]
                  .filter(Boolean)
                  .join(" "),
            }
          : null,
        note: order.note,
        createdAt: order.createdAt.toISOString(),
        items: order.items.map((item) => ({
          id: item.id,
          productName: item.customName ?? item.product?.name ?? "เมนูพิเศษ",
          productType: item.product?.type.name ?? "เมนูพิเศษ",
          isMinibar: item.product?.isMinibar ?? false,
          quantity: item.quantity,
          note: item.note,
          isCustom: !item.productId,
        })),
      })),
    );
  } catch (error) {
    console.error("GET /api/orders failed", error);
    return apiErrorResponse(
      "ไม่สามารถโหลดรายการออเดอร์ได้",
      500,
      "INTERNAL_ERROR",
    );
  }
}

export async function POST(request: NextRequest) {
  try {
    const currentUser = await getCurrentUser();
    const parsed = await readJsonObject(request);
    if (!parsed.ok) return parsed.response;

    const issues: ValidationIssue[] = [];
    const bookingId =
      typeof parsed.body.bookingId === "string"
        ? parsed.body.bookingId.trim()
        : "";
    const itemsValue = parsed.body.items;
    const items: OrderItemInput[] = [];

    if (!bookingId) {
      issues.push({ path: "bookingId", message: "Booking id is required" });
    }

    if (!Array.isArray(itemsValue) || !itemsValue.length) {
      issues.push({
        path: "items",
        message: "At least one order item is required",
      });
    } else {
      itemsValue.forEach((item, index) => {
        if (typeof item !== "object" || item === null || Array.isArray(item)) {
          issues.push({
            path: `items.${index}`,
            message: "Order item must be an object",
          });
          return;
        }

        const itemRecord = item as Record<string, unknown>;
        const productId =
          typeof itemRecord.productId === "string"
            ? itemRecord.productId.trim()
            : "";
        const customName =
          typeof itemRecord.customName === "string"
            ? itemRecord.customName.trim()
            : "";
        const customPriceValue = itemRecord.customUnitPrice;
        const customUnitPrice =
          typeof customPriceValue === "number" &&
          Number.isFinite(customPriceValue) &&
          customPriceValue >= 0
            ? customPriceValue
            : null;
        const isCustom = !productId && Boolean(customName);
        const note = itemRecord.note;
        const quantityValue = itemRecord.quantity;
        const quantity =
          quantityValue === undefined
            ? 1
            : typeof quantityValue === "number" &&
                Number.isInteger(quantityValue) &&
                quantityValue > 0
              ? quantityValue
              : null;
        const isExtraValue = itemRecord.isExtra;
        const isExtra =
          isExtraValue === undefined
            ? true
            : typeof isExtraValue === "boolean"
              ? isExtraValue
              : null;

        if (!productId && !isCustom) {
          issues.push({
            path: `items.${index}`,
            message: "ระบุสินค้าจากเมนู หรือเมนูพิเศษพร้อมราคา",
          });
        }
        if (isCustom && customUnitPrice === null) {
          issues.push({
            path: `items.${index}.customUnitPrice`,
            message: "ราคาเมนูพิเศษไม่ถูกต้อง",
          });
        }

        if (note !== undefined && typeof note !== "string") {
          issues.push({
            path: `items.${index}.note`,
            message: "Item note must be a string",
          });
        }

        if (quantity === null) {
          issues.push({
            path: `items.${index}.quantity`,
            message: "Quantity must be a positive integer",
          });
        }

        if (isExtra === null) {
          issues.push({
            path: `items.${index}.isExtra`,
            message: "isExtra must be boolean",
          });
        }

        const catalogOk = Boolean(productId) && !isCustom;
        const customOk = isCustom && customUnitPrice !== null;
        if (
          (catalogOk || customOk) &&
          quantity !== null &&
          isExtra !== null &&
          (note === undefined || typeof note === "string")
        ) {
          items.push({
            productId: catalogOk ? productId : null,
            customName: customOk ? customName : null,
            customUnitPrice: customOk ? customUnitPrice : null,
            quantity,
            isExtra,
            ...(note !== undefined ? { note } : {}),
          });
        }
      });
    }

    if (issues.length) {
      return validationErrorResponse(
        "ข้อมูลลูกค้าหรือรายการสินค้าไม่ครบ",
        issues,
      );
    }

    const booking = await prisma.booking.findUnique({
      where: { id: bookingId },
      include: { rooms: true },
    });
    if (
      !booking ||
      booking.status === "CANCELLED" ||
      booking.status === "CHECKED_OUT"
    ) {
      return NextResponse.json(
        { message: "ไม่พบลูกค้าที่กำลังเข้าพัก" },
        { status: 404 },
      );
    }

    const isGroup = Boolean(booking.tourGroupId);
    const roomIdValue = parsed.body.roomId;
    let targetRoomId: string | null = null;

    if (roomIdValue !== undefined && roomIdValue !== null) {
      if (typeof roomIdValue !== "string" || !roomIdValue.trim()) {
        return validationErrorResponse("ข้อมูลห้องไม่ถูกต้อง", [
          { path: "roomId", message: "Room id must be a string or null" },
        ]);
      }
      const requestedRoomId = roomIdValue.trim();
      if (!booking.rooms.some((item) => item.roomId === requestedRoomId)) {
        return apiErrorResponse(
          "ห้องที่เลือกไม่อยู่ในการจองนี้",
          400,
          "ROOM_NOT_IN_BOOKING",
        );
      }
      targetRoomId = requestedRoomId;
    } else if (!isGroup) {
      targetRoomId = booking.rooms[0]?.roomId ?? null;
    }
    // group + roomId null/undefined => charge to group bill (roomId stays null)

    if (!isGroup && items.some((item) => !item.productId)) {
      return validationErrorResponse("เมนูพิเศษใช้ได้เฉพาะการจองแบบกลุ่ม", [
        { path: "items", message: "Custom dishes require a group booking" },
      ]);
    }

    const productIds = [
      ...new Set(
        items
          .map((item) => item.productId)
          .filter((id): id is string => Boolean(id)),
      ),
    ];
    const products = productIds.length
      ? await prisma.product.findMany({
          where: { id: { in: productIds }, isActive: true },
        })
      : [];
    if (products.length !== productIds.length) {
      return NextResponse.json(
        { message: "มีสินค้าที่ไม่พบหรือหยุดจำหน่าย" },
        { status: 400 },
      );
    }

    const grouped = new Map<
      string,
      {
        productId: string | null;
        customName: string | null;
        customUnitPrice: number | null;
        note?: string;
        quantity: number;
        isExtra: boolean;
      }
    >();
    for (const item of items) {
      const isExtra = isGroup ? item.isExtra : true;
      const key = item.productId
        ? `${item.productId}:${item.note ?? ""}:${isExtra ? "1" : "0"}`
        : `custom:${item.customName}:${item.customUnitPrice}:${item.note ?? ""}:${isExtra ? "1" : "0"}`;
      const current = grouped.get(key);
      grouped.set(
        key,
        current
          ? { ...current, quantity: current.quantity + item.quantity }
          : {
              productId: item.productId,
              customName: item.customName,
              customUnitPrice: item.customUnitPrice,
              note: item.note,
              quantity: item.quantity,
              isExtra,
            },
      );
    }

    const productMap = new Map(
      products.map((product) => [product.id, product]),
    );
    const orderNoteParts = [
      isGroup
        ? targetRoomId
          ? "สั่งแยกห้อง"
          : "สั่งลงบิลกรุ๊ป"
        : "สั่งอาหารรูมเซอร์วิส",
    ];
    const clientNote =
      typeof parsed.body.note === "string" ? parsed.body.note.trim() : "";
    if (clientNote) {
      orderNoteParts.push(clientNote);
    }
    const orderNote = orderNoteParts.join(" · ");

    const order = await prisma.order.create({
      data: {
        number: `ORD-${Date.now()}-${Math.random().toString(36).slice(2, 6).toUpperCase()}`,
        status: OrderStatus.PENDING,
        roomId: targetRoomId,
        bookingId: booking.id,
        note: orderNote,
        items: {
          create: [...grouped.values()].map((item) =>
            item.productId
              ? {
                  productId: item.productId,
                  customName: null,
                  quantity: item.quantity,
                  unitPrice: productMap.get(item.productId)!.price,
                  note: item.note,
                  isExtra: item.isExtra,
                }
              : {
                  productId: null,
                  customName: item.customName,
                  quantity: item.quantity,
                  unitPrice: item.customUnitPrice ?? 0,
                  note: item.note,
                  isExtra: item.isExtra,
                },
          ),
        },
      },
      select: { id: true, number: true, status: true, roomId: true },
    });

    await recordAuditLog({
      actor: {
        employeeId: currentUser?.employee?.id,
        authUserId: currentUser?.user.id,
      },
      action: "ORDER_CREATED",
      entityType: "ORDER",
      entityId: order.id,
      metadata: {
        bookingId,
        status: order.status,
        roomId: order.roomId,
        chargeTo: order.roomId ? "room" : "group",
        itemCount: [...grouped.values()].length,
      },
    });

    return NextResponse.json(order, { status: 201 });
  } catch (error) {
    console.error("POST /api/orders failed", error);
    return apiErrorResponse(
      "ไม่สามารถบันทึกออเดอร์ได้",
      500,
      "INTERNAL_ERROR",
    );
  }
}
