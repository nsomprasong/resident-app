import assert from "node:assert/strict";
import test from "node:test";

import {
  canTransitionOrderStatus,
  cancelUnfinishedOrdersForBooking,
  getNextKitchenStatuses,
  kitchenVisibleStatuses,
  unfinishedKitchenOrderStatuses,
} from "../../lib/orders/kitchen-workflow";

test("kitchen visible statuses exclude completed terminal states", () => {
  assert.deepEqual(kitchenVisibleStatuses, ["PENDING", "PREPARING", "READY"]);
  assert.equal(kitchenVisibleStatuses.includes("DELIVERED"), false);
  assert.equal(kitchenVisibleStatuses.includes("CANCELLED"), false);
});

test("unfinished kitchen statuses match visible prep board", () => {
  assert.deepEqual(unfinishedKitchenOrderStatuses, kitchenVisibleStatuses);
});

test("cancelUnfinishedOrdersForBooking updates only unfinished statuses", async () => {
  const calls: Array<{ where: unknown; data: unknown }> = [];
  const tx = {
    order: {
      updateMany: async (args: { where: unknown; data: unknown }) => {
        calls.push(args);
        return { count: 2 };
      },
    },
  };

  const result = await cancelUnfinishedOrdersForBooking(
    tx as never,
    "booking-1",
  );

  assert.equal(result.count, 2);
  assert.equal(calls.length, 1);
  assert.deepEqual(calls[0], {
    where: {
      bookingId: "booking-1",
      status: { in: unfinishedKitchenOrderStatuses },
    },
    data: { status: "CANCELLED" },
  });
});

test("kitchen workflow allows forward preparation and delivery transitions", () => {
  assert.equal(canTransitionOrderStatus("PENDING", "PREPARING"), true);
  assert.equal(canTransitionOrderStatus("PREPARING", "READY"), true);
  assert.equal(canTransitionOrderStatus("READY", "DELIVERED"), true);
});

test("kitchen workflow rejects skipped or terminal transitions", () => {
  assert.equal(canTransitionOrderStatus("PENDING", "READY"), false);
  assert.equal(canTransitionOrderStatus("READY", "PREPARING"), false);
  assert.equal(canTransitionOrderStatus("DELIVERED", "CANCELLED"), false);
  assert.deepEqual(getNextKitchenStatuses("DELIVERED"), []);
});
