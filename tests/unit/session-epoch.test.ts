import assert from "node:assert/strict";
import { describe, it } from "node:test";

import {
  readSessionEpochFromClaims,
  sessionEpochMatches,
} from "@/lib/auth/session-epoch";

describe("session-epoch helpers", () => {
  it("defaults missing claim to 0", () => {
    assert.equal(readSessionEpochFromClaims(null), 0);
    assert.equal(readSessionEpochFromClaims({}), 0);
    assert.equal(sessionEpochMatches({}, 0), true);
    assert.equal(sessionEpochMatches({}, 1), false);
  });

  it("reads numeric and string claim values", () => {
    assert.equal(
      readSessionEpochFromClaims({ app_metadata: { session_epoch: 3 } }),
      3,
    );
    assert.equal(
      readSessionEpochFromClaims({ app_metadata: { session_epoch: "4" } }),
      4,
    );
  });
});
