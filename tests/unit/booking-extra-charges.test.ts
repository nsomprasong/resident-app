import assert from "node:assert/strict";
import { describe, it } from "node:test";

import { resolveApiPermission } from "@/lib/auth/authorization";
import { parseBookingChargeTemplateInput } from "@/lib/bookings/charge-templates";
import {
  extraChargeLineTotal,
  parseBookingExtraCharges,
} from "@/lib/bookings/extra-charges";

describe("booking extra charges", () => {
  it("parses valid charge rows and skips empty/zero rows", () => {
    const result = parseBookingExtraCharges(
      [
        { description: "ค่าแก๊ส", amount: 150, type: "OTHER" },
        { description: "ค่าทำความสะอาด", amount: 0, type: "CLEANING" },
        { description: "", amount: 0, type: "OTHER" },
      ],
      "extraCharges",
    );
    assert.equal(result.ok, true);
    if (!result.ok) return;
    assert.deepEqual(result.charges, [
      { description: "ค่าแก๊ส", amount: 150, type: "OTHER" },
    ]);
  });

  it("multiplies unit price by quantity", () => {
    const result = parseBookingExtraCharges(
      [{ description: "ค่าน้ำแข็ง", amount: 50, quantity: 3, type: "OTHER" }],
      "extraCharges",
    );
    assert.equal(result.ok, true);
    if (!result.ok) return;
    assert.deepEqual(result.charges, [
      { description: "ค่าน้ำแข็ง x3", amount: 150, type: "OTHER" },
    ]);
    assert.equal(extraChargeLineTotal({ amount: 50, quantity: 3 }), 150);
  });

  it("rejects invalid amounts", () => {
    const result = parseBookingExtraCharges(
      [{ description: "ค่าถ่าน", amount: -1, type: "OTHER" }],
      "charges",
    );
    assert.equal(result.ok, false);
  });

  it("rejects invalid quantity", () => {
    const result = parseBookingExtraCharges(
      [{ description: "ค่าถ่าน", amount: 20, quantity: 0, type: "OTHER" }],
      "charges",
    );
    assert.equal(result.ok, false);
  });

  it("maps charges API to booking.write", () => {
    assert.equal(
      resolveApiPermission(
        "POST",
        "/api/bookings/00000000-0000-0000-0000-000000000000/charges",
      ),
      "booking.write",
    );
  });

  it("parses charge template upsert payload", () => {
    const result = parseBookingChargeTemplateInput({
      name: " ค่าแก๊ส ",
      defaultAmount: 120,
      type: "OTHER",
    });
    assert.equal(result.ok, true);
    if (!result.ok) return;
    assert.deepEqual(result.data, {
      name: "ค่าแก๊ส",
      defaultAmount: 120,
      type: "OTHER",
      isActive: true,
    });
  });

  it("maps charge template APIs to booking permissions", () => {
    assert.equal(
      resolveApiPermission("GET", "/api/booking-charge-templates"),
      "booking.read",
    );
    assert.equal(
      resolveApiPermission("POST", "/api/booking-charge-templates"),
      "booking.write",
    );
    assert.equal(
      resolveApiPermission(
        "PATCH",
        "/api/booking-charge-templates/00000000-0000-0000-0000-000000000001",
      ),
      "booking.write",
    );
    assert.equal(
      resolveApiPermission(
        "DELETE",
        "/api/booking-charge-templates/00000000-0000-0000-0000-000000000001",
      ),
      "booking.write",
    );
  });
});
