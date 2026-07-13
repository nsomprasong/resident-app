import { expect, test } from "@playwright/test";

import { activeBookingConflictStatuses } from "../../lib/bookings/availability";

test("booking resource conflicts only consider active booking statuses", () => {
  expect(activeBookingConflictStatuses).toEqual([
    "PENDING",
    "CONFIRMED",
    "CHECKED_IN",
  ]);
  expect(activeBookingConflictStatuses).not.toContain("CHECKED_OUT");
  expect(activeBookingConflictStatuses).not.toContain("CANCELLED");
});
