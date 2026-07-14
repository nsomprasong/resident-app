import assert from "node:assert/strict";
import { describe, it } from "node:test";

import {
  filterHrNavItems,
  filterSelfNavItems,
  hrNavItems,
  selfNavItems,
} from "@/lib/hr/nav";

describe("hr nav", () => {
  it("lists four admin HR destinations", () => {
    assert.equal(hrNavItems.length, 4);
    assert.deepEqual(
      hrNavItems.map((item) => item.path),
      ["/hr", "/hr/employees", "/hr/schedules", "/hr/time-pay"],
    );
  });

  it("filters menu items by permission codes", () => {
    const visible = filterHrNavItems([
      "hr.employee.view",
      "hr.schedule.manage",
    ]);
    assert.deepEqual(
      visible.map((item) => item.path),
      ["/hr", "/hr/employees", "/hr/schedules"],
    );
  });

  it("lists a single self-service destination", () => {
    assert.equal(selfNavItems.length, 1);
    assert.equal(selfNavItems[0]?.path, "/my-work");
  });

  it("filters self nav items by hr.attendance.self", () => {
    assert.deepEqual(
      filterSelfNavItems(["hr.attendance.self"]).map((item) => item.path),
      ["/my-work"],
    );
    assert.deepEqual(filterSelfNavItems(["hr.leave.self"]), []);
  });
});
