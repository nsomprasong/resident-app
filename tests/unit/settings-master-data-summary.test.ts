import assert from "node:assert/strict";
import test from "node:test";

import { countActiveRecords } from "../../lib/settings/master-data-summary";

test("counts active and inactive records by isActive", () => {
  assert.deepEqual(
    countActiveRecords([
      { isActive: true },
      { isActive: false },
      { isActive: true },
    ]),
    { active: 2, inactive: 1 },
  );
});

test("counts active and inactive resource records by status", () => {
  assert.deepEqual(
    countActiveRecords(
      [{ status: "AVAILABLE" }, { status: "OCCUPIED" }, { status: "MAINTENANCE" }],
      ["AVAILABLE"],
    ),
    { active: 1, inactive: 2 },
  );
});
