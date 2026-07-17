import assert from "node:assert/strict";
import { describe, it } from "node:test";

import {
  buildEmployeeDisplayName,
  displayEmployeeName,
  isLoginEligibleStatus,
  parseHrEmployeeInput,
} from "@/lib/hr/employees";

describe("hr employees validation", () => {
  it("requires first name, username and phone on create (no password)", () => {
    const result = parseHrEmployeeInput({}, "create");
    assert.equal(result.ok, false);
    if (!result.ok) {
      assert.ok(result.issues.some((issue) => issue.path === "firstName"));
      assert.ok(result.issues.some((issue) => issue.path === "username"));
      assert.ok(result.issues.some((issue) => issue.path === "phone"));
      assert.equal(
        result.issues.some((issue) => issue.path === "password"),
        false,
      );
    }
  });

  it("parses phone-auth create payload without email or password", () => {
    const result = parseHrEmployeeInput(
      {
        firstName: "สมชาย",
        lastName: "ใจดี",
        employmentType: "DAILY",
        username: "SomChai.W",
        phone: "0812345678",
      },
      "create",
    );
    assert.equal(result.ok, true);
    if (!result.ok) return;
    assert.equal(result.data.firstName, "สมชาย");
    assert.equal(result.data.employmentType, "DAILY");
    assert.equal(result.data.hrStatus, "ACTIVE");
    assert.equal(result.data.username, "somchai.w");
    assert.equal(result.data.phone, "+66812345678");
    assert.equal(result.data.email, null);
    assert.equal(result.data.password, undefined);
  });

  it("allows optional email as contact only", () => {
    const result = parseHrEmployeeInput(
      {
        firstName: "สมชาย",
        lastName: "ใจดี",
        employmentType: "MONTHLY",
        username: "somchai",
        phone: "0812345678",
        email: "contact@example.com",
      },
      "create",
    );
    assert.equal(result.ok, true);
    if (!result.ok) return;
    assert.equal(result.data.email, "contact@example.com");
  });

  it("builds display name and login eligibility", () => {
    assert.equal(buildEmployeeDisplayName("สมชาย", "ใจดี"), "สมชาย ใจดี");
    assert.equal(isLoginEligibleStatus("ACTIVE"), true);
    assert.equal(isLoginEligibleStatus("ARCHIVED"), false);
  });

  it("saves default shift template id or clears to ไม่กำหนด", () => {
    const clearDefault = parseHrEmployeeInput(
      {
        firstName: "A",
        lastName: "B",
        employmentType: "MONTHLY",
        hrStatus: "ACTIVE",
        defaultShiftTemplateId: "",
      },
      "update",
    );
    assert.equal(clearDefault.ok, true);
    if (clearDefault.ok) {
      assert.equal(clearDefault.data.defaultShiftTemplateId, null);
    }

    const setDefault = parseHrEmployeeInput(
      {
        firstName: "A",
        lastName: "B",
        employmentType: "MONTHLY",
        hrStatus: "ACTIVE",
        defaultShiftTemplateId: "11111111-1111-4111-8111-111111111111",
      },
      "update",
    );
    assert.equal(setDefault.ok, true);
    if (setDefault.ok) {
      assert.equal(
        setDefault.data.defaultShiftTemplateId,
        "11111111-1111-4111-8111-111111111111",
      );
    }
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
