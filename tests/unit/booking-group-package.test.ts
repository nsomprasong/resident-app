import assert from "node:assert/strict";
import { describe, it } from "node:test";

import { resolveApiPermission } from "@/lib/auth/authorization";
import {
  formatGroupPackageDescription,
  groupPackageAmount,
  isGroupPackageChargeDescription,
  parseGroupPackageInput,
} from "@/lib/bookings/group-package";

describe("booking group package", () => {
  it("formats and detects package charge description", () => {
    const description = formatGroupPackageDescription(12, 1500);
    assert.equal(description, "ราคาเหมากลุ่ม 12 คน × ฿1500");
    assert.equal(isGroupPackageChargeDescription(description), true);
    assert.equal(isGroupPackageChargeDescription("ค่าถ่าน"), false);
  });

  it("computes package amount", () => {
    assert.equal(groupPackageAmount(3, 1200.5), 3601.5);
  });

  it("parses valid guestCount and pricePerPerson", () => {
    const result = parseGroupPackageInput({
      guestCount: 8,
      pricePerPerson: 999.999,
    });
    assert.equal(result.ok, true);
    if (!result.ok) return;
    assert.equal(result.guestCount, 8);
    assert.equal(result.pricePerPerson, 1000);
    assert.equal(result.amount, 8000);
    assert.equal(result.description, "ราคาเหมากลุ่ม 8 คน × ฿1000");
  });

  it("rejects invalid package input", () => {
    const zeroGuests = parseGroupPackageInput({
      guestCount: 0,
      pricePerPerson: 100,
    });
    assert.equal(zeroGuests.ok, false);

    const fractionalGuests = parseGroupPackageInput({
      guestCount: 1.5,
      pricePerPerson: 100,
    });
    assert.equal(fractionalGuests.ok, false);

    const negativePrice = parseGroupPackageInput({
      guestCount: 2,
      pricePerPerson: -1,
    });
    assert.equal(negativePrice.ok, false);
  });

  it("maps package API to booking.write", () => {
    assert.equal(
      resolveApiPermission(
        "PATCH",
        "/api/bookings/00000000-0000-0000-0000-000000000000/package",
      ),
      "booking.write",
    );
  });
});
