import { expect, test } from "@playwright/test";

import {
  availableRaftStatuses,
  availableRoomStatuses,
  bookableRaftStatuses,
  bookableRoomStatuses,
} from "../../lib/bookings/availability";

test("physical resource status policy only treats AVAILABLE as free-now", () => {
  expect(availableRoomStatuses).toEqual(["AVAILABLE"]);
  expect(availableRoomStatuses).not.toContain("OCCUPIED");
  expect(availableRoomStatuses).not.toContain("CLEANING");
  expect(availableRoomStatuses).not.toContain("MAINTENANCE");

  expect(availableRaftStatuses).toEqual(["AVAILABLE"]);
  expect(availableRaftStatuses).not.toContain("MAINTENANCE");
});

test("date-range booking allows OCCUPIED/CLEANING rooms, blocks MAINTENANCE", () => {
  expect(bookableRoomStatuses).toEqual(["AVAILABLE", "OCCUPIED", "CLEANING"]);
  expect(bookableRoomStatuses).not.toContain("MAINTENANCE");
  expect(bookableRaftStatuses).toEqual(["AVAILABLE"]);
});
