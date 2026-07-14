import assert from "node:assert/strict";
import { describe, it } from "node:test";

import { buildAuditLogWhere } from "@/lib/system/audit-log-query";

describe("audit-logs list filters", () => {
  it("builds an empty where when no filters are set", () => {
    assert.deepEqual(buildAuditLogWhere({}), {});
  });

  it("filters by action and entity type", () => {
    const where = buildAuditLogWhere({
      action: "DATA_RESET_EXECUTED",
      entityType: "SYSTEM",
    });
    assert.deepEqual(where, {
      AND: [
        { action: { equals: "DATA_RESET_EXECUTED" } },
        { entityType: { equals: "SYSTEM" } },
      ],
    });
  });

  it("adds a text search branch when q is provided", () => {
    const where = buildAuditLogWhere({ q: "employee" });
    assert.ok("AND" in where);
    const and = where.AND;
    assert.ok(Array.isArray(and));
    assert.equal(and.length, 1);
    assert.ok("OR" in and[0]);
  });
});
