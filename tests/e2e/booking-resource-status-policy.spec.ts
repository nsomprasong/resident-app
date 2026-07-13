import { expect, test } from "@playwright/test";

import {
  availableRaftStatuses,
  availableRoomStatuses,
} from "../../lib/bookings/availability";

test("booking resource status policy only allows available resources", () => {
  expect(availableRoomStatuses).toEqual(["AVAILABLE"]);
  expect(availableRoomStatuses).not.toContain("OCCUPIED");
  expect(availableRoomStatuses).not.toContain("CLEANING");
  expect(availableRoomStatuses).not.toContain("MAINTENANCE");

  expect(availableRaftStatuses).toEqual(["AVAILABLE"]);
  expect(availableRaftStatuses).not.toContain("MAINTENANCE");
});
