import assert from "node:assert/strict";
import { describe, it } from "node:test";

import {
  DATA_RESET_CONFIRM_PHRASE,
  expandDataResetTargets,
  hrResetTargets,
  masterResetTargets,
  orderDataResetTargets,
  resolveDataResetTargets,
  serviceResetTargets,
  supermarketResetTargets,
  systemResetTargets,
} from "../../lib/system/data-reset";

describe("data-reset target resolution", () => {
  it("expands all category targets", () => {
    assert.deepEqual(resolveDataResetTargets("service", "all"), {
      ok: true,
      targets: [...serviceResetTargets],
    });
    assert.deepEqual(resolveDataResetTargets("hr", "all"), {
      ok: true,
      targets: [...hrResetTargets],
    });
    assert.deepEqual(resolveDataResetTargets("master", "all"), {
      ok: true,
      targets: [...masterResetTargets],
    });
    assert.deepEqual(resolveDataResetTargets("supermarket", "all"), {
      ok: true,
      targets: [...supermarketResetTargets],
    });
    assert.deepEqual(resolveDataResetTargets("system", "all"), {
      ok: true,
      targets: [...systemResetTargets],
    });
  });

  it("accepts selected targets and rejects cross-category values", () => {
    assert.deepEqual(resolveDataResetTargets("service", ["guests", "bookings"]), {
      ok: true,
      targets: ["bookings", "guests"],
    });
    assert.equal(resolveDataResetTargets("service", ["rooms"]).ok, false);
    assert.equal(resolveDataResetTargets("service", ["employees"]).ok, false);
    assert.equal(resolveDataResetTargets("master", ["bookings"]).ok, false);
    assert.equal(resolveDataResetTargets("hr", ["bookings"]).ok, false);
    assert.equal(resolveDataResetTargets("supermarket", ["products"]).ok, false);
    assert.equal(
      resolveDataResetTargets("supermarket", ["posSales", "posProducts"]).ok,
      true,
    );
    assert.equal(resolveDataResetTargets("system", ["auditLogs"]).ok, true);
    assert.equal(resolveDataResetTargets("service", []).ok, false);
  });

  it("auto-expands prerequisites so FK order can succeed", () => {
    assert.deepEqual(expandDataResetTargets("service", ["guests"]), [
      "bookings",
      "guests",
    ]);
    assert.deepEqual(expandDataResetTargets("hr", ["hrLeaveTypes"]), [
      "hrLeave",
      "hrLeaveTypes",
    ]);
    assert.deepEqual(expandDataResetTargets("hr", ["hrShiftTemplates"]), [
      "hrAttendance",
      "hrSchedules",
      "hrShiftTemplates",
    ]);
    assert.ok(
      expandDataResetTargets("hr", ["employees"]).includes("hrAttendance"),
    );
    assert.ok(expandDataResetTargets("hr", ["employees"]).includes("hrPayroll"));
    assert.deepEqual(expandDataResetTargets("master", ["zones"]), [
      "rooms",
      "zones",
    ]);
    assert.deepEqual(expandDataResetTargets("master", ["rafts"]), [
      "rooms",
      "rafts",
    ]);
    assert.deepEqual(expandDataResetTargets("master", ["productTypes"]), [
      "products",
      "productTypes",
    ]);
    assert.deepEqual(expandDataResetTargets("supermarket", ["posCategories"]), [
      "posSales",
      "posProducts",
      "posCategories",
    ]);
    assert.deepEqual(expandDataResetTargets("supermarket", ["posProducts"]), [
      "posSales",
      "posProducts",
    ]);
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
        "posSettings",
      ]),
      ["posSales", "posProducts", "posCategories", "posSettings"],
    );
    assert.deepEqual(
      orderDataResetTargets("hr", [
        "hrOrg",
        "employees",
        "hrAttendance",
        "hrSchedules",
        "hrLeave",
      ]),
      ["hrAttendance", "hrLeave", "hrSchedules", "employees", "hrOrg"],
    );
  });

  it("keeps a Thai confirm phrase for destructive reset", () => {
    assert.equal(DATA_RESET_CONFIRM_PHRASE, "ล้างข้อมูล");
  });

  it("keeps service free of employee targets", () => {
    assert.deepEqual([...serviceResetTargets], [
      "bookings",
      "guests",
      "tourGroups",
    ]);
    assert.ok(!serviceResetTargets.includes("employees" as never));
    assert.ok(!serviceResetTargets.includes("hrAttendance" as never));
  });

  it("covers HR wipe targets including payroll schedules and settings", () => {
    assert.ok(hrResetTargets.includes("hrAttendance"));
    assert.ok(hrResetTargets.includes("hrSchedules"));
    assert.ok(hrResetTargets.includes("hrPayroll"));
    assert.ok(hrResetTargets.includes("hrPinSettings"));
    assert.ok(hrResetTargets.includes("employees"));
    assert.ok(hrResetTargets.includes("hrOrg"));
  });

  it("places employees before org wipe and after dependent HR data", () => {
    assert.deepEqual(
      orderDataResetTargets("hr", [
        "hrOrg",
        "employees",
        "hrPayroll",
        "hrAttendance",
      ]),
      ["hrAttendance", "hrPayroll", "employees", "hrOrg"],
    );
  });

  it("orders attendance and schedules before employees so independent commits can stick", () => {
    const ordered = orderDataResetTargets("hr", [
      "employees",
      "hrAttendance",
      "hrSchedules",
    ]);
    assert.ok(ordered.indexOf("hrAttendance") < ordered.indexOf("employees"));
    assert.ok(ordered.indexOf("hrSchedules") < ordered.indexOf("employees"));
  });
});
