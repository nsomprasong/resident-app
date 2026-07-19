import { OrderStatus } from "@/generated/prisma/client";
import {
  apiErrorResponse,
  readJsonObject,
  validationErrorResponse,
  type ValidationIssue,
} from "@/lib/api/validation";
import { getCurrentUser } from "@/lib/auth/current-user";
import { recordAuditLog } from "@/lib/audit/audit-log";
import { prisma } from "@/lib/prisma";
import { NextRequest, NextResponse } from "next/server";

export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ itemId: string }> },
) {
  try {
    const { itemId } = await params;
    const currentUser = await getCurrentUser();
    const parsed = await readJsonObject(request);
    if (!parsed.ok) return parsed.response;

    const issues: ValidationIssue[] = [];
    const quantityValue = parsed.body.quantity;
    const isExtraValue = parsed.body.isExtra;
    const hasQuantity = quantityValue !== undefined;
    const hasIsExtra = isExtraValue !== undefined;

    if (!hasQuantity && !hasIsExtra) {
      issues.push({
        path: "body",
        message: "quantity or isExtra is required",
      });
    }

    if (hasQuantity) {
      if (
        typeof quantityValue !== "number" ||
        !Number.isInteger(quantityValue) ||
        quantityValue < 0
      ) {
        issues.push({
          path: "quantity",
          message: "Quantity must be a non-negative integer",
        });
      }
    }

    if (hasIsExtra && typeof isExtraValue !== "boolean") {
      issues.push({
        path: "isExtra",
        message: "isExtra must be boolean",
      });
    }

    if (issues.length) {
      return validationErrorResponse("ข้อมูลรายการอาหารไม่ถูกต้อง", issues);
    }

    const quantity = hasQuantity ? (quantityValue as number) : undefined;
    const requestedIsExtra = hasIsExtra
      ? (isExtraValue as boolean)
      : undefined;

    const result = await prisma.$transaction(async (tx) => {
      const item = await tx.orderItem.findUnique({
        where: { id: itemId },
        include: {
          order: {
            select: {
              id: true,
              number: true,
              status: true,
              bookingId: true,
              booking: { select: { status: true, tourGroupId: true } },
            },
          },
          product: { select: { name: true } },
        },
      });
      if (!item) throw new Error("NOT_FOUND");
      if (
        !item.order.bookingId ||
        !item.order.booking ||
        item.order.booking.status === "CANCELLED" ||
        item.order.booking.status === "CHECKED_OUT"
      ) {
        throw new Error("BOOKING_CLOSED");
      }
      if (item.order.status !== OrderStatus.PENDING) {
        throw new Error("ORDER_LOCKED");
      }

      const isGroup = Boolean(item.order.booking.tourGroupId);
      const nextIsExtra =
        requestedIsExtra === undefined
          ? item.isExtra
          : isGroup
            ? requestedIsExtra
            : true;

      if (quantity === 0) {
        await tx.orderItem.delete({ where: { id: itemId } });
        const remaining = await tx.orderItem.count({
          where: { orderId: item.orderId },
        });
        if (remaining === 0) {
          await tx.order.update({
            where: { id: item.orderId },
            data: { status: OrderStatus.CANCELLED },
          });
        }
        return {
          id: itemId,
          deleted: true,
          quantity: 0,
          isExtra: item.isExtra,
          orderId: item.orderId,
          productName: item.customName ?? item.product?.name ?? "เมนูพิเศษ",
        };
      }

      const updated = await tx.orderItem.update({
        where: { id: itemId },
        data: {
          ...(quantity !== undefined ? { quantity } : {}),
          ...(requestedIsExtra !== undefined ? { isExtra: nextIsExtra } : {}),
        },
        select: { id: true, quantity: true, isExtra: true, orderId: true },
      });

      return {
        ...updated,
        deleted: false,
        productName: item.customName ?? item.product?.name ?? "เมนูพิเศษ",
      };
    });

    await recordAuditLog({
      actor: {
        employeeId: currentUser?.employee?.id,
        authUserId: currentUser?.user.id,
      },
      action: result.deleted ? "ORDER_ITEM_REMOVED" : "ORDER_ITEM_UPDATED",
      entityType: "ORDER_ITEM",
      entityId: itemId,
      metadata: {
        orderId: result.orderId,
        quantity: result.quantity,
        isExtra: result.isExtra,
        productName: result.productName,
        deleted: result.deleted,
      },
    });

    return NextResponse.json(result);
  } catch (error) {
    const message = error instanceof Error ? error.message : "";
    if (message === "NOT_FOUND") {
      return apiErrorResponse("ไม่พบรายการอาหาร", 404, "NOT_FOUND");
    }
    if (message === "BOOKING_CLOSED") {
      return apiErrorResponse(
        "ไม่สามารถแก้ไขรายการของงานที่ปิดแล้ว",
        400,
        "BOOKING_CLOSED",
      );
    }
    if (message === "ORDER_LOCKED") {
      return apiErrorResponse(
        "ออเดอร์นี้เริ่มทำครัวแล้ว แก้ไขไม่ได้",
        409,
        "ORDER_LOCKED",
      );
    }
    console.error("PATCH /api/order-items/[itemId] failed", error);
    return apiErrorResponse(
      "ไม่สามารถอัปเดตรายการอาหารได้",
      500,
      "INTERNAL_ERROR",
    );
  }
}
