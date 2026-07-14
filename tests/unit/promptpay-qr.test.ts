import assert from "node:assert/strict";
import test from "node:test";

import {
  buildPromptPayPayload,
  extractCrcFromPayload,
  formatPromptPayAmount,
} from "../../lib/payments/promptpay-qr";
import {
  isValidPromptPayIdentifier,
  maskPromptPayIdentifier,
  normalizePromptPayIdentifier,
  toPromptPayTarget,
} from "../../lib/settings/promptpay-accounts";

test("normalize and validate phone identifiers", () => {
  assert.equal(normalizePromptPayIdentifier("081-234-5678"), "0812345678");
  assert.equal(isValidPromptPayIdentifier("0812345678", "PHONE"), true);
  assert.equal(isValidPromptPayIdentifier("123", "PHONE"), false);
  assert.equal(toPromptPayTarget("0812345678", "PHONE"), "66812345678");
});

test("mask phone identifier", () => {
  assert.equal(maskPromptPayIdentifier("0812345678", "PHONE"), "081-XXX-5678");
});

test("format amount to two decimals", () => {
  assert.equal(formatPromptPayAmount(100), "100.00");
  assert.equal(formatPromptPayAmount(99.9), "99.90");
  assert.throws(() => formatPromptPayAmount(0));
});

test("payload includes THB currency, amount and CRC", () => {
  const payload = buildPromptPayPayload({
    identifier: "0812345678",
    idType: "PHONE",
    amount: 12.34,
  });
  assert.match(payload, /^000201/);
  assert.match(payload, /5303764/);
  assert.match(payload, /540512\.34/);
  assert.match(payload, /5802TH/);
  const crc = extractCrcFromPayload(payload);
  assert.ok(crc);
  assert.equal(crc?.length, 4);
});

test("national id identifier validates 13 digits", () => {
  assert.equal(
    isValidPromptPayIdentifier("1234567890123", "NATIONAL_ID_OR_TAX_ID"),
    true,
  );
  const payload = buildPromptPayPayload({
    identifier: "1234567890123",
    idType: "NATIONAL_ID_OR_TAX_ID",
    amount: 1,
  });
  assert.ok(extractCrcFromPayload(payload));
});
