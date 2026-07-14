import assert from "node:assert/strict";
import test from "node:test";

import { parsePromptPayAccountInput } from "../../lib/settings/promptpay-accounts";

test("parsePromptPayAccountInput requires create fields", () => {
  const result = parsePromptPayAccountInput({}, "create");
  assert.equal(result.ok, false);
});

test("parsePromptPayAccountInput accepts phone account", () => {
  const result = parsePromptPayAccountInput(
    {
      displayName: "หน้าร้าน",
      idType: "PHONE",
      identifier: "081-234-5678",
      accountName: "บริษัท ทดสอบ",
      isPrimary: true,
    },
    "create",
  );
  assert.equal(result.ok, true);
  if (result.ok) {
    assert.equal(result.data.identifier, "0812345678");
    assert.equal(result.data.isPrimary, true);
  }
});
