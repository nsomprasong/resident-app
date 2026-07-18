import assert from "node:assert/strict";
import test from "node:test";

import {
  activeBookingConflictStatuses,
  availableRaftStatuses,
  availableRoomStatuses,
  bookableRaftStatuses,
  bookableRoomStatuses,
  bookingNightsOverlap,
  isRoomBookedForDateRange,
} from "../../lib/bookings/availability";

const day = (value: string) => new Date(`${value}T00:00:00.000Z`);

test("booking conflict policy only includes active booking statuses", () => {
  assert.deepEqual(activeBookingConflictStatuses, [
    "PENDING",
    "CONFIRMED",
    "CHECKED_IN",
  ]);
  assert.equal(activeBookingConflictStatuses.includes("CHECKED_OUT"), false);
  assert.equal(activeBookingConflictStatuses.includes("CANCELLED"), false);
});

test("physical availability statuses stay AVAILABLE-only for dashboard", () => {
  assert.deepEqual(availableRoomStatuses, ["AVAILABLE"]);
  assert.deepEqual(availableRaftStatuses, ["AVAILABLE"]);
});

test("date-range booking allows OCCUPIED/CLEANING rooms but not MAINTENANCE", () => {
  assert.deepEqual(bookableRoomStatuses, [
    "AVAILABLE",
    "OCCUPIED",
    "CLEANING",
  ]);
  assert.equal(bookableRoomStatuses.includes("MAINTENANCE"), false);
  assert.deepEqual(bookableRaftStatuses, ["AVAILABLE"]);
});

test("night occupancy excludes checkout day so back-to-back stays do not overlap", () => {
  const first = { checkIn: day("2026-07-18"), checkOut: day("2026-07-19") };
  const next = { checkIn: day("2026-07-19"), checkOut: day("2026-07-20") };
  const longer = { checkIn: day("2026-07-18"), checkOut: day("2026-07-20") };

  assert.equal(bookingNightsOverlap(first, next), false);
  assert.equal(bookingNightsOverlap(next, first), false);
  assert.equal(bookingNightsOverlap(longer, next), true);
  assert.equal(bookingNightsOverlap(first, longer), true);
});

test("room booked flag ignores OCCUPIED when no booking conflict", () => {
  assert.equal(
    isRoomBookedForDateRange({
      hasForeignBookingConflict: false,
      status: "OCCUPIED",
    }),
    false,
  );
  assert.equal(
    isRoomBookedForDateRange({
      hasForeignBookingConflict: false,
      status: "CLEANING",
    }),
    false,
  );
  assert.equal(
    isRoomBookedForDateRange({
      hasForeignBookingConflict: false,
      status: "MAINTENANCE",
    }),
    true,
  );
  assert.equal(
    isRoomBookedForDateRange({
      hasForeignBookingConflict: true,
      status: "AVAILABLE",
    }),
    true,
  );
});
