import assert from "node:assert/strict";
import { describe, it } from "node:test";

import {
  addDaysToOpsDateKey,
  resolveOpsDateKey,
  summarizeTodayOps,
} from "@/lib/dashboard/today-ops";

describe("summarizeTodayOps", () => {
  it("counts rooms, groups, rafts, guests and food for today", () => {
    const summary = summarizeTodayOps({
      todayKey: "2026-07-13",
      bookings: [
        {
          checkIn: new Date("2026-07-13T00:00:00.000Z"),
          checkOut: new Date("2026-07-15T00:00:00.000Z"),
          tourGroupId: "g1",
          guestCount: 20,
          roomCount: 4,
          raftCount: 2,
        },
        {
          checkIn: new Date("2026-07-12T00:00:00.000Z"),
          checkOut: new Date("2026-07-14T00:00:00.000Z"),
          tourGroupId: "g1",
          guestCount: 2,
          roomCount: 1,
          raftCount: 0,
        },
        {
          checkIn: new Date("2026-07-13T00:00:00.000Z"),
          checkOut: new Date("2026-07-14T00:00:00.000Z"),
          tourGroupId: null,
          guestCount: 3,
          roomCount: 1,
          raftCount: 1,
        },
      ],
      foodItems: [
        { quantity: 2, isMinibar: false },
        { quantity: 1, isMinibar: false },
        { quantity: 3, isMinibar: true },
      ],
      foodProductIds: ["p1", "p2", "p1"],
    });

    assert.equal(summary.roomsCheckInToday, 5);
    assert.equal(summary.roomsInHouse, 6);
    assert.equal(summary.tourGroupsToday, 1);
    assert.equal(summary.raftsToday, 3);
    assert.equal(summary.guestsToday, 25);
    assert.equal(summary.foodPortionsToday, 3);
    assert.equal(summary.foodKindsToday, 2);
    assert.equal(summary.minibarPortionsToday, 3);
    assert.equal(summary.checkInBookingCount, 2);
    assert.equal(summary.inHouseBookingCount, 3);
  });

  it("summarizes only the current open bookings passed in by the page", () => {
    const summary = summarizeTodayOps({
      todayKey: "2026-07-13",
      bookings: [
        {
          checkIn: new Date("2026-07-13T00:00:00.000Z"),
          checkOut: new Date("2026-07-14T00:00:00.000Z"),
          tourGroupId: "current",
          guestCount: 10,
          roomCount: 2,
          raftCount: 1,
        },
      ],
      foodItems: [{ quantity: 4, isMinibar: false }],
      foodProductIds: ["curry"],
    });

    assert.equal(summary.tourGroupsToday, 1);
    assert.equal(summary.roomsInHouse, 2);
    assert.equal(summary.foodPortionsToday, 4);
    assert.equal(summary.inHouseBookingCount, 1);
  });
});

describe("ops date navigation helpers", () => {
  it("resolves valid date keys and falls back for invalid ones", () => {
    assert.equal(resolveOpsDateKey("2026-07-15", "2026-07-14"), "2026-07-15");
    assert.equal(resolveOpsDateKey("2026-02-31", "2026-07-14"), "2026-07-14");
    assert.equal(resolveOpsDateKey("bad", "2026-07-14"), "2026-07-14");
  });

  it("adds days from the currently displayed date key", () => {
    assert.equal(addDaysToOpsDateKey("2026-07-14", 1), "2026-07-15");
    assert.equal(addDaysToOpsDateKey("2026-07-31", 1), "2026-08-01");
  });
});
