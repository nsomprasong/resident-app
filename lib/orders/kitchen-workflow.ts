import type { OrderStatus, Prisma } from "@/generated/prisma/client";

export const kitchenVisibleStatuses: OrderStatus[] = [
  "PENDING",
  "PREPARING",
  "READY",
];

/** Orders not yet delivered — cancelled when checkout is fully paid */
export const unfinishedKitchenOrderStatuses: OrderStatus[] = [
  "PENDING",
  "PREPARING",
  "READY",
];

const allowedTransitions: Readonly<Record<OrderStatus, readonly OrderStatus[]>> = {
  PENDING: ["PREPARING", "CANCELLED"],
  PREPARING: ["READY", "CANCELLED"],
  READY: ["DELIVERED", "CANCELLED"],
  DELIVERED: [],
  CANCELLED: [],
};

export function canTransitionOrderStatus(
  currentStatus: OrderStatus,
  nextStatus: OrderStatus,
) {
  return allowedTransitions[currentStatus].includes(nextStatus);
}

export function getNextKitchenStatuses(currentStatus: OrderStatus) {
  return allowedTransitions[currentStatus];
}

export async function cancelUnfinishedOrdersForBooking(
  tx: Prisma.TransactionClient,
  bookingId: string,
) {
  return tx.order.updateMany({
    where: {
      bookingId,
      status: { in: unfinishedKitchenOrderStatuses },
    },
    data: { status: "CANCELLED" },
  });
}
