import assert from "node:assert/strict";
import test from "node:test";

import {
  activeBookingConflictStatuses,
  availableRaftStatuses,
  availableRoomStatuses,
} from "../../lib/bookings/availability";

test("booking conflict policy only includes active booking statuses", () => {
  assert.deepEqual(activeBookingConflictStatuses, [
    "PENDING",
    "CONFIRMED",
    "CHECKED_IN",
  ]);
  assert.equal(activeBookingConflictStatuses.includes("CHECKED_OUT"), false);
  assert.equal(activeBookingConflictStatuses.includes("CANCELLED"), false);
});

test("resource availability policy only allows available room and raft statuses", () => {
  assert.deepEqual(availableRoomStatuses, ["AVAILABLE"]);
  assert.deepEqual(availableRaftStatuses, ["AVAILABLE"]);
});
