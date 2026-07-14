import assert from "node:assert/strict";
import { describe, it } from "node:test";

import {
  DATA_RESET_CONFIRM_PHRASE,
  masterResetTargets,
  orderDataResetTargets,
  resolveDataResetTargets,
  serviceResetTargets,
  supermarketResetTargets,
} from "../../lib/system/data-reset";

describe("data-reset target resolution", () => {
  it("expands all service, master, and supermarket targets", () => {
    assert.deepEqual(
      resolveDataResetTargets("service", "all"),
      { ok: true, targets: [...serviceResetTargets] },
    );
    assert.deepEqual(
      resolveDataResetTargets("master", "all"),
      { ok: true, targets: [...masterResetTargets] },
    );
    assert.deepEqual(
      resolveDataResetTargets("supermarket", "all"),
      { ok: true, targets: [...supermarketResetTargets] },
    );
  });

  it("accepts selected targets and rejects cross-category values", () => {
    assert.deepEqual(resolveDataResetTargets("service", ["guests", "bookings"]), {
      ok: true,
      targets: ["guests", "bookings"],
    });
    assert.equal(resolveDataResetTargets("service", ["rooms"]).ok, false);
    assert.equal(resolveDataResetTargets("master", ["bookings"]).ok, false);
    assert.equal(resolveDataResetTargets("supermarket", ["products"]).ok, false);
    assert.equal(
      resolveDataResetTargets("supermarket", ["posSales", "posProducts"]).ok,
      true,
    );
    assert.equal(resolveDataResetTargets("service", []).ok, false);
  });

  it("orders deletes to satisfy foreign keys", () => {
    assert.deepEqual(
      orderDataResetTargets("service", ["tourGroups", "bookings", "guests"]),
      ["bookings", "guests", "tourGroups"],
    );
    assert.deepEqual(
      orderDataResetTargets("master", ["zones", "rooms", "products"]),
      ["products", "rooms", "zones"],
    );
    assert.deepEqual(
      orderDataResetTargets("supermarket", [
        "posCategories",
        "posSales",
        "posProducts",
      ]),
      ["posSales", "posProducts", "posCategories"],
    );
  });

  it("keeps a Thai confirm phrase for destructive reset", () => {
    assert.equal(DATA_RESET_CONFIRM_PHRASE, "ล้างข้อมูล");
  });

  it("places audit log wipe after booking-related targets", () => {
    assert.deepEqual(
      orderDataResetTargets("service", ["auditLogs", "bookings", "guests"]),
      ["bookings", "guests", "auditLogs"],
    );
  });
});
