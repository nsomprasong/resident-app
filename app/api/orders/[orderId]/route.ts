import { OrderStatus } from "@/generated/prisma/client";
import {
  apiErrorResponse,
  readJsonObject,
  validationErrorResponse,
  type ValidationIssue,
} from "@/lib/api/validation";
import { getCurrentUser } from "@/lib/auth/current-user";
import { recordAuditLog } from "@/lib/audit/audit-log";
import { canTransitionOrderStatus } from "@/lib/orders/kitchen-workflow";
import { prisma } from "@/lib/prisma";
import { NextRequest, NextResponse } from "next/server";

export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ orderId: string }> },
) {
  try {
    const { orderId } = await params;
    const currentUser = await getCurrentUser();
    const parsed = await readJsonObject(request);
    if (!parsed.ok) return parsed.response;

    const issues: ValidationIssue[] = [];
    const statusValue = parsed.body.status;

    if (
      typeof statusValue !== "string" ||
      !Object.values(OrderStatus).includes(statusValue as OrderStatus)
    ) {
      issues.push({ path: "status", message: "Order status is invalid" });
    }

    if (issues.length) {
      return validationErrorResponse("สถานะออเดอร์ไม่ถูกต้อง", issues);
    }

    const nextStatus = statusValue as OrderStatus;
    const result = await prisma.$transaction(async (tx) => {
      const order = await tx.order.findUnique({
        where: { id: orderId },
        select: { id: true, number: true, status: true },
      });

      if (!order) throw new Error("NOT_FOUND");
      if (!canTransitionOrderStatus(order.status, nextStatus)) {
        throw new Error("INVALID_TRANSITION");
      }

      const updated = await tx.order.update({
        where: { id: orderId },
        data: { status: nextStatus },
        select: { id: true, number: true, status: true },
      });

      return { previousStatus: order.status, updated };
    });

    await recordAuditLog({
      actor: {
        employeeId: currentUser?.employee?.id,
        authUserId: currentUser?.user.id,
      },
      action: "ORDER_STATUS_UPDATED",
      entityType: "ORDER",
      entityId: result.updated.id,
      metadata: {
        number: result.updated.number,
        previousStatus: result.previousStatus,
        status: result.updated.status,
      },
    });

    return NextResponse.json(result.updated);
  } catch (error) {
    const message = error instanceof Error ? error.message : "";
    if (message === "NOT_FOUND") {
      return apiErrorResponse("ไม่พบออเดอร์", 404, "NOT_FOUND");
    }
    if (message === "INVALID_TRANSITION") {
      return apiErrorResponse(
        "ไม่สามารถเปลี่ยนสถานะออเดอร์ได้",
        409,
        "INVALID_TRANSITION",
      );
    }

    console.error("PATCH /api/orders/[orderId] failed", error);
    return apiErrorResponse(
      "ไม่สามารถอัปเดตสถานะออเดอร์ได้",
      500,
      "INTERNAL_ERROR",
    );
  }
}
