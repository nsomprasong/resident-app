import assert from "node:assert/strict";
import { describe, it } from "node:test";

import {
  readSessionEpochFromAccessToken,
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

  it("reads session_epoch from access token payload", () => {
    const payload = Buffer.from(
      JSON.stringify({ app_metadata: { session_epoch: 7 } }),
      "utf8",
    ).toString("base64url");
    assert.equal(readSessionEpochFromAccessToken(`x.${payload}.y`), 7);
    assert.equal(readSessionEpochFromAccessToken("not-a-jwt"), 0);
  });
});
