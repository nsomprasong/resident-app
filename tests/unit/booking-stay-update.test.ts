import assert from "node:assert/strict";
import { describe, it } from "node:test";

import {
  StayResourceConflictError,
  formatNightDeltaDescription,
  parseStayDatesInput,
  parseStayResourceFlags,
} from "@/lib/bookings/stay-update";
import { bookingNights } from "@/lib/bookings/pricing-flags";

describe("booking stay update", () => {
  it("parses stay dates", () => {
    const result = parseStayDatesInput({
      checkIn: "2026-07-20",
      checkOut: "2026-07-22",
    });
    assert.equal(result.ok, true);
    if (!result.ok) return;
    assert.equal(result.checkInText, "2026-07-20");
    assert.equal(result.checkOutText, "2026-07-22");
    assert.equal(bookingNights(result.checkIn, result.checkOut), 2);
  });

  it("rejects invalid stay dates", () => {
    assert.equal(
      parseStayDatesInput({ checkIn: "2026-07-22", checkOut: "2026-07-20" })
        .ok,
      false,
    );
  });

  it("formats night delta charge descriptions", () => {
    assert.equal(
      formatNightDeltaDescription("room", "12", 1),
      "ปรับวันเข้าพัก ห้อง 12 · +1 คืน",
    );
    assert.equal(
      formatNightDeltaDescription("raft", "แพ A", -2),
      "ปรับวันเข้าพัก แพ แพ A · -2 คืน",
    );
  });

  it("parses stay resource flags", () => {
    const result = parseStayResourceFlags(
      [
        { id: "a", isExtra: false },
        { id: "b", isExtra: true },
      ],
      "rooms",
    );
    assert.equal(result.ok, true);
    if (!result.ok) return;
    assert.equal(result.items.length, 2);
  });

  it("exposes structured resource conflict payload", () => {
    const error = new StayResourceConflictError({
      conflicts: {
        rooms: [{ id: "1", number: "12" }],
        rafts: [],
      },
      keepable: {
        rooms: [{ id: "2", number: "13", isExtra: false }],
        rafts: [],
      },
    });
    assert.equal(error.message, "RESOURCE_CONFLICT");
    assert.equal(error.payload.conflicts.rooms[0]?.number, "12");
    assert.equal(error.payload.keepable.rooms[0]?.number, "13");
  });
});
