import assert from "node:assert/strict";
import test from "node:test";

import { money } from "../../lib/pos/money";

test("POS stock arithmetic retains three decimal places", () => {
  assert.equal(money("10.005").minus(money("0.005")).toFixed(3), "10.000");
});
