import assert from "node:assert/strict";
import { describe, it } from "node:test";

import {
  buildEmployeeDisplayName,
  displayEmployeeName,
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

  it("prefers personal name over email-shaped name values", () => {
    assert.equal(
      displayEmployeeName({
        name: "legacy@example.com",
        firstName: "สมหญิง",
        lastName: "ใจงาม",
        email: "legacy@example.com",
      }),
      "สมหญิง ใจงาม",
    );
    assert.equal(
      displayEmployeeName({
        name: "legacy@example.com",
        email: "legacy@example.com",
        employeeCode: "EMP-0007",
      }),
      "EMP-0007",
    );
    assert.equal(
      displayEmployeeName({
        name: "สมชาย",
        email: "somchai@example.com",
      }),
      "สมชาย",
    );
    assert.equal(
      displayEmployeeName({
        name: "Narongsak Somprasong",
        firstName: "nsomprasong@gmail.com",
        lastName: "Narongsak",
        email: "nsomprasong@gmail.com",
        employeeCode: "EMP-0001",
      }),
      "Narongsak Somprasong",
    );
  });
});
