import assert from "node:assert/strict";
import { describe, it } from "node:test";

import {
  buildEmployeeDisplayName,
  isLoginEligibleStatus,
  parseHrEmployeeInput,
} from "@/lib/hr/employees";

describe("hr employees validation", () => {
  it("requires first name and employment type on create", () => {
    const result = parseHrEmployeeInput({}, "create");
    assert.equal(result.ok, false);
  });

  it("parses daily employee create payload", () => {
    const result = parseHrEmployeeInput(
      {
        firstName: "สมชาย",
        lastName: "ใจดี",
        employmentType: "DAILY",
        email: "somchai@example.com",
      },
      "create",
    );
    assert.equal(result.ok, true);
    if (!result.ok) return;
    assert.equal(result.data.firstName, "สมชาย");
    assert.equal(result.data.employmentType, "DAILY");
    assert.equal(result.data.hrStatus, "ACTIVE");
  });

  it("builds display name and login eligibility", () => {
    assert.equal(buildEmployeeDisplayName("สมชาย", "ใจดี"), "สมชาย ใจดี");
    assert.equal(isLoginEligibleStatus("ACTIVE"), true);
    assert.equal(isLoginEligibleStatus("ARCHIVED"), false);
  });
});
