import assert from "node:assert/strict";
import { describe, it } from "node:test";

import { filterHrNavItems, hrNavItems } from "@/lib/hr/nav";

describe("hr nav", () => {
  it("lists nine HR destinations", () => {
    assert.equal(hrNavItems.length, 9);
    assert.equal(hrNavItems[0]?.path, "/hr");
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
});
