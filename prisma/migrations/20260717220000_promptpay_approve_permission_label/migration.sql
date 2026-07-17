-- Clarify PromptPay approve permission labels in the catalog

INSERT INTO "permissions" ("id", "code", "description", "created_at", "updated_at")
VALUES
  (gen_random_uuid(), 'payment.verify', 'อนุมัติ PromptPay', CURRENT_TIMESTAMP, CURRENT_TIMESTAMP),
  (gen_random_uuid(), 'payment.create', 'สร้าง QR รับชำระ PromptPay', CURRENT_TIMESTAMP, CURRENT_TIMESTAMP),
  (gen_random_uuid(), 'payment.submit', 'ส่งสลิป PromptPay', CURRENT_TIMESTAMP, CURRENT_TIMESTAMP),
  (gen_random_uuid(), 'payment.cancel', 'ยกเลิกรายการ PromptPay', CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)
ON CONFLICT ("code") DO UPDATE
SET
  "description" = EXCLUDED."description",
  "updated_at" = CURRENT_TIMESTAMP;
