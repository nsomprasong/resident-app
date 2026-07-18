import assert from "node:assert/strict";
import { describe, it } from "node:test";

import { resolveApiPermission } from "@/lib/auth/authorization";
import {
  bookingNights,
  parsePricingFlagInputs,
} from "@/lib/bookings/pricing-flags";

describe("booking pricing flags", () => {
  it("parses pricing flag inputs and dedupes by id", () => {
    const result = parsePricingFlagInputs(
      [
        { id: "a", isExtra: true },
        { id: "a", isExtra: false },
        { id: "b", isExtra: true },
      ],
      "rooms",
    );
    assert.equal(result.ok, true);
    if (!result.ok) return;
    assert.deepEqual(result.items, [
      { id: "a", isExtra: false },
      { id: "b", isExtra: true },
    ]);
  });

  it("rejects invalid pricing flag entries", () => {
    const result = parsePricingFlagInputs([{ id: "a" }], "rooms");
    assert.equal(result.ok, false);
  });

  it("computes booking nights", () => {
    assert.equal(
      bookingNights(
        new Date("2026-07-01T00:00:00.000Z"),
        new Date("2026-07-03T00:00:00.000Z"),
      ),
      2,
    );
  });

  it("maps pricing API to resource.manage or order.write", () => {
    assert.deepEqual(
      resolveApiPermission(
        "PATCH",
        "/api/bookings/00000000-0000-0000-0000-000000000000/pricing",
      ),
      { anyOf: ["resource.manage", "order.write"] },
    );
  });
});
