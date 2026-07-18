import assert from "node:assert/strict";
import { describe, it } from "node:test";

import {
  compareRoomNumbers,
  sortRoomsByZoneAndNumber,
} from "@/lib/bookings/room-sort";

describe("room-sort", () => {
  it("sorts room numbers by numeric meaning", () => {
    const numbers = ["10", "2", "1", "21", "3"];
    assert.deepEqual(
      [...numbers].sort(compareRoomNumbers),
      ["1", "2", "3", "10", "21"],
    );
  });

  it("sorts prefixed room numbers numerically", () => {
    const numbers = ["B10", "B2", "A1", "B1"];
    assert.deepEqual(
      [...numbers].sort(compareRoomNumbers),
      ["A1", "B1", "B2", "B10"],
    );
  });

  it("sorts by zone then numeric room number", () => {
    const rooms = [
      { id: "1", number: "10", zone: { name: "B" } },
      { id: "2", number: "2", zone: { name: "A" } },
      { id: "3", number: "1", zone: { name: "B" } },
      { id: "4", number: "1", zone: { name: "A" } },
    ];
    assert.deepEqual(
      sortRoomsByZoneAndNumber(rooms).map((room) => `${room.zone.name}:${room.number}`),
      ["A:1", "A:2", "B:1", "B:10"],
    );
  });
});
