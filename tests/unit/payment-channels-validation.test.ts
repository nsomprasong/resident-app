import assert from "node:assert/strict";
import { describe, it } from "node:test";

import { parsePaymentChannelInput } from "@/lib/settings/payment-channels";

describe("parsePaymentChannelInput", () => {
  it("requires fields on create", () => {
    const result = parsePaymentChannelInput({}, "create");
    assert.equal(result.ok, false);
  });

  it("accepts valid create payload", () => {
    const result = parsePaymentChannelInput(
      {
        name: " โอนธนาคาร ",
        method: "TRANSFER",
      },
      "create",
    );
    assert.equal(result.ok, true);
    if (result.ok) {
      assert.equal(result.data.name, "โอนธนาคาร");
      assert.equal(result.data.method, "TRANSFER");
    }
  });

  it("allows isActive-only update", () => {
    const result = parsePaymentChannelInput({ isActive: false }, "update");
    assert.equal(result.ok, true);
  });
});
