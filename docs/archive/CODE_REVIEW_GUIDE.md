# Code Review Guide

## Checklist

- [ ] ตรง requirement และไม่มี scope creep
- [ ] Naming สื่อ domain และไม่มี typo/public rename ที่ไม่แจ้ง
- [ ] ไม่มี `any`, unsafe cast, hard-code, duplicate logic
- [ ] Validation ฝั่ง server ครบและ error contract สม่ำเสมอ
- [ ] Authentication/Authorization/ownership ถูกบังคับ
- [ ] Transaction, concurrency และ idempotency เหมาะสม
- [ ] Query ไม่ over-fetch/N+1 และมี index/pagination เมื่อจำเป็น
- [ ] Component ขนาดเหมาะสม, state/effect ถูกต้อง, UX error/loading ครบ
- [ ] Accessibility: semantic, keyboard, focus, label, contrast
- [ ] Secret/PII ไม่หลุดใน code/log/docs
- [ ] Tests พิสูจน์ behavior และ regression
- [ ] Migration forward-safe และมี deployment/rollback note
- [ ] Documentation, CHANGELOG, TODO อัปเดต

## Review Style

แยก blocker, required, suggestion และ question. อ้างบรรทัด/behavior พร้อมเหตุผล; หลีกเลี่ยง preference ที่ไม่มีมาตรฐานรองรับ. ผู้เขียนต้องตอบ unresolved risk ก่อน merge.
