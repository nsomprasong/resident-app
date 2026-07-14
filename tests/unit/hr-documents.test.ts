import assert from "node:assert/strict";
import { describe, it } from "node:test";

import {
  classifyDocumentExpiry,
  extensionForDocumentMime,
  isAllowedEmployeeDocumentType,
  isEmployeeDocumentType,
  sanitizeOriginalFileName,
} from "@/lib/hr/documents";

describe("hr documents", () => {
  it("validates mime and document types", () => {
    assert.equal(isAllowedEmployeeDocumentType("application/pdf"), true);
    assert.equal(isAllowedEmployeeDocumentType("text/plain"), false);
    assert.equal(isEmployeeDocumentType("CONTRACT"), true);
    assert.equal(isEmployeeDocumentType("UNKNOWN"), false);
    assert.equal(extensionForDocumentMime("image/png"), "png");
  });

  it("classifies expiry status", () => {
    const now = new Date("2026-07-13T00:00:00.000Z");
    assert.equal(classifyDocumentExpiry(null, { now }), "NONE");
    assert.equal(
      classifyDocumentExpiry(new Date("2026-07-01T00:00:00.000Z"), { now }),
      "EXPIRED",
    );
    assert.equal(
      classifyDocumentExpiry(new Date("2026-07-20T00:00:00.000Z"), {
        now,
        warningDays: 30,
      }),
      "EXPIRING_SOON",
    );
    assert.equal(
      classifyDocumentExpiry(new Date("2026-12-01T00:00:00.000Z"), {
        now,
        warningDays: 30,
      }),
      "OK",
    );
  });

  it("sanitizes file names", () => {
    assert.equal(
      sanitizeOriginalFileName("../../สัญญา<>.pdf"),
      "สัญญา_.pdf",
    );
  });
});
