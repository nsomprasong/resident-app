import assert from "node:assert/strict";
import { describe, it } from "node:test";

import { resolveApiPermission } from "@/lib/auth/authorization";
import {
  canTransitionPaymentStatus,
} from "@/lib/payments/promptpay-workflow";

describe("promptpay unverify", () => {
  it("allows VERIFIED to return to PENDING_VERIFICATION", () => {
    assert.equal(
      canTransitionPaymentStatus("VERIFIED", "PENDING_VERIFICATION"),
      true,
    );
  });

  it("still allows refund transitions from VERIFIED", () => {
    assert.equal(canTransitionPaymentStatus("VERIFIED", "REFUNDED"), true);
    assert.equal(
      canTransitionPaymentStatus("VERIFIED", "PARTIALLY_REFUNDED"),
      true,
    );
  });

  it("maps unverify API to payment.verify", () => {
    assert.equal(
      resolveApiPermission(
        "POST",
        "/api/bookings/00000000-0000-0000-0000-000000000001/promptpay-payments/00000000-0000-0000-0000-000000000002/unverify",
      ),
      "payment.verify",
    );
  });
});
